/**
 * Kill-switch state management with Deno KV persistence.
 */
import { Result } from "typescript-result";
import type { KillSwitchState } from "./types.ts";
import { DEFAULT_KILL_SWITCH_STATE } from "./types.ts";
import { getKv } from "../singleton/kv.ts";

const KILL_SWITCH_KEY = ["kill-switch"];

/**
 * Load kill-switch state from Deno KV.
 */
export async function loadKillSwitchState(): Promise<Result<KillSwitchState, Error>> {
	const kv = await getKv();
	const entryResult = await Result.try(() => kv.get<KillSwitchState>(KILL_SWITCH_KEY));

	if (entryResult.error) {
		return Result.error(entryResult.error);
	}

	return Result.ok(entryResult.value?.value ?? DEFAULT_KILL_SWITCH_STATE);
}

/**
 * Save kill-switch state to Deno KV.
 */
export async function saveKillSwitchState(state: KillSwitchState): Promise<Result<void, Error>> {
	const kv = await getKv();
	const result = await Result.try(() => kv.set(KILL_SWITCH_KEY, state));

	if (result.error) {
		return Result.error(result.error);
	}

	return Result.ok(undefined);
}
