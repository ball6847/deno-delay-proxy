/**
 * State management types for the delay proxy application.
 */
import { z } from "zod";

/**
 * Kill-switch configuration state persisted in Deno KV.
 */
export type KillSwitchState = {
	enabled: boolean;
	status: number;
	headers: Record<string, string>;
	body: string;
};

/**
 * Default kill-switch state used when no persisted state exists.
 */
export const DEFAULT_KILL_SWITCH_STATE: KillSwitchState = {
	enabled: false,
	status: 200,
	headers: { "content-type": "application/json" },
	body: '{"message": "blocked by kill-switch"}',
};

/**
 * Zod schema for kill-switch request validation.
 */
export const KillSwitchSchema = z.object({
	enabled: z.boolean().optional(),
	status: z.number().optional(),
	headers: z.record(z.string()).optional(),
	body: z.string().optional(),
});

/**
 * Zod schema for delay request validation.
 */
export const DelaySchema = z.object({
	delay: z.number().min(0).optional(),
});
