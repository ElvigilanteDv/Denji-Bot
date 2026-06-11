let cooldownsCazar = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsCazar[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '⚰️ *Aún cargas las heridas de la última caza*',
        `> Espera *${minutos}m ${segundos}s*`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }

  let random = Math.random()
  let animal, emoji, diamantes, exp, rareza, descripcion

  if (random < 0.05) {
    animal = 'Dragón salvaje'
    emoji = '🐉'
    diamantes = Math.floor(Math.random() * 11) + 10
    exp = Math.floor(Math.random() * 31) + 20
    rareza = '⭐ LEGENDARIO'
    descripcion = 'Lo derribaste con un solo golpe mortal'
  } else if (random < 0.20) {
    animal = 'Oso pardo'
    emoji = '🐻'
    diamantes = Math.floor(Math.random() * 6) + 5
    exp = Math.floor(Math.random() * 21) + 10
    rareza = '🔥 ÉPICO'
    descripcion = 'Fue una pelea brutal pero ganaste'
  } else if (random < 0.50) {
    animal = 'Ciervo'
    emoji = '🦌'
    diamantes = Math.floor(Math.random() * 4) + 2
    exp = Math.floor(Math.random() * 11) + 5
    rareza = '💜 NORMAL'
    descripcion = 'Lo seguiste y no escapó de tu cuchillo'
  } else {
    animal = 'Conejo'
    emoji = '🐰'
    diamantes = Math.floor(Math.random() * 2) + 1
    exp = Math.floor(Math.random() * 6) + 3
    rareza = '💚 COMÚN'
    descripcion = 'Una presa pequeña pero algo es algo'
  }

  user.diamantes = (user.diamantes || 0) + diamantes
  user.exp = (user.exp || 0) + exp
  cooldownsCazar[who] = now + 300000

  await conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      `${emoji} *${animal}* — ${rareza}`,
      `🔪 ${descripcion}`,
      '',
      `💀 Diamantes: *+${diamantes}*`,
      `⚡ EXP: *+${exp}*`,
      `🩸 Total: *${user.diamantes} 💎*`,
      '',
      '> Vuelve en *5 minutos* para otra caza',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })
}

handler.help = ['cazar']
handler.tags = ['rpg']
handler.command = /^(cazar|hunt)$/i
handler.desc = 'Caza animales para ganar diamantes y exp'

export default handler
