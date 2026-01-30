/**
 * Data schemas for the delay proxy application.
 */
import { z } from "zod";

/**
 * Kill-switch configuration data persisted in Deno KV.
 */
export type KillSwitchData = {
	enabled: boolean;
	status: number;
	headers: Record<string, string>;
	body: string;
};

/**
 * Default kill-switch values used when no persisted data exists.
 */
export const DEFAULT_KILL_SWITCH: KillSwitchData = {
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