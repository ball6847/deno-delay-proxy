/**
 * Swagger UI handler.
 */

/**
 * Handler for serving the Swagger UI at /swagger/ endpoint.
 */
export class SwaggerUiHandler {
	private readonly SWAGGER_UI_CSS = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.css";
	private readonly SWAGGER_UI_BUNDLE = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.js";
	private readonly SWAGGER_UI_STANDALONE = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js";

	/**
	 * Serve Swagger UI at /swagger/* endpoint.
	 * Returns null if the pathname doesn't match.
	 */
	handle(req: Request, url: URL): Response | null {
		const pathname = url.pathname;

		// Only handle GET requests
		if (req.method !== "GET") {
			return null;
		}

		// Handle /swagger/ or /swagger/index.html - return main HTML page
		if (pathname === "/swagger/" || pathname === "/swagger/index.html") {
			return this.serveHtml();
		}

		return null;
	}

	private serveHtml(): Response {
		const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delay Proxy API</title>
    <link rel="stylesheet" href="${this.SWAGGER_UI_CSS}">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="${this.SWAGGER_UI_BUNDLE}"></script>
    <script src="${this.SWAGGER_UI_STANDALONE}"></script>
    <script>
        window.onload = function() {
            window.ui = SwaggerUIBundle({
                url: "/swagger/json",
                dom_id: "#swagger-ui",
                presets: [
                    SwaggerUIBundle.presets.apis,
                    "StandalonePreset"
                ]
            });
        };
    </script>
</body>
</html>`;

		return new Response(html, {
			status: 200,
			headers: {
				"content-type": "text/html; charset=utf-8",
			},
		});
	}

	private redirectTo(url: string): Response {
		return new Response(null, {
			status: 302,
			headers: {
				"location": url,
			},
		});
	}
}
