let cooldownsDaily = {}
let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, lastDaily: 0 }
    user = global.db.data.users[who]
  }
  let now = Date.now()
  let last = user.lastDaily || 0
  let diff = now - last
  let cooldown = 86400000
  if (diff < cooldown) {
    let restante = cooldown - diff
    let horas = Math.floor(restante / 3600000)
    let minutos = Math.floor((restante % 3600000) / 60000)
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI DAILY 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji ya te dio su sangre hoy\n🕐 » ' + horas + 'h ' + minutos + 'm para la próxima entrega\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  user.diamantes = (user.diamantes || 0) + 5
  user.exp = (user.exp || 0) + 50
  user.lastDaily = now
  let texto = '🪚「 DENJI DAILY 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💀 » ¡Denji rev la motosierra y te lanza tu recompensa!\n\n'
  texto += '🩸 » +5 diamantes\n'
  texto += '⚡ » +50 experiencia\n'
  texto += '🪚 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ Vuelve mañana... si sobrevives'
  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}
handler.help = ['daily']
handler.tags = ['rpg']
handler.command = /^(daily|diario|recompensa)$/i
handler.desc = 'Denji te lanza tu recompensa diaria de sangre 🪚🩸'
export default handler
