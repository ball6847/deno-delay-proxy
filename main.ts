const UPSTREAM = Deno.env.get("UPSTREAM");
const DELAY = parseInt(Deno.env.get("DELAY") || "0", 10);

if (!UPSTREAM) {
  console.error("UPSTREAM environment variable is required");
  Deno.exit(1);
}

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