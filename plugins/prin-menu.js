import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { xpRange } from '../lib/levelling.js'

const charset = {
  a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',
  j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',
  s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ'
}
const textCyberpunk = t => t.replace(/[a-z]/gi, c => charset[c.toLowerCase()] || c)

const tagLabels = {
  main:       '🔩 Principal',
  group:      '⛓️ Grupos',
  rpg:        '🩸 RPG',
  game:       '🎯 Juegos',
  gacha:      '🔮 Gacha',
  diversion:  '💀 Diversión',
  anime:      '🗡️ Anime',
  serbot:     '🤖 Serbot',
  owner:      '⚙️ Owner',
  downloader: '📥 Descargas',
  info:       '📟 Info'
}

const defaultMenu = {
  before: `
꒰ঌ DENJI BOT ໒꒱
✦─────────────────✦
··──→ 𝙐𝙨𝙚𝙧  : %name
··──→ 𝙉𝙞𝙫𝙚𝙡 : %level
··──→ 𝙀𝙭𝙥   : %exp / %maxexp
··──→ 𝙈𝙤𝙙𝙤  : %mode
··──→ 𝙐𝙥    : %uptime
··──→ 𝙐𝙨𝙧𝙨  : %totalreg
··──→ 𝙏𝙞𝙢𝙚  : %time
✦─────────────────✦
%readmore`.trim(),
  header: '\n\\ꔫ꒾/%category〔%count〕\\ꔫ꒾/\n⸻⸻⸻⸻⸻⸻',
  body:   '\n❧ %cmd\n  ↳ %desc',
  footer: '⸻⸻⸻⸻⸻⸻',
  after:  '\n✦─────────────────✦\n꒰ঌ ᴄʀᴇᴀᴅᴏ ᴘᴏʀ ᴊᴍ ✦ ᴅᴇɴᴊɪ ʙᴏᴛ ໒꒱\n✦─────────────────✦'
}

const menuDir = './media/menu'
fs.mkdirSync(menuDir, { recursive: true })

const getMenuMediaFile = jid =>
  path.join(menuDir, `menuMedia_${jid.replace(/[:@.]/g, '_')}.json`)

const loadMenuMedia = jid => {
  try { return JSON.parse(fs.readFileSync(getMenuMediaFile(jid))) }
  catch { return {} }
}

const fetchBuffer = async url => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status} al obtener imagen: ${url}`)
  return Buffer.from(await r.arrayBuffer())
}

let _defaultThumb = null
const getDefaultThumb = async () => {
  if (!_defaultThumb) _defaultThumb = await fetchBuffer('https://files.catbox.moe/ks2023.jpg')
  return _defaultThumb
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)

const clockString = ms =>
  [3600000, 60000, 1000]
    .map((v, i) => String(Math.floor(ms / v) % (i ? 60 : 99)).padStart(2, '0'))
    .join(':')

let handler = async (m, { conn, usedPrefix: _p, command }) => {
  try {
    await conn.sendMessage(m.chat, { react: { text: '🩸', key: m.key } })

    const users = global.db?.data?.users ?? {}
    if (!users[m.sender]) users[m.sender] = { exp: 0, level: 0 }
    const user = users[m.sender]
    const { min, xp } = xpRange(user.level, global.multiplier)

    const botJid = conn.user.jid
    const menuMedia = loadMenuMedia(botJid)
    const menu = global.subBotMenus?.[botJid] || defaultMenu

    const replace = {
      name:     await conn.getName(m.sender),
      level:    user.level,
      exp:      Math.max(0, user.exp - min),
      maxexp:   xp,
      totalreg: Object.keys(users).length,
      totalcmd: Object.keys(global.plugins ?? {}).length,
      mode:     global.opts?.self ? 'Privado' : 'Público',
      uptime:   clockString(process.uptime() * 1000),
      time:     new Date().toLocaleString('es-MX', { hour12: true }),
      readmore: readMore
    }

    const pluginList = Object.values(global.plugins ?? {})
      .filter(p => !p.disabled)
      .map(p => ({
        help:   [].concat(p.help ?? []),
        tags:   [].concat(p.tags ?? []),
        prefix: 'customPrefix' in p,
        desc:   p.desc || ''
      }))

    let tagFiltro = null
    const match = command.match(/^(?:menu|menú|help)(.+)$/i)
    if (match) {
      const buscada = match[1].toLowerCase()
      tagFiltro = Object.keys(tagLabels).find(k => k === buscada) ?? null
    }

    const secciones = Object.entries(tagLabels)
      .filter(([tag]) => !tagFiltro || tag === tagFiltro)
      .map(([tag, label]) => {
        const cmds = pluginList
          .filter(p => p.tags.includes(tag))
          .flatMap(p =>
            p.help.map(h => {
              const cmd = p.prefix ? h : _p + h
              const desc = p.desc ? `  ↳ ${p.desc}` : ''
              return `❧ ${cmd}${desc ? '\n' + desc : ''}`
            })
          ).join('\n')

        if (!cmds) return ''
        const count = pluginList.filter(p => p.tags.includes(tag)).length
        const header = menu.header
          .replace('%category', textCyberpunk(label))
          .replace('%count', count)
        return `${header}\n${cmds}\n${menu.footer}`
      })
      .filter(Boolean)

    const texto = [menu.before, ...secciones, menu.after]
      .join('\n')
      .replace(/%(\w+)/g, (_, k) => replace[k] ?? '')

    const thumb = menuMedia.thumbnail && fs.existsSync(menuMedia.thumbnail)
      ? fs.readFileSync(menuMedia.thumbnail)
      : await getDefaultThumb()

    await conn.sendMessage(m.chat, {
      image:      thumb,
      caption:    texto.trim(),
      footer:     'DENJI SYSTEM',
      headerType: 4
    }, { quoted: m })

  } catch (e) {
    console.error('[menu_denji]', e)
    await conn.sendMessage(m.chat, {
      text: `🩸 *DENJI BOT* 🩸\n\n💀 Error:\n${e?.message ?? e}`
    }, { quoted: m })
  }
}

handler.help     = ['menu', 'menú', 'help']
handler.tags     = ['main']
handler.command  = /^(menu|menú|help)(rpg|group|game|gacha|diversion|anime|serbot|owner|downloader|tools|info|main)?$/i
handler.register = false
handler.desc     = 'Muestra el menú principal de Denji Bot'

export default handler
