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
  const directText = String(text || '').trim()
  const quoted = m.quoted || m.msg?.contextInfo?.quotedMessage || null
  const quotedText = quoted?.text || quoted?.caption || ''
  return extractTikTokUrl(directText) || extractTikTokUrl(quotedText) || ''
}

async function getTikTokDataByUrl(videoUrl) {
  const api = `https://api.delirius.store/download/tiktok?url=${encodeURIComponent(videoUrl)}`
  const res = await axios.get(api, {
    timeout: REQUEST_TIMEOUT,
    validateStatus: () => true,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,*/*' }
  })
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`)
  const json = res.data
  if (!json?.status || !json?.data?.meta?.media?.[0]?.org)
    throw new Error(json?.message || 'No se pudo obtener el video')
  return {
    title: safeFileName(json?.data?.title || 'tiktok'),
    directUrl: json.data.meta.media[0].org,
    fileName: normalizeMp4Name(json?.data?.title || 'tiktok'),
    author: json?.data?.author?.nickname || 'Desconocido',
    duration: json?.data?.duration || 0
  }
}

async function searchTikTok(query, count = 8) {
  const api = `https://api.delirius.store/search/tiktok?q=${encodeURIComponent(query)}&count=${count}`
  const res = await axios.get(api, {
    timeout: REQUEST_TIMEOUT,
    validateStatus: () => true,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,*/*' }
  })
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`)
  const json = res.data

  const items =
    json?.data?.videos ||
    json?.data?.items ||
    json?.data ||
    json?.result ||
    json?.videos ||
    []

  if (!Array.isArray(items) || items.length === 0)
    throw new Error('No se encontraron videos para esa búsqueda')

  return items.slice(0, count).map(v => ({
    title: safeFileName(v?.title || v?.desc || v?.description || 'tiktok'),
    directUrl: v?.play || v?.video?.play_addr?.url_list?.[0] || v?.download_url || v?.url || '',
    fileName: normalizeMp4Name(v?.title || v?.desc || 'tiktok'),
    author: v?.author?.nickname || v?.nickname || 'Desconocido',
    duration: v?.duration || 0
  })).filter(v => v.directUrl)
}

async function downloadFile(url, fileName) {
  ensureTmpDir()
  const tempPath = path.join(TMP_DIR, `${TMP_FILE_PREFIX}${Date.now()}-${randomUUID()}-${normalizeMp4Name(fileName)}`)

  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Referer': 'https://www.tiktok.com/' }
  })

  if (response.status >= 400) throw new Error(`Error HTTP ${response.status}`)

  const contentLength = Number(response.headers?.['content-length'] || 0)
  if (contentLength && contentLength > MAX_VIDEO_BYTES)
    throw new Error('El video pesa demasiado')

  let downloaded = 0
  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_VIDEO_BYTES)
      response.data.destroy(new Error('El video pesa demasiado'))
  })

  await pipeline(response.data, fs.createWriteStream(tempPath))

  if (!fs.existsSync(tempPath)) throw new Error('No se pudo guardar el video')
  const size = fs.statSync(tempPath).size
  if (!size || size < 100000) {
    deleteFileSafe(tempPath)
    throw new Error('El archivo descargado es inválido')
  }

  return { tempPath, size }
}

async function sendVideo(conn, chat, quoted, { filePath, fileName, title, size, author, duration }) {
  const buffer = fs.readFileSync(filePath)
  const caption =
    `⛓️🩸 DENJI BOT 🩸⛓️\n\n` +
    `⚡ *TIKTOK DESCARGADO*\n` +
    `🎬 *Título:* ${title}\n` +
    `👤 *Autor:* ${author}\n` +
    `⏱️ *Duración:* ${duration}s\n` +
    `💾 *Peso:* ${(size / 1024 / 1024).toFixed(2)} MB\n\n` +
    `> 🩸 DENJI BOT © JM 🩸`

  if (size > VIDEO_AS_DOCUMENT_THRESHOLD) {
    return conn.sendMessage(chat, {
      document: buffer, mimetype: 'video/mp4', fileName,
      caption: caption + '\n\n📦 Enviado como documento por peso.'
    }, { quoted })
  }

  try {
    await conn.sendMessage(chat, { video: buffer, mimetype: 'video/mp4', fileName, caption }, { quoted })
  } catch {
    await conn.sendMessage(chat, {
      document: buffer, mimetype: 'video/mp4', fileName,
      caption: caption + '\n\n📦 Enviado como documento por compatibilidad.'
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

  const diamonds = user.diamantes || user.diamond || 0
  const input = String(text || '').trim()

  if (!input) {
    return conn.sendMessage(m.chat, {
      text:
        `⛓️🩸 DENJI BOT 🩸⛓️\n\n` +
        `⚡ *USO CORRECTO*\n\n` +
        `🔗 *.tt <link>* — descarga por link\n` +
        `🔎 *.tt <búsqueda>* — busca y envía 8 videos\n\n` +
        `💎 Cuesta 1 diamante por descarga\n` +
        `💎 Búsqueda: 1 diamante por video enviado\n\n` +
        `> 🩸 DENJI BOT © JM 🩸`
    }, { quoted: m })
  }

  if (diamonds < 1) {
    return conn.sendMessage(m.chat, {
      text:
        `⛓️🩸 DENJI BOT 🩸⛓️\n\n` +
        `💀 No tienes suficientes diamantes\n\n` +
        `💎 Necesitas: 1 diamante\n` +
        `🩸 Tienes: ${diamonds} diamantes\n\n` +
        `> Usa #work para ganar`
    }, { quoted: m })
  }

  const videoUrl = resolveTikTokUrl(m, input)
  const isLink = !!videoUrl

  await m.react('⚰️')

  if (isLink) {
    if (diamonds < 1) return conn.sendMessage(m.chat, { text: `💀 No tienes diamantes` }, { quoted: m })

    let tempPath = null
    const oldDiamonds = diamonds

    try {
      user.diamantes = oldDiamonds - 1

      await conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n⚡ *DESCARGANDO...*\n💎 -1 diamante\n\n> Espera ⛓️`
      }, { quoted: m })

      const meta = await getTikTokDataByUrl(videoUrl)
      const downloaded = await downloadFile(meta.directUrl, meta.fileName)
      tempPath = downloaded.tempPath

      await sendVideo(conn, m.chat, m, {
        filePath: downloaded.tempPath,
        fileName: meta.fileName,
        title: meta.title,
        size: downloaded.size,
        author: meta.author,
        duration: meta.duration
      })

      await m.react('🩸')
    } catch (e) {
      user.diamantes = diamonds
      await m.react('💀')
      await conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 Error al descargar\n\n⚠️ ${e.message || 'Intenta de nuevo'}`
      }, { quoted: m })
    } finally {
      deleteFileSafe(tempPath)
    }

  } else {
    const SEARCH_COUNT = 8
    if (diamonds < SEARCH_COUNT) {
      return conn.sendMessage(m.chat, {
        text:
          `⛓️🩸 DENJI BOT 🩸⛓️\n\n` +
          `💀 Necesitas al menos *${SEARCH_COUNT} diamantes* para buscar\n` +
          `🩸 Tienes: ${diamonds} diamantes`
      }, { quoted: m })
    }

    await conn.sendMessage(m.chat, {
      text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n🔎 *Buscando:* ${input}\n⚡ Enviando 8 videos...\n\n> Espera ⛓️`
    }, { quoted: m })

    let videos = []
    try {
      videos = await searchTikTok(input, SEARCH_COUNT)
    } catch (e) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 Error en búsqueda\n\n⚠️ ${e.message}`
      }, { quoted: m })
    }

    if (videos.length === 0) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `⛓️🩸 DENJI BOT 🩸⛓️\n\n💀 No encontré videos para: *${input}*`
      }, { quoted: m })
    }

    let enviados = 0
    let fallidos = 0

    for (const vid of videos) {
      let tempPath = null
      try {
        const downloaded = await downloadFile(vid.directUrl, vid.fileName)
        tempPath = downloaded.tempPath
        user.diamantes = (user.diamantes || 0) - 1

        await sendVideo(conn, m.chat, m, {
          filePath: downloaded.tempPath,
          fileName: vid.fileName,
          title: vid.title,
          size: downloaded.size,
          author: vid.author,
          duration: vid.duration
        })

        enviados++
      } catch (e) {
        fallidos++
        console.log(`[TT SEARCH] Falló video ${enviados + fallidos}:`, e.message)
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
        `💎 *Diamantes usados:* ${enviados}\n\n` +
        `> 🩸 DENJI BOT © JM 🩸`
    }, { quoted: m })
  }
}

handler.help = ['tt <link o búsqueda>']
handler.tags = ['downloader']
handler.command = /^(tt|tiktok)$/i
handler.desc = 'Descarga TikTok por link o búsqueda (envía 8 videos)'

export default handler
