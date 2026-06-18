import yts from 'yt-search'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import ffmpeg from 'fluent-ffmpeg'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const execFileAsync = promisify(execFile)

const TMP_DIR = path.join(os.tmpdir(), 'denji-ytc')
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

const qualityFormat = {
  '480p':  'bestvideo[height<=480]+bestaudio/best[height<=480]/best',
  '720p':  'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
  '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'
}

async function ytdlpDownload(youtubeUrl, quality, outputPath) {
  checkCookies()
  const format = qualityFormat[quality] || qualityFormat['480p']

  const args = [
    '--cookies', COOKIES_PATH,
    '--js-runtimes', 'node',
    '-f', format,
    '--merge-output-format', 'mp4',
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

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
    throw new Error('La descarga terminó pero el archivo es inválido o vacío.')
  }
}

function probeVideoCodec(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(err)
      const videoStream = data.streams?.find(s => s.codec_type === 'video')
      resolve(videoStream?.codec_name || null)
    })
  })
}

function remuxFaststart(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
      .on('error', reject)
      .on('end', () => resolve(outputPath))
      .save(outputPath)
  })
}

function reencodeH264(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart'])
      .on('error', reject)
      .on('end', () => resolve(outputPath))
      .save(outputPath)
  })
}

async function fixVideoForWhatsapp(inputPath) {
  const outputPath = inputPath.replace(/\.mp4$/i, '') + '-fixed.mp4'

  let codec = null
  try { codec = await probeVideoCodec(inputPath) } catch {}

  const esH264 = codec && ['h264', 'avc', 'avc1'].includes(String(codec).toLowerCase())

  if (esH264) {
    try {
      await remuxFaststart(inputPath, outputPath)
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) return outputPath
    } catch {}
    deleteSafe(outputPath)
  }

  await reencodeH264(inputPath, outputPath)
  return outputPath
}
async function sendVideoWithRetry(conn, chat, quoted, videoBuffer, fileName, caption, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await conn.sendMessage(chat, {
        video: videoBuffer,
        fileName,
        mimetype: 'video/mp4',
        caption
      }, { quoted })
      return 'video'
    } catch (e) {
      console.log(`[VIDEOC] intento ${i} de envío falló:`, e.message)
      if (i < intentos) await new Promise(r => setTimeout(r, 3000))
    }
  }

  // Si después de varios intentos sigue fallando, mándalo como documento (más tolerante a fallos de subida)
  await conn.sendMessage(chat, {
    document: videoBuffer,
    fileName,
    mimetype: 'video/mp4',
    caption: caption + '\n\n📦 Enviado como documento porque el envío como video falló varias veces.'
  }, { quoted })
  return 'document'
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const input = text?.trim()

  if (!input) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🎬 Descarga videos de YouTube (con cookies)\n\n> ${usedPrefix}${command} <nombre o link>`
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
        header: '🎬 ' + (v.timestamp || '?'),
        title: (v.title || 'Sin título').substring(0, 35),
        description: '💀 ' + (v.author?.name || v.author || 'Desconocido') + ' | 👁️ ' + (v.views || 0).toLocaleString(),
        id: 'vdvc' + SEP + payload
      }
    })

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'DENJI BOT - YOUTUBE (cookies)', subtitle: 'Selecciona un video', hasMediaAttachment: false },
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
    console.log('[VIDEOC ERROR]', e.message)
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

    if (id.startsWith('vdvc' + SEP) && !id.startsWith('vdvcdl' + SEP)) {
      const payload = id.slice(('vdvc' + SEP).length)
      const [urlB64, titleB64] = payload.split(SEP)
      const titulo = Buffer.from(titleB64, 'base64url').toString()

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: 'DENJI BOT - YOUTUBE (cookies)', subtitle: 'Elige la calidad', hasMediaAttachment: false },
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
                  { header: '🎬', title: 'MP4 - 480p', description: '💀 Calidad normal', id: 'vdvcdl' + SEP + '480p' + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎬', title: 'MP4 - 720p', description: '🩸 Alta definición', id: 'vdvcdl' + SEP + '720p' + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎬', title: 'MP4 - 1080p', description: '⭐ Full HD', id: 'vdvcdl' + SEP + '1080p' + SEP + urlB64 + SEP + titleB64 }
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

    if (id.startsWith('vdvcdl' + SEP)) {
      const payload = id.slice(('vdvcdl' + SEP).length)
      const parts = payload.split(SEP)
      const quality = parts[0]
      const urlB64 = parts[1]
      const titleB64 = parts[2]
      const ytUrl = Buffer.from(urlB64, 'base64url').toString()
      const titulo = Buffer.from(titleB64, 'base64url').toString()

      await m.react('⚰️')
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n🔪 Descargando ${quality} con cookies...\n💀 ${titulo}`
      }, { quoted: m })

      const finalTitle = sanitize(titulo)
      const rawPath = path.join(TMP_DIR, `${Date.now()}.mp4`)
      let fixedPath = null

      try {
        await ytdlpDownload(ytUrl, quality, rawPath)
        fixedPath = await fixVideoForWhatsapp(rawPath)
        const videoBuffer = await fs.promises.readFile(fixedPath)

        await sendVideoWithRetry(
  conn,
  m.chat,
  m,
  videoBuffer,
  finalTitle + '.mp4',
  `🩸 DENJI BOT 🩸\n\n🔪 Video descargado (cookies)\n\n💀 ${finalTitle}\n💀 Calidad: *${quality}*`
)
await m.react('🩸')
      } finally {
        deleteSafe(rawPath)
        deleteSafe(fixedPath)
      }
      return true
    }

    return false

  } catch (e) {
    console.log('[VIDEOC ERROR]', e.message)
    await m.react('💀')
    conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error: ' + e.message }, { quoted: m })
    return true
  }
}

handler.help = ['videomp4c']
handler.tags = ['downloader']
handler.command = /^(videomp4c|mp4c|ytvc)$/i
handler.desc = 'Descarga videos de YouTube usando yt-dlp + cookies (Termux)'

export default handler
