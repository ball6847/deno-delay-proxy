import { DelayHandler, KillSwitchHandler, NotFoundHandler, ProxyHandler, SwaggerHandler, SwaggerUiHandler } from "./src/handlers/index.ts";
import { logger } from "./src/logger.ts";
import { DelayRepository } from "./src/repository/delay.ts";
import { KillSwitchRepository } from "./src/repository/kill-switch.ts";

const UPSTREAM = Deno.env.get("UPSTREAM");

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
const swaggerHandler = new SwaggerHandler();
const swaggerUiHandler = new SwaggerUiHandler();

/**
 * Pure handler function - takes Request, returns Response.
 * This function is testable by passing Request objects and asserting Response.
 */
export async function handleRequest(req: Request): Promise<Response> {
	const url = new URL(req.url);

	// Try Swagger JSON handler
	const swaggerResponse = await swaggerHandler.handle(req, url);
	if (swaggerResponse) {
		return swaggerResponse;
	}

	// Try Swagger UI handler
	const swaggerUiResponse = await swaggerUiHandler.handle(req, url);
	if (swaggerUiResponse) {
		return swaggerUiResponse;
	}

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

const PORT = Number(Deno.env.get("PORT")) || 8000;

// Deno.serve is just a thin wrapper around our pure handler function
Deno.serve({port: PORT}, (req: Request) => handleRequest(req));
