import { Result } from "typescript-result";
import { z } from "zod";

const UPSTREAM = Deno.env.get("UPSTREAM");

if (!UPSTREAM) {
	console.error("UPSTREAM environment variable is required");
	Deno.exit(1);
}

// Deno KV for persistent state
const kv = await Deno.openKv();

// Kill-switch state (persisted in KV)
type KillSwitchState = {
	enabled: boolean;
	status: number;
	headers: Record<string, string>;
	body: string;
};

const KILL_SWITCH_KEY = ["kill-switch"];

// Default kill-switch state
const defaultKillSwitchState: KillSwitchState = {
	enabled: false,
	status: 200,
	headers: { "content-type": "application/json" },
	body: '{"message": "blocked by kill-switch"}',
};

let killSwitchState: KillSwitchState = defaultKillSwitchState;

// Load kill-switch state from KV on startup
async function loadKillSwitchState(): Promise<Result<KillSwitchState, Error>> {
	const entryResult = await Result.try(() => kv.get<KillSwitchState>(KILL_SWITCH_KEY));

	if (entryResult.error) {
		return Result.error(entryResult.error);
	}

	return Result.ok(entryResult.value?.value ?? defaultKillSwitchState);
}

// Save kill-switch state to KV
async function saveKillSwitchState(state: KillSwitchState): Promise<Result<void, Error>> {
	const result = await Result.try(() => kv.set(KILL_SWITCH_KEY, state));

	if (result.error) {
		return Result.error(result.error);
	}

	return Result.ok(undefined);
}

// Delay state (persisted in KV)
const DELAY_KEY = ["delay"];

// Default delay from environment
let delayMs: number = parseInt(Deno.env.get("DELAY") || "0", 10);

// Load delay state from KV on startup
async function loadDelayState(): Promise<Result<number, Error>> {
	const entryResult = await Result.try(() => kv.get<number>(DELAY_KEY));

	if (entryResult.error) {
		return Result.error(entryResult.error);
	}

	return Result.ok(entryResult.value?.value ?? delayMs);
}

// Save delay state to KV
async function saveDelayState(delay: number): Promise<Result<void, Error>> {
	const result = await Result.try(() => kv.set(DELAY_KEY, delay));

	if (result.error) {
		return Result.error(result.error);
	}

	return Result.ok(undefined);
}

// JSON structured logger
function logJson(level: string, data: Record<string, unknown>): void {
	const logEntry = {
		timestamp: new Date().toISOString(),
		level,
		...data,
	};
	console.log(JSON.stringify(logEntry));
}

// Request logger
function logRequest(req: Request, targetUrl: URL): void {
	logJson("info", {
		event: "request",
		method: req.method,
		url: req.url,
		targetUrl: targetUrl.toString(),
		userAgent: req.headers.get("user-agent") || "unknown",
	});
}

// Response logger
function logResponse(targetUrl: URL, status: number, durationMs: number, killed: boolean): void {
	logJson("info", {
		event: "response",
		targetUrl: targetUrl.toString(),
		status,
		durationMs,
		killed,
	});
}

// Zod schemas for request validation
const KillSwitchSchema = z.object({
	enabled: z.boolean().optional(),
	status: z.number().optional(),
	headers: z.record(z.string()).optional(),
	body: z.string().optional(),
});

const DelaySchema = z.object({
	delay: z.number().min(0).optional(),
});

// Load initial state
const [killSwitchResult, delayResult] = await Promise.all([
	loadKillSwitchState(),
	loadDelayState(),
]);

killSwitchResult.fold(
	(state: KillSwitchState) => {
		killSwitchState = state;
	},
	() => {
		killSwitchState = defaultKillSwitchState;
	},
);

delayResult.fold(
	(delay: number) => {
		delayMs = delay;
	},
	() => {
		// keep default delayMs
	},
);

console.log(`Starting proxy server`);
console.log(`Upstream: ${UPSTREAM}`);
console.log(`Delay: ${delayMs}ms`);

Deno.serve(async (req: Request) => {
	const url = new URL(req.url);

	// API endpoints
	if (url.pathname === "/api/kill-switch" && req.method === "POST") {
		// Parse JSON using Result pattern
		let body: unknown;
		const bodyResult = await Result.try(async () => {
			body = await req.json();
			return body;
		});

		if (bodyResult.error) {
			return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
				status: 400,
				headers: { "content-type": "application/json" },
			});
		}

		const bodyObj = body as Record<string, unknown>;

		// Use Zod for type-safe field validation
		const validationResult = KillSwitchSchema.safeParse(bodyObj);

		if (!validationResult.success) {
			return new Response(
				JSON.stringify({
					error: "Invalid request body",
					details: validationResult.error.errors,
				}),
				{
					status: 400,
					headers: { "content-type": "application/json" },
				},
			);
		}

		const { enabled, status, headers, body: bodyText } = validationResult.data;

		killSwitchState = {
			enabled: enabled ?? killSwitchState.enabled,
			status: status ?? killSwitchState.status,
			headers: headers ?? killSwitchState.headers,
			body: bodyText ?? killSwitchState.body,
		};

		const saveResult = await saveKillSwitchState(killSwitchState);
		saveResult.fold(
			() => {
				logJson("info", {
					event: "kill-switch-updated",
					enabled: killSwitchState.enabled,
					status: killSwitchState.status,
				});
			},
			(e: Error) => {
				logJson("error", {
					event: "kill-switch-save-failed",
					error: e.message,
				});
			},
		);

		return new Response(JSON.stringify({ success: true, state: killSwitchState }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}

	if (url.pathname === "/api/kill-switch" && req.method === "GET") {
		return new Response(JSON.stringify(killSwitchState), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}

	if (url.pathname === "/api/delay" && req.method === "POST") {
		// Parse JSON using Result pattern
		let body: unknown;
		const bodyResult = await Result.try(async () => {
			body = await req.json();
			return body;
		});

		if (bodyResult.error) {
			return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
				status: 400,
				headers: { "content-type": "application/json" },
			});
		}

		const bodyObj = body as Record<string, unknown>;

		// Use Zod for type-safe field validation
		const validationResult = DelaySchema.safeParse(bodyObj);

		if (!validationResult.success) {
			return new Response(
				JSON.stringify({
					error: "Invalid request body",
					details: validationResult.error.errors,
				}),
				{
					status: 400,
					headers: { "content-type": "application/json" },
				},
			);
		}

		const delay = validationResult.data.delay ?? delayMs;

		const saveResult = await saveDelayState(delay);
		saveResult.fold(
			() => {
				logJson("info", {
					event: "delay-updated",
					delay,
				});
			},
			(e: Error) => {
				logJson("error", {
					event: "delay-save-failed",
					error: e.message,
				});
			},
		);

		return new Response(JSON.stringify({ success: true, delay }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}

	if (url.pathname === "/api/delay" && req.method === "GET") {
		return new Response(JSON.stringify({ delay: delayMs }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}

	// Proxy endpoint - requires /proxy/ prefix
	if (!url.pathname.startsWith("/proxy/")) {
		return new Response(JSON.stringify({ error: "Not found" }), {
			status: 404,
			headers: { "content-type": "application/json" },
		});
	}

	// Strip /proxy prefix and forward to upstream
	const targetPath = url.pathname.replace(/^\/proxy/, "");
	const targetUrl = new URL(targetPath + url.search, UPSTREAM);

	logRequest(req, targetUrl);

	const startTime = Date.now();

	// Apply delay if kill-switch is not enabled
	if (!killSwitchState.enabled) {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	// Check kill-switch after delay
	if (killSwitchState.enabled) {
		const durationMs = Date.now() - startTime;
		logResponse(targetUrl, killSwitchState.status, durationMs, true);

		return new Response(killSwitchState.body, {
			status: killSwitchState.status,
			headers: killSwitchState.headers,
		});
	}

	const response = await fetch(targetUrl, {
		method: req.method,
		headers: req.headers,
		body: req.body,
	});

	const durationMs = Date.now() - startTime;
	logResponse(targetUrl, response.status, durationMs, false);

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
});
