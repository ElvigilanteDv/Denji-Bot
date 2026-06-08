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
  if (v.url && isYTUrl(v.url)) return v.url
  if (v.videoId) return `https://www.youtube.com/watch?v=${v.videoId}`
  return null
}

async function dvDownload(youtubeUrl, tipo = 'mp4', quality = '480p') {
  const endpoint = tipo === 'mp3' ? '/ytmp3' : '/ytmp4'
  const params = new URLSearchParams({ url: youtubeUrl, key: DV_API_KEY })
  if (tipo === 'mp4') params.set('quality', quality)
  const res = await fetch(`${DV_API_URL}${endpoint}?${params}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || json.message || 'API sin resultado')
  return json
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

    if (!results.length) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 No se encontraron resultados\n\n> Intenta con otro nombre o link'
      }, { quoted: m })
    }

    const validos = results.filter(v => buildYTUrl(v))
    if (!validos.length) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 No se pudo obtener el link del video'
      }, { quoted: m })
    }

    const rows = validos.map((v, i) => ({
      header: '🎬 ' + (v.timestamp || '?'),
      title: (v.title || 'Sin título').substring(0, 35),
      description: '💀 ' + (v.author?.name || v.author || 'Desconocido') + ' | 👁️ ' + (v.views || 0).toLocaleString(),
      id: 'ytdv_' + i + '_' + Buffer.from(buildYTUrl(v)).toString('base64') + '_' + Buffer.from((v.title || '').substring(0, 50)).toString('base64')
    }))

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

    if (id?.startsWith('ytdv_')) {
      const parts = id.split('_')
      const urlBase64 = parts[2]
      const titleBase64 = parts[3]
      const titulo = Buffer.from(titleBase64, 'base64').toString()

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
                    id: 'ytfmt_mp3_' + urlBase64 + '_' + titleBase64
                  },
                  {
                    header: '🎬 VIDEO',
                    title: 'MP4 - 480p',
                    description: '💀 Video con audio incluido',
                    id: 'ytfmt_mp4480_' + urlBase64 + '_' + titleBase64
                  },
                  {
                    header: '🎬 VIDEO HD',
                    title: 'MP4 - 720p',
                    description: '🩸 Video en alta definición',
                    id: 'ytfmt_mp4720_' + urlBase64 + '_' + titleBase64
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

    if (id?.startsWith('ytfmt_')) {
      const parts = id.split('_')
      const formato = parts[1]
      const urlBase64 = parts[2]
      const titleBase64 = parts[3]
      const ytUrl = Buffer.from(urlBase64, 'base64').toString()
      const titulo = Buffer.from(titleBase64, 'base64').toString()

      await m.react('⚰️')
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n🔪 Descargando ${formato === 'mp3' ? 'audio' : 'video'}...\n💀 ${titulo}`
      }, { quoted: m })

      const tipo = formato === 'mp3' ? 'mp3' : 'mp4'
      const quality = formato === 'mp4720' ? '720p' : '480p'
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
    }

    return false

  } catch (e) {
    console.log(e)
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
