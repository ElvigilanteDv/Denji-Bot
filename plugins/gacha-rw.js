import fetch from 'node-fetch'

const API_BASE = 'https://elvigilante-api.onrender.com/api'
const API_KEY = 'elvigilante'

const cooldowns = new Map()
const lastRoll = new Map()
const BORDER_TOP = '╭⊱ ━━━━━━━━━━━━━━━ ⊰╮'
const BORDER_BOTTOM = '╰⊱ ━━━━━━━━━━━━━━━ ⊰╯'

async function pullGacha() {
  const res = await fetch(`${API_BASE}/tools/gacha/pull?apiKey=${API_KEY}`)
  const json = await res.json()
  if (!json.status || !json.data?.pull) throw new Error('No se pudo tirar la gacha')
  return json.data.pull
}

module.exports = {
  command: ['rw', 'roll', 'gacha'],
  description: 'Tira de la gacha cada 5 minutos',
  categoria: 'gacha',

  run: async (client, m, args, from) => {
    const now = Date.now()
    const cd = cooldowns.get(from) || 0

    if (now < cd) {
      const restante = Math.ceil((cd - now) / 1000)
      const minutos = Math.floor(restante / 60)
      const segundos = restante % 60
      return client.sendMessage(from, {
        text: `${BORDER_TOP}\n       ᴍᴀɴᴇᴋɪ-ɴᴇᴋᴏ ʙᴏᴛ\n${BORDER_BOTTOM}\n\n『 ɢᴀᴄʜᴀ 』\n\n⊹ Espera ${minutos}m ${segundos}s\n⊹ La gacha se está recargando\n\n${BORDER_TOP}\n       🐾 Gacha\n${BORDER_BOTTOM}`
      }, { quoted: m })
    }

    try {
      const pull = await pullGacha()
      lastRoll.set(from, pull)
      cooldowns.set(from, now + 300000)

      const rarityEmojis = { 'SSR': '🌟', 'SR': '⭐', 'R': '✨', 'N': '💫' }
      const emoji = rarityEmojis[pull.rarity] || '✨'

      await client.sendMessage(from, {
        image: { url: pull.image },
        caption: `${BORDER_TOP}\n       ᴍᴀɴᴇᴋɪ-ɴᴇᴋᴏ ʙᴏᴛ\n${BORDER_BOTTOM}\n\n『 ɢᴀᴄʜᴀ 』\n\n${emoji} ${pull.name}\n⊹ Rareza: ${pull.rarity}\n⊹ ⚔️ ATK: ${pull.attack}\n⊹ 🛡️ DEF: ${pull.defense}\n⊹ ❤️ HP: ${pull.health}\n\n> Usa .claim para guardarlo\n> ⏳ 5 minutos\n\n${BORDER_TOP}\n       🐾 Gacha\n${BORDER_BOTTOM}`
      }, { quoted: m })

    } catch (e) {
      await client.sendMessage(from, {
        text: `${BORDER_TOP}\n       ᴍᴀɴᴇᴋɪ-ɴᴇᴋᴏ ʙᴏᴛ\n${BORDER_BOTTOM}\n\n『 ɢᴀᴄʜᴀ 』\n\n⊹ ❌ Error al tirar la gacha\n⊹ Intenta de nuevo\n\n${BORDER_TOP}\n       🐾 Gacha\n${BORDER_BOTTOM}`
      }, { quoted: m })
    }
  }
}