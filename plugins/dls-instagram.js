import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { pipeline } from 'stream/promises'
import { spawn } from 'child_process'

const API_BASE = process.env.DV_API_URL
const API_KEY = process.env.DV_API_KEY
const API_INSTAGRAM_URL = `${API_BASE}/instagram`

const REQUEST_TIMEOUT = 120000
const MAX_MEDIA_BYTES = 200 * 1024 * 1024
const VIDEO_AS_DOCUMENT_THRESHOLD = 50 * 1024 * 1024
const TMP_DIR = path.join(process.cwd(), 'tmp', 'denji-instagram')

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })
}
ensureTmpDir()

function safeFileName(name) {
  return (
    String(name || 'instagram-media')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'instagram-media'
  )
}

function normalizeMediaFileName(name, mediaType = 'video') {
  const raw = String(name || '').trim()
  const defaultExt = mediaType === 'image' ? 'jpg' : 'mp4'
  const extMatch = raw.match(/\.([a-z0-9]+)$/i)
  const ext = extMatch ? extMatch[1].toLowerCase() : defaultExt
  const base = safeFileName(raw.replace(/\.[^.]+$/i, '') || 'instagram-media')
  return `${base}.${ext}`
}

function extractTextFromMessage(message) {
  return (
    message?.text ||
    message?.caption ||
    message?.body ||
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    message?.message?.documentMessage?.caption ||
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    ''
  )
}

function extractInstagramUrl(text) {
  const match = String(text || '').match(
    /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s]+/i
  )
  return match ? match[0].trim().replace(/[)\],>]+$/g, '') : ''
}

function resolveUserInput(m, text) {
  const args = String(text || '').trim().split(/\s+/).filter(Boolean)
  const quoted = m.quoted || m.msg?.contextInfo?.quotedMessage || null
  const quotedText = extractTextFromMessage(quoted)

  return {
    args,
    url: extractInstagramUrl(String(text || '').trim()) || extractInstagramUrl(quotedText) || ''
  }
}

function resolvePick(args) {
  const first = String(args?.[0] || '').trim()
  if (!/^\d+$/.test(first)) return 1
  const parsed = Number(first)
  if (!Number.isFinite(parsed)) return 1
  return Math.max(1, Math.min(parsed, 20))
}

function extractApiError(data, status) {
  return (
    data?.detail ||
    data?.error?.message ||
    data?.message ||
    data?.error ||
    (status ? `HTTP ${status}` : 'Error de API')
  )
}

function deleteFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}
}

function withApiKey(params = {}) {
  return {
    ...params,
    apikey: API_KEY
  }
}

function buildHeaders(extra = {}) {
  return {
    Accept: 'application/json,text/plain,*/*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
    Referer: `${API_BASE}/`,
    ...extra
  }
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

async function apiGet(url, params, timeout = REQUEST_TIMEOUT) {
  const response = await axios.get(url, {
    timeout,
    params: withApiKey(params),
    headers: buildHeaders(),
    validateStatus: () => true
  })

  const data = response.data

  if (response.status >= 400) {
    throw new Error(extractApiError(data, response.status))
  }

  if (data?.ok === false || data?.status === false) {
    throw new Error(extractApiError(data, response.status))
  }

  return data
}

async function requestInstagramInfo(postUrl, pick) {
  const data = await apiGet(API_INSTAGRAM_URL, {
    mode: 'link',
    url: postUrl,
    pick,
    lang: 'es'
  })

  const selected = data?.selected || {}
  const mediaType = String(selected?.type || data?.type || 'video').toLowerCase()

  return {
    title: safeFileName(data?.title || 'Instagram Media'),
    username: String(data?.username || '').trim() || null,
    description: String(data?.description || '').trim() || null,
    thumbnail: data?.thumbnail || null,
    mediaType,
    count: Number(data?.count || 1),
    pick: Number(data?.pick || pick || 1),
    fileName: normalizeMediaFileName(
      selected?.filename || data?.filename || 'instagram-media.mp4',
      mediaType
    ),
  }
}

async function downloadInstagramFile(postUrl, pick, outputPath, maxBytes = MAX_MEDIA_BYTES) {
  ensureTmpDir()

  const response = await axios.get(API_INSTAGRAM_URL, {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    params: withApiKey({
      mode: 'file',
      url: postUrl,
      pick,
      lang: 'es'
    }),
    headers: buildHeaders({ Accept: '*/*' }),
    validateStatus: () => true,
    maxRedirects: 5
  })

  if (response.status >= 400) {
    const errorText = await readStreamToText(response.data).catch(() => '')
    throw new Error(
      extractApiError(
        { message: errorText || 'No se pudo descargar el archivo.' },
        response.status
      )
    )
  }

  const contentLength = Number(response.headers?.['content-length'] || 0)
  if (contentLength && contentLength > maxBytes) {
    throw new Error('El archivo es demasiado grande para enviarlo por WhatsApp.')
  }

  let downloaded = 0
  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > maxBytes) {
      response.data.destroy(new Error('El archivo es demasiado grande para enviarlo por WhatsApp.'))
    }
  })

  await pipeline(response.data, fs.createWriteStream(outputPath))

  if (!fs.existsSync(outputPath)) {
    throw new Error('No se pudo guardar el archivo.')
  }

  const size = fs.statSync(outputPath).size

  if (!size || size < 30000) {
    deleteFileSafe(outputPath)
    throw new Error('El archivo descargado es inválido.')
  }

  if (size > maxBytes) {
    deleteFileSafe(outputPath)
    throw new Error('El archivo es demasiado grande para enviarlo por WhatsApp.')
  }

  return {
    tempPath: outputPath,
    size,
  }
}

async function convertVideoForWhatsApp(inputPath, outputPath) {
  ensureTmpDir()

  return await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-profile:v', 'main',
      '-level', '4.0',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-movflags', '+faststart',
      '-loglevel', 'error',
      outputPath,
    ], {
      stdio: ['ignore', 'ignore', 'pipe']
    })

    let errorText = ''

    ffmpeg.stderr.on('data', chunk => {
      errorText += chunk.toString()
    })

    ffmpeg.on('error', error => {
      if (error?.code === 'ENOENT') {
        reject(new Error('ffmpeg no está instalado en el hosting.'))
        return
      }
      reject(error)
    })

    ffmpeg.on('close', code => {
      if (code === 0) return resolve(true)
      reject(new Error(errorText.trim() || 'No se pudo convertir el video para WhatsApp.'))
    })
  })
}

async function hasAudioStream(filePath) {
  const target = String(filePath || '').trim()
  if (!target || !fs.existsSync(target)) return false

  return await new Promise(resolve => {
    const probe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      target,
    ], { stdio: ['ignore', 'pipe', 'ignore'] })

    let stdout = ''
    probe.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })

    probe.on('error', () => resolve(false))
    probe.on('close', code => {
      if (code !== 0) return resolve(false)
      resolve(stdout.toLowerCase().includes('audio'))
    })
  })
}

async function sendInstagramMedia(conn, chat, quoted, { filePath, fileName, mediaType, title, username, size }) {
  let caption =
    `⛓️ DENJI BOT ⛓️\n\n` +
    `🩸 *INSTAGRAM ARRANCADO*\n` +
    `📸 *Título:* ${title}\n`

  if (username) caption += `👤 *Autor:* ${username}\n`
  caption += `💾 *Peso:* ${(size / 1024 / 1024).toFixed(2)} MB\n\n`
  caption += `> A la orden, soy Denji ⛓️`

  if (mediaType === 'image') {
    await conn.sendMessage(chat, {
      image: { url: filePath },
      caption
    }, { quoted })
    return 'image'
  }

  if (size > VIDEO_AS_DOCUMENT_THRESHOLD) {
    await conn.sendMessage(chat, {
      document: { url: filePath },
      mimetype: 'video/mp4',
      fileName,
      caption: caption + '\n\n📦 Enviado como documento por peso.'
    }, { quoted })
    return 'document'
  }

  try {
    await conn.sendMessage(chat, {
      video: { url: filePath },
      mimetype: 'video/mp4',
      fileName,
      caption
    }, { quoted })
    return 'video'
  } catch (error) {
    await conn.sendMessage(chat, {
      document: { url: filePath },
      mimetype: 'video/mp4',
      fileName,
      caption: caption + '\n\n📦 Enviado como documento por compatibilidad.'
    }, { quoted })
    return 'document'
  }
}

function cleanInstagramError(err) {
  const msg = String(err?.message || err || '')

  if (msg.includes('504') || msg.includes('Gateway time-out') || msg.includes('Gateway Timeout')) {
    return 'La API tardó demasiado en responder. Intenta otra vez en unos segundos.'
  }

  if (msg.includes('ffmpeg no está instalado')) {
    return 'Falta ffmpeg en el hosting para convertir el video.'
  }

  if (msg.includes('demasiado grande')) {
    return 'El archivo pesa demasiado para enviarlo por WhatsApp.'
  }

  return msg.slice(0, 300) || 'No se pudo procesar la publicación de Instagram.'
}

let handler = async (m, { conn, text }) => {
  if (!API_BASE || !API_KEY) {
    return conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `💀 Falta configurar DV_API_URL o DV_API_KEY en el .env`
    }, { quoted: m })
  }

  let user = global.db.data.users[m.sender]
  if (!user) {
    global.db.data.users[m.sender] = { diamantes: 0 }
    user = global.db.data.users[m.sender]
  }

  const diamonds = user.diamantes || user.diamond || 0
  const input = resolveUserInput(m, text)
  const pick = resolvePick(input.args)
  const postUrl = input.url

  if (!postUrl) {
    return conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `⚡ *USO CORRECTO*\n` +
        `🔗 .instagram <link>\n` +
        `🔗 .ig <link>\n` +
        `🔗 .instagram 2 <link>\n\n` +
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

  let rawPath = null
  let finalPath = null
  const oldDiamonds = diamonds

  try {
    await m.react('⚰️')
    user.diamantes = oldDiamonds - 1

    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `🩸 *ARRANCANDO INSTAGRAM...*\n` +
        `💎 -1 diamante\n\n` +
        `> Espera un momento ⛓️`
    }, { quoted: m })

    const info = await requestInstagramInfo(postUrl, pick)
    rawPath = path.join(TMP_DIR, `${Date.now()}-raw-${info.fileName}`)
    const downloaded = await downloadInstagramFile(postUrl, pick, rawPath)

    let sendPath = downloaded.tempPath
    let sendSize = downloaded.size

    if (info.mediaType === 'video') {
      finalPath = path.join(TMP_DIR, `${Date.now()}-final-${normalizeMediaFileName(info.fileName, 'video')}`)
      const sourceHasAudio = await hasAudioStream(downloaded.tempPath)
      await convertVideoForWhatsApp(downloaded.tempPath, finalPath)

      if (!fs.existsSync(finalPath)) {
        throw new Error('No se pudo preparar el video final.')
      }

      sendPath = finalPath
      sendSize = fs.statSync(finalPath).size
      const convertedHasAudio = await hasAudioStream(finalPath)

      if (sourceHasAudio && !convertedHasAudio) {
        sendPath = downloaded.tempPath
        sendSize = downloaded.size
      }

      if (!sendSize || sendSize < 100000) {
        throw new Error('El video convertido es inválido.')
      }
    }

    await sendInstagramMedia(conn, m.chat, m, {
      filePath: sendPath,
      fileName: normalizeMediaFileName(info.fileName, info.mediaType),
      mediaType: info.mediaType,
      title: info.title,
      username: info.username,
      size: sendSize,
    })

    await m.react('🩸')
  } catch (err) {
    console.error('DENJI INSTAGRAM ERROR =>', err)
    user.diamantes = oldDiamonds

    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `💀 Error al procesar la publicación de Instagram\n\n` +
        `⚠️ ${cleanInstagramError(err)}`
    }, { quoted: m })
  } finally {
    deleteFileSafe(rawPath)
    deleteFileSafe(finalPath)
  }
}

handler.help = ['instagram', 'ig', 'igdl']
handler.tags = ['downloader']
handler.command = /^(instagram|ig|igdl)$/i
handler.desc = 'Descarga publicaciones de Instagram'

export default handler
