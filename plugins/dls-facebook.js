import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { pipeline } from 'stream/promises'
import { randomUUID } from 'crypto'

const API_BASE = process.env.DV_API_URL
const API_KEY = process.env.DV_API_KEY
const API_FACEBOOK_URL = `${API_BASE}/facebook`

const VIDEO_QUALITY = 'auto'
const REQUEST_TIMEOUT = 120000
const MAX_VIDEO_BYTES = 800 * 1024 * 1024
const VIDEO_AS_DOCUMENT_THRESHOLD = 45 * 1024 * 1024

const TMP_DIR = path.join(process.cwd(), 'tmp', 'denji-facebook')

ensureTmpDir()

function ensureTmpDir() {
  try {
    fs.mkdirSync(TMP_DIR, { recursive: true })
  } catch {}
}

function safeFileName(name) {
  return (
    String(name || 'facebook-video')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'facebook-video'
  )
}

function normalizeMp4Name(name) {
  const clean = safeFileName(String(name || 'facebook-video').replace(/\.mp4$/i, ''))
  return `${clean || 'facebook-video'}.mp4`
}

function buildTempPath(fileName) {
  ensureTmpDir()
  return path.join(
    TMP_DIR,
    `${Date.now()}-${randomUUID()}-${normalizeMp4Name(fileName)}`
  )
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

function resolveUserInput(m, text) {
  const quoted = m.quoted || m.msg?.contextInfo?.quotedMessage || null
  const quotedText = extractTextFromMessage(quoted)
  return String(text || '').trim() || quotedText || ''
}

function extractFacebookUrl(text) {
  const match = String(text || '').match(
    /https?:\/\/(?:www\.)?(?:facebook\.com|m\.facebook\.com|fb\.watch)\/[^\s]+/i
  )
  return match ? match[0].trim().replace(/[)\],>]+$/g, '') : ''
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

function parseContentDispositionFileName(headerValue) {
  const text = String(headerValue || '')
  const utfMatch = text.match(/filename\*=UTF-8''([^;]+)/i)

  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]).replace(/["']/g, '').trim()
    } catch {}
  }

  const normalMatch = text.match(/filename="?([^"]+)"?/i)
  if (normalMatch?.[1]) return normalMatch[1].trim()

  return ''
}

function deleteFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}
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

function appendApiKeyToUrl(url) {
  const u = new URL(url)
  if (!u.searchParams.get('apikey')) u.searchParams.set('apikey', API_KEY)
  return u.toString()
}

async function apiGet(url, params, timeout = 45000) {
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

function pickApiDownloadUrl(data) {
  return (
    data?.download_url_full ||
    data?.stream_url_full ||
    data?.download_url ||
    data?.stream_url ||
    data?.url ||
    data?.result?.download_url_full ||
    data?.result?.stream_url_full ||
    data?.result?.download_url ||
    data?.result?.stream_url ||
    data?.result?.url ||
    ''
  )
}

async function requestFacebookMeta(videoUrl) {
  const data = await apiGet(API_FACEBOOK_URL, {
    mode: 'link',
    quality: VIDEO_QUALITY,
    url: videoUrl
  })

  return {
    title: safeFileName(data?.title || data?.result?.title || 'Facebook Video'),
    description: String(data?.description || data?.result?.description || '').trim() || null,
    duration: String(data?.duration || data?.result?.duration || '').trim() || null,
    thumbnail: data?.thumbnail || data?.result?.thumbnail || null,
    fileName: normalizeMp4Name(
      data?.filename || data?.file_name || data?.result?.filename || 'facebook-video.mp4'
    ),
    downloadUrl: pickApiDownloadUrl(data)
  }
}

async function downloadFacebookVideo(videoUrl, outputPath, directUrl = '') {
  ensureTmpDir()

  const hasDirectUrl = /^https?:\/\//i.test(String(directUrl || '').trim())
  const requestUrl = hasDirectUrl ? appendApiKeyToUrl(directUrl) : API_FACEBOOK_URL

  const requestConfig = {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    maxRedirects: 5,
    headers: buildHeaders({ Accept: '*/*' }),
    validateStatus: () => true
  }

  if (!hasDirectUrl) {
    requestConfig.params = withApiKey({
      mode: 'file',
      quality: VIDEO_QUALITY,
      url: videoUrl
    })
  }

  const response = await axios.get(requestUrl, requestConfig)

  if (response.status >= 400) {
    const errorText = await readStreamToText(response.data).catch(() => '')
    let parsed = null

    try {
      parsed = JSON.parse(errorText)
    } catch {}

    throw new Error(
      extractApiError(
        parsed || { message: errorText || 'No se pudo descargar el video.' },
        response.status
      )
    )
  }

  const contentLength = Number(response.headers?.['content-length'] || 0)

  if (contentLength && contentLength > MAX_VIDEO_BYTES) {
    throw new Error('El video es demasiado grande para enviarlo por WhatsApp.')
  }

  let downloaded = 0

  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_VIDEO_BYTES) {
      response.data.destroy(new Error('El video es demasiado grande para enviarlo por WhatsApp.'))
    }
  })

  await pipeline(response.data, fs.createWriteStream(outputPath))

  if (!fs.existsSync(outputPath)) {
    throw new Error('No se pudo guardar el video.')
  }

  const size = fs.statSync(outputPath).size

  if (!size || size < 100000) {
    deleteFileSafe(outputPath)
    throw new Error('El archivo descargado es inválido.')
  }

  if (size > MAX_VIDEO_BYTES) {
    deleteFileSafe(outputPath)
    throw new Error('El video es demasiado grande para enviarlo por WhatsApp.')
  }

  const detectedName = parseContentDispositionFileName(
    response.headers?.['content-disposition']
  )

  return {
    tempPath: outputPath,
    size,
    fileName: normalizeMp4Name(detectedName || path.basename(outputPath))
  }
}

async function sendVideoOrDocument(conn, chat, quoted, options) {
  const {
    filePath,
    fileName,
    title,
    caption = null,
    documentThreshold = VIDEO_AS_DOCUMENT_THRESHOLD,
    size = 0
  } = options

  const finalCaption =
    caption ||
    `⛓️ DENJI BOT ⛓️\n\n⚡ *FACEBOOK DESCARGADO*\n🎬 ${title || fileName}\n\n> A la orden, soy Denji ⛓️`

  if (size > documentThreshold) {
    await conn.sendMessage(chat, {
      document: { url: filePath },
      mimetype: 'video/mp4',
      fileName,
      caption: finalCaption + '\n\n📦 Enviado como documento por peso.'
    }, { quoted })
    return 'document'
  }

  try {
    await conn.sendMessage(chat, {
      video: { url: filePath },
      mimetype: 'video/mp4',
      fileName,
      caption: finalCaption
    }, { quoted })
    return 'video'
  } catch (error) {
    await conn.sendMessage(chat, {
      document: { url: filePath },
      mimetype: 'video/mp4',
      fileName,
      caption: finalCaption + '\n\n📦 Enviado como documento por compatibilidad.'
    }, { quoted })
    return 'document'
  }
}

let handler = async (m, { conn, text }) => {
  if (!API_BASE || !API_KEY) {
    return conn.sendMessage(m.chat, {
      text: '⛓️ DENJI BOT ⛓️\n\n💀 Falta configurar DV_API_URL o DV_API_KEY en el .env'
    }, { quoted: m })
  }

  let user = global.db.data.users[m.sender]
  if (!user) {
    global.db.data.users[m.sender] = { diamantes: 0 }
    user = global.db.data.users[m.sender]
  }

  const diamonds = user.diamantes || user.diamond || 0
  const rawInput = resolveUserInput(m, text)
  const videoUrl = extractFacebookUrl(rawInput)

  if (!videoUrl) {
    return conn.sendMessage(m.chat, {
      text:
        '⛓️ DENJI BOT ⛓️\n\n' +
        '⚡ *USO CORRECTO*\n' +
        '🔗 .facebook <link público de Facebook>\n' +
        '🔗 .fb <link>\n' +
        '🔗 También puedes responder a un mensaje con el link\n\n' +
        '💎 Cuesta 1 diamante por descarga\n' +
        '> A la orden, soy Denji ⛓️'
    }, { quoted: m })
  }

  if (diamonds < 1) {
    return conn.sendMessage(m.chat, {
      text:
        '⛓️ DENJI BOT ⛓️\n\n' +
        '💀 No tienes suficientes diamantes\n\n' +
        '💎 Necesitas: 1 diamante\n' +
        `🩸 Tienes: ${diamonds} diamantes\n\n` +
        '> Usa #work para ganar'
    }, { quoted: m })
  }

  let tempPath = null
  const oldDiamonds = diamonds

  try {
    await m.react('⚰️')
    user.diamantes = oldDiamonds - 1

    await conn.sendMessage(m.chat, {
      text:
        '⛓️ DENJI BOT ⛓️\n\n' +
        '⚡ *PREPARANDO FACEBOOK...*\n' +
        '💎 -1 diamante\n\n' +
        '> Espera un momento ⛓️'
    }, { quoted: m })

    const info = await requestFacebookMeta(videoUrl)

    if (info.thumbnail) {
      let preview =
        '⛓️ DENJI BOT ⛓️\n\n' +
        '⚡ *FACEBOOK VIDEO*\n' +
        `🎬 ${info.title}\n`

      if (info.duration) preview += `⏱️ Duración: ${info.duration}\n`
      if (info.description) preview += `\n${info.description.slice(0, 300)}`

      await conn.sendMessage(m.chat, {
        image: { url: info.thumbnail },
        caption: preview
      }, { quoted: m })
    }

    tempPath = buildTempPath(info.fileName)

    const downloaded = await downloadFacebookVideo(videoUrl, tempPath, info.downloadUrl)

    const caption =
      '⛓️ DENJI BOT ⛓️\n\n' +
      '⚡ *FACEBOOK ENVIADO*\n' +
      `🎬 ${info.title}\n` +
      `${info.duration ? `⏱️ Duración: ${info.duration}\n` : ''}` +
      `💾 Peso: ${(downloaded.size / 1024 / 1024).toFixed(2)} MB\n\n` +
      '> A la orden, soy Denji ⛓️'

    await sendVideoOrDocument(conn, m.chat, m, {
      filePath: downloaded.tempPath,
      fileName: normalizeMp4Name(downloaded.fileName || info.fileName),
      title: info.title,
      size: downloaded.size,
      documentThreshold: VIDEO_AS_DOCUMENT_THRESHOLD,
      caption
    })

    await m.react('🩸')
  } catch (error) {
    console.error('DENJI FACEBOOK ERROR =>', error)
    user.diamantes = oldDiamonds

    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text:
        '⛓️ DENJI BOT ⛓️\n\n' +
        '💀 Error al procesar el video de Facebook\n\n' +
        `⚠️ ${error?.message || 'No se pudo descargar el video'}`
    }, { quoted: m })
  } finally {
    deleteFileSafe(tempPath)
  }
}

handler.help = ['facebook', 'fb', 'fbmp4']
handler.tags = ['downloader']
handler.command = /^(facebook|fb|fbmp4)$/i
handler.desc = 'Descarga videos públicos de Facebook'

export default handler
