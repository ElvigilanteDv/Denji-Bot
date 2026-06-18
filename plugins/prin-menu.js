import { xpRange } from '../lib/levelling.js'
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'

const charset = { a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ' }
const textCyberpunk = t => t.replace(/[a-z]/gi, c => charset[c.toLowerCase()] || c)

// Orden fijo de categorías
const tagLabels = {
  main:       'Principal',
  group:      'Grupos',
  rpg:        'RPG',
  game:       'Juegos',
  gacha:      'Gacha',
  diversion:  'Diversion',
  anime:      'Anime',
  serbot:     'Serbot',
  owner:      'Owner',
  downloader: 'Descargas',
  tools:      'Tools',
  sticker:    'Sticker',
  info:       'Info'
}

const FALLBACK_LABEL = 'Otros'

const defaultMenu = {
  before: `
࿇ ══━━━✥◈✥━━━══ ࿇
    𝕯𝖊𝖓𝖏𝖎 𝕭𝖔𝖙
࿇ ══━━━✥◈✥━━━══ ࿇
𖣔 ɪɴꜰᴏ ˚ʚ♡ɞ˚
❧ Usuario
> %name
❧ Experiencia
> %exp / %maxexp
❧ Comandos
> %totalcmd
❧ Modo
> %mode
❧ Activo
> %muptime
❧ Registrados
> %totalreg
%readmore
`.trim(),
  header: '\n𖣔 %category ˚ʚ♡ɞ˚',
  body: '❧ %cmd',
  footer: '⸻⸻⸻⸻⸻⸻',
  after: '\n࿇ ══━━━✥◈✥━━━══ ࿇\n   𝕯𝖊𝖓𝖏𝖎 𝕭𝖔𝖙\n࿇ ══━━━✥◈✥━━━══ ࿇\n\n𖣔 ᴄʀᴇᴀᴅᴏʀ ˚ʚ♡ɞ˚\n❧ JM'
}

const menuDir = './media/menu'
fs.mkdirSync(menuDir, { recursive: true })

const getMenuMediaFile = jid =>
  path.join(menuDir, `menuMedia_${jid.replace(/[:@.]/g, '_')}.json`)

const loadMenuMedia = jid => {
  try {
    return JSON.parse(fs.readFileSync(getMenuMediaFile(jid)))
  } catch { return {} }
}

const fetchBuffer = url => fetch(url).then(r => r.arrayBuffer()).then(b => Buffer.from(b))
const defaultThumb = await fetchBuffer('https://files.catbox.moe/ks2023.jpg')

const clockString = ms =>
  [3600000, 60000, 1000].map((v, i) =>
    String(Math.floor(ms / v) % (i ? 60 : 99)).padStart(2, '0')
  ).join(':')

let handler = async (m, { conn, usedPrefix }) => {
  await conn.sendMessage(m.chat, { react: { text: '🩸', key: m.key } })

  const botJid = conn.user.jid
  const menuMedia = loadMenuMedia(botJid)
  const menu = global.subBotMenus?.[botJid] || defaultMenu
  const user = global.db.data.users[m.sender] || { level: 0, exp: 0 }
  const { min, xp } = xpRange(user.level, global.multiplier)

  // Solo entran al menú los plugins activos que sí tengan help definido
  const pluginList = Object.values(global.plugins || {})
    .filter(p => !p.disabled && [].concat(p.help ?? []).length)
    .map(p => ({
      help:   [].concat(p.help || []),
      tags:   [].concat(p.tags || []),
      prefix: 'customPrefix' in p,
      desc:   p.desc || ''
    }))

  const replace = {
    name:     await conn.getName(m.sender),
    level:    user.level,
    exp:      user.exp - min,
    maxexp:   xp,
    totalreg: Object.keys(global.db.data.users).length,
    totalcmd: pluginList.reduce((acc, p) => acc + p.help.length, 0),
    mode:     global.opts.self ? 'Privado' : 'Público',
    muptime:  clockString(process.uptime() * 1000),
    readmore: String.fromCharCode(8206).repeat(4001)
  }

  const buildSection = (label, matched) => {
    if (!matched.length) return ''
    const cmds = matched
      .flatMap(p => p.help.map(h => {
        const cmd = p.prefix ? h : usedPrefix + h
        return menu.body.replace('%cmd', cmd) + (p.desc ? `\n> ${p.desc}` : '')
      }))
      .sort((a, b) => a.localeCompare(b))
      .join('\n')
    const header = menu.header.replace('%category', textCyberpunk(label))
    return `${header}\n${cmds}\n${menu.footer}`
  }

  const secciones = Object.entries(tagLabels)
    .map(([tag, label]) => buildSection(label, pluginList.filter(p => p.tags.includes(tag))))
    .filter(Boolean)

  // Tags que no estén en tagLabels van a "Otros" en vez de desaparecer
  const huerfanos = pluginList.filter(p => !p.tags.some(t => tagLabels[t]))
  const seccionHuerfanos = buildSection(FALLBACK_LABEL, huerfanos)
  if (seccionHuerfanos) secciones.push(seccionHuerfanos)

  const text = [menu.before, ...secciones, menu.after]
    .join('\n')
    .replace(/%(\w+)/g, (_, k) => replace[k] ?? '')

  const thumb = menuMedia.thumbnail && fs.existsSync(menuMedia.thumbnail)
    ? fs.readFileSync(menuMedia.thumbnail)
    : defaultThumb

  await conn.sendMessage(m.chat, {
    image: thumb,
    caption: text,
    footer: 'DENJI SYSTEM',
    headerType: 4
  })
}

handler.help     = ['menu', 'menú']
handler.tags     = ['main']
handler.command  = ['menu', 'menú', 'help', 'ayuda']
handler.desc     = 'muestra el menu'
handler.register = false

export default handler
