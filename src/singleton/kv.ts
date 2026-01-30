/**
 * Deno KV singleton for persistent state management.
 */
let kvInstance: Deno.Kv | null = null;

/**
 * Initialize and get the singleton Deno KV instance.
 */
export async function getKv(): Promise<Deno.Kv> {
	if (!kvInstance) {
		kvInstance = await Deno.openKv();
	}
	return kvInstance;
}

/**
 * Close the KV connection (useful for testing).
 */
export function closeKv(): void {
	if (kvInstance) {
		kvInstance.close();
		kvInstance = null;
	}
}
