import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const execPromise = promisify(exec)
const searchCache = new Map()

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
        if (await fileExists(output)) return await readFile(output)
      } catch {
        return buffer
      }
    }

    await convertToSticker(input, output)
    if (!(await fileExists(output))) throw new Error('No se pudo convertir el sticker')
    return await readFile(output)
  } finally {
    await unlink(input).catch(() => {})
    await unlink(output).catch(() => {})
  }
}

async function searchStickerPacks(query) {
  const res = await fetch(`https://api.delirius.store/tools/stickerpack?query=${encodeURIComponent(query)}&page=0`)
  const json = await res.json()

  if (!json.status || !json.data) {
    throw new Error('No se encontraron resultados')
  }

  const data = Array.isArray(json.data) ? json.data : [json.data]
  return data
}

async function sendChoiceMenu(conn, chat, quoted, packs, usedPrefix, command) {
  const top = packs.slice(0, 3)

  let txt =
    `⛓️ DENJI BOT ⛓️\n\n` +
    `🩸 *PACKS ENCONTRADOS*\n\n`

  top.forEach((p, i) => {
    txt += `⚰️ *${i + 1}.* ${p.title || 'Sin título'}\n`
    txt += `👤 Autor: ${p.username || 'Desconocido'}\n`
    txt += `📦 Stickers: ${p.total || p.stickers?.length || 0}\n\n`
  })

  txt += `🔪 *Elige uno respondiendo con:*\n`
  txt += `${usedPrefix}${command} 1\n`
  txt += `${usedPrefix}${command} 2\n`
  txt += `${usedPrefix}${command} 3\n\n`
  txt += `> Escoge tu carnicería ⛓️`

  await conn.sendMessage(chat, { text: txt }, { quoted })
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const input = text?.trim()
  const userKey = `${m.sender}:${command}`

  if (!input) {
    return conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `🩸 *PACK DE STICKERS*\n\n` +
        `🔎 Busca packs y elige cuál quieres arrancar.\n\n` +
        `⚡ *Uso:*\n` +
        `${usedPrefix}${command} <tema>\n\n` +
        `🔪 *Ejemplo:*\n` +
        `${usedPrefix}${command} anime\n\n` +
        `> A la orden, soy Denji ⛓️`
    }, { quoted: m })
  }

  const isSelection = /^\d+$/.test(input)

  try {
    if (!isSelection) {
      await m.react('🔍')

      const packs = await searchStickerPacks(input)
      const top = packs.slice(0, 3)

      if (!top.length) {
        await m.react('💀')
        return conn.sendMessage(m.chat, {
          text:
            `⛓️ DENJI BOT ⛓️\n\n` +
            `💀 No encontré packs con ese tema.\n\n` +
            `> Prueba con otra búsqueda ⛓️`
        }, { quoted: m })
      }

      searchCache.set(userKey, {
        expires: Date.now() + 5 * 60 * 1000,
        packs: top
      })

      await sendChoiceMenu(conn, m.chat, m, top, usedPrefix, command)
      await m.react('🩸')
      return
    }

    const cached = searchCache.get(userKey)

    if (!cached || cached.expires < Date.now()) {
      searchCache.delete(userKey)
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text:
          `⛓️ DENJI BOT ⛓️\n\n` +
          `💀 Tu selección expiró.\n\n` +
          `🔎 Haz la búsqueda otra vez.\n` +
          `> La sangre se enfrió... ⛓️`
      }, { quoted: m })
    }

    const index = Number(input) - 1
    const selected = cached.packs[index]

    if (!selected) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text:
          `⛓️ DENJI BOT ⛓️\n\n` +
          `💀 Opción inválida.\n\n` +
          `⚠️ Elige 1, 2 o 3.\n` +
          `> No cortes donde no es ⛓️`
      }, { quoted: m })
    }

    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `⚰️ *PACK SELECCIONADO*\n` +
        `🎴 *Pack:* ${selected.title || 'Sin título'}\n` +
        `👤 *Autor:* ${selected.username || 'Desconocido'}\n` +
        `📦 *Total:* ${selected.total || selected.stickers?.length || 0}\n\n` +
        `🩸 Enviando hasta 10 stickers...\n` +
        `> Que empiece la masacre ⛓️`
    }, { quoted: m })

    await m.react('⏳')

    let enviados = 0
    for (const url of (selected.stickers || []).slice(0, 10)) {
      try {
        const stickerBuffer = await toWhatsAppSticker(url)
        await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
        enviados++
      } catch (e) {
        console.log('DENJI SPACK ERROR =>', e?.message || e)
      }
    }

    searchCache.delete(userKey)

    if (!enviados) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text:
          `⛓️ DENJI BOT ⛓️\n\n` +
          `💀 El pack salió corrupto o incompatible.\n\n` +
          `> Ni Denji pudo salvarlo... ⛓️`
      }, { quoted: m })
    }

    await m.react('🩸')

    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `🩸 *CARNICERÍA COMPLETADA*\n` +
        `🎴 *Pack:* ${selected.title || 'Sin título'}\n` +
        `✅ *Enviados:* ${enviados} stickers\n\n` +
        `> Denji dejó todo bañado en sangre ⛓️`
    }, { quoted: m })

  } catch (e) {
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text:
        `⛓️ DENJI BOT ⛓️\n\n` +
        `💀 Error al buscar o enviar stickers.\n\n` +
        `⚠️ ${String(e.message || e).slice(0, 200)}\n\n` +
        `> Algo se despedazó en el camino... ⛓️`
    }, { quoted: m })
  }
}

handler.help = ['spack']
handler.tags = ['downloader']
handler.command = /^spack$/i
handler.desc = 'Busca packs de stickers y permite elegir uno'

export default handler
