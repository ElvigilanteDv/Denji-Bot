import { MsEdgeTTS, OUTPUT_FORMAT, PITCH, RATE } from 'msedge-tts'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const VOICE = 'es-MX-JorgeNeural' 

const handler = async (m, { conn, usedPrefix, command }) => {
  const text = m.text?.slice((usedPrefix + command).length).trim()

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔪 Convierte texto a voz tenebrosa\n\n> ${usedPrefix}${command} <texto>\n> Ejemplo: ${usedPrefix}${command} nadie escapa de mis cadenas`
    }, { quoted: m })
  }

  await m.react('⚰️')

  const tmpDir = os.tmpdir()
  const rawPath = path.join(tmpDir, `tts_${Date.now()}.mp3`)
  const finalPath = path.join(tmpDir, `tts_final_${Date.now()}.mp3`)

  try {
    const tts = new MsEdgeTTS()
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
      pitch: PITCH.LOW,
      rate: RATE.SLOW
    })

    const { audioStream } = await tts.toStream(text)

    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(rawPath)
      audioStream.pipe(ws)
      ws.on('finish', resolve)
      ws.on('error', reject)
      audioStream.on('error', reject)
    })

    await execAsync(`ffmpeg -y -i "${rawPath}" -af "asetrate=44100*0.80,aresample=44100,atempo=1.1,bass=g=6" "${finalPath}"`)

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

handler.help = ['tts <texto>']
handler.tags = ['tools']
handler.command = /^(tts|voz|speak)$/i
handler.desc = 'Convierte texto a voz tenebrosa'

export default handler
