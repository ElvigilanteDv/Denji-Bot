let cooldownsAventura = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsAventura[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '⚰️ *Aún te recuperas de la última batalla*',
        `> Espera *${minutos}m ${segundos}s* para volver`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }

  let random = Math.random()
  let lugar, emoji, diamantes, exp, descripcion

  if (random < 0.10) {
    lugar = 'Palacio del Rey Demonio'
    emoji = '👹'
    diamantes = Math.floor(Math.random() * 26) + 15
    exp = Math.floor(Math.random() * 51) + 30
    descripcion = 'Derrotaste al Rey Demonio y saqueaste su trono'
  } else if (random < 0.30) {
    lugar = 'Mazmorra Oscura'
    emoji = '🕳️'
    diamantes = Math.floor(Math.random() * 16) + 10
    exp = Math.floor(Math.random() * 31) + 20
    descripcion = 'Sobreviviste las profundidades y encontraste un cofre'
  } else if (random < 0.60) {
    lugar = 'Bosque Encantado'
    emoji = '🌲'
    diamantes = Math.floor(Math.random() * 8) + 5
    exp = Math.floor(Math.random() * 16) + 10
    descripcion = 'Exploraste el bosque y hallaste algunas gemas'
  } else if (random < 0.85) {
    lugar = 'Cueva de Goblins'
    emoji = '👺'
    diamantes = Math.floor(Math.random() * 4) + 2
    exp = Math.floor(Math.random() * 11) + 5
    descripcion = 'Eliminaste unos goblins y les robaste sus monedas'
  } else {
    lugar = 'Trampa en el camino'
    emoji = '💀'
    diamantes = -Math.floor(Math.random() * 4) - 1
    exp = Math.floor(Math.random() * 6) + 2
    descripcion = 'Caíste en una trampa y perdiste algunos diamantes'
  }

  user.diamantes = Math.max(0, (user.diamantes || 0) + diamantes)
  user.exp = (user.exp || 0) + exp
  cooldownsAventura[who] = now + 600000

  await conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      `${emoji} *${lugar}*`,
      `🔪 ${descripcion}`,
      '',
      `💀 Diamantes: *${diamantes > 0 ? '+' : ''}${diamantes}*`,
      `⚡ EXP: *+${exp}*`,
      `🩸 Total: *${user.diamantes} 💎*`,
      '',
      '> Vuelve en *10 minutos* para otra aventura'
    ].join('\n')
  }, { quoted: m })
}

handler.help = ['aventura']
handler.tags = ['rpg']
handler.command = /^(aventura|aventure|explorar)$/i
handler.desc = 'Explora en busca de tesoros'

export default handler
