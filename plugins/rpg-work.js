let cooldownsWork = {}
let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }
  let now = Date.now()
  let cd = cooldownsWork[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)
  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI WORK 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji está lamiendo la sangre de la sierra\n🕐 » ' + minutos + 'm ' + segundos + 's para la próxima chamba\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  let random = Math.random()
  let diamantes = 1
  let exp = Math.floor(Math.random() * 20) + 5
  let rareza = '⭐'
  if (random < 0.15) {
    diamantes = 2
    rareza = '🌟🌟'
  } else if (random < 0.05) {
    diamantes = 3
    rareza = '🌟🌟🌟'
  }
  let trabajos = [
    '🪚 Denji destrozó una pared y le pagaron por demolición express',
    '🩸 Denji limpió una escena del crimen con la sierra. El cliente no preguntó nada',
    '💀 Denji cortó leña para todo el pueblo en 10 minutos. Le dieron propina por el susto',
    '🔪 Denji trabajó de seguridad en un bar. Nadie se portó mal esa noche',
    '🏗️ Denji destruyó un edificio viejo él solo. La constructora quedó impresionada',
    '🎤 Denji rev la sierra en un concierto. El público pagó por el espectáculo',
    '🩸 Denji repartió paquetes más rápido que nadie. Nadie le preguntó cómo',
    '🪚 Denji dio clases de defensa personal. Todos aprobaron con miedo'
  ]
  let perdidas = [
    { texto: '💔 Denji aceptó un trabajo falso y le robaron el botín', diamantes: -1 },
    { texto: '🎰 Denji apostó el pago en el casino del diablo... y perdió', diamantes: -1 },
    { texto: '🦝 Un diablo más rápido le robó los diamantes del día', diamantes: -1 }
  ]
  let esPerdida = random < 0.10
  let trabajo
  let cambio
  if (esPerdida) {
    trabajo = perdidas[Math.floor(Math.random() * perdidas.length)]
    cambio = trabajo.diamantes
  } else {
    trabajo = { texto: trabajos[Math.floor(Math.random() * trabajos.length)] }
    cambio = diamantes
  }
  user.diamantes = Math.max(0, (user.diamantes || 0) + cambio)
  user.exp = (user.exp || 0) + exp
  cooldownsWork[who] = now + 120000
  let texto = '🪚「 DENJI WORK 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💀 » ' + trabajo.texto + '\n\n'
  texto += '🩸 » Diamantes: ' + (cambio > 0 ? '+' : '') + cambio + ' ' + rareza + '\n'
  texto += '⚡ » Experiencia: +' + exp + '\n'
  texto += '🪚 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ 2 minutos antes de la próxima chamba sangrienta'
  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}
handler.help = ['work']
handler.tags = ['rpg']
handler.command = /^(work|trabajar|chamba)$/i
handler.desc = 'Denji trabaja con la motosierra para ganar diamantes 🪚🩸'
export default handler
