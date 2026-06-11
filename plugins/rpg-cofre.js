let cooldownsCofre = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsCofre[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    return conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '⚰️ *El cofre aún está sellado con sangre*',
        `> Espera *${minutos}m* para abrirlo`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }

  let random = Math.random()
  let tipo, emoji, diamantes, exp, descripcion

  if (random < 0.10) {
    tipo = 'Cofre de Diamante'
    emoji = '💎'
    diamantes = Math.floor(Math.random() * 31) + 20
    exp = Math.floor(Math.random() * 51) + 50
    descripcion = 'Un cofre brillante lleno de riquezas oscuras'
  } else if (random < 0.35) {
    tipo = 'Cofre de Oro'
    emoji = '🟡'
    diamantes = Math.floor(Math.random() * 16) + 10
    exp = Math.floor(Math.random() * 31) + 20
    descripcion = 'El oro manchado de sangre tiene más valor'
  } else if (random < 0.70) {
    tipo = 'Cofre de Plata'
    emoji = '⚪'
    diamantes = Math.floor(Math.random() * 8) + 5
    exp = Math.floor(Math.random() * 16) + 10
    descripcion = 'Algo de valor entre las sombras'
  } else {
    tipo = 'Cofre de Madera'
    emoji = '🟤'
    diamantes = Math.floor(Math.random() * 4) + 2
    exp = Math.floor(Math.random() * 11) + 5
    descripcion = 'Poco pero algo es algo para sobrevivir'
  }

  user.diamantes = (user.diamantes || 0) + diamantes
  user.exp = (user.exp || 0) + exp
  cooldownsCofre[who] = now + 3600000

  await conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      `${emoji} *${tipo}*`,
      `🔪 ${descripcion}`,
      '',
      `💀 Diamantes: *+${diamantes}*`,
      `⚡ EXP: *+${exp}*`,
      `🩸 Total: *${user.diamantes} 💎*`,
      '',
      '> Vuelve en *1 hora* para otro cofre',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })
}

handler.help = ['cofre']
handler.tags = ['rpg']
handler.command = /^(cofre|chest|tesoro)$/i
handler.desc = 'Abre un cofre misterioso cada hora'

export default handler
