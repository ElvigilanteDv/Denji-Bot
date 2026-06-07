let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Solo para grupos' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Solo administradores' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Denji necesita ser admin' }, { quoted: m })

  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  if (!who) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Menciona o responde a quien quitar admin' }, { quoted: m })

  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'demote')
    await conn.sendMessage(m.chat, { 
      text: '⛓️ DENJI BOT ⛓️\n\n💀 @' + who.split('@')[0] + ' ya no es admin\n🔗 Se acabó el poder',
      mentions: [who]
    }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n💀 Error al quitar admin' }, { quoted: m })
  }
}

handler.help = ['demote']
handler.tags = ['group']
handler.command = /^(demote|degradar|quitaradmin)$/i
handler.desc = 'Quita admin a un miembro'
handler.admin = true
handler.botAdmin = true

export default handler