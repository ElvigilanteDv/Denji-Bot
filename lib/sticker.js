import { downloadMediaMessage } from 'fsociety-Baileys'
import { sticker } from '../../lib/sticker.js'

export default {
  name: 's',
  aliases: ['sticker', 'stiker', 'sa', 'sanim', 'stickera', 'stickeranimado'],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import('../../utils.js')

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const isImage = quoted?.imageMessage || msg.message?.imageMessage
    const isVideo = quoted?.videoMessage || msg.message?.videoMessage

    if (!isImage && !isVideo) {
      return reply(sock, jid, '❌ Responde a una imagen o video con *.s*', msg)
    }

    try {
      await reply(sock, jid, '⏳ Creando sticker...', msg)

      const mediaMsg = (msg.message?.imageMessage || msg.message?.videoMessage)
        ? msg
        : { message: quoted, key: msg.key }

      const buffer = await downloadMediaMessage(
        mediaMsg,
        'buffer',
        {},
        { reuploadRequest: sock.updateMediaMessage }
      )

      const stickerBuffer = await sticker(buffer, {
        packname: '𝒱𝒶𝓁ℯ𝓃𝓉𝒾𝓃𝒶 ℬℴ𝓉❤️',
        author: 'Draven 🏴‍☠️',
        categories: ['🤩', '🎉']
      })

      await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg })
    } catch (e) {
      console.error('Error en .s:', e)
      await reply(sock, jid, `❌ Error al crear el sticker: ${e.message}`, msg)
    }
  }
}
