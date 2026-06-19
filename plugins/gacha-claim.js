import fs from 'fs'
import path from 'path'
let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, diamond: 0, inventory: [] }
    user = global.db.data.users[who]
  }
  if (!global.lastRoll || !global.lastRoll[who]) {
    return conn.sendMessage(m.chat, {
      text: '🪚「 DENJI CLAIM 」🩸\n\n💀 » No tienes personaje pendiente para reclamar\n\n> Usa #rw primero'
    }, { quoted: m })
  }
  let char = global.lastRoll[who]
  if (!user.inventory) user.inventory = []
  let rarityGemas = { 'SSR': 10, 'SR': 5, 'R': 2 }
  user.inventory.push(char.name)
  if (user.diamantes !== undefined) {
    user.diamantes = (user.diamantes || 0) + (rarityGemas[char.rarity] || 0)
  } else {
    user.diamond = (user.diamond || 0) + (rarityGemas[char.rarity] || 0)
  }
  let total = user.diamantes !== undefined ? user.diamantes : (user.diamond || 0)
  let rarityEmojis = { 'SSR': '🌟', 'SR': '⭐', 'R': '✨' }
  let texto = '🪚「 DENJI CLAIM 」🩸\n\n'
  texto += '💀 » ¡Denji cortó el rollo y reclamó al personaje!\n\n'
  texto += '🩸 » ' + char.name + '\n'
  texto += rarityEmojis[char.rarity] + ' » Rareza: ' + char.rarity + '\n'
  texto += '🪚 » ' + char.attack + ' ATK | 🛡️ ' + char.defense + ' DEF | ❤️ ' + char.health + ' HP\n'
  texto += '🩸 » +' + (rarityGemas[char.rarity] || 0) + ' diamantes\n'
  texto += '💰 » Total: ' + total + ' 💎\n'
  texto += '🎒 » Guardado en el inventario del matadero'
  delete global.lastRoll[who]
  await conn.sendMessage(m.chat, {
    image: { url: char.image },
    caption: texto
  }, { quoted: m })
}
handler.help = ['claim']
handler.tags = ['gacha']
handler.command = /^(claim|reclamar)$/i
handler.desc = 'Denji reclama tu último personaje de #rw 🪚🩸'
export default handler
