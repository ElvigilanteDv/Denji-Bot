import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { pipeline } from 'stream/promises'

const API_BASE    = process.env.DV_API_URL || 'https://dv-yer-api.online'
const API_KEY     = process.env.DV_API_KEY || ''
const MAX_BYTES   = 1024 * 1024 * 1024
const REQ_TIMEOUT = 120_000
const TMP_DIR     = path.join(os.tmpdir(), 'denji-mega')

function ensureTmpDir() {
  try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}
}
ensureTmpDir()

function deleteFileSafe(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}
}

function mimeFromFileName(fileName) {
  const lower = String(fileName || '').toLowerCase()
  if (lower.endsWith('.apk'))    return 'application/vnd.android.package-archive'
  if (lower.endsWith('.xapk'))   return 'application/xapk-package-archive'
  if (lower.endsWith('.zip'))    return 'application/zip'
  if (lower.endsWith('.rar'))    return 'application/vnd.rar'
  if (lower.endsWith('.7z'))     return 'application/x-7z-compressed'
  if (lower.endsWith('.mp3'))    return 'audio/mpeg'
  if (lower.endsWith('.mp4'))    return 'video/mp4'
  if (lower.endsWith('.mkv'))    return 'video/x-matroska'
  if (lower.endsWith('.pdf'))    return 'application/pdf'
  if (lower.endsWith('.txt'))    return 'text/plain'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png'))    return 'image/png'
  if (lower.endsWith('.exe'))    return 'application/x-msdownload'
  if (lower.endsWith('.iso'))    return 'application/x-iso9660-image'
  if (lower.endsWith('.mcpack') || lower.endsWith('.mcaddon') || lower.endsWith('.mcworld')) return 'application/octet-stream'
  return 'application/octet-stream'
}

function humanBytes(bytes) {
  const size = Number(bytes || 0)
  if (!size) return null
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size, index = 0
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index++ }
  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

function safeFileName(name) {
  return String(name || 'mega-file')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'mega-file'
}

function normalizeFileName(name) {
  const raw      = String(name || 'mega-file').trim()
  const extMatch = raw.match(/(\.[a-z0-9]{1,10})$/i)
  const ext      = extMatch ? extMatch[1] : ''
  const base     = safeFileName(raw.replace(/\.[^.]+$/i, '') || 'mega-file')
  return `${base}${ext}`
}

function buildParams(extra = {}) {
  const params = new URLSearchParams({ ...extra })
  if (API_KEY) params.set('apikey', API_KEY) // ← apikey, no api_key
  return params.toString()
}

async function getMegaMeta(fileUrl) {
  const url  = `${API_BASE}/mega?${buildParams({ mode: 'link', url: fileUrl })}`
  const res  = await fetch(url, { timeout: 45_000 })
  const data = await res.json()
  if (!data?.ok) throw new Error(data?.detail || data?.message || 'No se pudo obtener info del archivo')
  return {
    title:     safeFileName(data.title || data.filename || 'MEGA File'),
    fileName:  normalizeFileName(data.filename || 'mega-file'),
    fileSize:  String(data.filesize || '').trim() || humanBytes(data.filesize_bytes) || null,
    format:    String(data.format   || '').trim() || null,
    streamUrl: data.stream_url || data.download_url || null,
  }
}

async function downloadFromStream(streamUrl, outputPath) {
  ensureTmpDir()
  const res = await fetch(streamUrl, {
    timeout: REQ_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
      'Accept': '*/*'
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar`)
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('text/html')) throw new Error('La API bloqueó la descarga')
  const contentLength = Number(res.headers.get('content-length') || 0)
  if (contentLength && contentLength > MAX_BYTES) throw new Error('Archivo demasiado grande')
  let downloaded = 0
  res.body.on('data', (chunk) => {
    downloaded += chunk.length
    if (downloaded > MAX_BYTES) res.body.destroy(new Error('Archivo demasiado grande'))
  })
  try {
    await pipeline(res.body, fs.createWriteStream(outputPath))
  } catch (e) {
    deleteFileSafe(outputPath)
    throw e
  }
  if (!fs.existsSync(outputPath)) throw new Error('No se pudo guardar el archivo')
  const size = fs.statSync(outputPath).size
  if (!size || size < 1) { deleteFileSafe(outputPath); throw new Error('El archivo descargado es inválido') }
  if (size > MAX_BYTES)  { deleteFileSafe(outputPath); throw new Error('Archivo demasiado grande') }
  return size
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text || !text.includes('mega.nz')) {
    return conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '🔪 Descarga archivos directamente',
        'desde MEGA a WhatsApp',
        '',
        '> *Uso:*',
        `> ${usedPrefix}${command} <link de MEGA>`,
        '',
        '> *Ejemplo:*',
        `> ${usedPrefix}${command} https://mega.nz/file/...`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }

  await m.react('🩸')

  let tempPath = null

  try {
    ensureTmpDir()

    const info = await getMegaMeta(text.trim())
    if (!info.streamUrl) throw new Error('La API no devolvió URL de descarga')

    tempPath = path.join(TMP_DIR, `${Date.now()}-${normalizeFileName(info.fileName)}`)

    await conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        `🔪 *Archivo:* ${info.title}`,
        `💀 *Tamaño:* ${info.fileSize || 'Calculando...'}`,
        `🗡️ *Formato:* ${info.format || info.fileName.split('.').pop()?.toUpperCase() || '?'}`,
        '',
        '> Descargando tu presa...'
      ].join('\n')
    }, { quoted: m })

    const size = await downloadFromStream(info.streamUrl, tempPath)

    await conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n⚰️ Enviando a WhatsApp...'
    }, { quoted: m })

    const fileName = normalizeFileName(info.fileName)

    await conn.sendMessage(m.chat, {
      document: { stream: fs.createReadStream(tempPath) },
      fileName,
      mimetype: mimeFromFileName(fileName),
      fileLength: size,
      caption: [
        '🩸 DENJI BOT 🩸',
        '',
        `🔪 *Archivo:* ${info.title}`,
        `💀 *Tamaño:* ${info.fileSize || humanBytes(size) || 'Desconocido'}`,
        `🗡️ *Formato:* ${info.format || fileName.split('.').pop()?.toUpperCase() || 'FILE'}`,
        '',
        '> ✅ Descarga completada correctamente',
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m, timeout: 600_000 })

    await m.react('🩸')

  } catch (e) {
    console.error('[MEGA ERROR]', e?.message || e)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '💀 *Error al descargar:*',
        `> ${e.message}`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  } finally {
    deleteFileSafe(tempPath)
  }
}

handler.help    = ['mega']
handler.tags    = ['downloader']
handler.command = /^(mega)$/i
handler.desc    = 'Descarga archivos de MEGA'

export default handler
