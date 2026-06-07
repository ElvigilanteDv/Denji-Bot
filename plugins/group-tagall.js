let handler = async (m, { conn, isAdmin, participants }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Solo para grupos' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Solo administradores' }, { quoted: m })

  let texto = '⛓️ DENJI BOT ⛓️\n\n🔗 *TAGALL*\n\n'
  for (let p of participants) {
    texto += '⚡ @' + p.id.split('@')[0] + '\n'
  }

  await conn.sendMessage(m.chat, { text: texto, mentions: participants.map(p => p.id) }, { quoted: m })
}

handler.help = ['tagall']
handler.tags = ['group']
handler.command = /^(tagall|todos|all)$/i
handler.desc = 'Menciona a todos'
handler.admin = true

export default handler