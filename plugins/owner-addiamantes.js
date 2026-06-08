let handler = async (m, { conn, args }) => {
  let who = m.sender
  let owners = ['59177474230@s.whatsapp.net', '573223090406@s.whatsapp.net', '5218444966582@s.whatsapp.net']

  if (!owners.includes(who)) {
    return conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 Solo los creadores pueden usar esto'
    }, { quoted: m })
  }

  let target = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : who
  let cantidad = target === who ? parseInt(args[0]) : parseInt(args[1])

  if (isNaN(cantidad) || cantidad <= 0) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Cantidad inválida\n\n🔪 Uso correcto:\n> #dardiamantes 100\n> #dardiamantes @usuario 100`
    }, { quoted: m })
  }

  let user = global.db.data.users[target]
  if (!user) {
    global.db.data.users[target] = { diamantes: 0, bank: 0, exp: 0, level: 0 }
    user = global.db.data.users[target]
  }

  user.diamantes = (user.diamantes || 0) + cantidad
  global.markDatabaseModified()

  await conn.sendMessage(m.chat, {
    text: `🩸 DENJI BOT 🩸\n\n🔪 Diamantes entregados\n\n💀 Usuario: @${target.split('@')[0]}\n💀 Agregado: +${cantidad} 💎\n💀 Total: ${user.diamantes} 💎`,
    mentions: [target]
  }, { quoted: m })
}

handler.help = ['dardiamantes']
handler.tags = ['owner']
handler.command = /^(dardiamantes|dardinero|adddiamantes)$/i
handler.desc = 'Da diamantes a un usuario'

export default handler
