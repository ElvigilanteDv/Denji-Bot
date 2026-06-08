import yts from 'yt-search'
import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const DV_API_URL = process.env.DV_API_URL
const DV_API_KEY = process.env.DV_API_KEY

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
  console.log('[DVYER] URL recibida:', JSON.stringify(youtubeUrl))
  console.log('[DVYER] Tipo:', tipo, '| Quality:', quality)
  console.log('[DVYER] DV_API_URL:', DV_API_URL)
  console.log('[DVYER] DV_API_KEY:', DV_API_KEY ? 'OK' : 'UNDEFINED')

  const endpoint = tipo === 'mp3' ? '/ytmp3' : '/ytmp4'
  const params = new URLSearchParams({ url: youtubeUrl, key: DV_API_KEY })
  if (tipo === 'mp4') params.set('quality', quality)

  const fullUrl = `${DV_API_URL}${endpoint}?${params}`
  console.log('[DVYER] Request URL completa:', fullUrl)

  const res = await fetch(fullUrl)
  const json = await res.json()
  console.log('[DVYER] Respuesta:', JSON.stringify(json))
  if (!json.ok) throw new Error(json.error || json.message || 'API sin resultado')
  return json
}

const SEP = '|~|'

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

    const rows = validos.map((v, i) => {
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
      const ytUrl = Buffer.from(urlB64, 'base64url').toString()
      const titulo = Buffer.from(titleB64, 'base64url').toString()

      console.log('[YT PASO2] URL decodificada:', ytUrl)
      console.log('[YT PASO2] Título:', titulo)

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
                  {
                    header: '🎵 AUDIO',
                    title: 'MP3 - 128K',
                    description: '🔪 Solo audio en alta calidad',
                    id: 'ytmp3' + SEP + urlB64 + SEP + titleB64
                  },
                  {
                    header: '🎬 VIDEO',
                    title: 'MP4 - 480p',
                    description: '💀 Video con audio incluido',
                    id: 'ytmp4480' + SEP + urlB64 + SEP + titleB64
                  },
                  {
                    header: '🎬 VIDEO HD',
                    title: 'MP4 - 720p',
                    description: '🩸 Video en alta definición',
                    id: 'ytmp4720' + SEP + urlB64 + SEP + titleB64
                  }
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

    console.log('[YT PASO3] fmt:', fmt)
    console.log('[YT PASO3] URL decodificada:', ytUrl)
    console.log('[YT PASO3] Título:', titulo)

    const tipo = fmt === 'ytmp3' ? 'mp3' : 'mp4'
    const quality = fmt === 'ytmp4720' ? '720p' : '480p'

    await m.react('⚰️')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔪 Descargando ${tipo === 'mp3' ? 'audio' : 'video'}...\n💀 ${titulo}`
    }, { quoted: m })

    const result = await dvDownload(ytUrl, tipo, quality)
    const downloadUrl = result.download_url || result.stream_url
    const finalTitle = result.title || titulo
    const finalFilename = sanitizeFileName(result.filename || finalTitle)

    if (tipo === 'mp3') {
      await conn.sendMessage(m.chat, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: finalFilename + '.mp3',
        caption: `🩸 DENJI BOT 🩸\n\n🔪 Audio descargado\n\n💀 ${finalTitle}\n💀 Calidad: *${result.quality || '128K'}*`
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        video: { url: downloadUrl },
        fileName: finalFilename + '.mp4',
        mimetype: 'video/mp4',
        caption: `🩸 DENJI BOT 🩸\n\n🔪 Video descargado\n\n💀 ${finalTitle}\n💀 Calidad: *${result.quality || quality}*`
      }, { quoted: m })
    }

    await m.react('🩸')
    return true

  } catch (e) {
    console.log('[YT ERROR]', e)
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
