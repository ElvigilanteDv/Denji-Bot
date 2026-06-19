import fetch from 'node-fetch'

const API_BASE = 'https://elvigilante-api.onrender.com/api'
const API_KEY = 'elvigilante'

const cooldowns = new Map()

async function pullGacha() {
  const res = await fetch(`${API_BASE}/tools/gacha/pull?apiKey=${API_KEY}`)
  const json = await res.json()
  if (!json.status || !json.data?.pull) throw new Error('La motosierra falló')
  return json.data.pull
}

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

  try {
    const pull = await pullGacha()
    
    if (!global.lastRoll) global.lastRoll = new Map()
    global.lastRoll.set(m.sender, pull)
    cooldowns.set(m.sender, now + 300000)

    const rarityEmojis = { 'SSR': '🌟', 'SR': '⭐', 'R': '✨', 'N': '💀' }
    const emoji = rarityEmojis[pull.rarity] || '🔩'

    await conn.sendMessage(m.chat, {
      image: { url: pull.image },
      caption: `⛓️ DENJI BOT ⛓️\n\n🪚 ¡Denji cortó un demonio!\n\n${emoji} ${pull.name}\n🔩 Rareza: ${pull.rarity}\n🩸 ATK: ${pull.attack} | 🛡️ DEF: ${pull.defense} | 💀 HP: ${pull.health}\n\n> Usa #claim para guardarlo\n> ⏳ 5 minutos`
    }, { quoted: m })

  } catch (e) {
    conn.sendMessage(m.chat, {
      text: `⛓️ DENJI BOT ⛓️\n\n💀 La motosierra falló\n🩸 No se pudo obtener personaje`
    }, { quoted: m })
  }
}

handler.help = ['rw']
handler.tags = ['gacha']
handler.command = /^(rw|roll|gacha)$/i
handler.desc = 'Denji corta un demonio cada 5 min'

export default handler