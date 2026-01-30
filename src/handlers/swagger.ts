/**
 * Swagger JSON handler.
 */

const SWAGGER_JSON_PATH = new URL("../docs/swagger.json", import.meta.url);

/**
 * Extract the server URL from the request.
 */
function getServerUrl(req: Request, url: URL): string {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
    const protocol = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
    return `${protocol}://${host}`;
}

/**
 * Handler for serving the Swagger OpenAPI JSON specification.
 */
export class SwaggerHandler {
    /**
     * Serve the Swagger JSON spec at /swagger/json endpoint.
     * The servers array is dynamically generated from the request URL.
     * Returns null if the pathname doesn't match.
     */
    async handle(req: Request, url: URL): Promise<Response | null> {
        const pathname = url.pathname;

        // Only handle GET /swagger/json
        if (pathname !== "/swagger/json" || req.method !== "GET") {
            return null;
        }

        const specContent = await Deno.readTextFile(SWAGGER_JSON_PATH);
        const spec = JSON.parse(specContent);

        // Dynamically set the servers array based on the request URL
        const serverUrl = getServerUrl(req, url);
        spec.servers = [{ url: serverUrl }];

        return new Response(JSON.stringify(spec), {
            status: 200,
            headers: {
                "content-type": "application/json",
            },
        });
    }
}