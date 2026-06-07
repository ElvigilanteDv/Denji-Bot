let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Solo para grupos' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Solo administradores' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Denji necesita ser admin' }, { quoted: m })

  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  if (!who) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Menciona o responde a quien dar admin' }, { quoted: m })

  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'promote')
    await conn.sendMessage(m.chat, { 
      text: '⛓️ DENJI BOT ⛓️\n\n⚡ @' + who.split('@')[0] + ' ahora es admin\n🔗 Usa bien tu poder',
      mentions: [who]
    }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n💀 Error al dar admin' }, { quoted: m })
  }
}

handler.help = ['promote']
handler.tags = ['group']
handler.command = /^(promote|promover|daradmin)$/i
handler.desc = 'Da admin a un miembro'
handler.admin = true
handler.botAdmin = true

export default handler