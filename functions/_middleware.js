// Cloudflare Pages only (docs/deployment.md, option D2): forwards /api, /sms, /docs and /openapi.json to the API server,
// so the portal and the API share one address (needed for the sign-in cookie). Set SYLY_API_URL in the Pages project,
// for example https://syly-api.onrender.com. Every other request is served as a normal static file.
// Not used by Vercel (vercel.json has the same rule) or by docker compose (nginx does it). [unverified: not deployed yet]
export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const forwarded = url.pathname.startsWith('/api/') || url.pathname.startsWith('/sms/') || url.pathname === '/docs' || url.pathname === '/openapi.json'
  if (!forwarded) return context.next()
  if (!env.SYLY_API_URL) return new Response(JSON.stringify({ detail: 'The API address is not set (SYLY_API_URL).' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  const target = new URL(url.pathname + url.search, env.SYLY_API_URL)
  const upstream = new Request(target, request)
  upstream.headers.set('X-Forwarded-Proto', 'https') // so the API marks the sign-in cookie Secure
  return fetch(upstream)
}
