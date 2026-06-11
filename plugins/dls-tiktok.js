import fs from 'fs'
import path from 'path'
import os from 'os'
import axios from 'axios'
import { pipeline } from 'stream/promises'
import { randomUUID } from 'crypto'

const TMP_DIR = path.join(os.tmpdir(), 'denji-tiktok')
const TMP_FILE_PREFIX = 'denji-tt-'
const TMP_MAX_AGE_MS = 2 * 60 * 60 * 1000
const REQUEST_TIMEOUT = 60000
const MAX_VIDEO_BYTES = 80 * 1024 * 1024
const VIDEO_AS_DOCUMENT_THRESHOLD = 40 * 1024 * 1024

const API_BASE = process.env.DV_API_URL || 'https://dv-yer-api.online'
const API_KEY  = process.env.DV_API_KEY  || 'dvyerDravenFX4'

function ensureTmpDir() {
  try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}
}
function cleanupOldTempFiles() {
  ensureTmpDir()
  try {
    const now = Date.now()
    for (const file of fs.readdirSync(TMP_DIR)) {
      if (!file.startsWith(TMP_FILE_PREFIX)) continue
      const fullPath = path.join(TMP_DIR, file)
      const stat = fs.statSync(fullPath)
      if (stat.isFile() && now - stat.mtimeMs > TMP_MAX_AGE_MS) fs.unlinkSync(fullPath)
    }
  } catch {}
}
function deleteFileSafe(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}
}
function safeFileName(name) {
  return String(name || 'tiktok').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'tiktok'
}
function normalizeMp4Name(name) {
  return `${safeFileName(String(name || 'tiktok').replace(/\.mp4$/i, '')) || 'tiktok'}.mp4`
}
function extractTikTokUrl(text) {
  const match = String(text || '').match(
    /https?:\/\/(?:www\.)?(?:tiktok\.com|m\.tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com|douyin\.com)\/[^\s]+/i
  )
  return match ? match[0].trim().replace(/[)\],>]+$/g, '') : ''
}
function resolveTikTokUrl(m, text) {
  const quoted = m.quoted || null
  const quotedText = quoted?.text || quoted?.caption || ''
  return extractTikTokUrl(String(text || '').trim()) || extractTikTokUrl(quotedText) || ''
}

async function resolveDownloadUrl(tiktokUrl) {
  const res = await axios.get(`${API_BASE}/ttdlmp4`, {
    params: { url: tiktokUrl, quality: 'hd' },
    timeout: REQUEST_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
      'x-api-key': API_KEY
    },
    validateStatus: () => true
  })
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`)
  const json = res.data
  if (!json?.ok) throw new Error(json?.message || 'No se pudo resolver el video')
  const url = json.download_url || json.stream_url || json.url
  if (!url) throw new Error('Sin URL de descarga')
  return {
    downloadUrl: url,
    title: safeFileName(json.title || 'tiktok'),
    fileName: normalizeMp4Name(json.filename || json.title || 'tiktok'),
    quality: json.quality || 'HD'
  }
}

async function searchTikTok(query, count = 8) {
  const { data } = await axios.get(
    `https://api.delirius.store/search/tiktoksearch?query=${encodeURIComponent(query)}`,
    { timeout: REQUEST_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!data?.status || !data?.meta?.length)
    throw new Error('No se encontraron videos')
  
  return data.meta.slice(0, count).map(v => ({
    pageUrl: v.share_url || v.video_url || v.link || v.url || '',
    title: safeFileName(v.title || 'tiktok'),
    author: v.author?.nickname || v.author?.username || 'Desconocido',
    duration: v.duration || 0,
    likes: v.like || 0
  })).filter(v => v.pageUrl)
}

async function downloadFile(url, fileName) {
  ensureTmpDir()
  const tempPath = path.join(TMP_DIR, `${TMP_FILE_PREFIX}${Date.now()}-${randomUUID()}.mp4`)

  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    maxRedirects: 10,
    validateStatus: () => true,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*',
      'Referer': 'https://www.tiktok.com/',
      'x-api-key': API_KEY
    }
  })
  if (response.status >= 400) throw new Error(`HTTP ${response.status}`)

  let downloaded = 0
  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_VIDEO_BYTES)
      response.data.destroy(new Error('Video demasiado pesado'))
  })
  await pipeline(response.data, fs.createWriteStream(tempPath))

  if (!fs.existsSync(tempPath)) throw new Error('No se pudo guardar')
  const size = fs.statSync(tempPath).size
  if (!size || size < 50000) {
    deleteFileSafe(tempPath)
    throw new Error('Archivo inválido o vacío')
  }
  return { tempPath, size }
}

async function sendVideo(conn, chat, quoted, { tempPath, size, title, author, duration, likes, quality }) {
  const buffer = fs.readFileSync(tempPath)
  const caption =
    `⛓️🩸 DENJI BOT 🩸⛓️\n\n` +
    `🎬 *${title}*\n` +
    `👤 *Autor:* ${author}\n` +
    (duration ? `⏱️ *Duración:* ${duration}s\n` : '') +
    (likes    ? `❤️ *Likes:* ${Number(likes).toLocaleString()}\n` : '') +
    (quality  ? `🎞️ *Calidad:* ${quality}\n` : '') +
    `💾 *Peso:* ${(size / 1024 / 1024).toFixed(2)} MB\n\n` +
    `> 🩸 DENJI BOT © JM 🩸`

  if (size > VIDEO_AS_DOCUMENT_THRESHOLD) {
    return conn.sendMessage(chat, {
      document: buffer, mimetype: 'video/mp4',
      fileName: normalizeMp4Name(title),
      caption: caption + '\n\n📦 Como documento por peso.'
    }, { quoted })
  }
  try {
    await conn.sendMessage(chat, { video: buffer, mimetype: 'video/mp4', caption }, { quoted })
  } catch {
    await conn.sendMessage(chat, {
      document: buffer, mimetype: 'video/mp4',
      fileName: normalizeMp4Name(title),
      caption: caption + '\n\n📦 Como documento.'
    }, { quoted })
  }
}

ensureTmpDir()
cleanupOldTempFiles()

let handler = async (m, { conn, text }) => {
  let user = global.db.data.users[m.sender]
  if (!user) {
    global.db.data.users[m.sender] = { diamantes: 0 }
    user = global.db.data.users[m.sender]
  }

  const diamonds = user.diamantes ?? user.diamond ?? 0
  const input = String(text || '').trim()

  if (!input) {
    return conn.sendMessage(m.chat, {
      text:
        `⛓️🩸 DENJI BOT 🩸⛓️\n\n` +
        `⚡ *USO*\n\n` +
        `🔗 *.tt <link>* → descarga ese video (1 💎)\n` +
        `🔎 *.tt <búsqueda>* → envía 8 videos automático (1 💎 c/u)\n\n` +
        `> 🩸 DENJI BOT © JM 🩸`
    }, { quoted: m })
  }

  const videoUrl = resolveTikTokUrl(m, input)
  const isLink = !!videoUrl

  if (isLink) {
    if (diamonds < 1) {
      return conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 Sin diamantes (tienes ${diamonds})\n> Usa #work`
      }, { quoted: m })
    }

    const oldDiamonds = diamonds
    let tempPath = null

    try {
      await m.react('⚰️')
      user.diamantes = oldDiamonds - 1

      await conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n⚡ Descargando...\n💎 -1 diamante`
      }, { quoted: m })

      const meta = await resolveDownloadUrl(videoUrl)
      const downloaded = await downloadFile(meta.downloadUrl, meta.fileName)
      tempPath = downloaded.tempPath

      await sendVideo(conn, m.chat, m, {
        tempPath: downloaded.tempPath,
        size: downloaded.size,
        title: meta.title,
        author: '',
        quality: meta.quality
      })

      await m.react('🩸')
    } catch (e) {
      user.diamantes = oldDiamonds
      await m.react('💀')
      await conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 Error\n⚠️ ${e.message || 'Intenta de nuevo'}`
      }, { quoted: m })
    } finally {
      deleteFileSafe(tempPath)
    }

  } else {
    if (diamonds < 1) {
      return conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 Sin diamantes (tienes ${diamonds})\n> Usa #work`
      }, { quoted: m })
    }

    let videos = []
    try {
      await m.react('🔎')
      await conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n🔎 Buscando: *${input}*\n⚡ Preparando 8 videos...`
      }, { quoted: m })

      videos = await searchTikTok(input, 8)
    } catch (e) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 Sin resultados para: *${input}*\n⚠️ ${e.message}`
      }, { quoted: m })
    }

    let enviados = 0
    let fallidos = 0
    const oldDiamonds = diamonds

    for (const vid of videos) {
      let tempPath = null
      try {
      
        const meta = await resolveDownloadUrl(vid.pageUrl)
        const downloaded = await downloadFile(meta.downloadUrl, meta.fileName)
        tempPath = downloaded.tempPath

        await sendVideo(conn, m.chat, m, {
          tempPath: downloaded.tempPath,
          size: downloaded.size,
          title: vid.title || meta.title,
          author: vid.author,
          duration: vid.duration,
          likes: vid.likes,
          quality: meta.quality
        })

        user.diamantes = (user.diamantes ?? oldDiamonds) - 1
        enviados++
      } catch (e) {
        fallidos++
        console.log(`[TT SEARCH] Falló "${vid.title}":`, e.message)
      } finally {
        deleteFileSafe(tempPath)
      }
    }

    await m.react(enviados > 0 ? '🩸' : '💀')
    await conn.sendMessage(m.chat, {
      text:
        `⛓️🩸 DENJI BOT 🩸⛓️\n\n` +
        `✅ *Enviados:* ${enviados}\n` +
        `❌ *Fallidos:* ${fallidos}\n` +
        `💎 *Usados:* ${enviados}\n\n` +
        `> 🩸 DENJI BOT © JM 🩸`
    }, { quoted: m })
  }
}

handler.help = ['tt <link o búsqueda>']
handler.tags = ['downloader']
handler.command = /^(tt|tiktok)$/i
handler.desc = 'Descarga TikTok por link o busca y envía 8 videos automático'

export default handler
