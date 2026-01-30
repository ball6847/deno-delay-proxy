/**
 * State management module - barrel file.
 */
export type { KillSwitchState } from "./types.ts";
export { DEFAULT_KILL_SWITCH_STATE, DelaySchema, KillSwitchSchema } from "./types.ts";

export { KillSwitchEntity } from "./kill-switch.ts";
export { DelayEntity } from "./delay.ts";
