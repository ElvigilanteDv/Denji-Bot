let cooldownsHunt = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsHunt[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI HUNT 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji está lamiendo la sierra después de la caza\n🕐 » ' + minutos + 'm ' + segundos + 's para volver al matadero\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }

  let random = Math.random()
  let diamantes, victimas, exp, tipo

  if (random < 0.04) {
    victimas = Math.floor(Math.random() * 6) + 5
    diamantes = victimas * 2
    exp = Math.floor(Math.random() * 30) + 20
    tipo = [
      '💎 Denji cazó al Diablo Primordial en su guarida. Lo destrozó con un solo corte y recogió todo su botín.',
      '🛥️ Una flota entera de demonios del mar atacó el puerto. Denji los cortó uno por uno. El gobierno pagó bien.',
      '⚡ El Diablo del Trueno y su ejército aparecieron. Denji rev la sierra y no quedó nada. Gran recompensa.',
      '🏢 Un edificio entero infestado de demonios. Denji entró solo y salió con sangre hasta las rodillas y el botín completo.'
    ]
  } else if (random < 0.15) {
    victimas = Math.floor(Math.random() * 4) + 4
    diamantes = Math.floor(victimas * 1.5)
    exp = Math.floor(Math.random() * 20) + 10
    tipo = [
      '🔥 El Diablo del Fuego y sus secuaces aparecieron en la ciudad. Denji los despedazó antes del amanecer.',
      '🌑 Un grupo de demonios de la oscuridad atacó un barrio entero. Denji llegó con la sierra encendida.',
      '🪖 Una base militar fue invadida por demonios. Denji limpió todo él solo. Los soldados pagaron la recompensa.',
      '🏗️ Demonios de construcción destruían edificios. Denji los cortó con más eficiencia que cualquier demoledora.'
    ]
  } else if (random < 0.35) {
    victimas = Math.floor(Math.random() * 3) + 3
    diamantes = victimas
    exp = Math.floor(Math.random() * 15) + 5
    tipo = [
      '🥷 Tres demonios ninja aparecieron en la discoteca. Denji los despedazó entre la música y el caos.',
      '🚛 Un convoy de demonios bloqueaba la carretera. Denji los cortó rápido y cobró por despejar el camino.',
      '🚕 Demonios taxi secuestraban gente de noche. Denji los eliminó y cobró la recompensa de los rescatados.',
      '🍺 El bar estaba infestado. Denji entró, bebió algo, y de paso destrozó a todos los demonios del lugar.'
    ]
  } else if (random < 0.60) {
    victimas = Math.floor(Math.random() * 2) + 1
    diamantes = Math.floor(victimas * 0.5) || 1
    exp = Math.floor(Math.random() * 10) + 3
    tipo = [
      '😴 Un demonio pequeño y aburrido. Denji lo cortó casi dormido. Poca recompensa pero algo es algo.',
      '🪙 Un demonio rata que apenas valía la energía. Denji lo aplastó con el pie. Pagaron con monedas.',
      '🌧️ Llovía y solo apareció un demonio débil. Denji lo cortó rápido para no mojarse más.'
    ]
  } else {
    victimas = 0
    diamantes = -(Math.floor(Math.random() * 8) + 3)
    exp = Math.floor(Math.random() * 5) + 1
    tipo = [
      '🚔 La policía confundió a Denji con un demonio. Multa por destruir media manzana cazando.',
      '💊 Un demonio venenoso mordió a Denji antes de morir. Tuvo que comprar antídoto caro.',
      '🏥 El demonio era más fuerte de lo esperado. Denji terminó en urgencias. Puntos de sutura y todo.',
      '🔪 Era una trampa de demonios inteligentes. Le robaron el botín mientras estaba inconsciente.',
      '👊 El Diablo de la Fuerza Bruta le dio una paliza épica. Denji perdió diamantes en la retirada.',
      '☠️ Un demonio maldijo a Denji antes de morir. Tuvo que gastar en un exorcismo para quitarse la maldición.'
    ]
  }

  let mensaje = tipo[Math.floor(Math.random() * tipo.length)]
  user.diamantes = Math.max(0, (user.diamantes || 0) + diamantes)
  user.exp = (user.exp || 0) + exp
  cooldownsHunt[who] = now + 240000

  let texto = '🪚「 DENJI HUNT 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💀 » ' + mensaje + '\n\n'
  if (victimas > 0) texto += '👹 » Demonios cazados: ' + victimas + '\n'
  texto += '🩸 » Diamantes: ' + (diamantes > 0 ? '+' : '') + diamantes + '\n'
  texto += '⚡ » Experiencia: +' + exp + '\n'
  texto += '🪚 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ 4 minutos antes de la próxima cacería'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['hunt']
handler.tags = ['rpg']
handler.command = /^(hunt|cazar|caceria)$/i
handler.desc = 'Denji caza demonios con la motosierra 🪚🩸'

export default handler
