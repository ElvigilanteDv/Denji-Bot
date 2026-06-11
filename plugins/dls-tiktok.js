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

async function getTikTokByUrl(videoUrl) {
  const { data } = await axios.get(
    `https://api.delirius.store/download/tiktok?url=${encodeURIComponent(videoUrl)}`,
    { timeout: REQUEST_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!data?.status || !data?.data?.meta?.media?.[0]?.org)
    throw new Error(data?.message || 'No se pudo obtener el video')
  return {
    title: safeFileName(data.data.title || 'tiktok'),
    downloadUrl: data.data.meta.media[0].org,
    fileName: normalizeMp4Name(data.data.title || 'tiktok'),
    author: data.data.author?.nickname || 'Desconocido',
    duration: data.data.duration || 0,
    directStream: false
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
    title: safeFileName(v.title || 'tiktok'),
    downloadUrl: v.url || '',
    fileName: normalizeMp4Name(v.title || 'tiktok'),
    author: v.author?.nickname || v.author?.username || 'Desconocido',
    duration: v.duration || 0,
    likes: v.like || 0,
    directStream: true 
  })).filter(v => v.downloadUrl)
}

async function sendVideo(conn, chat, quoted, meta) {
  const caption =
    `⛓️🩸 DENJI BOT 🩸⛓️\n\n` +
    `⚡ *TIKTOK*\n` +
    `🎬 *${meta.title}*\n` +
    `👤 *Autor:* ${meta.author}\n` +
    (meta.duration ? `⏱️ *Duración:* ${meta.duration}s\n` : '') +
    (meta.likes    ? `❤️ *Likes:* ${Number(meta.likes).toLocaleString()}\n` : '') +
    `\n> 🩸 DENJI BOT © JM 🩸`

  if (meta.directStream) {
    return conn.sendMessage(chat, {
      video: { url: meta.downloadUrl },
      caption,
      mimetype: 'video/mp4',
      ptv: false
    }, { quoted })
  }

  ensureTmpDir()
  const tempPath = path.join(TMP_DIR, `${TMP_FILE_PREFIX}${Date.now()}-${randomUUID()}.mp4`)
  let tempPath2 = null

  try {
    const response = await axios.get(meta.downloadUrl, {
      responseType: 'stream',
      timeout: REQUEST_TIMEOUT,
      maxRedirects: 10,
      validateStatus: () => true,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tiktok.com/' }
    })
    if (response.status >= 400) throw new Error(`HTTP ${response.status}`)

    let downloaded = 0
    response.data.on('data', chunk => {
      downloaded += chunk.length
      if (downloaded > MAX_VIDEO_BYTES) response.data.destroy(new Error('Video demasiado pesado'))
    })
    await pipeline(response.data, fs.createWriteStream(tempPath))

    const size = fs.statSync(tempPath).size
    if (!size || size < 100000) throw new Error('Archivo inválido')

    const buffer = fs.readFileSync(tempPath)

    if (size > VIDEO_AS_DOCUMENT_THRESHOLD) {
      return conn.sendMessage(chat, {
        document: buffer, mimetype: 'video/mp4',
        fileName: meta.fileName,
        caption: caption + '\n\n📦 Enviado como documento por peso.'
      }, { quoted })
    }

    try {
      await conn.sendMessage(chat, { video: buffer, mimetype: 'video/mp4', caption }, { quoted })
    } catch {
      await conn.sendMessage(chat, {
        document: buffer, mimetype: 'video/mp4',
        fileName: meta.fileName,
        caption: caption + '\n\n📦 Enviado como documento.'
      }, { quoted })
    }
  } finally {
    deleteFileSafe(tempPath)
    if (tempPath2) deleteFileSafe(tempPath2)
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
        `🔗 *.tt <link>* — descarga por link (1 💎)\n` +
        `🔎 *.tt <búsqueda>* — envía 8 videos automático (1 💎 c/u)\n\n` +
        `> 🩸 DENJI BOT © JM 🩸`
    }, { quoted: m })
  }

  const videoUrl = resolveTikTokUrl(m, input)
  const isLink = !!videoUrl

  if (isLink) {
    if (diamonds < 1) {
      return conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 Sin diamantes\n💎 Necesitas 1 | Tienes: ${diamonds}\n> Usa #work`
      }, { quoted: m })
    }

    const oldDiamonds = diamonds
    try {
      await m.react('⚰️')
      user.diamantes = oldDiamonds - 1

      await conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n⚡ Descargando...\n💎 -1 diamante`
      }, { quoted: m })

      const meta = await getTikTokByUrl(videoUrl)
      await sendVideo(conn, m.chat, m, meta)
      await m.react('🩸')
    } catch (e) {
      user.diamantes = oldDiamonds
      await m.react('💀')
      await conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 Error\n⚠️ ${e.message || 'Intenta de nuevo'}`
      }, { quoted: m })
    }

  // ── MODO BÚSQUEDA ────────────────────────────────────────────
  } else {
    const COUNT = 8
    if (diamonds < 1) {
      return conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 Sin diamantes\n💎 Tienes: ${diamonds}\n> Usa #work`
      }, { quoted: m })
    }

    let videos = []
    try {
      await m.react('🔎')
      await conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n🔎 Buscando: *${input}*\n⚡ Enviando ${COUNT} videos...`
      }, { quoted: m })

      videos = await searchTikTok(input, COUNT)
    } catch (e) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 No encontré nada para: *${input}*\n⚠️ ${e.message}`
      }, { quoted: m })
    }

    let enviados = 0
    let fallidos = 0
    const oldDiamonds = diamonds

    for (const vid of videos) {
      try {
        await sendVideo(conn, m.chat, m, vid)
        user.diamantes = (user.diamantes ?? oldDiamonds) - 1
        enviados++
      } catch (e) {
        fallidos++
        console.log(`[TT SEARCH] Falló:`, e.message)
      }
    }

    await m.react(enviados > 0 ? '🩸' : '💀')
    await conn.sendMessage(m.chat, {
      text:
        `⛓️🩸 DENJI BOT 🩸⛓️\n\n` +
        `✅ Enviados: ${enviados}\n` +
        `❌ Fallidos: ${fallidos}\n` +
        `💎 Usados: ${enviados}\n\n` +
        `> 🩸 DENJI BOT © JM 🩸`
    }, { quoted: m })
  }
}

handler.help = ['tt <link o búsqueda>']
handler.tags = ['downloader']
handler.command = /^(tt|tiktok)$/i
handler.desc = 'Descarga TikTok por link o busca y envía 8 videos automático'

export default handler
