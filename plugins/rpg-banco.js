let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, bank: 0 }
    user = global.db.data.users[who]
  }

  let cartera = user.diamantes || 0
  let banco = user.bank || 0
  let total = cartera + banco

  await conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      '🔪 *Tu fortuna en sangre y diamantes*',
      '',
      `💀 Cartera: *${cartera} 💎*`,
      `⚰️ Banco: *${banco} 💎*`,
      `🩸 Total: *${total} 💎*`,
      '',
      '> 🔪 #dep <cantidad> | #dep all',
      '> 💀 #ret <cantidad> | #ret all'
    ].join('\n')
  }, { quoted: m })
}

handler.help = ['banco']
handler.tags = ['rpg']
handler.command = /^(banco|bank|saldo)$/i
handler.desc = 'Muestra tu saldo del banco'

export default handler
