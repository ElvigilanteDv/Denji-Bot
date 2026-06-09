// © 2026 EL VIGILANTE & BRAYANRK - HINATA BOT
// No quitar créditos

import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

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
    '-loop 0',
    '-an',
    '-vsync 0',
    `"${outputPath}"`
  ].join(' ')

  await execPromise(cmd)
}

async function toWhatsAppSticker(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'image/webp,image/*,*/*'
    }
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const contentType = res.headers.get('content-type') || ''
  const buffer = Buffer.from(await res.arrayBuffer())

  const inputExt =
    contentType.includes('png') ? '.png' :
    contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg' :
    contentType.includes('gif') ? '.gif' :
    contentType.includes('webp') ? '.webp' :
    '.bin'

  const input = join(tmpdir(), `denji_stk_in_${Date.now()}${inputExt}`)
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

    if (!(await fileExists(output))) {
      throw new Error('No se pudo convertir el sticker')
    }

    return await readFile(output)
  } finally {
    await unlink(input).catch(() => {})
    await unlink(output).catch(() => {})
  }
}

function denjiHeader() {
  return '⛓️ DENJI BOT ⛓️'
}

async function buscarYEnviar(conn, m, query) {
  await m.react('🔍')

  const res = await fetch(`https://api.delirius.store/search/stickerly?query=${encodeURIComponent(query)}`)
  const json = await res.json()

  if (!json.status || !json.data?.length) {
    await m.react('💀')
    return conn.sendMessage(m.chat, {
      text:
        `${denjiHeader()}\n\n` +
        `🩸 *BÚSQUEDA FALLIDA*\n\n` +
        `💀 No encontré nada para *${query}*\n\n` +
        `> Prueba otra palabra antes de que se enfríe la sangre...`
    }, { quoted: m })
  }

  const pack = json.data[0]

  await m.react('⏳')
  await conn.sendMessage(m.chat, {
    text:
      `${denjiHeader()}\n\n` +
      `🩸 *PACK LOCALIZADO*\n\n` +
      `🎴 *Pack:* ${pack.name}\n` +
      `👤 *Autor:* ${pack.author}\n\n` +
      `⚰️ Descargando los pedazos del pack...\n` +
      `> La motosierra ya arrancó.`
  }, { quoted: m })

  const res2 = await fetch(`https://api.delirius.store/download/stickerly?url=${encodeURIComponent(pack.url)}`)
  const json2 = await res2.json()

  if (!json2.status || !json2.data?.stickers?.length) {
    await m.react('💀')
    return conn.sendMessage(m.chat, {
      text:
        `${denjiHeader()}\n\n` +
        `💀 *ERROR DE DESCARGA*\n\n` +
        `No pude arrancar los stickers del pack.\n\n` +
        `> Algo se hizo trizas en el camino...`
    }, { quoted: m })
  }

  const stickers = json2.data.stickers
  let enviados = 0

  for (let i = 0; i < Math.min(stickers.length, 5); i++) {
    try {
      const stickerBuffer = await toWhatsAppSticker(stickers[i])
      await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
      enviados++
    } catch (e) {
      console.log('DENJI STICKERLY ERROR =>', e?.message || e)
    }
  }

  await conn.sendMessage(m.chat, {
    text:
      `${denjiHeader()}\n\n` +
      `🩸 *CARNICERÍA COMPLETADA*\n\n` +
      `✅ *Enviados:* ${enviados}/${Math.min(stickers.length, 5)}\n` +
      `🎴 *Pack:* ${pack.name}\n` +
      `👤 *Autor:* ${pack.author}\n\n` +
      `> Denji dejó el chat bañado en sangre.`
  }, { quoted: m })

  await m.react('🩸')
}

let handler = async (m, { conn, text }) => {
  if (!text) {
    const sections = [{
      title: '🩸 BÚSQUEDAS SANGRIENTAS',
      rows: [
        { header: '🗡️', title: 'Goku', description: 'Arranca stickers de Goku', id: 'stickerly_Goku' },
        { header: '⛓️', title: 'Naruto', description: 'Corta stickers de Naruto', id: 'stickerly_Naruto' },
        { header: '💀', title: 'Luffy', description: 'Despedaza stickers de Luffy', id: 'stickerly_Luffy' },
        { header: '🩸', title: 'Meme', description: 'Desangra stickers de memes', id: 'stickerly_Meme' }
      ]
    }]

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '⛓️ DENJI STICKERLY ⛓️',
        subtitle: 'Buscador sangriento de stickers',
        hasMediaAttachment: false
      },
      body: {
        text:
          `${denjiHeader()}\n\n` +
          `🩸 *STICKERLY MODE*\n\n` +
          `⚡ Busca packs de stickers y arráncalos directo al chat.\n\n` +
          `🔎 Usa el menú o escribe:\n` +
          `.stickerly Goku\n` +
          `.stickerly Naruto\n\n` +
          `> Escoge tu próxima masacre.`
      },
      footer: {
        text: '🩸 Denji Bot | La motosierra nunca duerme'
      },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🩸 ELEGIR BÚSQUEDA',
            sections
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {},
          interactiveMessage
        }
      }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    return
  }

  try {
    await buscarYEnviar(conn, m, text)
  } catch (e) {
    console.error(e)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text:
        `${denjiHeader()}\n\n` +
        `💀 *ERROR FATAL*\n\n` +
        `⚠️ ${String(e.message || e).slice(0, 250)}\n\n` +
        `> Algo explotó entre sangre y fierros...`
    }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null

    if (!id || !id.startsWith('stickerly_')) return false

    const query = id.replace('stickerly_', '')
    await buscarYEnviar(conn, m, query)
    return true
  } catch (e) {
    console.error(e)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text:
        `${denjiHeader()}\n\n` +
        `💀 *ERROR AL LEER EL MENÚ*\n\n` +
        `⚠️ ${String(e.message || e).slice(0, 250)}\n\n` +
        `> La sangre no dejó ver la opción correcta...`
    }, { quoted: m })
    return true
  }
}

handler.help = ['stickerly']
handler.tags = ['downloader']
handler.command = /^(stickerly|stickers|stickerpack)$/i
handler.desc = 'Busca y descarga stickers de Stickerly estilo Denji'

export default handler
