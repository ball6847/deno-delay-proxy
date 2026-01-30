/**
 * Proxy HTTP handler.
 */
import { type Logger } from "../logger.ts";
import type { DelayRepository } from "../repository/delay.ts";
import type { KillSwitchRepository } from "../repository/kill-switch.ts";

export class ProxyHandler {
	constructor(
		private readonly upstream: string,
		private readonly killSwitchRepository: KillSwitchRepository,
		private readonly delayRepository: DelayRepository,
		private readonly logger: Logger,
	) {}

	async handle(req: Request, url: URL): Promise<Response | null> {
		const pathname = url.pathname;

		// Proxy endpoint - requires /proxy/ prefix
		if (!pathname.startsWith("/proxy/")) {
			return null;
		}

		return await this.handleProxy(req, url);
	}

	private async handleProxy(req: Request, url: URL): Promise<Response> {
		const [killSwitchResult, delayResult] = await Promise.all([
			this.killSwitchRepository.load(),
			this.delayRepository.load(0),
		]);

		const killSwitchData = killSwitchResult.value ?? {
			enabled: false,
			status: 503,
			headers: {},
			body: "",
		};
		const delayMs = delayResult.value ?? 0;

		// Strip /proxy prefix and forward to upstream
		const targetPath = url.pathname.replace(/^\/proxy/, "");
		const targetUrl = new URL(targetPath + url.search, this.upstream);

		this.logger.request(req, targetUrl);

		const startTime = Date.now();

		// Apply delay if kill-switch is not enabled
		if (!killSwitchData.enabled) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}

		// Check kill-switch after delay
		if (killSwitchData.enabled) {
			const durationMs = Date.now() - startTime;
			this.logger.response(targetUrl, killSwitchData.status, durationMs, true);

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
		this.logger.response(targetUrl, response.status, durationMs, false);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	}
}

/**
 * Not found handler for unmatched routes.
 */
export class NotFoundHandler {
	handle(_req: Request, _url: URL): Response {
		return new Response(JSON.stringify({ error: "Not found" }), {
			status: 404,
			headers: { "content-type": "application/json" },
		});
	}
}
