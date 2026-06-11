let cooldownsFish = {}
let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }
  let now = Date.now()
  let cd = cooldownsFish[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)
  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI PESCA 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » La motosierra está secándose del agua\n🕐 » ' + minutos + 'm ' + segundos + 's para volver al río\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  let random = Math.random()
  let diamantes, rareza, tipo
  if (random < 0.05) {
    diamantes = 5
    rareza = '🌟 LEGENDARIA — La motosierra cortó el océano'
    tipo = ['🐋 Denji partió una ballena con un solo corte. Los científicos pagaron por los pedazos.', '🦈 Un tiburón blanco mordió la sierra... y perdió los dientes. El acuario lo compró destrozado.', '👑 Denji hundió la motosierra y sacó un cofre lleno de oro y sangre seca.', '🐙 Un pulpo gigante intentó agarrar a Denji. Terminó en un restaurante de lujo en trozos.', '🎣 Denji pescó un pez espada de dos metros. Los chefs hicieron fila con miedo.']
  } else if (random < 0.15) {
    diamantes = 4
    rareza = '💫 ÉPICA — El río tembló'
    tipo = ['🐟 Atún rojo de 200 kilos. Denji lo sacó de un tajo limpio. Sushi premium.', '🦞 Langosta enorme entre las rocas. Denji metió la mano sin dudar. Batió el récord.', '🎣 Salmón real saltando. Denji lo cortó en el aire. Los chefs aplaudieron aterrados.', '🐠 Peces loro de colores. Denji los sacó con la sierra en modo suave. Dobló el precio.', '🦑 Calamar gigante. Denji lo atrapó de noche con la sierra encendida como linterna.']
  } else if (random < 0.30) {
    diamantes = 3
    rareza = '✨ EXCELENTE — Buen botín sangriento'
    tipo = ['🐠 Pez dorado enorme. Denji lo sacó de un charco. El dueño de la tienda pagó bien.', '🦀 Tres cangrejos gordos. Denji los agarró con la mano que no tiene sierra.', '🐟 Trucha arcoíris de montaña. Un gourmet asustado pagó el doble por llevársela rápido.', '🐡 Bagre enorme. Denji lo sacó con tripas y todo. Lo vendió fresco en el mercado.', '🦐 Camarones grandes con la red. Nadie preguntó cómo los atrapó Denji.']
  } else if (random < 0.50) {
    diamantes = 2
    rareza = '👍 BUENA — Algo cayó en la sierra'
    tipo = ['🐟 Lubina decente. Denji la asó con el calor de la motosierra. Quedó bien.', '🦀 Cangrejos en la trampa. El restaurante pagó bien y no hizo preguntas.', '🎣 Carpa grande con maíz. Denji la vendió al vecino que no sabe quién es.', '🐡 Mero entre las rocas. Denji metió la sierra y salió solo. Buen ejemplar.', '🐟 Mojarra grande. Denji dice que algo es algo, aunque sea poco.']
  } else {
    diamantes = 1
    rareza = '👌 REGULAR — La sierra pescó basura'
    tipo = ['🐟 Sardina diminuta. Denji la miró con decepción y la usó de carnada.', '🦐 Un camarón solitario. Denji lo aplastó sin querer. Algo sacaste igual.', '🐚 Concha bonita. Un turista asustado te la compró para que lo dejaras ir.', '🪱 Mojarra chiquita. Denji la asó igual. No desperdicia nada.', '👢 Una bota vieja con un diamante pegado en la suela. Alguien la perdió huyendo de Denji.']
  }
  let mensaje = tipo[Math.floor(Math.random() * tipo.length)]
  let expGanada = Math.floor(Math.random() * 15) + 5
  user.diamantes = (user.diamantes || 0) + diamantes
  user.exp = (user.exp || 0) + expGanada
  cooldownsFish[who] = now + 120000
  let texto = '🪚「 DENJI PESCA 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '🏆 » ' + rareza + '\n\n'
  texto += '💀 » ' + mensaje + '\n\n'
  texto += '🩸 » +' + diamantes + ' diamantes\n'
  texto += '⚡ » +' + expGanada + ' experiencia\n'
  texto += '🪚 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ 2 minutos antes de volver al río de sangre'
  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}
handler.help = ['fish']
handler.tags = ['rpg']
handler.command = /^(fish|pescar|pesca)$/i
handler.desc = 'Denji pesca con la motosierra para ganar diamantes 🪚🩸'
export default handler
