let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) return m.reply(`🪚「 DENJI BOT — INVITACIÓN 」🩸\n\n💀 » ¡Denji va a lanzar la motosierra con una invitación!\n\n> ${usedPrefix}${command} <número>\n> Ejemplo: ${usedPrefix}${command} 523218138672`)
  if (text.includes('+')) return m.reply('🪚「 DENJI BOT 」🩸\n\n❌ Sin el *+* o la motosierra se traba, crack')
  if (isNaN(text)) return m.reply('🪚「 DENJI BOT 」🩸\n\n❌ Solo números con código de país, Denji no entiende letras')
  const link = 'https://chat.whatsapp.com/' + await conn.groupInviteCode(m.chat)
  const number = text + '@s.whatsapp.net'
  try {
    await conn.sendMessage(number, {
      text: `🪚「 DENJI BOT — INVITACIÓN SANGRIENTA 」🩸\n\n💀 » ¡Denji te manda una invitación cortando todo a su paso!\n\n> ${link}\n\n🩸 Únete... o Denji irá por ti`,
      mentions: [m.sender]
    })
    await m.reply('🪚「 DENJI BOT 」🩸\n\n✅ ¡Invitación lanzada con la motosierra!\n💀 El objetivo la recibió... si es que sobrevivió')
    await m.react('🪚')
  } catch (e) {
    console.error(e)
    await m.react('❌')
    await m.reply('🪚「 DENJI BOT 」🩸\n\n❌ ¡La motosierra no encontró a nadie!\n\n💀 » El número no existe, no tiene WhatsApp\no nunca le ha hablado a Denji')
  }
}
handler.help = ['invite']
handler.tags = ['group']
handler.command = /^(invite|invitar)$/i
handler.desc = 'Denji lanza una invitación sangrienta 🪚🩸'
handler.group = true
handler.admin = true
export default handler
