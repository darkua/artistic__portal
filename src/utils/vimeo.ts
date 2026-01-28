/**
 * Extract Vimeo video ID from various Vimeo URL formats
 */
export function extractVimeoId(url: string): string | null {
  if (!url) return null

  const patterns = [
    /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/,
    /vimeo\.com\/(\d+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Get Vimeo embed URL from video ID
 */
export function getVimeoEmbedUrl(videoId: string): string {
  return `https://player.vimeo.com/video/${videoId}`
}

/**
 * Get Vimeo thumbnail URL from video ID
 * Note: Vimeo thumbnails require API access, but we can use a placeholder
 * or fetch from oEmbed API. For now, returning a placeholder pattern.
 */
export function getVimeoThumbnail(videoId: string): string {
  // Vimeo thumbnails can be fetched via oEmbed API, but for simplicity
  // we'll return a placeholder. In production, you might want to fetch via:
  // https://vimeo.com/api/oembed.json?url=https://vimeo.com/{videoId}
  return `https://vumbnail.com/${videoId}.jpg`
}

/**
 * Check if URL is a Vimeo URL
 */
export function isVimeoUrl(url: string): boolean {
  return /(?:vimeo\.com|player\.vimeo\.com)/.test(url)
}

