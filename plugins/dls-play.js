import yts from 'yt-search'
import axios from 'axios'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import { pipeline } from 'stream/promises'
import { randomUUID } from 'crypto'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const SEP = '|~|'
const DELIRIUS_API = 'https://api.delirius.store/download'
const TMP_DIR = path.join(os.tmpdir(), 'denji-yt')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145 Safari/537.36'
const FILE_TIMEOUT = 150_000
const MAX_BYTES = 500 * 1024 * 1024
const MIN_BYTES = 10 * 1024

async function ensureTmpDir() {
  await fsp.mkdir(TMP_DIR, { recursive: true })
}
ensureTmpDir()

async function deleteSafe(p) {
  try { if (p) await fsp.unlink(p) } catch {}
}

const isYTUrl = (url = '') => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

const getVideoId = (text = '') => {
  const m = text.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/
  )
  return m?.[1] || null
}

const sanitizeFileName = (name = 'archivo') =>
  name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'archivo'

const buildYTUrl = (v) => {
  if (v.videoId) return `https://www.youtube.com/watch?v=${v.videoId}`
  if (v.url && isYTUrl(v.url)) return v.url
  return null
}

const stripP = (q = '') => q.replace(/p$/i, '')

async function deliriusGetLink(youtubeUrl, tipo = 'mp4', quality = '360p') {
  let res, d

  if (tipo === 'mp3') {
    // /ytmp3 — no quality param needed
    res = await axios.get(`${DELIRIUS_API}/ytmp3`, {
      params: { url: youtubeUrl },
      timeout: 90_000,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      validateStatus: () => true
    })
    d = res.data
    console.log('[YT API mp3]', JSON.stringify(d))
    if (!d?.status) throw new Error(d?.msg || `Error al obtener audio (HTTP ${res.status})`)
    const remoteUrl = d?.data?.download || ''
    if (!remoteUrl) throw new Error('Delirius no devolvió URL de descarga (mp3)')
    return {
      remoteUrl,
      title: d?.data?.title || '',
      fileName: d?.data?.title || '',
      quality: 'mp3'
    }
  }

  const fmt = stripP(quality)
  res = await axios.get(`${DELIRIUS_API}/ytmp4v2`, {
    params: { url: youtubeUrl, format: fmt },
    timeout: 90_000,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    validateStatus: () => true
  })
  d = res.data
  // API sometimes returns a plain string error instead of JSON
  if (typeof d === 'string' || !d?.status) {
    const reason = typeof d === 'string' ? d.slice(0, 120) : (d?.msg || 'Sin URL')
    throw new Error(reason)
  }
  const remoteUrl = d?.data?.download || ''
  if (!remoteUrl) throw new Error('Delirius no devolvió URL de descarga (mp4)')
  return {
    remoteUrl,
    title: d?.data?.title || '',
    fileName: d?.data?.title || '',
    quality: d?.data?.format || fmt
  }
}

async function downloadToFile(remoteUrl, ext) {
  await ensureTmpDir()
  const tempPath = path.join(TMP_DIR, `${Date.now()}-${randomUUID()}${ext}`)

  const res = await axios.get(remoteUrl, {
    responseType: 'stream',
    timeout: FILE_TIMEOUT,
    headers: {
      'User-Agent': UA,
      'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.5',
      'Accept-Language': 'es-ES,es;q=0.9',
      'Accept-Encoding': 'identity'
    },
    maxRedirects: 5,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true
  })

  if (res.status >= 400) throw new Error(`HTTP ${res.status} al descargar`)

  let downloaded = 0
  res.data.on('data', (chunk) => {
    downloaded += chunk.length
    if (downloaded > MAX_BYTES) res.data.destroy(new Error('Archivo demasiado grande'))
  })

  try {
    await pipeline(res.data, fs.createWriteStream(tempPath))
  } catch (e) {
    await deleteSafe(tempPath)
    throw e
  }

  const stat = await fsp.stat(tempPath).catch(() => null)
  if (!stat?.size || stat.size < MIN_BYTES) {
    await deleteSafe(tempPath)
    throw new Error('Archivo descargado inválido o vacío')
  }

  return tempPath
}

async function sendMedia(conn, m, { tipo, remoteUrl, title, quality, fileName }) {
  const ext = tipo === 'mp3' ? '.mp3' : '.mp4'
  const safeName = sanitizeFileName(fileName || title) + ext
  const cap = tipo === 'mp3'
    ? `🩸 DENJI BOT 🩸\n\n🔪 Audio descargado\n\n💀 ${title}`
    : `🩸 DENJI BOT 🩸\n\n🔪 Video descargado\n\n💀 ${title}\n💀 Calidad: *${quality}p*`

  try {
    if (tipo === 'mp3') {
      await conn.sendMessage(m.chat, {
        audio: { url: remoteUrl },
        mimetype: 'audio/mpeg',
        fileName: safeName
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        video: { url: remoteUrl },
        mimetype: 'video/mp4',
        fileName: safeName,
        caption: cap
      }, { quoted: m })
    }
    return
  } catch (e) {
    console.log('[YT] URL directa falló, descargando local...', e.message)
  }

  let tempPath = null
  try {
    tempPath = await downloadToFile(remoteUrl, ext)
    if (tipo === 'mp3') {
      await conn.sendMessage(m.chat, {
        audio: { url: tempPath },
        mimetype: 'audio/mpeg',
        fileName: safeName
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        video: { url: tempPath },
        mimetype: 'video/mp4',
        fileName: safeName,
        caption: cap
      }, { quoted: m })
    }
  } finally {
    deleteSafe(tempPath)
  }
}


async function cobaltGetLink(youtubeUrl, quality = '360') {
  const q = String(quality).replace(/p$/i, '')
  const res = await axios.post('https://api.cobalt.tools/', {
    url: youtubeUrl,
    videoQuality: q,
    filenameStyle: 'basic',
    downloadMode: 'auto'
  }, {
    timeout: 60_000,
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    validateStatus: () => true
  })
  const d = res.data
  if (!d?.url) throw new Error(d?.error?.code || d?.text || 'Cobalt sin URL')
  return {
    remoteUrl: d.url,
    title: '',
    fileName: '',
    quality: q
  }
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
      return conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 No se encontraron resultados' }, { quoted: m })
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
    console.log('[YT SEARCH ERROR]', e)
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
                  { header: '🎵 AUDIO',    title: 'MP3 - 128K', description: '🔪 Solo audio',      id: 'ytmp3'    + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎬 VIDEO SD', title: 'MP4 - 360p', description: '💀 Video estándar',  id: 'ytmp4360' + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎬 VIDEO HD', title: 'MP4 - 480p', description: '🩸 Video HD',        id: 'ytmp4480' + SEP + urlB64 + SEP + titleB64 },
                  { header: '🎬 VIDEO FHD',title: 'MP4 - 720p', description: '🩸 Video Full HD',   id: 'ytmp4720' + SEP + urlB64 + SEP + titleB64 }
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

    const formatos = ['ytmp3', 'ytmp4360', 'ytmp4480', 'ytmp4720']
    const fmt = formatos.find(f => id?.startsWith(f + SEP))
    if (!fmt) return false

    const payload = id.slice((fmt + SEP).length)
    const [urlB64, titleB64] = payload.split(SEP)
    const ytUrl  = Buffer.from(urlB64,   'base64url').toString()
    const titulo = Buffer.from(titleB64, 'base64url').toString()

    const tipo    = fmt === 'ytmp3' ? 'mp3' : 'mp4'
    const quality = fmt === 'ytmp4720' ? '720p'
                  : fmt === 'ytmp4480' ? '480p'
                  : '360p'

    await m.react('⚰️')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔪 Descargando ${tipo === 'mp3' ? 'audio' : 'video'}...\n💀 ${titulo}\n\n> Esto puede tardar un momento...`
    }, { quoted: m })

    let result
    if (tipo === 'mp4') {

      const fallbacks = ['720p', '480p', '360p', '240p']
      const startIdx = Math.max(fallbacks.indexOf(quality), 0)
      const chain = fallbacks.slice(startIdx)
      let lastErr
      for (const q of chain) {
        try {
          result = await deliriusGetLink(ytUrl, 'mp4', q)
          break
        } catch (e) {
          lastErr = e
          const next = chain[chain.indexOf(q) + 1]
          console.log('[YT]', q, 'falló:', e.message, next ? '→ probando ' + next : '→ sin más opciones')
        }
      }
      if (!result) {
        console.log('[YT] Delirius agotado, intentando Cobalt...')
        const qNum = quality.replace(/p$/i, '')
        result = await cobaltGetLink(ytUrl, qNum)
      }
    } else {
      result = await deliriusGetLink(ytUrl, 'mp3')
    }

    await sendMedia(conn, m, {
      tipo,
      remoteUrl: result.remoteUrl,
      title: result.title || titulo,
      quality: result.quality,
      fileName: result.fileName || titulo
    })

    await m.react('🩸')
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
