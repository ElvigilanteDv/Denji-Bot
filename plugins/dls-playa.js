import yts from 'yt-search'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { pipeline } from 'stream/promises'

const DV_API_URL = process.env.DV_API_URL
const DV_API_KEY = process.env.DV_API_KEY
const TMP_DIR = path.join(os.tmpdir(), 'denji-yt')

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

async function dvAudio(youtubeUrl) {
  const params = new URLSearchParams({ url: youtubeUrl })
  if (DV_API_KEY) params.set('apikey', DV_API_KEY)
  const res = await fetch(`${DV_API_URL}/ytmp3?${params}`)
  const text = await res.text()
  if (text.trim().startsWith('<')) throw new Error('API no disponible, intenta más tarde')
  let json
  try { json = JSON.parse(text) } catch { throw new Error('Respuesta inválida de la API') }
  if (!json.ok) throw new Error(json.detail || json.error || json.message || 'API sin resultado')
  return json
}

async function downloadToFile(streamUrl, ext) {
  ensureTmp()
  const tmpPath = path.join(TMP_DIR, `${Date.now()}.${ext}`)
  const res = await fetch(streamUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar`)
  await pipeline(res.body, fs.createWriteStream(tmpPath))
  if (!fs.existsSync(tmpPath) || fs.statSync(tmpPath).size < 100) throw new Error('Archivo inválido')
  return tmpPath
}

let handlerAudio = async (m, { conn, text, usedPrefix, command }) => {
  const input = text?.trim()

  if (!input) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🎵 Descarga audio de YouTube\n\n> ${usedPrefix}${command} <nombre o link>`
    }, { quoted: m })
  }

  await m.react('🩸')

  let tmpPath = null
  try {
    const video_id = getVideoId(input)
    let ytUrl = null

    if (video_id) {
      ytUrl = `https://www.youtube.com/watch?v=${video_id}`
    } else if (isYTUrl(input)) {
      ytUrl = input
    } else {
      const search = await yts(input)
      const first = search.videos?.[0]
      if (!first) throw new Error('No se encontraron resultados')
      ytUrl = buildYTUrl(first)
    }

    if (!ytUrl) throw new Error('No se pudo obtener URL de YouTube')

    const result = await dvAudio(ytUrl)
    const streamUrl = result.download_url || result.stream_url
    const title = sanitize(result.title || 'audio')
    const filename = sanitize(result.filename || title)

    tmpPath = await downloadToFile(streamUrl, 'mp3')

    await conn.sendMessage(m.chat, {
      audio: { stream: fs.createReadStream(tmpPath) },
      mimetype: 'audio/mpeg',
      fileName: filename + '.mp3',
      caption: `🩸 DENJI BOT 🩸\n\n🎵 *${title}*`
    }, { quoted: m })

    await m.react('🩸')

  } catch (e) {
    console.log('[PLAYA ERROR]', e.message)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error: ${e.message}`
    }, { quoted: m })
  } finally {
    deleteSafe(tmpPath)
  }
}

handlerAudio.help = ['playmp3']
handlerAudio.tags = ['downloader']
handlerAudio.command = /^(playmp3|mp3a|audioa)$/i
handlerAudio.desc = 'Descarga audio de YouTube (API alternativa)'

export default handlerAudio
