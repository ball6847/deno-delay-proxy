/**
 * State management module - barrel file.
 */
export type { KillSwitchState } from "./types.ts";
export { DEFAULT_KILL_SWITCH_STATE, DelaySchema, KillSwitchSchema } from "./types.ts";

export { closeKv, getKv } from "../singleton/kv.ts";
export { loadKillSwitchState, saveKillSwitchState } from "./kill-switch.ts";
export { loadDelayState, saveDelayState } from "./delay.ts";
