import yts from 'yt-search'
import fetch from 'node-fetch'

const RYZE_API = 'https://ryzecodes.xyz/api/scrapers/36/run'
const RYZE_KEY = 'ryzk0cdn'
const RYZE_FORMAT = '480p'
const RYZE_ATTEMPTS = 6
const RYZE_INTERVAL = 1100

const isYTUrl = (url = '') => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

const getVideoId = (text = '') => {
  const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
  return match?.[1] || null
}

const safeFileName = (name = 'video') => name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'video'

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`)
  return json
}

async function getVideoInfo(input, video_id) {
  if (video_id) {
    try {
      const info = await yts({ videoId: video_id })
      if (info?.videoId) return { ...info, url: `https://youtu.be/${info.videoId}`, image: info.thumbnail || info.image }
    } catch {}
  }
  const search = await yts(input)
  const video = search.videos?.[0] || search.all?.find(v => v.type === 'video')
  return video || null
}

async function getVideoFromRyze(url) {
  const res = await fetchJson(RYZE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': RYZE_KEY },
    body: JSON.stringify({ input: { url, format: RYZE_FORMAT, attempts: RYZE_ATTEMPTS, interval_ms: RYZE_INTERVAL } })
  })

  const result = res?.result
  if (!res?.success || !result?.success) throw new Error(res?.error || result?.error || 'API sin resultado')

  const video_url = result.file_url || result.download_urls?.[0] || null
  if (!video_url) return null

  return { url: video_url, title: result.title || null, quality: result.selected_media?.quality || result.format || RYZE_FORMAT, size: result.selected_media?.size || null }
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const input_text = text?.trim()

  if (!input_text) {
    return conn.sendMessage(m.chat, {
      text: `⛓️ DENJI BOT ⛓️\n\n⚡ Descarga videos de YouTube\n\n> ${usedPrefix}${command} <nombre o link>\n> Ejemplo: ${usedPrefix}${command} Naruto Opening 1`
    }, { quoted: m })
  }

  const video_id = getVideoId(input_text)
  const query = video_id ? `https://youtu.be/${video_id}` : input_text

  let url = query
  let title = 'video'
  let thumbnail = null

  await m.react('🔍')

  try {
    const video_info = await getVideoInfo(query, video_id)
    if (video_info) {
      url = video_info.url || `https://youtu.be/${video_info.videoId}`
      title = video_info.title || title
      thumbnail = video_info.image || video_info.thumbnail || null

      const views = (video_info.views || 0).toLocaleString()
      const channel = video_info.author?.name || video_info.author || 'Desconocido'

      const info_message = `⛓️ DENJI BOT ⛓️\n\n⚡ Descargando video...\n\n❀ Título: *${title}*\n❀ Canal: *${channel}*\n❀ Duración: *${video_info.timestamp || 'Desconocido'}*\n❀ Vistas: *${views}*\n❀ Calidad: *${RYZE_FORMAT}*\n\n> Espera un momento...`

      if (thumbnail) {
        await conn.sendMessage(m.chat, { image: { url: thumbnail }, caption: info_message }, { quoted: m })
      } else {
        await conn.sendMessage(m.chat, { text: info_message }, { quoted: m })
      }
    }
  } catch {}

  if (!isYTUrl(url)) {
    await m.react('❌')
    return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n❌ No encontré un video válido de YouTube\n\n> Intenta con otro nombre o link' }, { quoted: m })
  }

  try {
    const video = await getVideoFromRyze(url)

    if (!video?.url) {
      await m.react('❌')
      return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n❌ No se pudo descargar el video\n\n> Intenta más tarde' }, { quoted: m })
    }

    await conn.sendMessage(m.chat, {
      video: { url: video.url },
      fileName: `${safeFileName(video.title || title)}.mp4`,
      mimetype: 'video/mp4',
      caption: `⛓️ DENJI BOT ⛓️\n\n⚡ Video descargado\n\n❀ ${video.title || title}\n❀ Calidad: *${video.quality}*\n❀ Tamaño: *${video.size || 'Desconocido'}*`
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    await m.react('❌')
    await conn.sendMessage(m.chat, { text: `⛓️ DENJI BOT ⛓️\n\n❌ Error al descargar\n\n> ${e.message}` }, { quoted: m })
  }
}

handler.help = ['video']
handler.tags = ['downloader']
handler.command = /^(video|ytmp4|ytvideo|descargarvideo)$/i
handler.desc = 'Descarga videos de YouTube'

export default handler