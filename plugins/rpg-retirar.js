let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, bank: 0 }
    user = global.db.data.users[who]
  }
  if (!args[0]) return conn.sendMessage(m.chat, { text: '🪚「 DENJI RET 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » ¿Cuánto vas a sacar de la bóveda?\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> #ret 100 | #ret all' }, { quoted: m })
  let cantidad = args[0].toLowerCase() === 'all' ? (user.bank || 0) : parseInt(args[0])
  if (isNaN(cantidad) || cantidad <= 0) return conn.sendMessage(m.chat, { text: '🪚「 DENJI RET 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » Cantidad inválida, ni la motosierra entiende eso\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if ((user.bank || 0) < cantidad) return conn.sendMessage(m.chat, { text: '🪚「 DENJI RET 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » No tienes tanta sangre guardada\n🏦 » Bóveda: ' + (user.bank || 0) + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  user.bank -= cantidad
  user.diamantes = (user.diamantes || 0) + cantidad
  await conn.sendMessage(m.chat, { text: '🪚「 DENJI RET 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji metió la sierra en la bóveda y sacó ' + cantidad + ' 💎\n🏦 » Bóveda sangrienta: ' + user.bank + ' 💎\n🩸 » Cartera: ' + user.diamantes + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> 🪚 Nadie le pregunta a Denji cómo abrió la caja' }, { quoted: m })
}
handler.help = ['retirar']
handler.tags = ['rpg']
handler.command = /^(ret|retirar)$/i
handler.desc = 'Denji mete la sierra en la bóveda y retira diamantes 🪚🩸'
export default handler
