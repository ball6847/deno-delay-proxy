import { DelayHandler, KillSwitchHandler, NotFoundHandler, ProxyHandler } from "./src/handlers/index.ts";
import { logger } from "./src/logger.ts";
import { DelayRepository } from "./src/repository/delay.ts";
import { KillSwitchRepository } from "./src/repository/kill-switch.ts";

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

// Load initial state for logging purposes
const [killSwitchResult, delayResult] = await Promise.all([
	killSwitchRepository.load(),
	delayRepository.load(0),
]);

const initialKillSwitch = killSwitchResult.value ?? { enabled: false, status: 503, headers: {}, body: "" };
const initialDelay = delayResult.value ?? 0;

console.log(`Starting proxy server`);
console.log(`Upstream: ${UPSTREAM}`);
console.log(`Initial delay: ${initialDelay}ms`);
console.log(`Initial kill-switch: ${initialKillSwitch.enabled ? "enabled" : "disabled"}`);

// Create handlers with dependency injection
const killSwitchHandler = new KillSwitchHandler(killSwitchRepository, logger);
const delayHandler = new DelayHandler(delayRepository, logger);
const proxyHandler = new ProxyHandler(
	UPSTREAM,
	killSwitchRepository,
	delayRepository,
	logger,
);
const notFoundHandler = new NotFoundHandler();

/**
 * Pure handler function - takes Request, returns Response.
 * This function is testable by passing Request objects and asserting Response.
 */
export async function handleRequest(req: Request): Promise<Response> {
	const url = new URL(req.url);

	// Try kill-switch handler
	const killSwitchResponse = await killSwitchHandler.handle(req, url);
	if (killSwitchResponse) {
		return killSwitchResponse;
	}

	// Try delay handler
	const delayResponse = await delayHandler.handle(req, url);
	if (delayResponse) {
		return delayResponse;
	}

	// Try proxy handler
	const proxyResponse = await proxyHandler.handle(req, url);
	if (proxyResponse) {
		return proxyResponse;
	}

	// Return 404 for unmatched routes
	return notFoundHandler.handle(req, url);
}

// Deno.serve is just a thin wrapper around our pure handler function
Deno.serve((req: Request) => handleRequest(req));
