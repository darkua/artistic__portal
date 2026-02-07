export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    
    // List of file extensions that should be served directly as static assets
    const staticExtensions = [
      '.js', '.css', '.html', '.json', '.xml', '.txt',
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
      '.mp4', '.webm', '.ogg', '.mp3', '.wav',
      '.woff', '.woff2', '.ttf', '.eot',
      '.pdf', '.zip'
    ]
    
    // Check if request is for a static file
    const isStaticFile = staticExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext))
    
    if (isStaticFile) {
      // Serve static file directly
      return env.ASSETS.fetch(request)
    }
    
    // For all other routes (SPA navigation), try to serve the asset first
    // If it fails or returns 404, serve index.html
    try {
      const response = await env.ASSETS.fetch(request)
      
      // If we got a valid response with content, return it
      if (response.status !== 404) {
        return response
      }
    } catch (e) {
      // Asset not found, fall through to index.html
    }
    
    // Serve index.html for SPA routing
    const indexUrl = new URL('/index.html', request.url)
    return env.ASSETS.fetch(new Request(indexUrl, request))
  }
}
