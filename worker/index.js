/**
 * Serves Open Graph HTML to social crawlers for work pages listed in /og-works.json.
 * Humans get the normal SPA from ASSETS. Test: /works/25?og=1
 */

const CRAWLER_UA =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|Pinterest|Googlebot/i

/** @type {Record<string, { siteUrl: string, path: string, title: string, description: string, image: string, videoEmbed?: string | null, type: string }> | null} */
let ogCache = null

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildOgHtml(entry) {
  const canonical = `${entry.siteUrl}${entry.path}`
  const title = escapeHtml(entry.title)
  const description = escapeHtml(entry.description)
  const image = escapeHtml(entry.image)
  const type = escapeHtml(entry.type || 'website')

  const videoTags = entry.videoEmbed
    ? `
    <meta property="og:video" content="${escapeHtml(entry.videoEmbed)}" />
    <meta property="og:video:secure_url" content="${escapeHtml(entry.videoEmbed)}" />
    <meta property="og:video:type" content="text/html" />
    <meta property="og:video:width" content="1280" />
    <meta property="og:video:height" content="720" />
    <meta name="twitter:card" content="player" />
    <meta name="twitter:player" content="${escapeHtml(entry.videoEmbed)}" />
    <meta name="twitter:player:width" content="1280" />
    <meta name="twitter:player:height" content="720" />`
    : `
    <meta name="twitter:card" content="summary_large_image" />`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:site_name" content="Elma Hache" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />${videoTags}
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonical)}" />
</head>
<body>
  <p><a href="${escapeHtml(canonical)}">${title}</a></p>
</body>
</html>`
}

async function loadOgWorks(env) {
  if (ogCache) return ogCache
  const res = await env.ASSETS.fetch(new URL('/og-works.json', 'https://placeholder.local'))
  if (!res.ok) {
    ogCache = {}
    return ogCache
  }
  ogCache = await res.json()
  return ogCache
}

export default {
  /** @param {Request} request @param {{ ASSETS: { fetch: (req: Request) => Promise<Response> } }} env */
  async fetch(request, env) {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/works\/(\d+)\/?$/)
    if (!match) {
      return env.ASSETS.fetch(request)
    }

    const workId = match[1]
    const ogWorks = await loadOgWorks(env)
    const entry = ogWorks[workId]
    if (!entry) {
      return env.ASSETS.fetch(request)
    }

    const ua = request.headers.get('User-Agent') || ''
    const forceOg = url.searchParams.get('og') === '1'
    if (!forceOg && !CRAWLER_UA.test(ua)) {
      return env.ASSETS.fetch(request)
    }

    return new Response(buildOgHtml(entry), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  },
}
