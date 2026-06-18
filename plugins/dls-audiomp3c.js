import yts from 'yt-search'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const execFileAsync = promisify(execFile)

const TMP_DIR = path.join(os.tmpdir(), 'denji-ytc-audio')
const COOKIES_PATH = path.join(process.cwd(), 'cookies', 'cookies.txt')
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

function checkCookies() {
  if (!fs.existsSync(COOKIES_PATH)) {
    throw new Error(`No encontré cookies.txt en /cookies (esperaba: ${COOKIES_PATH})`)
  }
}

// Calidades de audio en kbps
const qualityBitrate = {
  '128k': '128',
  '192k': '192',
  '320k': '320'
}

async function ytdlpDownloadAudio(youtubeUrl, bitrate, outputPath) {
  checkCookies()

  const args = [
    '--cookies', COOKIES_PATH,
    '--js-runtimes', 'node',
    '-f', 'bestaudio/best',
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', bitrate,
    '--no-playlist',
    '--no-warnings',
    '-o', outputPath,
    youtubeUrl
  ]

  try {
    await execFileAsync('yt-dlp', args, { timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 * 20 })
  } catch (e) {
    const stderr = String(e?.stderr || e?.message || 'Error desconocido')
    if (/sign in to confirm|cookies/i.test(stderr)) {
      throw new Error('Las cookies parecen vencidas o inválidas, vuelve a exportarlas.')
    }
    throw new Error('yt-dlp falló: ' + stderr.trim().split('\n').slice(-3).join(' | '))
  }

  // yt-dlp con --extract-audio puede cambiar la extensión, buscar el archivo real
  const mp3Path = outputPath.replace(/\.[^.]+$/, '.mp3')
  const finalPath = fs.existsSync(outputPath) ? outputPath
    : fs.existsSync(mp3Path) ? mp3Path
    : null

  if (!finalPath || fs.statSync(finalPath).size < 1000) {
    throw new Error('La descarga terminó pero el archivo de audio es inválido o vacío.')
  }

  return finalPath
}

async function sendAudioWithRetry(conn, chat, quoted, audioBuffer, fileName, caption, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await conn.sendMessage(chat, {
        audio: audioBuffer,
        fileName,
        mimetype: 'audio/mpeg',
        ptt: false
      }, { quoted })

      // Enviar caption aparte porque audio no soporta caption directo en Baileys
      await conn.sendMessage(chat, { text: caption }, { quoted })
      return 'audio'
    } catch (e) {
      console.log(`[AUDIOC] intento ${i} de envío falló:`, e.message)
      if (i < intentos) await new Promise(r => setTimeout(r, 3000))
    }
  }

  // Fallback: mandar como documento
  await conn.sendMessage(chat, {
    document: audioBuffer,
    fileName,
    mimetype: 'audio/mpeg',
    caption: caption + '\n\n📦 Enviado como documento porque el envío como audio falló varias veces.'
  }, { quoted })
  return 'document'
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const input = text?.trim()

  if (!input) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🎵 Descarga audios de YouTube en MP3 (con cookies)\n\n> ${usedPrefix}${command} <nombre o link>`
    }, { quoted: m })
  }

  try {
    checkCookies()
  } catch (e) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 ${e.message}`
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
        header: '🎵 ' + (v.timestamp || '?'),
        title: (v.title || 'Sin título').substring(0, 35),
        description: '💀 ' + (v.author?.name || v.author || 'Desconocido') + ' | 👁️ ' + (v.views || 0).toLocaleString(),
        id: 'advc' + SEP + payload
      }
    })

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'DENJI BOT - YOUTUBE AUDIO (cookies)', subtitle: 'Selecciona un audio', hasMediaAttachment: false },
      body: { text: `🩸 DENJI BOT 🩸\n\n🎵 Búsqueda: ${input}\n💀 ${validos.length} resultados\n\n> Elige uno` },
      footer: { text: '🩸 DENJI BOT 🩸' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎵 RESULTADOS',
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
    console.log('[AUDIOC ERROR]', e.message)
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

    // Paso 1: usuario eligió canción → mostrar calidades de audio
    if (id.startsWith('advc' + SEP) && !id.startsWith('advcdl' + SEP)) {
      const payload = id.slice(('advc' + SEP).length)
      const [urlB64, titleB64] = payload.split(SEP)
      const titulo = Buffer.from(titleB64, 'base64url').toString()

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: 'DENJI BOT - YOUTUBE AUDIO (cookies)', subtitle: 'Elige la calidad', hasMediaAttachment: false },
        body: { text: `🩸 DENJI BOT 🩸\n\n🎵 ${titulo}\n\n💀 ¿Qué calidad de audio quieres?` },
        footer: { text: '🩸 DENJI BOT 🩸' },
        nativeFlowMessage: {
          buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '🎵 CALIDAD',
              sections: [{
                title: '💀 ELIGE',
                rows: [
                  { header: '🎵', title: 'MP3 - 128 kbps', description: '💀 Calidad normal, archivo ligero', id: 'advcdl' + SEP + '128k' + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎵', title: 'MP3 - 192 kbps', description: '🩸 Buena calidad', id: 'advcdl' + SEP + '192k' + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎵', title: 'MP3 - 320 kbps', description: '⭐ Máxima calidad', id: 'advcdl' + SEP + '320k' + SEP + urlB64 + SEP + titleB64 }
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

    // Paso 2: usuario eligió calidad → descargar y enviar
    if (id.startsWith('advcdl' + SEP)) {
      const payload = id.slice(('advcdl' + SEP).length)
      const parts = payload.split(SEP)
      const quality = parts[0]
      const urlB64 = parts[1]
      const titleB64 = parts[2]
      const ytUrl = Buffer.from(urlB64, 'base64url').toString()
      const titulo = Buffer.from(titleB64, 'base64url').toString()
      const bitrate = qualityBitrate[quality] || '128'

      await m.react('⚰️')
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n🎵 Descargando MP3 ${quality} con cookies...\n💀 ${titulo}`
      }, { quoted: m })

      const finalTitle = sanitize(titulo)
      const rawPath = path.join(TMP_DIR, `${Date.now()}.mp3`)
      let realPath = null

      try {
        realPath = await ytdlpDownloadAudio(ytUrl, bitrate, rawPath)
        const audioBuffer = await fs.promises.readFile(realPath)

        await sendAudioWithRetry(
          conn,
          m.chat,
          m,
          audioBuffer,
          finalTitle + '.mp3',
          `🩸 DENJI BOT 🩸\n\n🎵 Audio descargado (cookies)\n\n💀 ${finalTitle}\n💀 Calidad: *${quality}*`
        )
        await m.react('🩸')
      } finally {
        deleteSafe(rawPath)
        if (realPath && realPath !== rawPath) deleteSafe(realPath)
      }
      return true
    }

    return false

  } catch (e) {
    console.log('[AUDIOC ERROR]', e.message)
    await m.react('💀')
    conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error: ' + e.message }, { quoted: m })
    return true
  }
}

handler.help = ['audiomp3c']
handler.tags = ['downloader']
handler.command = /^(audiomp3c|mp3c|ytac)$/i
handler.desc = 'Descarga audios de YouTube en MP3 usando yt-dlp + cookies (Termux)'

export default handler
