let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, bank: 0 }
    user = global.db.data.users[who]
  }
  if (!args[0]) return conn.sendMessage(m.chat, { text: '🪚「 DENJI DEP 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » ¿Cuánto vas a guardar en el matadero?\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> #dep 100 | #dep all' }, { quoted: m })
  let cantidad = args[0].toLowerCase() === 'all' ? (user.diamantes || 0) : parseInt(args[0])
  if (isNaN(cantidad) || cantidad <= 0) return conn.sendMessage(m.chat, { text: '🪚「 DENJI DEP 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » Cantidad inválida, ni la motosierra puede con eso\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if ((user.diamantes || 0) < cantidad) return conn.sendMessage(m.chat, { text: '🪚「 DENJI DEP 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » No tienes tanta sangre acumulada\n🩸 » Cartera: ' + (user.diamantes || 0) + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  user.diamantes -= cantidad
  user.bank = (user.bank || 0) + cantidad
  await conn.sendMessage(m.chat, { text: '🪚「 DENJI DEP 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji guardó ' + cantidad + ' 💎 en el matadero\n🏦 » Bóveda sangrienta: ' + user.bank + ' 💎\n🩸 » Cartera: ' + user.diamantes + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> 🪚 Nadie roba el banco de Denji' }, { quoted: m })
}
handler.help = ['depositar']
handler.tags = ['rpg']
handler.command = /^(dep|depositar)$/i
handler.desc = 'Deposita diamantes en la bóveda sangrienta de Denji 🪚🩸'
export default handler
