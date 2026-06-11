let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0, class: 'Novato', attack: 10, defense: 5, health: 100, maxHealth: 100 }
    user = global.db.data.users[who]
  }

  const claseEmojis = {
    'Novato': '🧍', 'Guerrero': '⚔️', 'Mago': '🔮', 'Asesino': '🗡️',
    'Paladín': '🛡️', 'Arquero': '🏹', 'Druida': '🌿', 'Berserker': '💢',
    'Nigromante': '💀', 'Samurái': '⛩️'
  }

  const clasesList = ['Novato', 'Guerrero', 'Mago', 'Asesino', 'Paladín', 'Arquero', 'Druida', 'Berserker', 'Nigromante', 'Samurái']

  const reqs = {
    'Novato':     { nivel: 0,  costo: 0    },
    'Guerrero':   { nivel: 5,  costo: 50   },
    'Mago':       { nivel: 5,  costo: 50   },
    'Asesino':    { nivel: 10, costo: 100  },
    'Paladín':    { nivel: 10, costo: 100  },
    'Arquero':    { nivel: 15, costo: 200  },
    'Druida':     { nivel: 15, costo: 200  },
    'Berserker':  { nivel: 20, costo: 500  },
    'Nigromante': { nivel: 20, costo: 500  },
    'Samurái':    { nivel: 25, costo: 1000 }
  }

  const clases = {
    'novato':     { nivel: 0,  costo: 0,    attack: 10, defense: 5,  health: 100, maxHealth: 100 },
    'guerrero':   { nivel: 5,  costo: 50,   attack: 25, defense: 20, health: 150, maxHealth: 150 },
    'mago':       { nivel: 5,  costo: 50,   attack: 35, defense: 10, health: 100, maxHealth: 100 },
    'asesino':    { nivel: 10, costo: 100,  attack: 40, defense: 15, health: 120, maxHealth: 120 },
    'paladín':    { nivel: 10, costo: 100,  attack: 20, defense: 35, health: 180, maxHealth: 180 },
    'arquero':    { nivel: 15, costo: 200,  attack: 45, defense: 20, health: 130, maxHealth: 130 },
    'druida':     { nivel: 15, costo: 200,  attack: 30, defense: 25, health: 160, maxHealth: 160 },
    'berserker':  { nivel: 20, costo: 500,  attack: 60, defense: 10, health: 200, maxHealth: 200 },
    'nigromante': { nivel: 20, costo: 500,  attack: 55, defense: 30, health: 150, maxHealth: 150 },
    'samurái':    { nivel: 25, costo: 1000, attack: 70, defense: 40, health: 220, maxHealth: 220 }
  }

  if (!args[0]) {
    let clase = user.class || 'Novato'
    let lines = [
      '🩸 DENJI BOT 🩸',
      '',
      `🔪 Tu clase actual: *${claseEmojis[clase] || ''} ${clase}*`,
      '',
      '💀 *Clases disponibles:*',
      ''
    ]

    for (let c of clasesList) {
      let req = reqs[c]
      let activa = c === clase ? ' ← *ACTUAL*' : ''
      let bloqueada = (user.level || 0) < req.nivel ? '🔒' : req.costo > (user.diamantes || 0) ? '💸' : '✅'
      lines.push(`${bloqueada} ${claseEmojis[c]} *${c}*${activa}`)
      lines.push(`   > Nivel ${req.nivel} | ${req.costo === 0 ? 'Gratis' : req.costo + ' 💎'}`)
      lines.push('')
    }

    lines.push('> Usa *#clase <nombre>* para cambiar')
    lines.push('')
    lines.push('🩸 DENJI BOT 🩸')

    return conn.sendMessage(m.chat, { text: lines.join('\n') }, { quoted: m })
  }

  let claseElegida = args.join(' ')
  let claseData = clases[claseElegida.toLowerCase()]

  if (!claseData) {
    return conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 *Clase no válida*\n> Usa #clase para ver la lista'
    }, { quoted: m })
  }

  let claseNombre = clasesList.find(c => c.toLowerCase() === claseElegida.toLowerCase())

  if ((user.class || '').toLowerCase() === claseElegida.toLowerCase()) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n⚰️ *Ya eres ${claseNombre}*\n> No puedes cambiar a la misma clase`
    }, { quoted: m })
  }

  if ((user.level || 0) < claseData.nivel) {
    return conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '💀 *Nivel insuficiente*',
        `> Necesitas nivel *${claseData.nivel}*`,
        `> Tu nivel: *${user.level || 0}*`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }

  if ((user.diamantes || 0) < claseData.costo) {
    return conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '💀 *Diamantes insuficientes*',
        `> Necesitas *${claseData.costo} 💎*`,
        `> Tienes: *${user.diamantes || 0} 💎*`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }

  user.diamantes -= claseData.costo
  user.class = claseNombre
  user.attack = claseData.attack
  user.defense = claseData.defense
  user.health = claseData.maxHealth
  user.maxHealth = claseData.maxHealth

  await conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      `${claseEmojis[claseNombre]} *¡Clase cambiada a ${claseNombre}!*`,
      '🔪 Tu sangre ahora corre diferente...',
      '',
      `⚔️ Ataque: *${claseData.attack}*`,
      `🛡️ Defensa: *${claseData.defense}*`,
      `❤️ Vida: *${claseData.maxHealth}*`,
      `💀 Costo: *-${claseData.costo} 💎*`,
      `🩸 Diamantes: *${user.diamantes} 💎*`,
      '',
      '> Tu nivel se mantiene intacto',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })
}

handler.help = ['clase']
handler.tags = ['rpg']
handler.command = /^(clase|clases)$/i
handler.desc = 'Cambia tu clase RPG'

export default handler
