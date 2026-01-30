/**
 * Delay HTTP handler.
 */
import { Result } from "typescript-result";
import { DelayDto } from "../dto/delay.ts";
import { type Logger } from "../logger.ts";
import type { DelayRepository } from "../repository/delay.ts";

export class DelayHandler {
	constructor(
		private readonly repository: DelayRepository,
		private readonly logger: Logger,
	) {}

	async handle(req: Request, url: URL): Promise<Response | null> {
		const pathname = url.pathname;

		// POST /api/delay - Update delay
		if (pathname === "/api/delay" && req.method === "POST") {
			return await this.handlePost(req);
		}

		// GET /api/delay - Get current delay
		if (pathname === "/api/delay" && req.method === "GET") {
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

		const currentState = await this.repository.load(0);
		const delay = validationResult.data.delay ?? currentState.value ?? 0;

		const saveResult = await this.repository.save(delay);
		saveResult.fold(
			() => {
				this.logger.log("info", {
					event: "delay-updated",
					delay,
				});
			},
			(e: Error) => {
				this.logger.log("error", {
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

	private async handleGet(): Promise<Response> {
		const result = await this.repository.load(0);

		return result.fold(
			(delay: number) =>
				new Response(JSON.stringify({ delay }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			() =>
				new Response(JSON.stringify({ error: "Failed to load delay" }), {
					status: 500,
					headers: { "content-type": "application/json" },
				}),
		);
	}
}
