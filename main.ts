const UPSTREAM = Deno.env.get("UPSTREAM");
const DELAY = parseInt(Deno.env.get("DELAY") || "0", 10);

if (!UPSTREAM) {
  console.error("UPSTREAM environment variable is required");
  Deno.exit(1);
}

// TODO: make proxy work at /proxy/:path paths (so we have slot for adding features)
// TODO: add /api/kill-switch/ endpoint to quickly manage proxy kill switch (force status, headers and response body, globally apply to all request) simple as POST /api/kill-switch with { enabled: boolean, status: number, headers: Record<string, string>, body: string }
// TODO: add /api/delay/ endpoint to manage proxy delay (simple as POST /api/delay with { delay: number })
// TODO: add json structured logging for request / response (need to find a good json logging library / try `pino` if it compatible with deno)
// TODO: use Deno KV as datasource (use on-cloud option at Deno Deploy free plan, https://docs.deno.com/deploy/reference/deno_kv/)
// TODO: keep everything in this file main.ts to keep it simple

console.log(`Starting proxy server`);
console.log(`Upstream: ${UPSTREAM}`);
console.log(`Delay: ${DELAY}ms`);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  const targetUrl = new URL(url.pathname + url.search, UPSTREAM);

  await new Promise((resolve) => setTimeout(resolve, DELAY));

  const response = await fetch(targetUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
});
