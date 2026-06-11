let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let colores = ['red', 'blue', 'black']
  let emojis = { red: '🔴', blue: '🔵', black: '⚫' }

  if (!args[0] || !colores.includes(args[0].toLowerCase()) || !args[1]) {
    return conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '🔪 *Apuesta a un color y gana*',
        '',
        '🔴 Red = x2',
        '🔵 Blue = x3',
        '⚫ Black = x5',
        '',
        '> #casino red 10',
        '> #casino black 50',
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }

  let color = args[0].toLowerCase()
  let apuesta = parseInt(args[1])

  if (isNaN(apuesta) || apuesta <= 0) {
    return conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 *Cantidad inválida*\n> Ingresa un número mayor a 0'
    }, { quoted: m })
  }

  if ((user.diamantes || 0) < apuesta) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 *No tienes suficientes diamantes*\n> Tienes: *${user.diamantes || 0} 💎*`
    }, { quoted: m })
  }

  let resultado = colores[Math.floor(Math.random() * colores.length)]
  let gano = resultado === color
  let multiplicador = color === 'red' ? 2 : color === 'blue' ? 3 : 5
  let ganancia = gano ? apuesta * multiplicador : 0

  user.diamantes = (user.diamantes || 0) - apuesta + ganancia
  user.exp = (user.exp || 0) + Math.floor(Math.random() * 10) + 5

  await conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      `🎯 Apuesta: *${apuesta} 💎*`,
      `${emojis[color]} Color: *${color.toUpperCase()}*`,
      `🔪 Multiplicador: *x${multiplicador}*`,
      '',
      `🎲 Salió: ${emojis[resultado]} *${resultado.toUpperCase()}*`,
      '',
      gano
        ? `🏆 *¡GANASTE!*\n💎 +${ganancia} diamantes\n🩸 La ruleta fue tuya...`
        : `💀 *PERDISTE*\n🔪 -${apuesta} diamantes\n⚰️ El casino se bebió tu sangre...`,
      '',
      `🩸 Total: *${user.diamantes} 💎*`,
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })
}

handler.help = ['casino']
handler.tags = ['rpg']
handler.command = /^(casino|apostar|bet)$/i
handler.desc = 'Apuesta en el casino'

export default handler
