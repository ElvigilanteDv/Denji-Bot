//funcione sapo hp 
import yts from 'yt-search'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { pipeline } from 'stream/promises'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const DV_API_URL = process.env.DV_API_URL || 'https://dv-yer-api.online'
const DV_API_KEY = process.env.DV_API_KEY || 'dvyerDravenFX4'
const TMP_DIR = path.join(os.tmpdir(), 'denji-yt')
const REQUEST_TIMEOUT = 120000
const MAX_BYTES = 150 * 1024 * 1024

function ensureTmpDir() {
  try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}
}
ensureTmpDir()

function deleteSafe(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p) } catch {}
}

const SEP = '|~|'

const getVideoId = (text = '') => {
  const match = text.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/
  )
  return match?.[1] || null
}

const isYTUrl = (url = '') => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

const sanitizeFileName = (name = 'archivo') =>
  name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'archivo'

const buildYTUrl = (v) => {
  if (v.videoId) return `https://www.youtube.com/watch?v=${v.videoId}`
  if (v.url && isYTUrl(v.url)) return v.url
  return null
}

async function dvDownload(youtubeUrl, tipo = 'mp4', quality = '480p') {
  const endpoint = tipo === 'mp3' ? '/ytmp3' : '/ytmp4'
  const params = { url: youtubeUrl, apikey: DV_API_KEY }
  if (tipo === 'mp4') params.quality = quality

  const res = await axios.get(`${DV_API_URL}${endpoint}`, {
    params,
    timeout: 60000,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
      'x-api-key': DV_API_KEY
    },
    validateStatus: () => true
  })

  const json = res.data
  if (res.status >= 400 || json?.ok === false) {
    throw new Error(json?.detail || json?.error || json?.message || `HTTP ${res.status}`)
  }
  return json
}

async function downloadToFile(streamUrl, outputPath) {
  ensureTmpDir()
  console.log('[DL URL]', streamUrl)

  const response = await axios.get(streamUrl, {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*',
      'x-api-key': DV_API_KEY
    },
    validateStatus: () => true,
    maxRedirects: 10
  })

  if (response.status >= 400) {
    throw new Error(`HTTP ${response.status} al descargar stream`)
  }

  let downloaded = 0
  response.data.on('data', (chunk) => {
    downloaded += chunk.length
    if (downloaded > MAX_BYTES) {
      response.data.destroy(new Error('Archivo demasiado grande'))
    }
  })

  try {
    await pipeline(response.data, fs.createWriteStream(outputPath))
  } catch (e) {
    deleteSafe(outputPath)
    throw e
  }

  if (!fs.existsSync(outputPath)) throw new Error('No se guardó el archivo')
  const size = fs.statSync(outputPath).size
  if (size < 100) throw new Error('Archivo inválido o vacío')
  return size
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const input_text = text?.trim()

  if (!input_text) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔪 Descarga música y videos de YouTube\n\n💀 Por nombre:\n> ${usedPrefix}${command} Naruto Opening 1\n\n💀 Por link:\n> ${usedPrefix}${command} https://youtu.be/xxx`
    }, { quoted: m })
  }

  await m.react('🩸')

  try {
    const video_id = getVideoId(input_text)
    let results = []

    if (video_id) {
      try {
        const info = await yts({ videoId: video_id })
        if (info?.videoId) results = [info]
      } catch {}
    }

    if (!results.length) {
      const search = await yts(input_text)
      results = (search.videos || []).slice(0, 8)
    }

    const validos = results.filter(v => buildYTUrl(v))

    if (!validos.length) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 No se encontraron resultados'
      }, { quoted: m })
    }

    const rows = validos.map((v) => {
      const ytUrl = buildYTUrl(v)
      const titulo = (v.title || '').substring(0, 50)
      const payload = Buffer.from(ytUrl).toString('base64url') + SEP + Buffer.from(titulo).toString('base64url')
      return {
        header: '🎬 ' + (v.timestamp || '?'),
        title: (v.title || 'Sin título').substring(0, 35),
        description: '💀 ' + (v.author?.name || v.author || 'Desconocido') + ' | 👁️ ' + (v.views || 0).toLocaleString(),
        id: 'ytdv' + SEP + payload
      }
    })

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'DENJI BOT - YOUTUBE', subtitle: 'Selecciona un video', hasMediaAttachment: false },
      body: { text: `🩸 DENJI BOT 🩸\n\n🔪 Búsqueda: ${input_text}\n💀 ${validos.length} resultados\n\n> Elige uno` },
      footer: { text: '🩸 DENJI BOT 🩸' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎬 RESULTADOS',
            sections: [{ title: '📋 ' + input_text.toUpperCase().substring(0, 24), rows }]
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

  } catch (e) {
    console.log(e)
    await m.react('💀')
    conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error al buscar: ' + e.message }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null

    if (id?.startsWith('ytdv' + SEP)) {
      const payload = id.slice(('ytdv' + SEP).length)
      const [urlB64, titleB64] = payload.split(SEP)
      const titulo = Buffer.from(titleB64, 'base64url').toString()

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: 'DENJI BOT - YOUTUBE', subtitle: '¿Cómo lo quieres?', hasMediaAttachment: false },
        body: { text: `🩸 DENJI BOT 🩸\n\n🔪 ${titulo || 'Video seleccionado'}\n\n💀 ¿Audio o Video?` },
        footer: { text: '🩸 DENJI BOT 🩸' },
        nativeFlowMessage: {
          buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '⬇️ FORMATO',
              sections: [{
                title: '💀 ELIGE EL FORMATO',
                rows: [
                  { header: '🎵 AUDIO', title: 'MP3 - 128K', description: '🔪 Solo audio', id: 'ytmp3' + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎬 VIDEO', title: 'MP4 - 480p', description: '💀 Video normal', id: 'ytmp4480' + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎬 VIDEO HD', title: 'MP4 - 720p', description: '🩸 Alta definición', id: 'ytmp4720' + SEP + urlB64 + SEP + titleB64 }
                ]
              }]
            })
          }]
        }
      })

      const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
      }, { quoted: m })

      await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
      return true
    }

    const formatos = ['ytmp3', 'ytmp4480', 'ytmp4720']
    const fmt = formatos.find(f => id?.startsWith(f + SEP))
    if (!fmt) return false

    const payload = id.slice((fmt + SEP).length)
    const [urlB64, titleB64] = payload.split(SEP)
    const ytUrl = Buffer.from(urlB64, 'base64url').toString()
    const titulo = Buffer.from(titleB64, 'base64url').toString()

    const tipo = fmt === 'ytmp3' ? 'mp3' : 'mp4'
    const quality = fmt === 'ytmp4720' ? '720p' : '480p'

    await m.react('⚰️')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔪 Descargando ${tipo === 'mp3' ? 'audio' : 'video'}...\n💀 ${titulo}\n\n> Esto puede tardar un momento...`
    }, { quoted: m })

    const result = await dvDownload(ytUrl, tipo, quality)
    const streamUrl = result.download_url_full || result.stream_url_full || result.download_url || result.stream_url || result.url
    console.log("[DV RESULT]", JSON.stringify(result, null, 2))
    console.log("[STREAM URL]", streamUrl)
    if (!streamUrl) throw new Error('La API no devolvió URL de descarga')

    const finalTitle = result.title || titulo
    const finalFilename = sanitizeFileName(finalTitle)
    const ext = tipo === 'mp3' ? '.mp3' : '.mp4'
    const tempPath = path.join(TMP_DIR, `${Date.now()}${ext}`)

    try {
      await downloadToFile(streamUrl, tempPath)

      if (tipo === 'mp3') {
        await conn.sendMessage(m.chat, {
          audio: { stream: fs.createReadStream(tempPath) },
          mimetype: 'audio/mpeg',
          fileName: finalFilename + ext,
          caption: `🩸 DENJI BOT 🩸\n\n🔪 Audio descargado\n\n💀 ${finalTitle}\n💀 Calidad: *${result.quality || '128K'}*`
        }, { quoted: m })
      } else {
        await conn.sendMessage(m.chat, {
          video: { stream: fs.createReadStream(tempPath) },
          fileName: finalFilename + ext,
          mimetype: 'video/mp4',
          caption: `🩸 DENJI BOT 🩸\n\n🔪 Video descargado\n\n💀 ${finalTitle}\n💀 Calidad: *${result.quality || quality}*`
        }, { quoted: m })
      }

      await m.react('🩸')

    } finally {
      deleteSafe(tempPath)
    }

    return true

  } catch (e) {
    console.log('[YT ERROR]', e.message)
    await m.react('💀')
    conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error: ' + e.message }, { quoted: m })
    return true
  }
}

handler.help = ['play']
handler.tags = ['downloader']
handler.command = /^(play|yt|youtube)$/i
handler.desc = 'Busca y descarga música y videos de YouTube'

export default handler
