let cooldownsBuceo = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsBuceo[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    let mensajesCd = [
      '🩸 Sigues sangrando del último buceo...',
      '💀 Tus heridas no han sanado aún...',
      '🔪 El mar aún reclama tu sangre...',
      '⚰️ Casi te ahogaste, descansa...',
      '🦈 Un tiburón aún ronda tus aguas...'
    ]
    let msgCd = mensajesCd[Math.floor(Math.random() * mensajesCd.length)]
    return conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        msgCd,
        `> Espera *${minutos}m ${segundos}s*`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }

  let zonas = [
    // ⭐ LEGENDARIAS (3%)
    {
      prob: 0.01,
      zona: 'Trono del Dios del Mar',
      emoji: '👑',
      tier: '⭐ LEGENDARIO',
      descripciones: [
        'Encontraste el trono perdido de Poseidón lleno de oro',
        'Una luz divina te guió hasta riquezas infinitas',
        'Los dioses del mar te bendijeron con sus tesoros'
      ],
      dMin: 40, dMax: 60,
      eMin: 60, eMax: 90
    },
    {
      prob: 0.02,
      zona: 'Atlántida Perdida',
      emoji: '🏛️',
      tier: '⭐ LEGENDARIO',
      descripciones: [
        'Encontraste la ciudad sumergida de Atlántida',
        'Las ruinas doradas de Atlántida brillaban ante ti',
        'Descubriste secretos y riquezas de la civilización perdida'
      ],
      dMin: 35, dMax: 55,
      eMin: 55, eMax: 80
    },
    // 🔥 ÉPICAS (10%)
    {
      prob: 0.04,
      zona: 'Guarida del Kraken Anciano',
      emoji: '🦑',
      tier: '🔥 ÉPICO',
      descripciones: [
        'Robaste los tesoros mientras el Kraken dormía',
        'Venciste al Kraken y tomaste su botín',
        'El Kraken te ofreció joyas a cambio de tu libertad'
      ],
      dMin: 25, dMax: 40,
      eMin: 40, eMax: 60
    },
    {
      prob: 0.03,
      zona: 'Barco Pirata Hundido',
      emoji: '🏴‍☠️',
      tier: '🔥 ÉPICO',
      descripciones: [
        'Encontraste el legendario barco del Capitán Maldito',
        'Un galeón pirata lleno de oro yacía en el fondo',
        'El cofre del tesoro pirata estaba intacto'
      ],
      dMin: 22, dMax: 38,
      eMin: 35, eMax: 55
    },
    {
      prob: 0.03,
      zona: 'Templo Submarino Antiguo',
      emoji: '⛩️',
      tier: '🔥 ÉPICO',
      descripciones: [
        'Un templo milenario guardaba ofrendas de oro',
        'Los dioses antiguos dejaron sus reliquias aquí',
        'Encontraste artefactos sagrados de gran valor'
      ],
      dMin: 20, dMax: 35,
      eMin: 30, eMax: 50
    },
    // 💜 RARAS (22%)
    {
      prob: 0.06,
      zona: 'Arrecife de Cristal Mágico',
      emoji: '💎',
      tier: '💜 RARO',
      descripciones: [
        'Los cristales del arrecife brillaban como diamantes',
        'Recolectaste cristales mágicos del fondo marino',
        'Un arrecife encantado te llenó los bolsillos'
      ],
      dMin: 12, dMax: 22,
      eMin: 20, eMax: 35
    },
    {
      prob: 0.06,
      zona: 'Cueva de la Sirena',
      emoji: '🧜‍♀️',
      tier: '💜 RARO',
      descripciones: [
        'Una sirena te regaló perlas mágicas',
        'La sirena cantó y apareció oro a tus pies',
        'Intercambiaste historias por joyas con la sirena'
      ],
      dMin: 10, dMax: 20,
      eMin: 18, eMax: 30
    },
    {
      prob: 0.05,
      zona: 'Jardín de Coral Dorado',
      emoji: '🪸',
      tier: '💜 RARO',
      descripciones: [
        'Corales dorados que valen una fortuna',
        'El jardín de coral guardaba joyas entre sus ramas',
        'Recolectaste coral dorado muy preciado'
      ],
      dMin: 9, dMax: 18,
      eMin: 15, eMax: 28
    },
    {
      prob: 0.05,
      zona: 'Naufragio Mercante',
      emoji: '⚓',
      tier: '💜 RARO',
      descripciones: [
        'Un barco mercante hundido lleno de mercancías',
        'La bodega del barco guardaba valiosas especias',
        'Encontraste monedas antiguas en el naufragio'
      ],
      dMin: 8, dMax: 16,
      eMin: 14, eMax: 25
    },
    // 💚 COMUNES (35%)
    {
      prob: 0.09,
      zona: 'Cueva Submarina Oscura',
      emoji: '🌀',
      tier: '💚 COMÚN',
      descripciones: [
        'En la oscuridad encontraste algunas monedas',
        'Una pequeña grieta escondía unas pocas joyas',
        'Entre las rocas hallaste algo de valor'
      ],
      dMin: 4, dMax: 9,
      eMin: 8, eMax: 15
    },
    {
      prob: 0.08,
      zona: 'Banco de Algas Luminosas',
      emoji: '🌿',
      tier: '💚 COMÚN',
      descripciones: [
        'Las algas luminosas escondían pequeñas perlas',
        'Entre las algas había algunas cositas valiosas',
        'Recolectaste plantas marinas de poco valor'
      ],
      dMin: 3, dMax: 8,
      eMin: 6, eMax: 12
    },
    {
      prob: 0.09,
      zona: 'Fondo Arenoso Tranquilo',
      emoji: '🐚',
      tier: '💚 COMÚN',
      descripciones: [
        'Solo conchas y arena pero algo brilló',
        'Una concha especial tenía una perla dentro',
        'El fondo tranquilo te dio poco pero algo es algo'
      ],
      dMin: 2, dMax: 6,
      eMin: 4, eMax: 10
    },
    {
      prob: 0.09,
      zona: 'Arrecife Colorido',
      emoji: '🐠',
      tier: '💚 COMÚN',
      descripciones: [
        'Los peces coloridos te guiaron a unas monedas',
        'Entre los corales había algo de valor escondido',
        'Un pez curioso te trajo un pequeño regalo'
      ],
      dMin: 2, dMax: 5,
      eMin: 3, eMax: 8
    },
    // 💀 PELIGROS (30%)
    {
      prob: 0.08,
      zona: 'Ataque de Tiburón',
      emoji: '🦈',
      tier: '💀 PELIGRO',
      descripciones: [
        'Un tiburón blanco te atacó y perdiste tus cosas',
        'La mandíbula del tiburón destrozó tu equipo',
        'Huiste del tiburón pero dejaste tus diamantes'
      ],
      dMin: -8, dMax: -3,
      eMin: 2, eMax: 6
    },
    {
      prob: 0.07,
      zona: 'Corriente Submarina',
      emoji: '🌊',
      tier: '💀 PELIGRO',
      descripciones: [
        'La corriente te arrastró lejos y perdiste todo',
        'Una corriente inesperada se llevó tu botín',
        'El remolino submarino te robó los diamantes'
      ],
      dMin: -6, dMax: -2,
      eMin: 1, eMax: 5
    },
    {
      prob: 0.08,
      zona: 'Trampa de Medusas',
      emoji: '🪼',
      tier: '💀 PELIGRO',
      descripciones: [
        'Las medusas te paralizaron y alguien te robó',
        'El veneno de medusa te hizo soltar todo',
        'Un banco de medusas bloqueó tu regreso'
      ],
      dMin: -5, dMax: -1,
      eMin: 1, eMax: 4
    },
    {
      prob: 0.07,
      zona: 'Aguas Tóxicas',
      emoji: '☠️',
      tier: '💀 PELIGRO',
      descripciones: [
        'Las aguas contaminadas arruinaron tu equipo',
        'El veneno del agua disolvió tus diamantes',
        'Tuviste que salir corriendo y perdiste todo'
      ],
      dMin: -7, dMax: -2,
      eMin: 1, eMax: 3
    }
  ]

  let rand = Math.random()
  let acumulado = 0
  let resultado = zonas[zonas.length - 1]

  for (let z of zonas) {
    acumulado += z.prob
    if (rand < acumulado) {
      resultado = z
      break
    }
  }

  let { zona, emoji, tier, descripciones, dMin, dMax, eMin, eMax } = resultado

  let diamantes = dMin < 0
    ? -(Math.floor(Math.random() * (Math.abs(dMin) - Math.abs(dMax) + 1)) + Math.abs(dMax))
    : Math.floor(Math.random() * (dMax - dMin + 1)) + dMin

  let exp = Math.floor(Math.random() * (eMax - eMin + 1)) + eMin
  let descripcion = descripciones[Math.floor(Math.random() * descripciones.length)]

  user.diamantes = Math.max(0, (user.diamantes || 0) + diamantes)
  user.exp = (user.exp || 0) + exp
  cooldownsBuceo[who] = now + 600000

  const esPeligro = diamantes < 0

  await conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      `${emoji} *${zona}*`,
      `${tier}`,
      `🔪 ${descripcion}`,
      '',
      `💀 Diamantes: *${diamantes > 0 ? '+' : ''}${diamantes}*`,
      `⚡ EXP: *+${exp}*`,
      `🩸 Total: *${user.diamantes} 💎*`,
      '',
      esPeligro
        ? '> La sangre tiñó el mar de rojo...'
        : '> Vuelve en *10 minutos* para otro buceo',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })
}

handler.help = ['buceo']
handler.tags = ['rpg']
handler.command = /^(buceo|bucear|submarino|nadar|snorkel|sumerge)$/i
handler.desc = 'Bucea en busca de tesoros marinos'

export default handler
