/**
 * Kill-switch DTO for request validation.
 */
import { z } from "zod";

/**
 * Zod schema for kill-switch request validation.
 */
export const KillSwitchDto = z.object({
	enabled: z.boolean().optional(),
	status: z.number().optional(),
	headers: z.record(z.string()).optional(),
	body: z.string().optional(),
});

export type KillSwitchDto = z.infer<typeof KillSwitchDto>;
