let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Solo para grupos' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Denji necesita ser admin' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Solo administradores' }, { quoted: m })

  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  if (!who) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Menciona o responde a quien expulsar' }, { quoted: m })

  let metadata = await conn.groupMetadata(m.chat)
  let participants = metadata.participants
  let isOwner = participants.some(p => p.id === who && p.admin === 'superadmin')

  if (isOwner) {
    return conn.sendMessage(m.chat, { 
      text: '⛓️ DENJI BOT ⛓️\n\n💀 @' + who.split('@')[0] + ' es el creador\n🔗 No se puede expulsar al jefe',
      mentions: [who]
    }, { quoted: m })
  }

  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'remove')
    await conn.sendMessage(m.chat, { 
      text: '⛓️ DENJI BOT ⛓️\n\n💀 @' + who.split('@')[0] + ' fue expulsado\n🔗 No vuelvas',
      mentions: [who]
    }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n💀 Error al expulsar' }, { quoted: m })
  }
}

handler.help = ['kick']
handler.tags = ['group']
handler.command = /^(kick|echar|expulsar)$/i
handler.desc = 'Expulsa a un miembro'
handler.admin = true
handler.botAdmin = true

export default handler