let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, diamond: 0, bank: 0 }
    user = global.db.data.users[who]
  }
  let target = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : null
  let cantidad = target ? parseInt(args[1]) : parseInt(args[0])
  if (!target || isNaN(cantidad) || cantidad <= 0) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI PAY 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji lanza diamantes con la motosierra\n\n> #pay @usuario <cantidad>\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  if (target === who) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI PAY 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » No te puedes lanzar diamantes a ti mismo crack\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  let misDiamantes = user.diamantes || user.diamond || 0
  if (misDiamantes < cantidad) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI PAY 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » No tienes suficiente sangre acumulada\n🩸 » Tienes: ' + misDiamantes + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }
  if (user.diamantes !== undefined) {
    user.diamantes = misDiamantes - cantidad
  } else {
    user.diamond = misDiamantes - cantidad
  }
  let targetUser = global.db.data.users[target]
  if (!targetUser) {
    global.db.data.users[target] = { diamantes: 0, diamond: 0 }
    targetUser = global.db.data.users[target]
  }
  if (targetUser.diamantes !== undefined) {
    targetUser.diamantes = (targetUser.diamantes || 0) + cantidad
  } else {
    targetUser.diamond = (targetUser.diamond || 0) + cantidad
  }
  let miTotal = user.diamantes || user.diamond || 0
  let texto = '🪚「 DENJI PAY 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💀 » ¡Denji lanzó los diamantes con la motosierra!\n\n'
  texto += '📤 » @' + who.split('@')[0] + ' entregó\n'
  texto += '📥 » @' + target.split('@')[0] + ' recibió\n'
  texto += '🩸 » ' + cantidad + ' diamantes transferidos\n\n'
  texto += '🪚 » Tu saldo restante: ' + miTotal + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ La sierra cobra comisión en sangre'
  await conn.sendMessage(m.chat, { text: texto, mentions: [who, target] }, { quoted: m })
}
handler.help = ['pay']
handler.tags = ['rpg']
handler.command = /^(pay|pagar|transferir)$/i
handler.desc = 'Denji lanza diamantes con la motosierra a otro usuario 🪚🩸'
export default handler
