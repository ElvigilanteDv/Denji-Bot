let handler = async (m, { conn, text, usedPrefix, command }) => {

  if (!text) return m.reply(`𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA BOT ㅤ֢ㅤׄㅤׅ\n\n❀ Envía una invitación al grupo por número\n\n> ${usedPrefix}${command} <número>\n> Ejemplo: ${usedPrefix}${command} 523218138672`)

  if (text.includes('+')) return m.reply('𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA BOT ㅤ֢ㅤׄㅤׅ\n\n❌ Ingresa el número sin el *+*')

  if (isNaN(text)) return m.reply('𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA BOT ㅤ֢ㅤׄㅤׅ\n\n❌ Solo números con código de país sin espacios')

  const link = 'https://chat.whatsapp.com/' + await conn.groupInviteCode(m.chat)
  const number = text + '@s.whatsapp.net'

  try {
    await conn.sendMessage(number, {
      text: `𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA BOT ㅤ֢ㅤׄㅤׅ\n\n❀ Te invitaron a unirte a un grupo\n\n> ${link}`,
      mentions: [m.sender]
    })

    await m.reply('𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA BOT ㅤ֢ㅤׄㅤׅ\n\n✅ Invitación enviada correctamente')

    await m.react('✅')
  } catch (e) {
    console.error(e)
    await m.react('❌')
    await m.reply('𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA BOT ㅤ֢ㅤׄㅤׅ\n\n❌ No se pudo enviar la invitación\n\n> El número no existe, no tiene WhatsApp o nunca ha hablado con el bot')
  }
}

handler.help = ['invite']
handler.tags = ['group']
handler.command = /^(invite|invitar)$/i
handler.desc = 'Envía una invitación al grupo por número'
handler.group = true
handler.admin = true

export default handler
