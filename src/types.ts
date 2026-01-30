/**
 * Data schemas for the delay proxy application.
 */

/**
 * Kill-switch configuration persisted in Deno KV.
 */
export type KillSwitch = {
	enabled: boolean;
	status: number;
	headers: Record<string, string>;
	body: string;
};

/**
 * Default kill-switch values used when no persisted data exists.
 */
export const DEFAULT_KILL_SWITCH: KillSwitch = {
	enabled: false,
	status: 200,
	headers: { "content-type": "application/json" },
	body: '{"message": "blocked by kill-switch"}',
};
