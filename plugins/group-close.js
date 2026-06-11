let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  const isOwner = global.owner.some(([num]) => m.sender.startsWith(num))

  if (!m.isGroup) return conn.sendMessage(m.chat, {
    text: '🩸 DENJI BOT 🩸\n\n💀 *Solo funciona en grupos*'
  }, { quoted: m })

  if (!isAdmin && !isOwner) return conn.sendMessage(m.chat, {
    text: '🩸 DENJI BOT 🩸\n\n🗡️ *Acceso denegado, mortal*\n> Solo admins y owners'
  }, { quoted: m })

  if (!isBotAdmin) return conn.sendMessage(m.chat, {
    text: '🩸 DENJI BOT 🩸\n\n⚰️ *Hazme admin primero*'
  }, { quoted: m })

  await conn.groupSettingUpdate(m.chat, 'announcement')
  await conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      '🔒 *GRUPO CERRADO*',
      '💀 Solo admins pueden escribir',
      '> El silencio reina en este lugar...',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })
}

handler.help = ['close']
handler.tags = ['group']
handler.command = /^(close|cerrar)$/i
handler.desc = 'Cierra el grupo'
handler.admin = false
handler.botAdmin = true

export default handler
