import yts from 'yt-search'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { pipeline } from 'stream/promises'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const DV_API_URL = process.env.DV_API_URL
const DV_API_KEY = process.env.DV_API_KEY
const TMP_DIR = path.join(os.tmpdir(), 'denji-yt')
const SEP = '|~|'

function ensureTmp() {
  try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}
}
ensureTmp()

function deleteSafe(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p) } catch {}
}

function sanitize(name = 'archivo') {
  return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'archivo'
}

const getVideoId = (text = '') => {
  const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
  return match?.[1] || null
}

const isYTUrl = (url = '') => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

const buildYTUrl = (v) => {
  if (v.videoId) return `https://www.youtube.com/watch?v=${v.videoId}`
  if (v.url && isYTUrl(v.url)) return v.url
  return null
}

async function dvVideo(youtubeUrl, quality = '480p') {
  const params = new URLSearchParams({ url: youtubeUrl, quality })
  if (DV_API_KEY) params.set('apikey', DV_API_KEY)
  const res = await fetch(`${DV_API_URL}/ytmp4?${params}`)
  const text = await res.text()
  if (text.trim().startsWith('<')) throw new Error('API no disponible, intenta más tarde')
  let json
  try { json = JSON.parse(text) } catch { throw new Error('Respuesta inválida de la API') }
  if (!json.ok) throw new Error(json.detail || json.error || json.message || 'API sin resultado')
  return json
}

async function downloadToFile(streamUrl, ext, attempt = 1) {
  ensureTmp()
  const tmpPath = path.join(TMP_DIR, `${Date.now()}-${attempt}.${ext}`)
  const res = await fetch(streamUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar`)

  const expectedSize = Number(res.headers.get('content-length') || 0)

  try {
    await pipeline(res.body, fs.createWriteStream(tmpPath))
  } catch (e) {
    deleteSafe(tmpPath)
    throw new Error('La descarga se interrumpió a mitad de camino')
  }

  if (!fs.existsSync(tmpPath)) throw new Error('Archivo inválido')
  const actualSize = fs.statSync(tmpPath).size

  if (actualSize < 100) {
    deleteSafe(tmpPath)
    throw new Error('Archivo inválido')
  }

  // Si el servidor reportó un tamaño y lo que llegó es notablemente menor, el archivo viene cortado
  if (expectedSize && actualSize < expectedSize * 0.98) {
    deleteSafe(tmpPath)
    if (attempt < 2) return downloadToFile(streamUrl, ext, attempt + 1)
    throw new Error(`Descarga incompleta (${actualSize}/${expectedSize} bytes) - intenta de nuevo`)
  }

  return tmpPath
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const input = text?.trim()

  if (!input) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🎬 Descarga videos de YouTube\n\n> ${usedPrefix}${command} <nombre o link>`
    }, { quoted: m })
  }

  await m.react('🩸')

  try {
    const video_id = getVideoId(input)
    let results = []

    if (video_id) {
      try {
        const info = await yts({ videoId: video_id })
        if (info?.videoId) results = [info]
      } catch {}
    }

    if (!results.length) {
      const search = await yts(input)
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
        id: 'vdva' + SEP + payload
      }
    })

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'DENJI BOT - YOUTUBE', subtitle: 'Selecciona un video', hasMediaAttachment: false },
      body: { text: `🩸 DENJI BOT 🩸\n\n🔪 Búsqueda: ${input}\n💀 ${validos.length} resultados\n\n> Elige uno` },
      footer: { text: '🩸 DENJI BOT 🩸' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎬 RESULTADOS',
            sections: [{ title: '📋 ' + input.toUpperCase().substring(0, 24), rows }]
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

  } catch (e) {
    console.log('[VIDEOA ERROR]', e.message)
    await m.react('💀')
    conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error: ' + e.message }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id) return false

    if (id.startsWith('vdva' + SEP) && !id.startsWith('vdvadl' + SEP)) {
      const payload = id.slice(('vdva' + SEP).length)
      const [urlB64, titleB64] = payload.split(SEP)
      const titulo = Buffer.from(titleB64, 'base64url').toString()

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: 'DENJI BOT - YOUTUBE', subtitle: 'Elige la calidad', hasMediaAttachment: false },
        body: { text: `🩸 DENJI BOT 🩸\n\n🔪 ${titulo}\n\n💀 ¿Qué calidad quieres?` },
        footer: { text: '🩸 DENJI BOT 🩸' },
        nativeFlowMessage: {
          buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '🎬 CALIDAD',
              sections: [{
                title: '💀 ELIGE',
                rows: [
                  { header: '🎬', title: 'MP4 - 480p', description: '💀 Calidad normal', id: 'vdvadl' + SEP + '480p' + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎬', title: 'MP4 - 720p', description: '🩸 Alta definición', id: 'vdvadl' + SEP + '720p' + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎬', title: 'MP4 - 1080p', description: '⭐ Full HD', id: 'vdvadl' + SEP + '1080p' + SEP + urlB64 + SEP + titleB64 }
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

    if (id.startsWith('vdvadl' + SEP)) {
      const payload = id.slice(('vdvadl' + SEP).length)
      const parts = payload.split(SEP)
      const quality = parts[0]
      const urlB64 = parts[1]
      const titleB64 = parts[2]
      const ytUrl = Buffer.from(urlB64, 'base64url').toString()
      const titulo = Buffer.from(titleB64, 'base64url').toString()

      await m.react('⚰️')
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n🔪 Descargando ${quality}...\n💀 ${titulo}`
      }, { quoted: m })

      const result = await dvVideo(ytUrl, quality)
      const streamUrl = result.download_url || result.stream_url
      const finalTitle = sanitize(result.title || titulo)

      let tmpPath = null
      try {
        tmpPath = await downloadToFile(streamUrl, 'mp4')
        const videoBuffer = await fs.promises.readFile(tmpPath)

        await conn.sendMessage(m.chat, {
          video: videoBuffer,
          fileName: finalTitle + '.mp4',
          mimetype: 'video/mp4',
          caption: `🩸 DENJI BOT 🩸\n\n🔪 Video descargado\n\n💀 ${finalTitle}\n💀 Calidad: *${result.quality || quality}*`
        }, { quoted: m })
        await m.react('🩸')
      } finally {
        deleteSafe(tmpPath)
      }
      return true
    }

    return false

  } catch (e) {
    console.log('[VIDEOA ERROR]', e.message)
    await m.react('💀')
    conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error: ' + e.message }, { quoted: m })
    return true
  }
}

handler.help = ['videomp4']
handler.tags = ['downloader']
handler.command = /^(videomp4|mp4a|ytv)$/i
handler.desc = 'Descarga videos de YouTube con selector de calidad (API alternativa)'

export default handler
