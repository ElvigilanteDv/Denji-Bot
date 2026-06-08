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
const DELIRIUS_API = 'https://api.delirius.store'
const VIDEO_QUALITY = '360p'

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
    throw new Error(err || '🩸 La motosierra no pudo descargar el video')
  }
  let downloaded = 0
  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_VIDEO_BYTES) response.data.destroy(new Error('💀 Video demasiado grande, ni Denji puede cargarlo'))
  })
  try { await pipeline(response.data, fs.createWriteStream(outputPath)) }
  catch (e) { deleteFileSafe(outputPath); throw e }
  if (!fs.existsSync(outputPath)) throw new Error('🩸 No se pudo guardar el video')
  const size = fs.statSync(outputPath).size
  if (!size || size < 150000) { deleteFileSafe(outputPath); throw new Error('💀 Video inválido o vacío, el diablo lo corrompió') }
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
    ff.on('close', code => { if (code === 0) resolve(true); else reject(new Error('💀 ffmpeg reventó como un diablo')) })
  })
}

async function sendAudio(conn, m, videoUrl, title) {
  const res = await fetch(`${DELIRIUS_API}/download/ytmp3?url=${encodeURIComponent(videoUrl)}`)
  const json = await res.json()
  if (!json.status || !json.data?.download) throw new Error('🩸 La motosierra no pudo conseguir el audio.')
  const finalTitle = safeFileName(json.data.title || title)
  try {
    await conn.sendMessage(m.chat, {
      audio: { url: json.data.download }, mimetype: 'audio/mpeg', fileName: finalTitle + '.mp3'
    }, { quoted: m })
  } catch {
    await conn.sendMessage(m.chat, {
      document: { url: json.data.download }, mimetype: 'audio/mpeg', fileName: finalTitle + '.mp3'
    }, { quoted: m })
  }
  if (json.data.image) {
    await conn.sendMessage(m.chat, {
      image: { url: json.data.image },
      caption: `🎵 ${finalTitle}\n👤 ${json.data.author || ''}`
    }, { quoted: m })
  }
  return finalTitle
}

async function sendVideo(conn, m, videoUrl, title) {
  const res = await fetch(`${DELIRIUS_API}/download/ytmp4?url=${encodeURIComponent(videoUrl)}&format=${VIDEO_QUALITY}`)
  const json = await res.json()
  if (!json.status || !json.data?.download) throw new Error('🩸 La motosierra no pudo conseguir el video.')
  const finalTitle = safeFileName(json.data.title || title)
  const rawFile = path.join(TEMP_DIR, `yt_${Date.now()}.mp4`)
  const finalFile = path.join(TEMP_DIR, `yt_final_${Date.now()}.mp4`)
  try {
    const videoInfo = await downloadVideo(json.data.download, rawFile)
    const finalName = normalizeMp4Name(videoInfo.fileName || finalTitle)
    if (videoInfo.size > VIDEO_AS_DOCUMENT_THRESHOLD) {
      await conn.sendMessage(m.chat, {
        document: fs.readFileSync(rawFile), mimetype: 'video/mp4',
        fileName: finalName, caption: `🪚 ${finalTitle}`
      }, { quoted: m })
    } else {
      try {
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(rawFile), mimetype: 'video/mp4',
          fileName: finalName, caption: `🪚 ${finalTitle}`
        }, { quoted: m })
      } catch {
        await normalizeForWhatsApp(rawFile, finalFile)
        const filePath = fs.existsSync(finalFile) ? finalFile : rawFile
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(filePath), mimetype: 'video/mp4',
          fileName: finalName, caption: `🪚 ${finalTitle}`
        }, { quoted: m })
      }
    }
  } finally {
    deleteFileSafe(rawFile)
    deleteFileSafe(finalFile)
  }
  return finalTitle
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
    try { media = await prepareWAMessageMedia({ image: { url: 'https://files.catbox.moe/r60c8l.jpg' } }, { upload: conn.waUploadToServer }) } catch {}

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🪚 DENJI BOT - YOUTUBE', subtitle: 'Denji corta música y videos para ti 🩸', hasMediaAttachment: !!media, imageMessage: media?.imageMessage },
      body: { text: `🪚「 DENJI - YOUTUBE 」🩸\n\n💀 » ¡Denji rev su motosierra!\n¡Listo para destrozar cualquier video o música!\n\n> ${usedPrefix}${command} <nombre o link>\n> Ejemplo: ${usedPrefix}${command} Chainsaw Man OST\n> 🩸 Cuesta 1 diamante por descarga` },
      footer: { text: '🪚 DENJI BOT — ¡MOTOSIERRA ENCENDIDA! 🩸' },
      nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🪚 DENJI TUBE', sections: [{ title: '¿Qué quieres que Denji corte?', rows: [{ header: '🔍 BUSCAR', title: 'Buscar música o video', description: 'Escribe el nombre después del comando', id: 'ytinfo' }] }] }) }] }
    })
    const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
    return conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  }

  if (isHttpUrl(input) && !extractYouTubeUrl(input)) {
    return conn.sendMessage(m.chat, { text: '🩸 Ese link no es de YouTube... ¡ni la motosierra de Denji puede con eso!' }, { quoted: m })
  }

  const diamantes = getDiamantes(user)
  if (diamantes < 1) {
    return conn.sendMessage(m.chat, {
      text: `🪚「 DENJI - YOUTUBE 」🩸\n\n💀 » ¡Sin diamantes la motosierra no arranca!\n🩸 Necesitas: 1 | Tienes: ${diamantes}\n\n> Usa #work para conseguir más`
    }, { quoted: m })
  }

  await m.react('🔍')

  if (extractYouTubeUrl(input)) {
    const videoUrl = extractYouTubeUrl(input)
    const urlB64   = Buffer.from(videoUrl).toString('base64')
    const titleB64 = Buffer.from('video').toString('base64')
    return _mostrarSelectorFormato(conn, m, urlB64, titleB64, 'video', null)
  }

  try {
    const res = await fetch(`${DELIRIUS_API}/search/ytsearch?q=${encodeURIComponent(input)}`)
    const data = await res.json()
    if (!data.status || !data.data?.length) throw new Error('🩸 Denji buscó pero no encontró nada... prueba con otro nombre')

    const resultados = data.data.slice(0, 10)
    let media = null
    if (resultados[0]?.thumbnail) {
      try { media = await prepareWAMessageMedia({ image: { url: resultados[0].thumbnail } }, { upload: conn.waUploadToServer }) } catch {}
    }

    const rows = resultados.map((v, i) => ({
      header: String(v.author?.name || 'Desconocido').slice(0, 20),
      title: String(v.title || '').slice(0, 35),
      description: `⏱️ ${v.duration || '?'} | 👁️ ${Number(v.views || 0).toLocaleString()}`,
      id: `ytsel~${Buffer.from(v.url).toString('base64')}~${Buffer.from(String(v.title || 'video')).toString('base64')}`
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🪚 DENJI BOT - YOUTUBE', subtitle: `🩸 Resultados para: ${input}`, hasMediaAttachment: !!media, imageMessage: media?.imageMessage },
      body: { text: `🔍「 DENJI ENCONTRÓ ESTO 」🩸\n\n💀 » Búsqueda: *${input}*\n🪚 ${resultados.length} víctimas encontradas\n\n> Elige cuál quieres que Denji despedace\n> 🩸 1 diamante` },
      footer: { text: '🪚 DENJI BOT — ¡MOTOSIERRA ENCENDIDA! 🩸' },
      nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🪚 RESULTADOS', sections: [{ title: `🩸 ${input.toUpperCase().slice(0, 24)}`, rows }] }) }] }
    })
    const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    await m.react('✅')
  } catch (e) {
    await m.react('❌')
    conn.sendMessage(m.chat, { text: `🩸 ${e.message}` }, { quoted: m })
  }
}

async function _mostrarSelectorFormato(conn, m, urlB64, titleB64, title, thumbnail) {
  let media = null
  if (thumbnail) {
    try { media = await prepareWAMessageMedia({ image: { url: thumbnail } }, { upload: conn.waUploadToServer }) } catch {}
  }
  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: { title: '🪚 DENJI BOT - YOUTUBE', subtitle: String(title || '').slice(0, 60), hasMediaAttachment: !!media, imageMessage: media?.imageMessage },
    body: { text: `🪚「 DENJI - YOUTUBE 」🩸\n\n💀 » *${String(title || '').slice(0, 60)}*\n\n> ¿Cómo quieres que Denji lo corte?\n> 🩸 1 diamante` },
    footer: { text: '🪚 DENJI BOT — ¡MOTOSIERRA ENCENDIDA! 🩸' },
    nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🩸 FORMATO', sections: [{ title: '¿Qué quieres que Denji te traiga?', rows: [
      { header: '🎵 AUDIO', title: 'Descargar música (MP3)', description: '🎧 Alta calidad | 🩸 1 diamante', id: `ytdl~audio~${urlB64}~${titleB64}` },
      { header: '🪚 VIDEO', title: 'Descargar video (MP4)', description: `📹 ${VIDEO_QUALITY} | 🩸 1 diamante`, id: `ytdl~video~${urlB64}~${titleB64}` }
    ] }] }) }] }
  })
  const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
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
    await conn.sendMessage(m.chat, { text: '🔍 Dile a Denji qué cortar:\n> .yt Chainsaw Man OST' }, { quoted: m })
    return true
  }

  if (id.startsWith('ytsel~')) {
    const parts = id.split('~')
    if (parts.length < 3) return true
    const urlB64   = parts[1]
    const titleB64 = parts[2]
    let title = 'video'
    try { title = Buffer.from(titleB64, 'base64').toString() } catch {}

    await _mostrarSelectorFormato(conn, m, urlB64, titleB64, title, null)
    return true
  }

  if (id.startsWith('ytdl~')) {
    const parts = id.split('~')
    if (parts.length < 4) {
      await conn.sendMessage(m.chat, { text: '🩸 Error... la motosierra de Denji se trabó.' }, { quoted: m })
      return true
    }
    const tipo     = parts[1]
    const urlB64   = parts[2]
    const titleB64 = parts[3]

    let videoUrl, title
    try {
      videoUrl = Buffer.from(urlB64, 'base64').toString()
      title    = Buffer.from(titleB64, 'base64').toString()
    } catch {
      await conn.sendMessage(m.chat, { text: '🩸 Error... la motosierra de Denji se trabó.' }, { quoted: m })
      return true
    }

    let user = global.db.data.users[m.sender]
    if (!user) { global.db.data.users[m.sender] = { diamantes: 0, diamond: 0 }; user = global.db.data.users[m.sender] }

    const diamantes = getDiamantes(user)
    if (diamantes < 1) {
      await conn.sendMessage(m.chat, {
        text: `🪚「 DENJI - YOUTUBE 」🩸\n\n💀 » ¡Sin diamantes la motosierra no arranca!\n🩸 Necesitas: 1 | Tienes: ${diamantes}\n\n> Usa #work para conseguir más`
      }, { quoted: m })
      return true
    }

    restarDiamante(user)
    const restantes = getDiamantes(user)

    await m.react('⏳')
    await conn.sendMessage(m.chat, {
      text: tipo === 'audio'
        ? `🎵 *¡Denji rev su motosierra!*\n🎧 Cortando: ${title}\n🩸 -1 diamante\n💀 Espera, está destrozando el servidor...`
        : `🪚 *¡Denji rev su motosierra!*\n📹 Cortando: ${title} (${VIDEO_QUALITY})\n🩸 -1 diamante\n💀 Espera, está destrozando el servidor...`
    }, { quoted: m })

    try {
      let finalTitle
      if (tipo === 'audio') finalTitle = await sendAudio(conn, m, videoUrl, title)
      else finalTitle = await sendVideo(conn, m, videoUrl, title)

      await conn.sendMessage(m.chat, {
        text: `✅ *¡Denji lo destrozó con éxito!*\n\n${tipo === 'audio' ? '🎵' : '🪚'} » ${finalTitle || title}\n🩸 » Diamantes restantes: ${restantes}`
      }, { quoted: m })
      await m.react('🪚')
    } catch (e) {
      devolverDiamante(user, diamantes)
      console.error('[DENJI YT ERROR]', e.message)
      await m.react('❌')
      const rawMsg = String(e?.message || '').toLowerCase()
      const humanMsg = (rawMsg.includes('502') || rawMsg.includes('503') || rawMsg.includes('bad gateway'))
        ? '🩸 ¡El servidor está lleno de demonios!\n🔁 Intenta más tarde.\n💀 Diamante devuelto.'
        : `🩸 ${e.message || 'Error al descargar.'}\n💀 Diamante devuelto.`
      await conn.sendMessage(m.chat, { text: humanMsg }, { quoted: m })
    }
    return true
  }

  return false
}

handler.help    = ['yt', 'play', 'video']
handler.tags    = ['downloader']
handler.command = /^(yt|ytmp3|ytmp4|video|mp3|song|play|musica|cancion|youtube)$/i
handler.desc    = 'Denji corta música y videos de YouTube 🩸 1 diamante'

export default handler
