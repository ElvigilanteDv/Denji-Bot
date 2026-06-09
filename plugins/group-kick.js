let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '🪚「 DENJI BOT 」🩸\n\n💀 La motosierra solo funciona en grupos, crack' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '🪚「 DENJI BOT 」🩸\n\n❌ Denji necesita ser admin para rev la motosierra' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '🪚「 DENJI BOT 」🩸\n\n❌ Solo los admins pueden ordenarle a Denji que corte' }, { quoted: m })
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  if (!who) return conn.sendMessage(m.chat, { text: '🪚「 DENJI BOT 」🩸\n\n❌ Menciona o responde a quien quieres que Denji despedace' }, { quoted: m })
  let metadata = await conn.groupMetadata(m.chat)
  let participants = metadata.participants
  let isOwner = participants.some(p => p.id === who && p.admin === 'superadmin')
  if (isOwner) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI BOT 」🩸\n\n💀 @' + who.split('@')[0] + ' es el creador del grupo\n🩸 Ni la motosierra de Denji puede con el jefe',
      mentions: [who]
    }, { quoted: m })
  }
  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'remove')
    await conn.sendMessage(m.chat, {
      text: '🪚「 DENJI BOT — EXPULSADO 」🩸\n\n💀 @' + who.split('@')[0] + ' fue destrozado por la motosierra\n🩸 Denji no perdona... no vuelvas',
      mentions: [who]
    }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(m.chat, { text: '🪚「 DENJI BOT 」🩸\n\n❌ La motosierra se trabó... no se pudo expulsar' }, { quoted: m })
  }
}
handler.help = ['kick']
handler.tags = ['group']
handler.command = /^(kick|echar|expulsar)$/i
handler.desc = 'Denji despedaza y expulsa a un miembro 🪚🩸'
handler.admin = true
handler.botAdmin = true
export default handler
