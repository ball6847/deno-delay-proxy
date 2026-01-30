import { Result } from "typescript-result";
import { DEFAULT_KILL_SWITCH, type KillSwitch } from "./src/types.ts";
import { KillSwitchRepository } from "./src/repository/kill-switch.ts";
import { DelayRepository } from "./src/repository/delay.ts";
import { KillSwitchDto } from "./src/dto/kill-switch.ts";
import { DelayDto } from "./src/dto/delay.ts";
import { logger } from "./src/logger.ts";

const UPSTREAM = Deno.env.get("UPSTREAM");

if (!UPSTREAM) {
	console.error("UPSTREAM environment variable is required");
	Deno.exit(1);
}

// Deno KV for persistent state
const kv = await Deno.openKv();

// Dependency injection - inject KV into repositories
const killSwitchRepository = new KillSwitchRepository(kv);
const delayRepository = new DelayRepository(kv);

let killSwitchData: KillSwitch = DEFAULT_KILL_SWITCH;

// Load initial state
const [killSwitchResult, delayResult] = await Promise.all([
	killSwitchRepository.load(),
	delayRepository.load(parseInt(Deno.env.get("DELAY") || "0", 10)),
]);

killSwitchResult.fold(
	(state: KillSwitch) => {
		killSwitchData = state;
	},
	() => {
		killSwitchData = DEFAULT_KILL_SWITCH;
	},
);

let delayMs: number = 0;

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
		const validationResult = KillSwitchDto.safeParse(bodyObj);

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

		killSwitchData = {
			enabled: enabled ?? killSwitchData.enabled,
			status: status ?? killSwitchData.status,
			headers: headers ?? killSwitchData.headers,
			body: bodyText ?? killSwitchData.body,
		};

		const saveResult = await killSwitchRepository.save(killSwitchData);
		saveResult.fold(
			() => {
				logger.log("info", {
					event: "kill-switch-updated",
					enabled: killSwitchData.enabled,
					status: killSwitchData.status,
				});
			},
			(e: Error) => {
				logger.log("error", {
					event: "kill-switch-save-failed",
					error: e.message,
				});
			},
		);

		return new Response(JSON.stringify({ success: true, state: killSwitchData }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}

	if (url.pathname === "/api/kill-switch" && req.method === "GET") {
		return new Response(JSON.stringify(killSwitchData), {
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
		const validationResult = DelayDto.safeParse(bodyObj);

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

		delayMs = delay;

		const saveResult = await delayRepository.save(delay);
		saveResult.fold(
			() => {
				logger.log("info", {
					event: "delay-updated",
					delay,
				});
			},
			(e: Error) => {
				logger.log("error", {
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

	logger.request(req, targetUrl);

	const startTime = Date.now();

	// Apply delay if kill-switch is not enabled
	if (!killSwitchData.enabled) {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	// Check kill-switch after delay
	if (killSwitchData.enabled) {
		const durationMs = Date.now() - startTime;
		logger.response(targetUrl, killSwitchData.status, durationMs, true);

		return new Response(killSwitchData.body, {
			status: killSwitchData.status,
			headers: killSwitchData.headers,
		});
	}

	const response = await fetch(targetUrl, {
		method: req.method,
		headers: req.headers,
		body: req.body,
	});

	const durationMs = Date.now() - startTime;
	logger.response(targetUrl, response.status, durationMs, false);

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
});
