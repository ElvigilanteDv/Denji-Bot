let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, bank: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }
  if (!args[0]) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI RULETA 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji gira la ruleta con la motosierra\n\n🎯 » #ruleta <cantidad> <color>\n🔴 » Red = x2\n⚫ » Black = x2\n🟢 » Green = x10\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> #ruleta 10 red'
    }, { quoted: m })
  }
  let apuesta = parseInt(args[0])
  let color = args[1]?.toLowerCase()
  if (isNaN(apuesta) || apuesta <= 0) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI RULETA 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » Cantidad inválida, ni la sierra entiende eso\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  if (!color || !['red', 'black', 'green'].includes(color)) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI RULETA 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » Elige un color o Denji elige por ti con la sierra\n🔴 red | ⚫ black | 🟢 green\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  let misDiamantes = user.diamantes || user.diamond || 0
  if (misDiamantes < apuesta) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI RULETA 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » No tienes suficiente sangre acumulada\n🩸 » Tienes: ' + misDiamantes + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  let resultado
  let random = Math.random()
  if (color === 'green') {
    resultado = random < 0.05 ? 'green' : random < 0.525 ? 'red' : 'black'
  } else {
    resultado = random < 0.05 ? 'green' : random < 0.525 ? 'red' : 'black'
  }
  let gano = resultado === color
  let multiplicador = color === 'green' ? 10 : 2
  let ganancia = gano ? apuesta * multiplicador : 0
  if (user.diamantes !== undefined) {
    user.diamantes = misDiamantes - apuesta + ganancia
  } else {
    user.diamond = misDiamantes - apuesta + ganancia
  }
  let emojis = { red: '🔴', black: '⚫', green: '🟢' }
  let texto = '🪚「 DENJI RULETA 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💀 » Apostaste ' + apuesta + ' 💎 a ' + emojis[color] + '\n'
  texto += '🪚 » Denji gira la sierra... ¡Salió ' + emojis[resultado] + ' ' + resultado.toUpperCase() + '!\n\n'
  if (gano) {
    texto += '🏆 » ¡LA MOTOSIERRA TE SONRIÓ!\n'
    texto += '🩸 » +' + ganancia + ' diamantes\n'
  } else {
    texto += '💀 » LA SIERRA TE DESPEDAZÓ\n'
    texto += '🩸 » -' + apuesta + ' diamantes\n'
  }
  let total = user.diamantes || user.diamond || 0
  texto += '🪚 » Total: ' + total + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ La ruleta de Denji no tiene misericordia'
  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}
handler.help = ['ruleta']
handler.tags = ['rpg']
handler.command = /^(ruleta|roulette)$/i
handler.desc = 'Denji gira la ruleta sangrienta 🪚🩸'
export default handler
