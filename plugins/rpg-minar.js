let cooldownsMine = {}
let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }
  let now = Date.now()
  let cd = cooldownsMine[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)
  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI MINE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji está sacando los restos de la mina\n🕐 » ' + minutos + 'm ' + segundos + 's para volver a excavar\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  let random = Math.random()
  let diamantes, exp, rareza, mensaje
  if (random < 0.05) {
    diamantes = Math.floor(Math.random() * 11) + 10
    exp = Math.floor(Math.random() * 30) + 20
    rareza = '💎 DIAMANTE LEGENDARIO — La sierra encontró el núcleo'
    mensaje = [
      '💎 Denji metió la sierra en la roca y brotaron diamantes puros como sangre.',
      '💎 La motosierra golpeó la pared y apareció un diamante enorme. ¡Nadie lo esperaba!',
      '💎 Denji excavó profundo con la sierra y encontró un cofre lleno de diamantes en bruto.',
      '💎 La mina se iluminó con el brillo. Denji encontró un diamante legendario incrustado en la pared.'
    ]
  } else if (random < 0.15) {
    diamantes = Math.floor(Math.random() * 6) + 4
    exp = Math.floor(Math.random() * 20) + 10
    rareza = '🟡 ORO — La sierra lo derritió y lo recogió'
    mensaje = [
      '🟡 Denji encontró una veta de oro y la picó con la sierra sin piedad.',
      '🟡 El río subterráneo trajo pepitas de oro. Denji las recogió entre la sangre del suelo.',
      '🟡 Oro puro entre las rocas. Denji lo arrancó de un solo tajo.',
      '🟡 Una veta dorada brillaba en la oscuridad. Denji la destrozó sin contemplaciones.'
    ]
  } else if (random < 0.35) {
    diamantes = Math.floor(Math.random() * 4) + 2
    exp = Math.floor(Math.random() * 15) + 5
    rareza = '🔘 HIERRO — La motosierra lo masticó'
    mensaje = [
      '🔘 Denji encontró hierro de buena calidad. La sierra lo cortó como mantequilla.',
      '🔘 Mineral de hierro abundante. Denji lo arrancó a la fuerza. Algo es algo.',
      '🔘 Una veta de hierro sólida. La motosierra sudó un poco pero lo logró.',
      '🔘 Hierro forjable. El herrero lo compró sin preguntar de dónde venía.'
    ]
  } else {
    diamantes = Math.floor(Math.random() * 2) + 1
    exp = Math.floor(Math.random() * 10) + 3
    rareza = '🪨 PIEDRA — Ni la sierra se emocionó'
    mensaje = [
      '🪨 Solo piedras comunes. Denji las destrozó igual, por costumbre.',
      '🪨 El pico se desafiló un poco. La sierra no. Piedras y más piedras.',
      '🪨 Rocas sin valor aparente. Denji las vendió para relleno con cara de pocos amigos.',
      '🪨 Una cueva llena de piedras. Denji salió aburrido y con sangre ajena en la sierra.'
    ]
  }
  user.diamantes = (user.diamantes || 0) + diamantes
  user.exp = (user.exp || 0) + exp
  cooldownsMine[who] = now + 300000
  let texto = '🪚「 DENJI MINE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '🏆 » ' + rareza + '\n\n'
  texto += '💀 » ' + mensaje[Math.floor(Math.random() * mensaje.length)] + '\n\n'
  texto += '🩸 » +' + diamantes + ' diamantes\n'
  texto += '⚡ » +' + exp + ' experiencia\n'
  texto += '🪚 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ 5 minutos antes de volver al túnel sangriento'
  await conn.sendMessage(m.chat, {
    image: { url: 'https://files.catbox.moe/wa38lm.png' },
    caption: texto
  }, { quoted: m })
}
handler.help = ['minar']
handler.tags = ['rpg']
handler.command = /^(minar|mine|mineria)$/i
handler.desc = 'Denji excava con la motosierra para ganar diamantes 🪚🩸'
export default handler
