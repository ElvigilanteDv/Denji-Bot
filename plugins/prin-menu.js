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
ᴅᴇɴᴊɪ ʙᴏᴛ

Usuario   : %name
Nivel     : %level  (%exp/%maxexp)
Modo      : %mode
Comandos  : %totalcmd
Usuarios  : %totalreg
Uptime    : %uptime
Hora      : %time

%readmore`.trim(),
  header: '\n%category (%count)',
  after:  '\nDenji Bot - creado por JM'
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

// Cada comando: una línea con el nombre, y si tiene desc, otra línea indentada debajo
const buildCommandLine = (p, h, prefix) => {
  const cmd = p.prefix ? h : prefix + h
  return p.desc ? `  ${cmd}\n    ${p.desc}` : `  ${cmd}`
}

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

    const pluginList = Object.values(global.plugins ?? {})
      .filter(p => !p.disabled && [].concat(p.help ?? []).length)
      .map(p => ({
        help:   [].concat(p.help ?? []),
        tags:   [].concat(p.tags ?? []),
        prefix: 'customPrefix' in p,
        desc:   p.desc || ''
      }))

    const replace = {
      name:     await conn.getName(m.sender),
      level:    user.level,
      exp:      Math.max(0, user.exp - min),
      maxexp:   xp,
      totalreg: Object.keys(users).length,
      totalcmd: pluginList.reduce((acc, p) => acc + p.help.length, 0),
      mode:     global.opts?.self ? 'Privado' : 'Publico',
      uptime:   clockString(process.uptime() * 1000),
      time:     new Date().toLocaleString('es-MX', { hour12: true }),
      readmore: readMore
    }

    let tagFiltro = null
    const match = command.match(/^(?:menu|menú|help)(.+)$/i)
    if (match) {
      const buscada = match[1].toLowerCase()
      tagFiltro = Object.keys(tagLabels).find(k => k === buscada) ?? null
    }

    const buildSection = (label, matched) => {
      if (!matched.length) return ''
      const cmds = matched
        .flatMap(p => p.help.map(h => buildCommandLine(p, h, _p)))
        .sort((a, b) => a.localeCompare(b))
        .join('\n')
      const header = menu.header
        .replace('%category', textCyberpunk(label))
        .replace('%count', matched.length)
      return `${header}\n${cmds}`
    }

    const secciones = Object.entries(tagLabels)
      .filter(([tag]) => !tagFiltro || tag === tagFiltro)
      .map(([tag, label]) => buildSection(label, pluginList.filter(p => p.tags.includes(tag))))
      .filter(Boolean)

    if (!tagFiltro) {
      const huerfanos = pluginList.filter(p => !p.tags.some(t => tagLabels[t]))
      const seccionHuerfanos = buildSection(FALLBACK_LABEL, huerfanos)
      if (seccionHuerfanos) secciones.push(seccionHuerfanos)
    }

    const texto = [menu.before, ...secciones, menu.after]
      .join('\n\n')
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
      text: `DENJI BOT\n\nError:\n${e?.message ?? e}`
    }, { quoted: m })
  }
}

handler.help     = ['menu', 'menú', 'help']
handler.tags     = ['main']
handler.command  = /^(menu|menú|help)(rpg|group|game|gacha|diversion|anime|serbot|owner|downloader|tools|sticker|info|main)?$/i
handler.register = false
handler.desc     = 'Muestra el menú principal de Denji Bot'

export default handler
