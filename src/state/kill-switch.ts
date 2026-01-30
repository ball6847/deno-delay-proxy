/**
 * Kill-switch state management with Deno KV persistence.
 */
import { Result } from "typescript-result";
import type { KillSwitchState } from "./types.ts";
import { DEFAULT_KILL_SWITCH_STATE } from "./types.ts";

const KILL_SWITCH_KEY = ["kill-switch"];

export class KillSwitchEntity {
	constructor(private readonly kv: Deno.Kv) {}

	async load(): Promise<Result<KillSwitchState, Error>> {
		const entryResult = await Result.try(() => this.kv.get<KillSwitchState>(KILL_SWITCH_KEY));

		if (entryResult.error) {
			return Result.error(entryResult.error);
		}

		return Result.ok(entryResult.value?.value ?? DEFAULT_KILL_SWITCH_STATE);
	}

	async save(state: KillSwitchState): Promise<Result<void, Error>> {
		const result = await Result.try(() => this.kv.set(KILL_SWITCH_KEY, state));

		if (result.error) {
			return Result.error(result.error);
		}

		return Result.ok(undefined);
	}
}
