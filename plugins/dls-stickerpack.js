import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const execPromise = promisify(exec)

function isWebp(buffer) {
  return buffer?.slice(0, 4).toString() === 'RIFF' &&
         buffer?.slice(8, 12).toString() === 'WEBP'
}

async function fileExists(path) {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

async function convertToSticker(inputPath, outputPath) {
  const cmd = [
    'ffmpeg -y',
    '-threads 1',
    `-i "${inputPath}"`,
    '-vf "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,' +
      'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000"',
    '-vcodec libwebp',
    '-lossless 0',
    '-compression_level 6',
    '-q:v 40',
    '-preset default',
    '-loop 0',
    '-an',
    '-vsync 0',
    `"${outputPath}"`
  ].join(' ')

  await execPromise(cmd)
}

async function toWhatsAppSticker(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  const input = join(tmpdir(), `denji_stk_in_${Date.now()}`)
  const output = join(tmpdir(), `denji_stk_out_${Date.now()}.webp`)

  try {
    await writeFile(input, buffer)

    if (isWebp(buffer)) {
      try {
        await convertToSticker(input, output)
        if (await fileExists(output)) {
          return await readFile(output)
        }
      } catch {
        return buffer
      }
    }

    await convertToSticker(input, output)

    if (!(await fileExists(output))) {
      throw new Error('No se pudo convertir el sticker')
    }

    return await readFile(output)
  } finally {
    await unlink(input).catch(() => {})
    await unlink(output).catch(() => {})
  }
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const query = text?.trim()

  if (!query) {
    return conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `🩸 *PACK DE STICKERS*\n\n` +
        `⚡ Descarga packs de stickers con estilo sangriento.\n\n` +
        `🔗 *Uso:*\n` +
        `${usedPrefix}${command} <tema>\n\n` +
        `🔪 *Ejemplo:*\n` +
        `${usedPrefix}${command} anime\n\n` +
        `> A la orden, soy Denji ⛓️`
    }, { quoted: m })
  }

  await m.react('🔍')

  try {
    const res = await fetch(`https://api.delirius.store/tools/stickerpack?query=${encodeURIComponent(query)}&page=0`)
    const json = await res.json()

    if (!json.status || !json.data) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text:
          `⛓️ DENJI BOT ⛓️\n\n` +
          `💀 No encontré ningún pack con ese tema.\n\n` +
          `⚠️ Prueba con otra palabra.\n` +
          `> La motosierra sigue hambrienta... ⛓️`
      }, { quoted: m })
    }

    const { title, username, total, stickers } = json.data

    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `🩸 *PACK ENCONTRADO*\n` +
        `🎴 *Pack:* ${title}\n` +
        `👤 *Autor:* ${username}\n` +
        `📦 *Total:* ${total} stickers\n\n` +
        `⚡ Enviando hasta 10 stickers...\n` +
        `> Que empiece la carnicería ⛓️`
    }, { quoted: m })

    await m.react('⏳')

    let enviados = 0

    for (const url of stickers.slice(0, 10)) {
      try {
        const stickerBuffer = await toWhatsAppSticker(url)
        await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
        enviados++
      } catch (e) {
        console.log('DENJI STICKER ERROR =>', e?.message || e)
      }
    }

    if (enviados === 0) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text:
          `⛓️ DENJI BOT ⛓️\n\n` +
          `💀 Encontré el pack, pero los stickers salieron dañados o incompatibles.\n\n` +
          `⚠️ Intenta con otro pack.\n` +
          `> Ni la motosierra pudo salvarlos...`
      }, { quoted: m })
    }

    await m.react('✅')

    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `🩸 *MATANZA COMPLETADA*\n` +
        `🎴 *Pack:* ${title}\n` +
        `✅ *Enviados:* ${enviados} stickers\n\n` +
        `> Denji terminó el trabajo ⛓️`
    }, { quoted: m })

  } catch (e) {
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `💀 Error al obtener el pack de stickers.\n\n` +
        `⚠️ ${String(e.message || e).slice(0, 200)}\n\n` +
        `> Algo se hizo pedazos... ⛓️`
    }, { quoted: m })
  }
}

handler.help = ['spack']
handler.tags = ['downloader']
handler.command = /^spack$/i
handler.desc = 'Descarga packs de stickers estilo Denji'

export default handler
