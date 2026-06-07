import fs from 'fs'
import path from 'path'

const settingsPath = path.resolve('./json/settings.json')

function readSettings() {
  try {
    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2))
    }
    return JSON.parse(fs.readFileSync(settingsPath))
  } catch {
    return {}
  }
}

function saveSettings(data) {
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2))
}

function getChatConfig(botNumber, chatId) {
  let settings = readSettings()
  if (!settings[botNumber]) settings[botNumber] = {}
  if (!settings[botNumber][chatId]) {
    settings[botNumber][chatId] = {
      antilink: false,
      welcome: false,
      antiarabe: false,
      modoadmin: false
    }
    saveSettings(settings)
  }
  return settings
}

const handler = async (m, { conn, command, args }) => {
  const type = (args[0] || '').toLowerCase()
  const enable = command === 'on'
  const validTypes = ['antilink', 'welcome', 'antiarabe', 'modoadmin']

  if (!validTypes.includes(type)) {
    let lista = ''
    for (let t of validTypes) {
      let chat = getChatConfig(conn.user?.jid || 'bot', m.chat)
      let estado = chat[conn.user?.jid || 'bot'][m.chat][t] ? '✅' : '❌'
      lista += `${estado} ${t}\n`
    }
    return m.reply(`⛓️ DENJI BOT ⛓️\n\n⚡ *Estado de funciones:*\n\n${lista}\n> Usa .on <funcion> o .off <funcion>`)
  }

  const botNumber = conn.user?.jid || 'bot'
  let settings = getChatConfig(botNumber, m.chat)
  settings[botNumber][m.chat][type] = enable
  saveSettings(settings)

  return m.reply(`⚡ ${type} ${enable ? 'activado' : 'desactivado'}.`)
}

handler.help = ['on antilink', 'on welcome', 'on antiarabe', 'on modoadmin', 'off antilink', 'off welcome', 'off antiarabe', 'off modoadmin']
handler.tags = ['group']
handler.command = /^(on|off)$/i
handler.group = true
handler.admin = true

handler.before = async (m, { conn }) => {
  if (!m.isGroup) return
  const botNumber = conn.user?.jid || 'bot'
  const settings = getChatConfig(botNumber, m.chat)
  const chat = settings[botNumber][m.chat]

  if (chat.modoadmin) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const isUserAdmin = groupMetadata.participants.find(p => p.id === m.sender)?.admin
    if (!isUserAdmin && !m.fromMe) return
  }

  if (chat.antiarabe && m.messageStubType === 27) {
    const newJid = m.messageStubParameters?.[0]
    if (newJid) {
      const number = newJid.split('@')[0]
      const arabicPrefixes = ['212', '20', '971', '965', '966', '974', '973', '962']
      if (arabicPrefixes.some(prefix => number.startsWith(prefix))) {
        await conn.sendMessage(m.chat, { text: `⛓️ Este usuario será expulsado. [ Anti Arabe Activado ]` })
        await conn.groupParticipantsUpdate(m.chat, [newJid], 'remove')
        return true
      }
    }
  }

  const linkRegex = /chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}/i
  const linkRegex1 = /whatsapp\.com\/channel\/[0-9A-Za-z]{20,24}/i
  if (chat.antilink) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const isUserAdmin = groupMetadata.participants.find(p => p.id === m.sender)?.admin
    const text = m?.text || ''

    if (!isUserAdmin && (linkRegex.test(text) || linkRegex1.test(text))) {
      const userTag = `@${m.sender.split('@')[0]}`

      try {
        const ownGroupLink = `https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}`
        if (text.includes(ownGroupLink)) return
      } catch {}

      await conn.sendMessage(m.chat, { text: `⛓️ Hey ${userTag}, no se permiten links aquí.`, mentions: [m.sender] }, { quoted: m })
      await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
      return true
    }
  }

  if (chat.welcome && [27, 28, 32].includes(m.messageStubType)) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const groupSize = groupMetadata.participants.length
    const userId = m.messageStubParameters?.[0] || m.sender
    const userMention = '@' + userId.split('@')[0]
    let profilePic
    try {
      profilePic = await conn.profilePictureUrl(m.chat, 'image')
    } catch {
      profilePic = 'https://files.catbox.moe/ks2023.jpg'
    }

    if (m.messageStubType === 27) {
      let texto
      if (chat.sWelcome) {
        texto = chat.sWelcome
          .replace(/@user/g, userMention)
          .replace(/@group/g, groupMetadata.subject)
          .replace(/@members/g, groupSize)
      } else {
        texto = '⛓️ DENJI BOT ⛓️\n\n'
        texto += '⚡ *BIENVENID@*\n'
        texto += '🔗 ' + userMention + '\n'
        texto += '🩸 ' + groupMetadata.subject + '\n'
        texto += '💀 Miembros: ' + groupSize + '\n\n'
        texto += '> A la orden, soy Denji ⛓️'
      }

      await conn.sendMessage(m.chat, {
        image: { url: profilePic },
        caption: texto,
        mentions: [userId]
      })
    }

    if ([28, 32].includes(m.messageStubType)) {
      let texto
      if (chat.sBye) {
        texto = chat.sBye
          .replace(/@user/g, userMention)
          .replace(/@group/g, groupMetadata.subject)
          .replace(/@members/g, groupSize)
      } else {
        texto = '⛓️ DENJI BOT ⛓️\n\n'
        texto += '💀 *ADIOS*\n'
        texto += '🔗 ' + userMention + '\n'
        texto += '🩸 ' + groupMetadata.subject + '\n'
        texto += '💀 Miembros: ' + groupSize + '\n\n'
        texto += '> Otro que se fue... ⛓️'
      }

      await conn.sendMessage(m.chat, {
        image: { url: profilePic },
        caption: texto,
        mentions: [userId]
      })
    }
  }
}

export default handler