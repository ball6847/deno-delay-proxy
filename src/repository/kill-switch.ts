/**
 * Kill-switch repository for Deno KV persistence.
 */
import { Result } from "typescript-result";
import type { KillSwitch } from "../types.ts";
import { DEFAULT_KILL_SWITCH } from "../types.ts";

const KILL_SWITCH_KEY = ["kill-switch"];

export class KillSwitchRepository {
	constructor(private readonly kv: Deno.Kv) {}

	async load(): Promise<Result<KillSwitch, Error>> {
		const entryResult = await Result.try(() => this.kv.get<KillSwitch>(KILL_SWITCH_KEY));

		if (entryResult.error) {
			return Result.error(entryResult.error);
		}

		return Result.ok(entryResult.value?.value ?? DEFAULT_KILL_SWITCH);
	}

	async save(data: KillSwitch): Promise<Result<void, Error>> {
		const result = await Result.try(() => this.kv.set(KILL_SWITCH_KEY, data));

		if (result.error) {
			return Result.error(result.error);
		}

		return Result.ok(undefined);
	}
}
