import fs from 'fs'
import path from 'path'

const GACHA_FILE = path.join(process.cwd(), 'gacha.json')
const cooldowns = new Map()

let handler = async (m, { conn }) => {
  const now = Date.now()
  const cd = cooldowns.get(m.sender) || 0

  if (now < cd) {
    const restante = Math.ceil((cd - now) / 1000)
    const minutos = Math.floor(restante / 60)
    const segundos = restante % 60
    return conn.sendMessage(m.chat, {
      text: `⛓️ DENJI BOT ⛓️\n\n💀 La motosierra se está enfriando\n🔩 Espera ${minutos}m ${segundos}s`
    }, { quoted: m })
  }

  if (!fs.existsSync(GACHA_FILE)) {
    return conn.sendMessage(m.chat, {
      text: `⛓️ DENJI BOT ⛓️\n\n💀 No hay gacha.json\n🔩 Agrega el archivo de personajes`
    }, { quoted: m })
  }

  let characters = JSON.parse(fs.readFileSync(GACHA_FILE, 'utf8'))

  let random = Math.random()
  let rarity
  if (random < 0.02) rarity = 'SSR'
  else if (random < 0.15) rarity = 'SR'
  else if (random < 0.40) rarity = 'R'
  else rarity = 'N'

  let pool = characters.filter(c => c.rarity === rarity)
  if (pool.length === 0) pool = characters

  let char = pool[Math.floor(Math.random() * pool.length)]

  if (!global.lastRoll) global.lastRoll = new Map()
  global.lastRoll.set(m.sender, char)
  cooldowns.set(m.sender, now + 300000)

  const rarityEmojis = { 'SSR': '🌟', 'SR': '⭐', 'R': '✨', 'N': '💀' }
  const emoji = rarityEmojis[char.rarity] || '🔩'

  await conn.sendMessage(m.chat, {
    image: { url: char.image },
    caption: `⛓️ DENJI BOT ⛓️\n\n🪚 ¡Denji cortó un demonio!\n\n${emoji} ${char.name}\n🔩 Rareza: ${char.rarity}\n🩸 ATK: ${char.attack} | 🛡️ DEF: ${char.defense} | 💀 HP: ${char.health}\n\n> Usa #claim para guardarlo\n> ⏳ 5 minutos`
  }, { quoted: m })
}

handler.help = ['rw']
handler.tags = ['gacha']
handler.command = /^(rw|roll|gacha)$/i
handler.desc = 'Denji corta un demonio cada 5 min'

export default handler