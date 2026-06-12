let cooldownsMonthly = {}
let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, lastMonthly: 0 }
    user = global.db.data.users[who]
  }
  let now = Date.now()
  let last = user.lastMonthly || 0
  let diff = now - last
  let cooldown = 2592000000
  if (diff < cooldown) {
    let restante = cooldown - diff
    let dias = Math.floor(restante / 86400000)
    let horas = Math.floor((restante % 86400000) / 3600000)
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI MONTHLY 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji ya te lanzó la recompensa este mes\n⏳ » Vuelve en ' + dias + 'd ' + horas + 'h para la próxima masacre\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  let random = Math.random()
  let diamantes
  let rareza
  if (random < 0.05) {
    diamantes = 5000
    rareza = '🌟 LEGENDARIO — Denji destrozó el banco del diablo'
  } else if (random < 0.20) {
    diamantes = 4000
    rareza = '💫 ÉPICO — La motosierra cortó el cofre del mes'
  } else if (random < 0.50) {
    diamantes = 3500
    rareza = '✨ EXCELENTE — Buen botín mensual sangriento'
  } else {
    diamantes = 3000
    rareza = '🩸 NORMAL — La recompensa de siempre'
  }
  user.diamantes = (user.diamantes || 0) + diamantes
  user.lastMonthly = now
  let texto = '🪚「 DENJI MONTHLY 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💀 » ¡Denji rev la motosierra y te lanza el botín del mes!\n\n'
  texto += '🏆 » ' + rareza + '\n\n'
  texto += '🩸 » +' + diamantes + ' diamantes\n'
  texto += '🪚 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ Vuelve en 30 días... si sobrevives'
  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}
handler.help = ['monthly']
handler.tags = ['rpg']
handler.command = /^(monthly|mensual|don2)$/i
handler.desc = 'Denji te lanza la recompensa mensual sangrienta 🪚🩸'
export default handler
