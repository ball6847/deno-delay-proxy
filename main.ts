import { Result } from "typescript-result";

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
	try {
		const res = await kv.get<KillSwitchState>(KILL_SWITCH_KEY);
		if (res.value) {
			return Result.ok(res.value);
		}
		return Result.ok(defaultKillSwitchState);
	} catch (e) {
		return Result.error(e as Error);
	}
}

// Save kill-switch state to KV
async function saveKillSwitchState(state: KillSwitchState): Promise<Result<void, Error>> {
	try {
		await kv.set(KILL_SWITCH_KEY, state);
		return Result.ok(undefined);
	} catch (e) {
		return Result.error(e as Error);
	}
}

// Delay state (persisted in KV)
const DELAY_KEY = ["delay"];

// Default delay from environment
let delayMs: number = parseInt(Deno.env.get("DELAY") || "0", 10);

// Load delay state from KV on startup
async function loadDelayState(): Promise<Result<number, Error>> {
	try {
		const res = await kv.get<number>(DELAY_KEY);
		if (res.value !== null && res.value !== undefined) {
			return Result.ok(res.value);
		}
		return Result.ok(delayMs);
	} catch (e) {
		return Result.error(e as Error);
	}
}

// Save delay state to KV
async function saveDelayState(delay: number): Promise<Result<void, Error>> {
	try {
		await kv.set(DELAY_KEY, delay);
		return Result.ok(undefined);
	} catch (e) {
		return Result.error(e as Error);
	}
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
function logResponse(
	targetUrl: URL,
	status: number,
	durationMs: number,
	killed: boolean,
): void {
	logJson("info", {
		event: "response",
		targetUrl: targetUrl.toString(),
		status,
		durationMs,
		killed,
	});
}

// Safe value extraction helper
function safeExtract<T>(
	value: unknown,
	errorMessage: string,
	predicate: (value: unknown) => value is T,
): Result<T, string> {
	if (predicate(value)) {
		return { isOk: () => true, isError: () => false, value: value } as Result<T, string>;
	}
	return { isOk: () => false, isError: () => true, error: errorMessage } as Result<T, string>;
}

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

		// Use safeExtract for type-safe field extraction
		const enabledResult = safeExtract<boolean>(
			bodyObj.enabled,
			"enabled must be a boolean",
			(v): v is boolean => typeof v === "boolean",
		);

		const statusResult = safeExtract<number>(
			bodyObj.status,
			"status must be a number",
			(v): v is number => typeof v === "number",
		);

		const headersResult = safeExtract<Record<string, string>>(
			bodyObj.headers,
			"headers must be a record of strings",
			(v): v is Record<string, string> => {
				if (typeof v !== "object" || v === null) return false;
				return Object.values(v).every((val) => typeof val === "string");
			},
		);

		const bodyTextResult = safeExtract<string>(
			bodyObj.body,
			"body must be a string",
			(v): v is string => typeof v === "string",
		);

		// Check if all results are OK
		if (enabledResult.error) {
			return new Response(JSON.stringify({ error: enabledResult.error }), {
				status: 400,
				headers: { "content-type": "application/json" },
			});
		}
		if (statusResult.error) {
			return new Response(JSON.stringify({ error: statusResult.error }), {
				status: 400,
				headers: { "content-type": "application/json" },
			});
		}
		if (headersResult.error) {
			return new Response(JSON.stringify({ error: headersResult.error }), {
				status: 400,
				headers: { "content-type": "application/json" },
			});
		}
		if (bodyTextResult.error) {
			return new Response(JSON.stringify({ error: bodyTextResult.error }), {
				status: 400,
				headers: { "content-type": "application/json" },
			});
		}

		const enabled = enabledResult.getOrNull() as boolean;
		const status = statusResult.getOrNull() as number;
		const headers = headersResult.getOrNull() as Record<string, string>;
		const bodyText = bodyTextResult.getOrNull() as string;

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

		const delayResult = safeExtract<number>(
			bodyObj.delay,
			"delay must be a non-negative number",
			(v): v is number => typeof v === "number" && v >= 0,
		);

		if (delayResult.error) {
			return new Response(JSON.stringify({ error: delayResult.error }), {
				status: 400,
				headers: { "content-type": "application/json" },
			});
		}

		const delay = delayResult.getOrNull() as number;
		delayMs = delay;

		const saveResult = await saveDelayState(delayMs);
		saveResult.fold(
			() => {
				logJson("info", {
					event: "delay-updated",
					delayMs,
				});
			},
			(e: Error) => {
				logJson("error", {
					event: "delay-save-failed",
					error: e.message,
				});
			},
		);

		return new Response(JSON.stringify({ success: true, delay: delayMs }), {
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
