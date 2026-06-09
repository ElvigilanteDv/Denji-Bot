let handler = async (m, { conn, isAdmin, participants }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '🪚「 DENJI BOT 」🩸\n\n💀 La motosierra solo funciona en grupos, crack' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '🪚「 DENJI BOT 」🩸\n\n❌ Solo los que tienen autoridad pueden rev la motosierra' }, { quoted: m })
  let texto = '🪚「 DENJI BOT — TAGALL 」🩸\n\n💀 *¡Denji convoca a todos con su motosierra!*\n\n'
  for (let p of participants) {
    texto += '🩸 @' + p.id.split('@')[0] + '\n'
  }
  await conn.sendMessage(m.chat, { text: texto, mentions: participants.map(p => p.id) }, { quoted: m })
}
handler.help = ['tagall']
handler.tags = ['group']
handler.command = /^(tagall|todos|all)$/i
handler.desc = 'Denji convoca a todos con la motosierra 🪚🩸'
handler.admin = true
export default handler
