import fs from 'fs'
import path from 'path'
import os from 'os'
import { File } from 'megajs'
import { pipeline } from 'stream/promises'

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024
const TMP_DIR = path.join(os.tmpdir(), 'denji-mega')

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

function safeFileName(name) {
  return String(name || 'mega-file').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140) || 'mega-file'
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
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.zip')) return 'application/zip'
  if (lower.endsWith('.rar')) return 'application/vnd.rar'
  if (lower.endsWith('.7z')) return 'application/x-7z-compressed'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

function extractTextFromMessage(message) {
  return (
    message?.text || message?.caption || message?.body ||
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    message?.message?.documentMessage?.caption ||
    message?.conversation || message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption || message?.videoMessage?.caption ||
    message?.documentMessage?.caption || ''
  )
}

function resolveUserInput(m, text) {
  const quoted = m.quoted || m.msg?.contextInfo?.quotedMessage || null
  const quotedText = extractTextFromMessage(quoted)
  return String(text || '').trim() || quotedText || ''
}

function extractMegaUrl(text) {
  const match = String(text || '').match(/https?:\/\/(?:www\.)?(?:mega\.nz|mega\.co\.nz)\/[^\s]+/i)
  return match ? match[0].trim().replace(/[)\],>]+$/g, '') : ''
}

function deleteFileSafe(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}
}

function humanBytes(bytes) {
  const size = Number(bytes || 0)
  if (!size || size < 1) return null
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size, index = 0
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index++ }
  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

async function downloadFromMega(fileUrl, tmpDir) {
  const file = File.fromURL(fileUrl)
  await file.loadAttributes()

  if (file.size && file.size > MAX_FILE_BYTES) throw new Error('Archivo demasiado grande')

  const fileName = normalizeFileName(file.name || 'mega-file')
  const tempPath = path.join(tmpDir, `${Date.now()}-${fileName}`)
  const downloadStream = file.download({ maxConnections: 4 })

  try {
    await pipeline(downloadStream, fs.createWriteStream(tempPath))
  } catch (e) {
    deleteFileSafe(tempPath)
    throw new Error('No se pudo completar la descarga desde MEGA')
  }

  const size = fs.statSync(tempPath).size
  if (!size || size < 1) { deleteFileSafe(tempPath); throw new Error('Archivo descargado inválido') }

  return { tempPath, size, fileName, title: safeFileName(file.name || 'MEGA File') }
}

let handler = async (m, { conn, text }) => {
  let user = global.db.data.users[m.sender]
  if (!user) { global.db.data.users[m.sender] = { diamantes: 0 }; user = global.db.data.users[m.sender] }

  const diamonds = user.diamantes ?? user.diamond ?? 0
  const rawInput = resolveUserInput(m, text)
  const fileUrl = extractMegaUrl(rawInput)

  if (!fileUrl) {
    return conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '🔪 Descarga archivos desde MEGA',
        '',
        '> #mega <link público de MEGA>',
        '> También puedes responder a un mensaje con el link',
        '',
        '💀 Solo archivos, no carpetas',
        '💎 Cuesta 1 diamante por descarga',
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }

  if (/\/folder\//i.test(fileUrl)) {
    return conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 Solo se aceptan links de archivos, no de carpetas'
    }, { quoted: m })
  }

  if (diamonds < 1) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Sin diamantes (tienes ${diamonds})\n> Usa #work para ganar`
    }, { quoted: m })
  }

  let tempPath = null
  const oldDiamonds = diamonds

  try {
    await m.react('⚰️')
    user.diamantes = oldDiamonds - 1

    await conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n🔪 Descargando desde MEGA...\n💎 -1 diamante'
    }, { quoted: m })

    const result = await downloadFromMega(fileUrl, TMP_DIR)
    tempPath = result.tempPath

    await conn.sendMessage(m.chat, {
      document: { url: result.tempPath },
      mimetype: mimeFromFileName(result.fileName),
      fileName: result.fileName,
      caption: [
        '🩸 DENJI BOT 🩸',
        '',
        '🔪 Descarga completada',
        `💀 Archivo: *${result.title}*`,
        `💀 Tamaño: *${humanBytes(result.size)}*`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })

    await m.react('🩸')

  } catch (error) {
    console.error('MEGA ERROR =>', error)
    user.diamantes = oldDiamonds
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error al descargar de MEGA\n> ${error?.message || 'Intenta más tarde'}\n\n💎 Diamante devuelto`
    }, { quoted: m })
  } finally {
    deleteFileSafe(tempPath)
  }
}

handler.help = ['mega', 'megadl']
handler.tags = ['downloader']
handler.command = /^(mega|megadl)$/i
handler.desc = 'Descarga archivos desde enlaces públicos de MEGA 💎1'

export default handler
