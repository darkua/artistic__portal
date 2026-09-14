/**
 * Builds dist/og-works.json for social crawlers (Open Graph).
 * Set SITE_URL (default https://yoursite.com) and OG_WORK_IDS (default 25).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const SITE_URL = (process.env.SITE_URL || 'https://yoursite.com').replace(/\/$/, '')
const OG_WORK_IDS = (process.env.OG_WORK_IDS || '25')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const portfolioPath = path.join(root, 'src/data/portfolioData.json')
const outPath = path.join(root, 'dist/og-works.json')

function extractYouTubeId(url) {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function extractVimeoId(url) {
  if (!url) return null
  const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/)
  return match?.[1] ?? null
}

function absoluteUrl(maybeRelative) {
  if (!maybeRelative || typeof maybeRelative !== 'string') return null
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative
  if (maybeRelative.startsWith('//')) return `https:${maybeRelative}`
  return `${SITE_URL}${maybeRelative.startsWith('/') ? '' : '/'}${maybeRelative}`
}

function pickTitle(title) {
  if (!title || typeof title !== 'object') return 'Elma Hache'
  const en = (title.en || '').trim()
  const es = (title.es || '').trim()
  if (en && en.toLowerCase() !== 'title') return en
  return es || en || 'Elma Hache'
}

function pickDescription(work) {
  const desc = work.description || work.shortDescription || {}
  const text = ((desc.en || desc.es || '') + '').trim()
  if (!text) return 'Portfolio work by Elma Hache'
  const oneLine = text.replace(/\s+/g, ' ')
  return oneLine.length > 300 ? `${oneLine.slice(0, 297)}…` : oneLine
}

function pickImage(work) {
  const thumb = absoluteUrl(work.thumbnail)
  if (thumb) return thumb
  const firstVideo = Array.isArray(work.videos) ? work.videos[0] : null
  if (firstVideo?.thumbnail) return absoluteUrl(firstVideo.thumbnail)
  const videoUrl = firstVideo?.url || ''
  const yt = extractYouTubeId(videoUrl)
  if (yt) return `https://img.youtube.com/vi/${yt}/maxresdefault.jpg`
  const vimeo = extractVimeoId(videoUrl)
  if (vimeo) return `https://vumbnail.com/${vimeo}.jpg`
  return `${SITE_URL}/logo.png`
}

function pickVideoEmbed(work) {
  const firstVideo = Array.isArray(work.videos) ? work.videos[0] : null
  const videoUrl = firstVideo?.url || ''
  if (!videoUrl) return null
  const yt = extractYouTubeId(videoUrl)
  if (yt) return `https://www.youtube.com/embed/${yt}`
  const vimeo = extractVimeoId(videoUrl)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}`
  return null
}

function findWorkById(portfolio, id) {
  const sections = ['theaterDirector', 'actress', 'movieDirector', 'assistantDirection']
  for (const section of sections) {
    const arr = portfolio.works?.[section]
    if (!Array.isArray(arr)) continue
    const work = arr.find((w) => w && Number(w.id) === Number(id))
    if (work) return work
  }
  return null
}

function main() {
  if (!fs.existsSync(path.join(root, 'dist'))) {
    console.error('Run vite build first (dist/ missing).')
    process.exit(1)
  }

  const portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'))
  const out = {}

  for (const id of OG_WORK_IDS) {
    const work = findWorkById(portfolio, id)
    if (!work) {
      console.warn(`⚠️  Work id ${id} not found in portfolioData — skipped`)
      continue
    }

    const videoEmbed = pickVideoEmbed(work)
    out[String(id)] = {
      siteUrl: SITE_URL,
      path: `/works/${id}`,
      title: pickTitle(work.title),
      description: pickDescription(work),
      image: pickImage(work),
      videoEmbed,
      type: videoEmbed ? 'video.other' : 'website',
    }
    console.log(`✅ OG metadata for /works/${id} → ${pickTitle(work.title)}`)
  }

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(`Wrote ${outPath} (${Object.keys(out).length} work(s), SITE_URL=${SITE_URL})`)
}

main()
