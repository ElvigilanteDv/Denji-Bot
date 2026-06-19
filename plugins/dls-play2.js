import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { pipeline } from 'stream/promises'
import { spawn } from 'child_process'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const REQUEST_TIMEOUT = 120000
const MAX_VIDEO_BYTES = 1500 * 1024 * 1024
const VIDEO_AS_DOCUMENT_THRESHOLD = 70 * 1024 * 1024
const VIGILANTE_API = 'https://elvigilante-api.onrender.com/api'
const VIGILANTE_KEY = 'elvigilante'
const VIDEO_QUALITY = '720p'

const _processing = new Set()

function safeFileName(name) {
  return String(name || 'media').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'media'
}
function isHttpUrl(v) { return /^https?:\/\//i.test(String(v || '')) }
function extractYouTubeUrl(text) {
  const m = String(text || '').match(/https?:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\/[^\s]+/i)
  return m ? m[0].trim() : ''
}
function normalizeMp4Name(name) {
  const clean = safeFileName(String(name || 'video').replace(/\.mp4$/i, ''))
  return `${clean || 'video'}.mp4`
}
function deleteFileSafe(fp) {
  try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp) } catch {}
}
function parseContentDisposition(h) {
  const t = String(h || '')
  const u = t.match(/filename\*=UTF-8''([^;]+)/i)
  if (u?.[1]) { try { return decodeURIComponent(u[1]).replace(/["']/g, '').trim() } catch {} }
  const n = t.match(/filename="?([^"]+)"?/i)
  return n?.[1]?.trim() || ''
}
async function readStreamToText(stream) {
  return new Promise((res, rej) => {
    let d = ''
    stream.on('data', c => (d += c.toString()))
    stream.on('end', () => res(d))
    stream.on('error', rej)
  })
}

function getDiamantes(user) { return user?.diamantes ?? user?.diamond ?? 0 }
function restarDiamante(user) {
  if (user.diamantes !== undefined) user.diamantes = (user.diamantes || 0) - 1
  else user.diamond = (user.diamond || 0) - 1
}
function devolverDiamante(user, anterior) {
  if (user.diamantes !== undefined) user.diamantes = anterior
  else user.diamond = anterior
}

async function downloadVideo(downloadUrl, outputPath) {
  const response = await axios.get(downloadUrl, {
    responseType: 'stream', timeout: REQUEST_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
    validateStatus: () => true, maxRedirects: 10,
  })
  if (response.status >= 400) {
    const err = await readStreamToText(response.data).catch(() => '')
    throw new Error(err || 'Error al descargar el video')
  }
  let downloaded = 0
  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_VIDEO_BYTES) response.data.destroy(new Error('Video demasiado grande'))
  })
  try { await pipeline(response.data, fs.createWriteStream(outputPath)) }
  catch (e) { deleteFileSafe(outputPath); throw e }
  if (!fs.existsSync(outputPath)) throw new Error('No se pudo guardar el video')
  const size = fs.statSync(outputPath).size
  if (!size || size < 150000) { deleteFileSafe(outputPath); throw new Error('Video inválido o vacío') }
  const fromHeader = parseContentDisposition(response.headers?.['content-disposition'])
  return { size, fileName: normalizeMp4Name(fromHeader || 'video.mp4') }
}

async function normalizeForWhatsApp(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y', '-i', inputPath,
      '-vf', 'scale=640:trunc(ow/a/2)*2',
      '-c:v', 'libx264', '-b:v', '800k', '-preset', 'fast',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', '-loglevel', 'error',
      outputPath
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    ff.on('error', reject)
    ff.on('close', code => { if (code === 0) resolve(true); else reject(new Error('ffmpeg error')) })
  })
}

async function sendVideo(conn, m, videoUrl, title) {
  const res = await fetch(`${VIGILANTE_API}/download/ytvideo?url=${encodeURIComponent(videoUrl)}&quality=${VIDEO_QUALITY}&apiKey=${VIGILANTE_KEY}`)
  const json = await res.json()
  if (!json.status || !json.result?.download_url) throw new Error('⛓️ La motosierra no pudo cortar el video')

  const downloadUrl = json.result.download_url
  const finalTitle = safeFileName(json.result.title || title)

  try {
    await conn.sendMessage(m.chat, {
      video: { url: downloadUrl },
      mimetype: 'video/mp4',
      fileName: `${finalTitle}.mp4`,
      caption: `⛓️ DENJI BOT ⛓️\n\n🔩 ¡Video cortado!\n🩸 ${finalTitle}\n💀 Calidad: ${json.result.quality || VIDEO_QUALITY}`
    }, { quoted: m })
    return finalTitle
  } catch {
    const rawFile = path.join(TEMP_DIR, `yt_${Date.now()}.mp4`)
    const finalFile = path.join(TEMP_DIR, `yt_final_${Date.now()}.mp4`)
    try {
      const videoInfo = await downloadVideo(downloadUrl, rawFile)
      const finalName = normalizeMp4Name(videoInfo.fileName || finalTitle)
      if (videoInfo.size > VIDEO_AS_DOCUMENT_THRESHOLD) {
        await conn.sendMessage(m.chat, {
          document: fs.readFileSync(rawFile), mimetype: 'video/mp4',
          fileName: finalName, caption: `⛓️ DENJI BOT ⛓️\n\n💀 Video muy grande\n🩸 ${finalTitle}`
        }, { quoted: m })
      } else {
        await normalizeForWhatsApp(rawFile, finalFile)
        const filePath = fs.existsSync(finalFile) ? finalFile : rawFile
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(filePath), mimetype: 'video/mp4',
          fileName: finalName, caption: `⛓️ DENJI BOT ⛓️\n\n🔩 ¡Video cortado!\n🩸 ${finalTitle}`
        }, { quoted: m })
      }
    } finally {
      deleteFileSafe(rawFile)
      deleteFileSafe(finalFile)
    }
    return finalTitle
  }
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const msgKey = `main_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 15000)

  let user = global.db.data.users[m.sender]
  if (!user) { global.db.data.users[m.sender] = { diamantes: 0, diamond: 0 }; user = global.db.data.users[m.sender] }

  const input = text?.trim()

  if (!input) {
    let media = null
    try { media = await prepareWAMessageMedia({ image: { url: 'https://files.catbox.moe/ks2023.jpg' } }, { upload: conn.waUploadToServer }) } catch {}

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '⛓️ DENJI BOT ⛓️', subtitle: '¡Rev la motosierra! Videos de YouTube 🩸', hasMediaAttachment: !!media, imageMessage: media?.imageMessage },
      body: { text: `⛓️ DENJI BOT ⛓️\n\n🔩 ¡Descarga videos con Denji!\n\n> ${usedPrefix}${command} <nombre o link>\n> Ejemplo: ${usedPrefix}${command} Chainsaw Man OP\n> 🩸 Cuesta 1 diamante` },
      footer: { text: '🪚 DENJI BOT — ¡MOTOSIERRA ENCENDIDA! 🩸' },
      nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🎬 YOUTUBE', sections: [{ title: '¿Qué cortamos hoy?', rows: [{ header: '🔍 BUSCAR', title: 'Buscar video', description: 'Escribe el nombre después del comando', id: 'ytinfo' }] }] }) }] }
    })
    const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
    return conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  }

  if (isHttpUrl(input) && !extractYouTubeUrl(input)) {
    return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n💀 Ese link no es de YouTube' }, { quoted: m })
  }

  const diamantes = getDiamantes(user)
  if (diamantes < 1) {
    return conn.sendMessage(m.chat, {
      text: `⛓️ DENJI BOT ⛓️\n\n💀 ¡Sin diamantes la motosierra no arranca!\n🩸 Necesitas: 1 | Tienes: ${diamantes}\n\n> Usa #work para conseguir`
    }, { quoted: m })
  }

  await m.react('🔍')

  if (extractYouTubeUrl(input)) {
    const videoUrl = extractYouTubeUrl(input)
    return _descargarVideo(conn, m, videoUrl, 'video')
  }

  try {
    const res = await fetch(`${VIGILANTE_API}/search/youtube?apiKey=${VIGILANTE_KEY}&query=${encodeURIComponent(input)}`)
    const data = await res.json()
    if (!data.status || !data.data?.length) throw new Error('Denji no encontró nada...')

    const resultados = data.data.slice(0, 10)
    let media = null
    if (resultados[0]?.thumbnail) {
      try { media = await prepareWAMessageMedia({ image: { url: resultados[0].thumbnail } }, { upload: conn.waUploadToServer }) } catch {}
    }

    const rows = resultados.map((v) => ({
      header: String(v.author || 'Desconocido').slice(0, 20),
      title: String(v.title || '').slice(0, 35),
      description: `⏱️ ${v.duration || '?'} | 👁️ ${v.views || '?'}`,
      id: `ytsel~${Buffer.from(v.url).toString('base64')}~${Buffer.from(String(v.title || 'video')).toString('base64')}`
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '⛓️ DENJI BOT ⛓️', subtitle: `🩸 Resultados: ${input}`, hasMediaAttachment: !!media, imageMessage: media?.imageMessage },
      body: { text: `⛓️ DENJI BOT ⛓️\n\n🔩 ¡${resultados.length} videos encontrados!\n\n> Elige cuál cortar\n> 🩸 1 diamante` },
      footer: { text: '🪚 DENJI BOT — ¡MOTOSIERRA ENCENDIDA! 🩸' },
      nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🎬 RESULTADOS', sections: [{ title: `🩸 ${input.toUpperCase().slice(0, 24)}`, rows }] }) }] }
    })
    const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    await m.react('✅')
  } catch (e) {
    await m.react('❌')
    conn.sendMessage(m.chat, { text: `⛓️ DENJI BOT ⛓️\n\n💀 ${e.message}` }, { quoted: m })
  }
}

async function _descargarVideo(conn, m, videoUrl, title) {
  let user = global.db.data.users[m.sender]
  if (!user) { global.db.data.users[m.sender] = { diamantes: 0, diamond: 0 }; user = global.db.data.users[m.sender] }

  const diamantes = getDiamantes(user)
  if (diamantes < 1) {
    await conn.sendMessage(m.chat, {
      text: `⛓️ DENJI BOT ⛓️\n\n💀 ¡Sin diamantes la motosierra no arranca!\n🩸 Necesitas: 1 | Tienes: ${diamantes}\n\n> Usa #work para conseguir`
    }, { quoted: m })
    return
  }

  restarDiamante(user)
  const restantes = getDiamantes(user)

  await m.react('⏳')
  await conn.sendMessage(m.chat, {
    text: `⛓️ DENJI BOT ⛓️\n\n🪚 *¡Rev la motosierra!*\n📹 Cortando: ${title} (${VIDEO_QUALITY})\n🩸 -1 diamante\n💀 Destrozando el servidor...`
  }, { quoted: m })

  try {
    const finalTitle = await sendVideo(conn, m, videoUrl, title)
    await conn.sendMessage(m.chat, {
      text: `⛓️ DENJI BOT ⛓️\n\n🔩 *¡Video cortado con éxito!*\n🩸 ${finalTitle || title}\n💀 Diamantes restantes: ${restantes}`
    }, { quoted: m })
    await m.react('🪚')
  } catch (e) {
    devolverDiamante(user, diamantes)
    console.error('[DENJI YT ERROR]', e.message)
    await m.react('❌')
    const humanMsg = (e.message?.includes('502') || e.message?.includes('503'))
      ? '⛓️ DENJI BOT ⛓️\n\n💀 ¡El servidor está lleno de demonios!\n🩸 Intenta más tarde\n💀 Diamante devuelto'
      : `⛓️ DENJI BOT ⛓️\n\n💀 ${e.message || 'Error al cortar el video'}\n🩸 Diamante devuelto`
    await conn.sendMessage(m.chat, { text: humanMsg }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  const msgKey = `before_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return true
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 30000)

  let id
  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    id = data.id || data.selectedId || data.selectedRowId || null
  } catch { return false }

  if (!id) return false

  if (id === 'ytinfo') {
    await conn.sendMessage(m.chat, {
      text: '⛓️ DENJI BOT ⛓️\n\n🔩 Dile a Denji qué cortar:\n> .yt2 Chainsaw Man OP'
    }, { quoted: m })
    return true
  }

  if (id.startsWith('ytsel~')) {
    const parts = id.split('~')
    if (parts.length < 3) return true
    let videoUrl, title
    try {
      videoUrl = Buffer.from(parts[1], 'base64').toString()
      title = Buffer.from(parts[2], 'base64').toString()
    } catch { return true }
    await _descargarVideo(conn, m, videoUrl, title)
    return true
  }

  return false
}

handler.help = ['yt2', 'video2']
handler.tags = ['downloader']
handler.command = /^(yt2|ytmp4v2|video2)$/i
handler.desc = 'Denji corta videos de YouTube 🩸 1 diamante'

export default handler