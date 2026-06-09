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

ensureTmpDir()
cleanupOldTempFiles()

function ensureTmpDir() {
  try {
    fs.mkdirSync(TMP_DIR, { recursive: true })
  } catch {}
}

function cleanupOldTempFiles() {
  ensureTmpDir()
  try {
    const now = Date.now()
    const files = fs.readdirSync(TMP_DIR)

    for (const file of files) {
      if (!file.startsWith(TMP_FILE_PREFIX)) continue
      const fullPath = path.join(TMP_DIR, file)
      const stat = fs.statSync(fullPath)
      if (!stat.isFile()) continue
      if (now - stat.mtimeMs > TMP_MAX_AGE_MS) fs.unlinkSync(fullPath)
    }
  } catch {}
}

function deleteFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}
}

function safeFileName(name) {
  return (
    String(name || 'tiktok')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'tiktok'
  )
}

function normalizeMp4Name(name) {
  const clean = safeFileName(String(name || 'tiktok').replace(/\.mp4$/i, ''))
  return `${clean || 'tiktok'}.mp4`
}

function extractTextFromMessage(message) {
  return (
    message?.text ||
    message?.caption ||
    message?.body ||
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    message?.message?.documentMessage?.caption ||
    ''
  )
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
  const quotedText = extractTextFromMessage(quoted)
  return extractTikTokUrl(directText) || extractTikTokUrl(quotedText) || ''
}

async function readStreamToText(stream) {
  return await new Promise((resolve, reject) => {
    let data = ''
    stream.on('data', chunk => {
      data += chunk.toString()
    })
    stream.on('end', () => resolve(data))
    stream.on('error', reject)
  })
}

async function getTikTokData(videoUrl) {
  const api = `https://api.delirius.store/download/tiktok?url=${encodeURIComponent(videoUrl)}`
  const res = await axios.get(api, {
    timeout: REQUEST_TIMEOUT,
    validateStatus: () => true,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json,text/plain,*/*'
    }
  })

  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status}`)
  }

  const json = res.data
  if (!json?.status || !json?.data?.meta?.media?.[0]?.org) {
    throw new Error(json?.message || 'No se pudo obtener el video')
  }

  const title = safeFileName(json?.data?.title || 'tiktok')
  const directUrl = json.data.meta.media[0].org
  const fileName = normalizeMp4Name(title)

  return {
    title,
    directUrl,
    fileName,
    author: json?.data?.author?.nickname || 'Desconocido',
    duration: json?.data?.duration || 0
  }
}

async function downloadFile(url, fileName) {
  ensureTmpDir()

  const tempPath = path.join(
    TMP_DIR,
    `${TMP_FILE_PREFIX}${Date.now()}-${randomUUID()}-${normalizeMp4Name(fileName)}`
  )

  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*',
      'Referer': 'https://www.tiktok.com/'
    }
  })

  if (response.status >= 400) {
    const errorText = await readStreamToText(response.data).catch(() => '')
    throw new Error(errorText || `Error HTTP ${response.status}`)
  }

  const contentLength = Number(response.headers?.['content-length'] || 0)
  if (contentLength && contentLength > MAX_VIDEO_BYTES) {
    throw new Error('El video pesa demasiado para enviarlo por WhatsApp')
  }

  let downloaded = 0
  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_VIDEO_BYTES) {
      response.data.destroy(new Error('El video pesa demasiado para enviarlo por WhatsApp'))
    }
  })

  await pipeline(response.data, fs.createWriteStream(tempPath))

  if (!fs.existsSync(tempPath)) {
    throw new Error('No se pudo guardar el video')
  }

  const size = fs.statSync(tempPath).size
  if (!size || size < 100000) {
    deleteFileSafe(tempPath)
    throw new Error('El archivo descargado es inválido')
  }

  return { tempPath, size }
}

async function sendTikTokVideo(conn, chat, quoted, { filePath, fileName, title, size, author, duration }) {
  const buffer = fs.readFileSync(filePath)

  const caption =
    `⛓️ DENJI BOT ⛓️\n\n` +
    `⚡ *TIKTOK DESCARGADO*\n` +
    `🎬 *Título:* ${title}\n` +
    `👤 *Autor:* ${author}\n` +
    `⏱️ *Duración:* ${duration}s\n` +
    `💾 *Peso:* ${(size / 1024 / 1024).toFixed(2)} MB\n\n` +
    `> A la orden, soy Denji ⛓️`

  if (size > VIDEO_AS_DOCUMENT_THRESHOLD) {
    await conn.sendMessage(chat, {
      document: buffer,
      mimetype: 'video/mp4',
      fileName,
      caption: caption + '\n\n📦 Enviado como documento por peso.'
    }, { quoted })
    return
  }

  try {
    await conn.sendMessage(chat, {
      video: buffer,
      mimetype: 'video/mp4',
      fileName,
      caption
    }, { quoted })
  } catch {
    await conn.sendMessage(chat, {
      document: buffer,
      mimetype: 'video/mp4',
      fileName,
      caption: caption + '\n\n📦 Enviado como documento por compatibilidad.'
    }, { quoted })
  }
}

let handler = async (m, { conn, text }) => {
  let user = global.db.data.users[m.sender]
  if (!user) {
    global.db.data.users[m.sender] = { diamantes: 0 }
    user = global.db.data.users[m.sender]
  }

  const diamonds = user.diamantes || user.diamond || 0
  const videoUrl = resolveTikTokUrl(m, text)

  if (!videoUrl) {
    return conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `⚡ *USO CORRECTO*\n` +
        `🔗 .tt <link de TikTok>\n` +
        `🔗 .tt respondiendo a un mensaje con link\n\n` +
        `💎 Cuesta 1 diamante por descarga\n` +
        `> A la orden, soy Denji ⛓️`
    }, { quoted: m })
  }

  if (diamonds < 1) {
    return conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `💀 No tienes suficientes diamantes\n\n` +
        `💎 Necesitas: 1 diamante\n` +
        `🩸 Tienes: ${diamonds} diamantes\n\n` +
        `> Usa #work para ganar`
    }, { quoted: m })
  }

  let tempPath = null
  const oldDiamonds = diamonds

  try {
    await m.react('⚰️')

    user.diamantes = oldDiamonds - 1

    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `⚡ *DESCARGANDO TIKTOK...*\n` +
        `💎 -1 diamante\n\n` +
        `> Espera un momento ⛓️`
    }, { quoted: m })

    const meta = await getTikTokData(videoUrl)
    const downloaded = await downloadFile(meta.directUrl, meta.fileName)

    tempPath = downloaded.tempPath

    await sendTikTokVideo(conn, m.chat, m, {
      filePath: downloaded.tempPath,
      fileName: meta.fileName,
      title: meta.title,
      size: downloaded.size,
      author: meta.author,
      duration: meta.duration
    })

    await m.react('🩸')
  } catch (e) {
    console.log('DENJI TT ERROR =>', e)

    user.diamantes = oldDiamonds

    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `💀 Error al procesar el video\n\n` +
        `⚠️ ${e.message || 'No se pudo descargar'}`
    }, { quoted: m })
  } finally {
    deleteFileSafe(tempPath)
  }
}

handler.help = ['tt', 'tiktok']
handler.tags = ['downloader']
handler.command = /^(tt|tiktok)$/i
handler.desc = 'Descarga videos de TikTok por link'

export default handler
