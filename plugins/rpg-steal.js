let cooldownsRob = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, diamond: 0, bank: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsRob[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI STEAL 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji está escondiendo los cuerpos\n🕐 » ' + minutos + 'm ' + segundos + 's antes de la próxima víctima\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }

  let target = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  if (!target) return conn.sendMessage(m.chat, { text: '🪚「 DENJI STEAL 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Menciona a quién quieres que Denji despoje\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> #steal @usuario' }, { quoted: m })
  if (target === who) return conn.sendMessage(m.chat, { text: '🪚「 DENJI STEAL 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji no se roba a sí mismo crack\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  let victim = global.db.data.users[target]
  if (!victim) {
    global.db.data.users[target] = { diamantes: 0, diamond: 0, bank: 0 }
    victim = global.db.data.users[target]
  }

  let victimDiamantes = victim.diamantes || victim.diamond || 0

  if (victimDiamantes <= 0) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI STEAL 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » @' + target.split('@')[0] + ' no tiene nada, ni vale la sangre\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔',
      mentions: [target]
    }, { quoted: m })
  }

  cooldownsRob[who] = now + 2700000

  if (Math.random() < 0.55) {
    let maxRobo = Math.floor(victimDiamantes * 0.6)
    let robado = Math.floor(Math.random() * maxRobo) + 1

    if (victim.diamantes !== undefined) {
      victim.diamantes = victimDiamantes - robado
    } else {
      victim.diamond = victimDiamantes - robado
    }

    user.diamantes = (user.diamantes || user.diamond || 0) + robado
    user.exp = (user.exp || 0) + Math.floor(Math.random() * 15) + 5

    let mensajes = [
      '🪚 Denji entró en silencio con la sierra apagada. Encontró ' + robado + ' 💎 bajo el colchón.',
      '🩸 Denji apareció de la oscuridad. La víctima entregó ' + robado + ' 💎 sin que nadie preguntara.',
      '🪚 Denji se disfrazó de repartidor. Cuando abrió la puerta ya era demasiado tarde. ' + robado + ' 💎.',
      '💀 Denji siguió a la víctima al callejón. La sierra hizo el resto. ' + robado + ' 💎 obtenidos.',
      '🩸 Estaba distraído con el teléfono. Denji le birlaste ' + robado + ' 💎 antes de que parpadeara.'
    ]

    await conn.sendMessage(m.chat, {
      text: '🪚「 DENJI STEAL 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » ¡ROBO SANGRIENTO EXITOSO!\n\n🎯 » @' + target.split('@')[0] + ' fue despojado\n🩸 » Robaste: ' + robado + ' diamantes\n🪚 » Tu total: ' + (user.diamantes || user.diamond || 0) + ' 💎\n\n' + mensajes[Math.floor(Math.random() * mensajes.length)] + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ 45 minutos antes de la próxima cacería',
      mentions: [target]
    }, { quoted: m })
  } else {
    let multa = Math.floor(Math.random() * 8) + 3
    let misDiamantes = user.diamantes || user.diamond || 0
    misDiamantes = Math.max(0, misDiamantes - multa)
    if (user.diamantes !== undefined) {
      user.diamantes = misDiamantes
    } else {
      user.diamond = misDiamantes
    }

    let mensajes = [
      '🚔 La víctima activó la alarma. La policía llegó antes que la sierra. Multa: ' + multa + ' 💎.',
      '🚔 Era un agente encubierto. Denji tuvo que pagar fianza: ' + multa + ' 💎.',
      '🚔 Cinturón negro en karate. Le aplicó una llave a Denji. Multa: ' + multa + ' 💎.',
      '🚔 Resultó ser un demonio disfrazado. Denji perdió ' + multa + ' 💎 en la pelea.',
      '🚔 Las cámaras grabaron la sierra. Multa de ' + multa + ' 💎 para no ir al calabozo.'
    ]

    await conn.sendMessage(m.chat, {
      text: '🪚「 DENJI STEAL 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » ¡LA MOTOSIERRA FUE CAPTURADA!\n\n🎯 » @' + target.split('@')[0] + ' escapó\n🩸 » Multa: ' + multa + ' diamantes\n🪚 » Tu total: ' + (user.diamantes || user.diamond || 0) + ' 💎\n\n' + mensajes[Math.floor(Math.random() * mensajes.length)] + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ 45 minutos antes de la próxima cacería',
      mentions: [target]
    }, { quoted: m })
  }
}

handler.help = ['steal']
handler.tags = ['rpg']
handler.command = /^(steal|robar|rob)$/i
handler.desc = 'Denji roba diamantes con la motosierra 🪚🩸'

export default handler
