import axios from "axios"
import ffmpeg from "fluent-ffmpeg"
import { writeFile, unlink } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { randomUUID } from "crypto"
import fs from "fs"

const API_BASE = process.env.DV_API_URL
const APIKEY   = process.env.DV_API_KEY

async function toWebpSticker(inputBuffer, ext = "png") {
  const id      = randomUUID()
  const inPath  = join(tmpdir(), `emojimix_in_${id}.${ext}`)
  const outPath = join(tmpdir(), `emojimix_out_${id}.webp`)
  await writeFile(inPath, inputBuffer)
  await new Promise((resolve, reject) => {
    ffmpeg(inPath)
      .outputOptions([
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
        "-vcodec", "libwebp",
        "-lossless", "0",
        "-qscale", "75",
        "-preset", "default",
        "-loop", "0",
        "-an",
        "-vsync", "0",
      ])
      .toFormat("webp")
      .save(outPath)
      .on("end", resolve)
      .on("error", reject)
  })
  const outBuffer = await fs.promises.readFile(outPath)
  await unlink(inPath).catch(() => {})
  await unlink(outPath).catch(() => {})
  return outBuffer
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const fullText = text || ""
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu
  const foundEmojis = fullText.match(emojiRegex)

  if (!foundEmojis || foundEmojis.length < 2) {
    return conn.sendMessage(m.chat, {
      text: `🪚「 DENJI EMOJIMIX 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Necesitas dos emojis para que la sierra los fusione\n📌 » Ejemplo: ${usedPrefix}${command} 🐱🔥\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔`
    }, { quoted: m })
  }

  const emoji1 = foundEmojis[0]
  const emoji2 = foundEmojis[1]

  await m.react('⏳')

  try {
    const { data } = await axios.get(`${API_BASE}/search/tenor/emoji`, {
      params: { emoji1, emoji2, apikey: APIKEY },
      headers: { "x-api-key": APIKEY },
      timeout: 20000,
    })

    let imageUrl = data?.url_full || data?.url
    if (!imageUrl) throw new Error("La API no devolvió una imagen.")
    if (imageUrl.startsWith("/")) imageUrl = `${API_BASE}${imageUrl}`

    const imgRes = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 20000 })
    const imgBuffer = Buffer.from(imgRes.data)

    const webpBuffer = await toWebpSticker(imgBuffer, "png")

    await conn.sendMessage(m.chat, {
      sticker: webpBuffer,
      stickerAuthor: "🪚 DENJI BOT",
      stickerName: `${emoji1}+${emoji2}`,
    }, { quoted: m })

    await m.react('🪚')
  } catch (e) {
    console.error("[DENJI EMOJIMIX ERROR]", e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `🪚「 DENJI EMOJIMIX 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » La motosierra no pudo fusionar esos emojis\n☠️ » Intenta con otra combinación\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔`
    }, { quoted: m })
  }
}

handler.help = ['emojimix <emoji1><emoji2>']
handler.tags = ['sticker']
handler.command = /^(emojimix|emojicombine|mixemoji)$/i
handler.desc = 'Denji fusiona dos emojis con la motosierra 🪚🩸'

export default handler
