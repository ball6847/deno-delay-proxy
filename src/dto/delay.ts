/**
 * Delay DTO for request validation.
 */
import { z } from "zod";

/**
 * Zod schema for delay request validation.
 */
export const DelayDto = z.object({
	delay: z.number().min(0).optional(),
});

export type DelayDto = z.infer<typeof DelayDto>;
