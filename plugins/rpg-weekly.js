let cooldownsWeekly = {}
let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, lastWeekly: 0 }
    user = global.db.data.users[who]
  }
  let now = Date.now()
  let last = user.lastWeekly || 0
  let diff = now - last
  let cooldown = 604800000
  if (diff < cooldown) {
    let restante = cooldown - diff
    let dias = Math.floor(restante / 86400000)
    let horas = Math.floor((restante % 86400000) / 3600000)
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI WEEKLY 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji ya te lanzó la recompensa esta semana\n⏳ » Vuelve en ' + dias + 'd ' + horas + 'h para más sangre\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  user.diamantes = (user.diamantes || 0) + 500
  user.lastWeekly = now
  let texto = '🪚「 DENJI WEEKLY 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💀 » ¡Denji rev la motosierra y te lanza el botín semanal!\n\n'
  texto += '🩸 » +500 diamantes\n'
  texto += '🪚 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ Vuelve en 7 días... si sobrevives'
  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}
handler.help = ['weekly']
handler.tags = ['rpg']
handler.command = /^(weekly|semanal|don)$/i
handler.desc = 'Denji te lanza la recompensa semanal sangrienta 🪚🩸'
export default handler
