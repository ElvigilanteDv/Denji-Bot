let handler = async (m, { conn }) => {
  if (!global.lastRoll) global.lastRoll = new Map()
  const pull = global.lastRoll.get(m.sender)

  if (!pull) {
    return conn.sendMessage(m.chat, {
      text: `⛓️ DENJI BOT ⛓️\n\n💀 No tienes demonio pendiente\n🔩 Usa #rw para cazar uno primero`
    }, { quoted: m })
  }

  let user = global.db.data.users[m.sender]
  if (!user) {
    global.db.data.users[m.sender] = { diamantes: 0, inventory: [] }
    user = global.db.data.users[m.sender]
  }

  if (!user.inventory) user.inventory = []
  user.inventory.push(pull.name)

  const rarityGemas = { 'SSR': 15, 'SR': 8, 'R': 3, 'N': 1 }
  const gemas = rarityGemas[pull.rarity] || 2

  if (user.diamantes !== undefined) {
    user.diamantes = (user.diamantes || 0) + gemas
  } else {
    user.diamond = (user.diamond || 0) + gemas
  }

  const rarityEmojis = { 'SSR': '🌟', 'SR': '⭐', 'R': '✨', 'N': '💀' }
  const emoji = rarityEmojis[pull.rarity] || '🔩'

  const total = user.diamantes !== undefined ? user.diamantes : (user.diamond || 0)

  global.lastRoll.delete(m.sender)

  await conn.sendMessage(m.chat, {
    image: { url: pull.image },
    caption: `⛓️ DENJI BOT ⛓️\n\n🪚 ¡Demonio capturado!\n\n${emoji} ${pull.name}\n🔩 Rareza: ${pull.rarity}\n💀 +${gemas} diamantes\n🩸 Total: ${total} 💎\n🎒 Guardado en inventario`
  }, { quoted: m })
}

handler.help = ['claim']
handler.tags = ['gacha']
handler.command = /^(claim|reclamar)$/i
handler.desc = 'Reclama tu último demonio cazado'

export default handler