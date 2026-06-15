import fs from 'fs'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'
import { pipeline } from 'stream/promises'

const execAsync = promisify(exec)

const VOICE = 'Brian'
const SE_API = 'https://api.streamelements.com/kappa/v2/speech'

const handler = async (m, { conn, usedPrefix, command }) => {
  const text = m.text?.slice((usedPrefix + command).length).trim()

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔪 Convierte texto a voz tenebrosa\n\n> ${usedPrefix}${command} <texto>\n> Ejemplo: ${usedPrefix}${command} nadie escapa de mis cadenas`
    }, { quoted: m })
  }

  if (text.length > 500) {
    return conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 Texto demasiado largo\n> Máximo 500 caracteres'
    }, { quoted: m })
  }

  await m.react('⚰️')

  const tmpDir = os.tmpdir()
  const rawPath = path.join(tmpDir, `tts_${Date.now()}.mp3`)
  const finalPath = path.join(tmpDir, `tts_final_${Date.now()}.mp3`)

  try {
    const url = `${SE_API}?voice=${VOICE}&text=${encodeURIComponent(text)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`StreamElements error: HTTP ${res.status}`)

    await pipeline(res.body, fs.createWriteStream(rawPath))

    if (!fs.existsSync(rawPath) || fs.statSync(rawPath).size < 100) {
      throw new Error('Audio inválido o vacío')
    }

    await execAsync(`ffmpeg -y -i "${rawPath}" -af "asetrate=44100*0.78,aresample=44100,atempo=1.1,bass=g=8,volume=1.5" "${finalPath}"`)

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
handler.desc = 'Convierte texto a voz tenebrosa (StreamElements)'

export default handler
