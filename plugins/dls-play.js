import fetch from 'node-fetch'
import yts from 'yt-search'
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
const VIDEO_QUALITY = '360'  // sin "p" — ytmp4v2 lo requiere así

const _processing = new Set()

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   🩸 FRASES DE DENJI 🩸
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FRASES_DENJI = [
  '🩸 *"Oye... ya puedo respirar por fin..."*',
  '🔪 *"Solo quiero comer pan con mermelada..."*',
  '💀 *"No soy un humano ni un diablo... soy Chainsaw Man"*',
  '🩸 *"Makima... haré lo que sea por ti..."*',
  '⛓️ *"¡MOTOSIERRA!"*',
  '🔪 *"Los sueños baratos... son los mejores"*',
  '💀 *"Aki... Power... ya no están aquí..."*',
  '🩸 *"Pochita me dio su corazón... no lo desperdiciaré"*',
  '⛓️ *"¡Vrum vrum intensifies!"*',
  '🔪 *"Ni siquiera recuerdo cuántos demonios he matado"*',
  '💀 *"El Diablo de las Motosierras devora el miedo"*',
  '🩸 *"...¿Esto es lo que se siente vivir?"*'
]
const frasesRandom = () => FRASES_DENJI[Math.floor(Math.random() * FRASES_DENJI.length)]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   TEXTOS UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const UI = {
  header:       '⛓️ DENJI BOT ⛓️',
  subHeader:    '🔪 YouTube — Chainsaw Style',
  footer:       () => frasesRandom(),
  ayuda:        (p, c) =>
    `⛓️ *DENJI BOT* ⛓️\n\n🩸 *Descarga música y videos de YouTube*\n\n🔪 Por nombre:\n> ${p}${c} Naruto Opening 1\n\n🔪 Por link:\n> ${p}${c} https://youtu.be/xxx\n\n💎 *Cuesta 1 diamante por descarga*\n\n💀 *"El Chainsaw Man descarga lo que sea..."*\n\n${frasesRandom()}`,
  sinDiamantes: (d) =>
    `⛓️ *DENJI BOT* ⛓️\n\n💀 *Sin diamantes, humano*\n🔪 Necesitas: 1 | Tienes: ${d}\n\n🩸 *"Hasta yo necesito combustible..."*\n> Usa #work para ganar`,
  buscando:     () => '⛓️ *DENJI BOT* ⛓️\n\n🔍 Buscando en YouTube...\n🩸 *"La motosierra huele el video..."*',
  sinResultados:'⛓️ *DENJI BOT* ⛓️\n\n💀 No encontré nada...\n🔪 *"Ni los demonios conocen esa canción"*',
  descargandoAudio: (titulo) =>
    `⛓️ *DENJI BOT* ⛓️\n\n🎵 Descargando audio...\n💀 *${titulo}*\n💎 -1 diamante\n\n🔪 *"Espera... la motosierra está calentando..."*`,
  descargandoVideo: (titulo) =>
    `⛓️ *DENJI BOT* ⛓️\n\n🎬 Descargando video...\n💀 *${titulo}* (${VIDEO_QUALITY}p)\n💎 -1 diamante\n\n🔪 *"Espera... la motosierra está calentando..."*`,
  listo: (tipo, titulo, restantes) =>
    `⛓️ *DENJI BOT* ⛓️\n\n✅ *Descarga lista, humano*\n\n${tipo === 'audio' ? '🎵' : '🎬'} ${titulo}\n💎 Diamantes restantes: ${restantes}\n\n${frasesRandom()}`,
  error: (msg) =>
    `⛓️ *DENJI BOT* ⛓️\n\n💀 *Error*\n🔪 ${msg}\n\n🩸 *"Hasta Pochita fallaría esto..."*`,
  errorDiamante: (msg) =>
    `⛓️ *DENJI BOT* ⛓️\n\n💀 *Error*\n🔪 ${msg}\n\n💎 *Diamante devuelto*\n🩸 *"Ni modo..."*`,
  linkInvalido:  '⛓️ *DENJI BOT* ⛓️\n\n💀 Ese link no es de YouTube, humano.\n🔪 *"¿Me estás tomando el pelo?"*'
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   UTILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   DESCARGA + FFMPEG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   SEND AUDIO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function sendAudio(conn, m, videoUrl, title) {
  const res = await fetch(`${DELIRIUS_API}/download/ytmp3?url=${encodeURIComponent(videoUrl)}`)
  const json = await res.json()
  if (!json.status || !json.data?.download) throw new Error('No se pudo obtener el audio.')
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
      caption: `⛓️ *DENJI BOT* ⛓️\n\n🎵 *${finalTitle}*\n👤 ${json.data.author || ''}\n\n${frasesRandom()}`
    }, { quoted: m })
  }
  return finalTitle
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   SEND VIDEO  (usa ytmp4v2)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function sendVideo(conn, m, videoUrl, title) {
  // Intentar calidades en cascada
  const calidades = [VIDEO_QUALITY, '240', '144']
  let json = null
  for (const q of calidades) {
    const res = await fetch(`${DELIRIUS_API}/download/ytmp4v2?url=${encodeURIComponent(videoUrl)}&format=${q}`)
    const data = await res.json()
    if (data.status && data.data?.download) { json = data; break }
    console.log(`[YT] ${q}p falló:`, JSON.stringify(data).slice(0, 200))
  }
  if (!json) throw new Error('No se pudo obtener el video en ninguna calidad.')
  console.log('[YT] video OK con calidad:', json.data?.format)

  const finalTitle = safeFileName(json.data.title || title)
  const rawFile    = path.join(TEMP_DIR, `yt_${Date.now()}.mp4`)
  const finalFile  = path.join(TEMP_DIR, `yt_final_${Date.now()}.mp4`)
  try {
    const videoInfo = await downloadVideo(json.data.download, rawFile)
    const finalName = normalizeMp4Name(videoInfo.fileName || finalTitle)
    if (videoInfo.size > VIDEO_AS_DOCUMENT_THRESHOLD) {
      await conn.sendMessage(m.chat, {
        document: fs.readFileSync(rawFile), mimetype: 'video/mp4',
        fileName: finalName,
        caption: `⛓️ *DENJI BOT* ⛓️\n\n🎬 *${finalTitle}*\n\n${frasesRandom()}`
      }, { quoted: m })
    } else {
      try {
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(rawFile), mimetype: 'video/mp4',
          fileName: finalName,
          caption: `⛓️ *DENJI BOT* ⛓️\n\n🎬 *${finalTitle}*\n\n${frasesRandom()}`
        }, { quoted: m })
      } catch {
        await normalizeForWhatsApp(rawFile, finalFile)
        const filePath = fs.existsSync(finalFile) ? finalFile : rawFile
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(filePath), mimetype: 'video/mp4',
          fileName: finalName,
          caption: `⛓️ *DENJI BOT* ⛓️\n\n🎬 *${finalTitle}*\n\n${frasesRandom()}`
        }, { quoted: m })
      }
    }
  } finally {
    deleteFileSafe(rawFile)
    deleteFileSafe(finalFile)
  }
  return finalTitle
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   MENÚ DE FORMATO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function _mostrarSelectorFormato(conn, m, urlB64, titleB64, title, thumbnail) {
  let media = null
  if (thumbnail) {
    try { media = await prepareWAMessageMedia({ image: { url: thumbnail } }, { upload: conn.waUploadToServer }) } catch {}
  }
  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: { title: UI.header, subtitle: String(title || '').slice(0, 60), hasMediaAttachment: !!media, imageMessage: media?.imageMessage },
    body: { text: `⛓️ *DENJI BOT* ⛓️\n\n🩸 *${String(title || '').slice(0, 60)}*\n\n🔪 ¿Cómo lo quieres, humano?\n💎 1 diamante\n\n${frasesRandom()}` },
    footer: { text: frasesRandom() },
    nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '⛓️ FORMATO', sections: [{ title: '🩸 ELIGE TU ARMA', rows: [
      { header: '🎵 AUDIO',    title: 'MP3 — 128kbps',     description: '🔪 Solo audio, sin video | 💎 1 diamante', id: `ytdl~audio~${urlB64}~${titleB64}` },
      { header: '🎬 VIDEO SD', title: `MP4 — ${VIDEO_QUALITY}p`, description: `💀 Calidad estándar | 💎 1 diamante`,  id: `ytdl~video~${urlB64}~${titleB64}` }
    ] }] }) }] }
  })
  const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   HANDLER PRINCIPAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
      header: { title: UI.header, subtitle: UI.subHeader, hasMediaAttachment: !!media, imageMessage: media?.imageMessage },
      body: { text: UI.ayuda(usedPrefix, command) },
      footer: { text: frasesRandom() },
      nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🩸 YOUTUBE', sections: [{ title: '🔪 ¿Qué deseas?', rows: [{ header: '🔍 BUSCAR', title: 'Buscar música o video', description: '💀 Escribe el nombre después del comando', id: 'ytinfo' }] }] }) }] }
    })
    const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
    return conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  }

  if (isHttpUrl(input) && !extractYouTubeUrl(input)) {
    return conn.sendMessage(m.chat, { text: UI.linkInvalido }, { quoted: m })
  }

  const diamantes = getDiamantes(user)
  if (diamantes < 1) {
    return conn.sendMessage(m.chat, { text: UI.sinDiamantes(diamantes) }, { quoted: m })
  }

  await m.react('🩸')

  if (extractYouTubeUrl(input)) {
    const videoUrl = extractYouTubeUrl(input)
    const urlB64   = Buffer.from(videoUrl).toString('base64')
    const titleB64 = Buffer.from('video').toString('base64')
    return _mostrarSelectorFormato(conn, m, urlB64, titleB64, 'video', null)
  }

  try {
    // yt-search local — no depende de API externa
    const search = await yts(input)
    const resultados = (search.videos || []).slice(0, 10)
    if (!resultados.length) throw new Error('No se encontraron resultados')

    let media = null
    if (resultados[0]?.thumbnail) {
      try { media = await prepareWAMessageMedia({ image: { url: resultados[0].thumbnail } }, { upload: conn.waUploadToServer }) } catch {}
    }

    const rows = resultados.map((v) => ({
      header: String(v.author?.name || v.author || 'Desconocido').slice(0, 20),
      title: String(v.title || '').slice(0, 35),
      description: `⏱️ ${v.timestamp || '?'} | 👁️ ${Number(v.views || 0).toLocaleString()}`,
      id: `ytsel~${Buffer.from(v.url || '').toString('base64')}~${Buffer.from(String(v.title || 'video')).toString('base64')}`
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: UI.header, subtitle: `🔍 ${input}`, hasMediaAttachment: !!media, imageMessage: media?.imageMessage },
      body: { text: `⛓️ *DENJI BOT* ⛓️\n\n🩸 Búsqueda: *${input}*\n🔪 ${resultados.length} resultados\n\n> Elige uno, el Chainsaw Man te espera...\n💎 1 diamante` },
      footer: { text: frasesRandom() },
      nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🩸 RESULTADOS', sections: [{ title: `🔪 ${input.toUpperCase().slice(0, 24)}`, rows }] }) }] }
    })
    const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    await m.react('⛓️')
  } catch (e) {
    await m.react('💀')
    conn.sendMessage(m.chat, { text: UI.error(e.message) }, { quoted: m })
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   HANDLER.BEFORE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
      text: `⛓️ *DENJI BOT* ⛓️\n\n🔪 Escribe así:\n> .yt Naruto Opening 1\n\n🩸 *"La motosierra huele el video..."*`
    }, { quoted: m })
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
      await conn.sendMessage(m.chat, { text: UI.error('Error al procesar la selección.') }, { quoted: m })
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
      await conn.sendMessage(m.chat, { text: UI.error('Error al procesar la selección.') }, { quoted: m })
      return true
    }

    let user = global.db.data.users[m.sender]
    if (!user) { global.db.data.users[m.sender] = { diamantes: 0, diamond: 0 }; user = global.db.data.users[m.sender] }

    const diamantes = getDiamantes(user)
    if (diamantes < 1) {
      await conn.sendMessage(m.chat, { text: UI.sinDiamantes(diamantes) }, { quoted: m })
      return true
    }

    restarDiamante(user)
    const restantes = getDiamantes(user)

    await m.react('⛓️')
    await conn.sendMessage(m.chat, {
      text: tipo === 'audio' ? UI.descargandoAudio(title) : UI.descargandoVideo(title)
    }, { quoted: m })

    try {
      let finalTitle
      if (tipo === 'audio') finalTitle = await sendAudio(conn, m, videoUrl, title)
      else finalTitle = await sendVideo(conn, m, videoUrl, title)

      await conn.sendMessage(m.chat, { text: UI.listo(tipo, finalTitle || title, restantes) }, { quoted: m })
      await m.react('🩸')
    } catch (e) {
      devolverDiamante(user, diamantes)
      console.error('[YT ERROR]', e.message)
      await m.react('💀')
      const rawMsg = String(e?.message || '').toLowerCase()
      const humanMsg = (rawMsg.includes('502') || rawMsg.includes('503') || rawMsg.includes('bad gateway'))
        ? UI.errorDiamante('El servidor está saturado, intenta más tarde.')
        : UI.errorDiamante(e.message || 'Error al descargar.')
      await conn.sendMessage(m.chat, { text: humanMsg }, { quoted: m })
    }
    return true
  }

  return false
}

handler.help    = ['yt', 'play', 'video']
handler.tags    = ['downloader']
handler.command = /^(yt|ytmp3|ytmp4|video|mp3|song|play|musica|cancion|youtube)$/i
handler.desc    = '⛓️ Descarga audio o video de YouTube — Chainsaw Man style 💎1'

export default handler
