import fs from 'fs'
import path from 'path'
import os from 'os'
import axios from 'axios'
import { pipeline } from 'stream/promises'

const API_BASE = process.env.DV_API_URL
const API_KEY = process.env.DV_API_KEY
const API_MEGA_URL = `${API_BASE}/mega`

const REQUEST_TIMEOUT = 180000
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024
const TMP_DIR = path.join(os.tmpdir(), 'denji-mega')

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

function safeFileName(name) {
  return (
    String(name || 'mega-file')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140) || 'mega-file'
  )
}

function normalizeFileName(name, fallback = 'mega-file') {
  const raw = String(name || '').trim()
  const extMatch = raw.match(/(\.[a-z0-9]{1,10})$/i)
  const ext = extMatch ? extMatch[1] : ''
  const base = safeFileName(raw.replace(/\.[^.]+$/i, '') || fallback)
  return `${base}${ext}`
}

function mimeFromFileName(fileName) {
  const lower = String(fileName || '').toLowerCase()
  if (lower.endsWith('.apk')) return 'application/vnd.android.package-archive'
  if (lower.endsWith('.xapk')) return 'application/xapk-package-archive'
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.zip')) return 'application/zip'
  if (lower.endsWith('.rar')) return 'application/vnd.rar'
  if (lower.endsWith('.7z')) return 'application/x-7z-compressed'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.bin')) return 'application/octet-stream'
  return 'application/octet-stream'
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

function extractMegaUrl(text) {
  const match = String(text || '').match(
    /https?:\/\/(?:www\.)?(?:mega\.nz|mega\.co\.nz)\/[^\s]+/i
  )
  return match ? match[0].trim().replace(/[)\],>]+$/g, '') : ''
}

function extractApiError(data, status) {
  return (
    data?.detail ||
    data?.error?.message ||
    data?.message ||
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

function humanBytes(bytes) {
  const size = Number(bytes || 0)
  if (!size || size < 1) return null

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
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

async function apiGet(url, params, timeout = 45000) {
  const response = await axios.get(url, {
    timeout,
    params: withApiKey(params),
    headers: buildHeaders(),
    validateStatus: () => true,
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

async function requestMegaMeta(fileUrl) {
  const data = await apiGet(API_MEGA_URL, {
    mode: 'link',
    url: fileUrl,
  })

  return {
    title: safeFileName(data?.title || data?.filename || 'MEGA File'),
    fileName: normalizeFileName(data?.filename || 'mega-file'),
    fileSize: String(data?.filesize || '').trim() || null,
    fileSizeBytes: Number(data?.filesize_bytes || 0) || null,
    format: String(data?.format || '').trim() || null,
  }
}

async function downloadMegaFile(fileUrl, outputPath) {
  const response = await axios.get(API_MEGA_URL, {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    params: withApiKey({
      mode: 'file',
      url: fileUrl,
    }),
    headers: buildHeaders({ Accept: '*/*' }),
    validateStatus: () => true,
    maxRedirects: 5,
  })

  if (response.status >= 400) {
    const errorText = await readStreamToText(response.data).catch(() => '')
    let parsed = null

    try {
      parsed = JSON.parse(errorText)
    } catch {}

    throw new Error(
      extractApiError(
        parsed || { message: errorText || 'No se pudo descargar el archivo.' },
        response.status
      )
    )
  }

  const contentLength = Number(response.headers?.['content-length'] || 0)
  if (contentLength && contentLength > MAX_FILE_BYTES) {
    throw new Error('El archivo es demasiado grande para enviarlo por WhatsApp.')
  }

  let downloaded = 0

  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_FILE_BYTES) {
      response.data.destroy(new Error('El archivo es demasiado grande para enviarlo por WhatsApp.'))
    }
  })

  await pipeline(response.data, fs.createWriteStream(outputPath))

  if (!fs.existsSync(outputPath)) {
    throw new Error('No se pudo guardar el archivo.')
  }

  const size = fs.statSync(outputPath).size
  if (!size || size < 1) {
    deleteFileSafe(outputPath)
    throw new Error('El archivo descargado es inválido.')
  }

  if (size > MAX_FILE_BYTES) {
    deleteFileSafe(outputPath)
    throw new Error('El archivo es demasiado grande para enviarlo por WhatsApp.')
  }

  const detectedName = parseContentDispositionFileName(
    response.headers?.['content-disposition']
  )

  return {
    tempPath: outputPath,
    size,
    fileName: normalizeFileName(detectedName || path.basename(outputPath), 'mega-file'),
  }
}

async function sendMegaDocument(conn, chat, quoted, payload) {
  const { filePath, fileName, title, fileSize, fileSizeBytes, size } = payload

  let caption =
    `⛓️ DENJI BOT ⛓️\n\n` +
    `⚡ *MEGA DESCARGADO*\n` +
    `📦 *Archivo:* ${title}\n`

  if (fileSize) {
    caption += `💾 *Tamaño:* ${fileSize}\n`
  } else {
    const pretty = humanBytes(fileSizeBytes || size)
    if (pretty) caption += `💾 *Tamaño:* ${pretty}\n`
  }

  caption += `\n> A la orden, soy Denji ⛓️`

  await conn.sendMessage(chat, {
    document: { url: filePath },
    mimetype: mimeFromFileName(fileName),
    fileName,
    caption
  }, { quoted })
}

let handler = async (m, { conn, text }) => {
  let user = global.db.data.users[m.sender]
  if (!user) {
    global.db.data.users[m.sender] = { diamantes: 0 }
    user = global.db.data.users[m.sender]
  }

  const diamonds = user.diamantes || user.diamond || 0
  const rawInput = resolveUserInput(m, text)
  const fileUrl = extractMegaUrl(rawInput)

  if (!fileUrl) {
    return conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `⚡ *USO CORRECTO*\n` +
        `🔗 .mega <link público de mega>\n` +
        `🔗 También puedes responder a un mensaje con el link\n\n` +
        `📦 Solo archivos, no carpetas\n` +
        `💎 Cuesta 1 diamante por descarga\n\n` +
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
        `⚡ *PREPARANDO MEGA...*\n` +
        `💎 -1 diamante\n\n` +
        `> Espera un momento ⛓️`
    }, { quoted: m })

    const info = await requestMegaMeta(fileUrl)
    tempPath = path.join(TMP_DIR, `${Date.now()}-${info.fileName}`)

    const downloaded = await downloadMegaFile(fileUrl, tempPath)

    await sendMegaDocument(conn, m.chat, m, {
      filePath: downloaded.tempPath,
      fileName: normalizeFileName(downloaded.fileName || info.fileName, 'mega-file'),
      title: info.title,
      fileSize: info.fileSize,
      fileSizeBytes: info.fileSizeBytes,
      size: downloaded.size,
    })

    await m.react('🩸')
  } catch (error) {
    console.error('DENJI MEGA ERROR =>', error)
    user.diamantes = oldDiamonds

    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `💀 Error al procesar el archivo de MEGA\n\n` +
        `⚠️ ${error?.message || 'No se pudo descargar el archivo'}`
    }, { quoted: m })
  } finally {
    deleteFileSafe(tempPath)
  }
}

handler.help = ['mega', 'megadl']
handler.tags = ['downloader']
handler.command = /^(mega|megadl)$/i
handler.desc = 'Descarga archivos desde enlaces públicos de MEGA'

export default handler
