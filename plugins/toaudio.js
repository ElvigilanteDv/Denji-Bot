import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const TMP_DIR = path.join(os.tmpdir(), 'denji-toaudio')

function ensureTmp() {
  try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}
}
ensureTmp()

function deleteSafe(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p) } catch {}
}

let handler = async (m, { conn }) => {
  const quotedVideo = m.quoted?.mtype === 'videoMessage' ? m.quoted : null
  const directVideo = m.mtype === 'videoMessage' ? m : null
  const videoMsg = quotedVideo || directVideo

  if (!videoMsg) {
    return conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n❌ Responde a un video con *.toaudio*.'
    }, { quoted: m })
  }

  let inputPath = null
  let outputPath = null

  try {
    await m.react('⏳')

    const buffer = await videoMsg.download()
    const base = Date.now()
    inputPath = path.join(TMP_DIR, `video_${base}.mp4`)
    outputPath = path.join(TMP_DIR, `audio_${base}.mp3`)
    fs.writeFileSync(inputPath, buffer)

    await execAsync(`ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`)

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
      throw new Error('El video no tiene pista de audio o es demasiado corto.')
    }

    const audioBuffer = fs.readFileSync(outputPath)

    await conn.sendMessage(m.chat, {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      ptt: false
    }, { quoted: m })

    await m.react('🩸')
  } catch (e) {
    console.error('DENJI TOAUDIO ERROR =>', e)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error al extraer audio\n\n⚠️ ${e.message}`
    }, { quoted: m })
  } finally {
    deleteSafe(inputPath)
    deleteSafe(outputPath)
  }
}

handler.help = ['toaudio']
handler.tags = ['converter']
handler.command = /^(toaudio|ado|extraeraudio)$/i
handler.desc = 'Convierte un video a audio (mp3)'

export default handler
