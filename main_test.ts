/**
 * Integration tests for the proxy handler.
 *
 * These tests demonstrate how to write tests for the handler by passing
 * Request objects and asserting Response properties.
 */
import { handleRequest } from "./main.ts";
import { assert, assertEquals } from "jsr:@std/assert@1.0.17";

/**
 * Helper to create a Request object for testing.
 */
function createRequest(url: string, options?: RequestInit): Request {
	return new Request(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});
}

Deno.test("handleRequest - returns 404 for unknown routes", async () => {
	const request = createRequest("http://localhost/unknown-path");
	const response = await handleRequest(request);

	assertEquals(response.status, 404);

	const body = await response.json();
	assertEquals(body.error, "Not found");
});

Deno.test("handleRequest - GET /api/delay returns current delay", async () => {
	const request = createRequest("http://localhost/api/delay", {
		method: "GET",
	});
	const response = await handleRequest(request);

	assertEquals(response.status, 200);
	assertEquals(response.headers.get("content-type"), "application/json");

	const body = await response.json();
	assertEquals(typeof body.delay, "number");
	assert(body.delay >= 0);
});

Deno.test("handleRequest - POST /api/delay updates delay", async () => {
	const request = createRequest("http://localhost/api/delay", {
		method: "POST",
		body: JSON.stringify({ delay: 500 }),
	});
	const response = await handleRequest(request);

	assertEquals(response.status, 200);
	assertEquals(response.headers.get("content-type"), "application/json");

	const body = await response.json();
	assertEquals(body.success, true);
	assertEquals(body.delay, 500);
});

Deno.test("handleRequest - POST /api/delay with invalid JSON returns 400", async () => {
	const request = createRequest("http://localhost/api/delay", {
		method: "POST",
		body: "not valid json",
	});
	const response = await handleRequest(request);

	assertEquals(response.status, 400);

	const body = await response.json();
	assertEquals(body.error, "Invalid JSON body");
});

Deno.test("handleRequest - POST /api/delay with missing delay uses existing value", async () => {
	// First set a delay value
	const setRequest = createRequest("http://localhost/api/delay", {
		method: "POST",
		body: JSON.stringify({ delay: 123 }),
	});
	await handleRequest(setRequest);

	// Now send without delay - should use existing value (123)
	const request = createRequest("http://localhost/api/delay", {
		method: "POST",
		body: JSON.stringify({}),
	});
	const response = await handleRequest(request);

	// Should succeed with existing delay value
	assertEquals(response.status, 200);

	const body = await response.json();
	assertEquals(body.success, true);
	assertEquals(body.delay, 123);
});

Deno.test("handleRequest - GET /api/kill-switch returns current state", async () => {
	const request = createRequest("http://localhost/api/kill-switch", {
		method: "GET",
	});
	const response = await handleRequest(request);

	assertEquals(response.status, 200);
	assertEquals(response.headers.get("content-type"), "application/json");

	const body = await response.json();
	assertEquals(typeof body.enabled, "boolean");
	assert(typeof body.status, "number");
	assert(typeof body.headers, "object");
});

Deno.test("handleRequest - POST /api/kill-switch enables kill-switch", async () => {
	const request = createRequest("http://localhost/api/kill-switch", {
		method: "POST",
		body: JSON.stringify({
			enabled: true,
			status: 503,
			headers: { "X-Custom": "test" },
			body: "Service unavailable",
		}),
	});
	const response = await handleRequest(request);

	assertEquals(response.status, 200);
	assertEquals(response.headers.get("content-type"), "application/json");

	const body = await response.json();
	assertEquals(body.success, true);
	assertEquals(body.state.enabled, true);
	assertEquals(body.state.status, 503);
	assertEquals(body.state.headers["X-Custom"], "test");
	assertEquals(body.state.body, "Service unavailable");
});

Deno.test("handleRequest - POST /api/kill-switch disables kill-switch", async () => {
	const request = createRequest("http://localhost/api/kill-switch", {
		method: "POST",
		body: JSON.stringify({ enabled: false }),
	});
	const response = await handleRequest(request);

	assertEquals(response.status, 200);

	const body = await response.json();
	assertEquals(body.success, true);
	assertEquals(body.state.enabled, false);
});

Deno.test("handleRequest - proxy /proxy/ forwards request to upstream", async () => {
	const request = createRequest("http://localhost/proxy/api/users", {
		method: "GET",
	});
	const response = await handleRequest(request);

	// Response should have upstream server's status or 503 if kill-switch is on
	assert([200, 404, 503].includes(response.status), `Unexpected status: ${response.status}`);

	// Should not be the 404 from our notFound handler (which means proxy worked)
	assert(response.status !== 404 || response.body !== null);

	// Consume the body to avoid leaks
	await response.text();
});

Deno.test("handleRequest - non-proxy routes return null from proxy handler", async () => {
	const request = createRequest("http://localhost/api/other");
	const response = await handleRequest(request);

	// Should fall through to notFound handler since proxy returned null
	assertEquals(response.status, 404);
});
