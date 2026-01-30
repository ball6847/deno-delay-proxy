/**
 * Kill-switch HTTP handler.
 */
import { Result } from "typescript-result";
import { KillSwitchDto } from "../dto/kill-switch.ts";
import { type Logger } from "../logger.ts";
import type { KillSwitchRepository } from "../repository/kill-switch.ts";
import type { KillSwitch } from "../types.ts";

export class KillSwitchHandler {
	constructor(
		private readonly repository: KillSwitchRepository,
		private readonly logger: Logger,
	) {}

	async handle(req: Request, url: URL): Promise<Response | null> {
		const pathname = url.pathname;

		// POST /api/kill-switch - Update kill-switch state
		if (pathname === "/api/kill-switch" && req.method === "POST") {
			return await this.handlePost(req);
		}

		// GET /api/kill-switch - Get current state
		if (pathname === "/api/kill-switch" && req.method === "GET") {
			return await this.handleGet();
		}

		return null;
	}

	private async handlePost(req: Request): Promise<Response> {
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

		const currentState = await this.repository.load();

		const newState: KillSwitch = {
			enabled: enabled ?? currentState.value?.enabled ?? false,
			status: status ?? currentState.value?.status ?? 503,
			headers: headers ?? currentState.value?.headers ?? {},
			body: bodyText ?? currentState.value?.body ?? "",
		};

		const saveResult = await this.repository.save(newState);
		saveResult.fold(
			() => {
				this.logger.log("info", {
					event: "kill-switch-updated",
					enabled: newState.enabled,
					status: newState.status,
				});
			},
			(e: Error) => {
				this.logger.log("error", {
					event: "kill-switch-save-failed",
					error: e.message,
				});
			},
		);

		return new Response(JSON.stringify({ success: true, state: newState }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}

	private async handleGet(): Promise<Response> {
		const result = await this.repository.load();

		return result.fold(
			(data: KillSwitch) =>
				new Response(JSON.stringify(data), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			() =>
				new Response(JSON.stringify({ error: "Failed to load state" }), {
					status: 500,
					headers: { "content-type": "application/json" },
				}),
		);
	}
}
