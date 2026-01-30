/**
 * Delay state management with Deno KV persistence.
 */
import { Result } from "typescript-result";
import { getKv } from "../singleton/kv.ts";

const DELAY_KEY = ["delay"];

/**
 * Load delay state from Deno KV.
 */
export async function loadDelayState(defaultDelay: number): Promise<Result<number, Error>> {
	const kv = await getKv();
	const entryResult = await Result.try(() => kv.get<number>(DELAY_KEY));

	if (entryResult.error) {
		return Result.error(entryResult.error);
	}

	return Result.ok(entryResult.value?.value ?? defaultDelay);
}

/**
 * Save delay state to Deno KV.
 */
export async function saveDelayState(delay: number): Promise<Result<void, Error>> {
	const kv = await getKv();
	const result = await Result.try(() => kv.set(DELAY_KEY, delay));

	if (result.error) {
		return Result.error(result.error);
	}

	return Result.ok(undefined);
}
