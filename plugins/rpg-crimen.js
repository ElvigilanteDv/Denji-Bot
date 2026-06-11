let cooldownsCrime = {}
let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }
  let now = Date.now()
  let cd = cooldownsCrime[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)
  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI CRIMEN 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji está escondiendo los cuerpos\n🕐 » ' + minutos + 'm ' + segundos + 's para la próxima carnicería\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  let random = Math.random()
  let diamantes, exp, tipo
  if (random < 0.20) {
    diamantes = Math.floor(Math.random() * 11) + 10
    exp = Math.floor(Math.random() * 30) + 20
    tipo = ['🏦 Denji destrozó la bóveda del banco central con la motosierra. Nadie se atrevió a detenerlo.', '💎 Denji rebanó la vitrina de una joyería de un solo corte. Los diamantes cayeron como lluvia de sangre.', '🚛 Denji partió un camión blindado por la mitad. El conductor salió corriendo sin mirar atrás.', '🎰 Denji le arrancó el brazo al guardia del casino. Todos los cajeros abrieron las cajas sin protestar.', '🖼️ Denji se coló en una galería de arte. Nadie preguntó nada cuando vieron la motosierra.']
  } else if (random < 0.45) {
    diamantes = Math.floor(Math.random() * 6) + 3
    exp = Math.floor(Math.random() * 20) + 10
    tipo = ['🥷 Denji entró por la ventana con la sierra apagada. Silencioso... pero letal.', '🛒 Denji llenó dos carritos y rev la motosierra en caja. El cajero dijo que era gratis.', '📱 Denji robó celulares en el metro. Nadie le pidió que los devolviera.', '🔑 Con la motosierra como llave maestra, Denji abrió tres habitaciones de golpe.', '🏍️ Denji se llevó una moto cortando la cadena con un solo toque de la sierra.']
  } else if (random < 0.65) {
    diamantes = Math.floor(Math.random() * 4) + 1
    exp = Math.floor(Math.random() * 15) + 5
    tipo = ['🪙 Denji vació los bolsillos de un tipo dormido. Poca cosa, pero algo es algo.', '🍫 Denji intimidó al de la tienda con la motosierra. Se llevó los chocolates más caros.', '🌂 Denji robó paraguas de un restaurante. La motosierra mojada hace ruido raro.', '📚 Denji vendió copias piratas. Nadie se quejó después de ver sus colmillos.', '🪙 Denji vació la caja de propinas. El mesero fingió no ver nada.']
  } else {
    diamantes = -(Math.floor(Math.random() * 8) + 3)
    exp = Math.floor(Math.random() * 5) + 1
    tipo = ['🚔 La policía atrapó a Denji... y tuvo que pagar fianza con diamantes.', '📸 Las cámaras captaron la motosierra. Denji pagó daños y salió furioso.', '🕵️ El cómplice era agente encubierto. Denji escapó pero perdió el botín.', '🐕 Un pitbull le mordió la mano de la sierra. Denji pagó al veterinario por error.', '🧓 La viejita resultó ser un demonio disfrazado. Le cobró cara la derrota.']
  }
  let mensaje = tipo[Math.floor(Math.random() * tipo.length)]
  user.diamantes = Math.max(0, (user.diamantes || 0) + diamantes)
  user.exp = (user.exp || 0) + exp
  cooldownsCrime[who] = now + 180000
  let texto = '🪚「 DENJI CRIMEN 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💀 » ' + mensaje + '\n\n'
  texto += '🩸 » Diamantes: ' + (diamantes > 0 ? '+' : '') + diamantes + '\n'
  texto += '⚡ » Experiencia: +' + exp + '\n'
  texto += '🪚 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> 💀 3 minutos antes de la próxima masacre'
  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}
handler.help = ['crimen']
handler.tags = ['rpg']
handler.command = /^(crime|crimen|robar)$/i
handler.desc = 'Denji comete un crimen sangriento para ganar diamantes 🪚🩸'
export default handler
