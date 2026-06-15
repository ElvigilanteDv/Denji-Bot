import fs from 'fs'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'
import { pipeline } from 'stream/promises'

const execAsync = promisify(exec)

async function getTTS(text, voice = 'es-MX-JorgeNeural') {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=es&client=tw-ob`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

const handler = async (m, { conn, usedPrefix, command }) => {
  const text = m.text?.slice((usedPrefix + command).length).trim()

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔪 Convierte texto a voz tenebrosa\n\n> ${usedPrefix}${command} <texto>\n> Ejemplo: ${usedPrefix}${command} nadie escapa de mis cadenas`
    }, { quoted: m })
  }

  if (text.length > 200) {
    return conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 Texto demasiado largo\n> Máximo 200 caracteres'
    }, { quoted: m })
  }

  await m.react('⚰️')

  const tmpDir = os.tmpdir()
  const rawPath = path.join(tmpDir, `tts_${Date.now()}.mp3`)
  const finalPath = path.join(tmpDir, `tts_final_${Date.now()}.mp3`)

  try {
    const res = await getTTS(text)
    await pipeline(res.body, fs.createWriteStream(rawPath))

    if (!fs.existsSync(rawPath) || fs.statSync(rawPath).size < 100) {
      throw new Error('Audio inválido o vacío')
    }

    await execAsync(`ffmpeg -y -i "${rawPath}" -af "asetrate=44100*0.75,aresample=44100,atempo=1.15,bass=g=10,volume=1.5" "${finalPath}"`)

    const audioData = fs.readFileSync(finalPath)

    await conn.sendMessage(m.chat, {
      audio: audioData,
      mimetype: 'audio/mpeg',
      ptt: false
    }, { quoted: m })

    await m.react('🩸')

  } catch (e) {
    console.error('[TTS ERROR]', e.message)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error al generar voz\n> ${e.message}`
    }, { quoted: m })
  } finally {
    try { fs.unlinkSync(rawPath) } catch {}
    try { fs.unlinkSync(finalPath) } catch {}
  }
}

handler.help = ['tts2 <texto>']
handler.tags = ['tools']
handler.command = /^(tts2|voz2)$/i
handler.desc = 'Convierte texto a voz tenebrosa'

export default handler
