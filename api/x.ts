// Tiny allow-listed read-only proxy with CDN caching. No secrets involved.
const ALLOW = [
  /(^|\.)blockscout\.com$/,
  /^explorer\.optimism\.io$/,
  /^scrollscan\.com$/,
  /^api\.coingecko\.com$/,
  /(^|\.)publicnode\.com$/,
  /^mainnet\.era\.zksync\.io$/,
  /^api\.binplorer\.com$/,
]

export async function GET(request: Request) {
  return handle(request)
}
export async function POST(request: Request) {
  return handle(request)
}

async function handle(request: Request) {
  const u = new URL(request.url).searchParams.get('u')
  if (!u) return json({ error: 'missing u' }, 400)
  let target: URL
  try { target = new URL(u) } catch { return json({ error: 'bad url' }, 400) }
  if (target.protocol !== 'https:' || !ALLOW.some((r) => r.test(target.hostname))) return json({ error: 'host not allowed' }, 403)
  const isPost = request.method === 'POST'
  const body = isPost ? await request.text() : undefined
  if (body && body.length > 20000) return json({ error: 'body too large' }, 413)
  try {
    const r = await fetch(target, {
      method: isPost ? 'POST' : 'GET',
      body,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'tracelight/1.0 (+https://github.com/yunnaysy/tracelight)',
      },
      signal: AbortSignal.timeout(12000),
    })
    const text = await r.text()
    const looksJson = /^\s*[\[{]/.test(text)
    if (!looksJson) return json({ error: 'upstream returned non-JSON', status: r.status }, 502)
    const ttl = target.hostname === 'api.coingecko.com' ? 60 : 15
    return new Response(text, {
      status: r.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': isPost ? 'no-store' : `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`,
        'access-control-allow-origin': '*',
      },
    })
  } catch (e) {
    return json({ error: 'upstream unreachable' }, 504)
  }
}

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } })
}
