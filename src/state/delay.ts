/**
 * Delay state management with Deno KV persistence.
 */
import { Result } from "typescript-result";

const DELAY_KEY = ["delay"];

export class DelayEntity {
	constructor(private readonly kv: Deno.Kv) {}

	async load(defaultDelay: number): Promise<Result<number, Error>> {
		const entryResult = await Result.try(() => this.kv.get<number>(DELAY_KEY));

		if (entryResult.error) {
			return Result.error(entryResult.error);
		}

		return Result.ok(entryResult.value?.value ?? defaultDelay);
	}

	async save(delay: number): Promise<Result<void, Error>> {
		const result = await Result.try(() => this.kv.set(DELAY_KEY, delay));

		if (result.error) {
			return Result.error(result.error);
		}

		return Result.ok(undefined);
	}
}
