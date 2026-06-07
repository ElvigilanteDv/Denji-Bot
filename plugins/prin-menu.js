import fs from 'fs'
import path, { join } from 'path'
import fetch from 'node-fetch'
import { xpRange } from '../lib/levelling.js'

const tags = {
  main: '🔩 PRINCIPAL',
  group: '⛓️ GRUPOS',
  rpg: '🩸 RPG',
  game: '🎯 JUEGOS',
  gacha: '🔮 GACHA',
  diversion: '💀 DIVERSION',
  anime: '🗡️ ANIME',
  serbot: '🤖 SERBOT',
  owner: '⚙️ OWNER',
  downloader: '📥 DESCARGAS',
  info: '📟 INFO'
}

const defaultMenu = {
  before: `
🩸━━━━━━━━━━━━━━━━🩸
💀 D E N J I  B O T 💀
🩸━━━━━━━━━━━━━━━━🩸
🔪 チェンソーマン 🔪
🩸 El Hombre Motosierra 🩸

⚰️ Hora: %time
💀 Usuarios: %totalreg
🔪 Comandos: %totalcmd
⛓️ Activo: %uptime
%readmore
`,
  header: '\n🩸━━━ %category (%count cmd) ━━━🩸\n',
  body: '  💀 %cmd',
  desc: '\n     🔪 %desc',
  footer: '',
  after: `
🩸━━━━━━━━━━━━━━━━🩸
💀 D E N J I  B O T 💀
🔪 Creado por JM 🔪
🩸━━━━━━━━━━━━━━━━🩸`
}

let handler = async (m, { conn, usedPrefix: _p, command }) => {
  try {
    let user = global.db.data.users[m.sender]
    if (!user) {
      user = { exp: 0, level: 0 }
      global.db.data.users[m.sender] = user
    }

    const help = Object.values(global.plugins)
      .filter(p => !p.disabled)
      .map(p => ({
        help: Array.isArray(p.help) ? p.help : [p.help],
        tags: Array.isArray(p.tags) ? p.tags : [p.tags],
        prefix: 'customPrefix' in p,
        desc: p.desc || ''
      }))

    let tagSeleccionada = null
    if (command.startsWith('menu') && command.length > 4) {
      let tagBuscada = command.replace('menu', '').toLowerCase()
      for (let key of Object.keys(tags)) {
        if (key.toLowerCase() === tagBuscada) {
          tagSeleccionada = key
          break
        }
      }
    }

    let bannerFinal = 'https://files.catbox.moe/ks2023.jpg'

    let textoMenu = defaultMenu.before
      .replace(/%time/g, new Date().toLocaleString())
      .replace(/%totalreg/g, Object.keys(global.db.data.users).length)
      .replace(/%totalcmd/g, Object.keys(global.plugins).length)
      .replace(/%uptime/g, Math.floor(process.uptime() / 60) + 'm ' + Math.floor(process.uptime() % 60) + 's')

    if (tagSeleccionada) {
      textoMenu = textoMenu.replace('D E N J I  B O T', 'DENJI BOT - ' + tags[tagSeleccionada])
    }

    for (let tag of Object.keys(tags)) {
      if (tagSeleccionada && tag !== tagSeleccionada) continue
      const cmds = help
        .filter(menu => menu.tags?.includes(tag))
        .map(menu => menu.help.map(h =>
          defaultMenu.body.replace(/%cmd/g, menu.prefix ? h : `${_p}${h}`) +
          (menu.desc ? defaultMenu.desc.replace(/%desc/g, menu.desc) : '')
        ).join('\n')).join('\n')

      if (cmds) {
        let count = help.filter(menu => menu.tags?.includes(tag)).length
        textoMenu += defaultMenu.header.replace(/%category/g, tags[tag]).replace(/%count/g, count)
        textoMenu += cmds + '\n'
      }
    }

    textoMenu += defaultMenu.after

    const replace = { readmore: readMore }
    let texto = textoMenu
    for (let key of Object.keys(replace)) {
      texto = texto.replace(new RegExp(`%${key}`, 'g'), replace[key])
    }

    await conn.sendMessage(m.chat, {
      image: { url: bannerFinal },
      caption: texto.trim()
    }, { quoted: m })

  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { text: `🩸 DENJI BOT 🩸\n\n💀 Error:\n${e}` }, { quoted: m })
  }
}

handler.help = ['menu', 'menú', 'help']
handler.tags = ['main']
handler.command = /^(menu|menú|help)(rpg|group|game|gacha|diversion|anime|serbot|owner|downloader|info|main)?$/i
handler.register = false
handler.desc = 'Muestra el menú principal'

export default handler

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)
