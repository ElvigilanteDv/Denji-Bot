let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { health: 100, maxHealth: 100, diamantes: 0 }
    user = global.db.data.users[who]
  }
  if ((user.diamantes || 0) < 1) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI CURAR 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Sin diamantes la sangre del diablo no alcanza\n🩸 » Tienes: ' + (user.diamantes || 0) + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  if (user.health === (user.maxHealth || 100)) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI CURAR 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji ya está al máximo, no necesita curarse\n❤️ » ' + user.health + '/' + (user.maxHealth || 100) + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  user.diamantes -= 1
  user.health = user.maxHealth || 100
  let texto = '🪚「 DENJI CURAR 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💀 » ¡Denji bebió sangre del diablo y se regeneró por completo!\n\n'
  texto += '🩸 » -1 diamante\n'
  texto += '❤️ » Vida: ' + user.health + '/' + (user.maxHealth || 100) + '\n'
  texto += '🪚 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ La motosierra vuelve a rugir con fuerza'
  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}
handler.help = ['curar']
handler.tags = ['rpg']
handler.command = /^(curar|heal|cura|sanar)$/i
handler.desc = 'Denji bebe sangre del diablo y se cura por 1 💎 🪚🩸'
export default handler
