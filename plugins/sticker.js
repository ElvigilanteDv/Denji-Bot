import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { sticker } from '../lib/sticker.js'

let handler = async (m, { conn, usedPrefix, command }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = (quoted.msg || quoted).mimetype || ''
  const isImage = /image/.test(mime)
  const isVideo = /video/.test(mime)
  if (!isImage && !isVideo) {
    return m.reply(`❌ Responde a una imagen o video con *${usedPrefix}${command}*`)
  }
  await m.reply('⏳ Creando sticker...')
  const buffer = await quoted.download()
  const stickerBuffer = await sticker(buffer, {
    packname: '⛓️🩸 DENJI BOT 🩸⛓️',
    author: '🩸 © JM 🩸',
    categories: ['🩸', '⛓️']
  })
  await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
}

handler.help    = ['sticker', 'stiker', 'animado']
handler.tags    = ['sticker']
handler.command = /^s(ticker|tikera?|anim(ado)?)?$/i
handler.desc    = 'Convierte una imagen o video en sticker'

export default handler
