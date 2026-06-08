import fs from 'fs'
import path from 'path'

const settingsDir = path.resolve('./json')
const settingsPath = path.join(settingsDir, 'settings.json')

function ensureSettingsFile() {
  if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true })
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2))
  }
}

function readSettings() {
  try {
    ensureSettingsFile()
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  } catch {
    return {}
  }
}

function saveSettings(data) {
  ensureSettingsFile()
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2))
}

function getChatConfig(botNumber, chatId) {
  const settings = readSettings()

  if (!settings[botNumber]) settings[botNumber] = {}
  if (!settings[botNumber][chatId]) {
    settings[botNumber][chatId] = {
      antilink: false,
      antilinkMode: 'delete',
      antilinkWarnLimit: 3,
      antilinkWarnings: {},
      welcome: false,
      antiarabe: false,
      modoadmin: false
    }
    saveSettings(settings)
  }

  return settings[botNumber][chatId]
}

function updateChatConfig(botNumber, chatId, newData) {
  const settings = readSettings()

  if (!settings[botNumber]) settings[botNumber] = {}
  settings[botNumber][chatId] = {
    antilink: false,
    antilinkMode: 'delete',
    antilinkWarnLimit: 3,
    antilinkWarnings: {},
    welcome: false,
    antiarabe: false,
    modoadmin: false,
    ...(settings[botNumber][chatId] || {}),
    ...newData
  }

  saveSettings(settings)
  return settings[botNumber][chatId]
}

function getWarningCount(botNumber, chatId, user) {
  const settings = readSettings()
  return settings?.[botNumber]?.[chatId]?.antilinkWarnings?.[user] || 0
}

function addWarning(botNumber, chatId, user) {
  const settings = readSettings()

  if (!settings[botNumber]) settings[botNumber] = {}
  if (!settings[botNumber][chatId]) {
    settings[botNumber][chatId] = {
      antilink: false,
      antilinkMode: 'delete',
      antilinkWarnLimit: 3,
      antilinkWarnings: {},
      welcome: false,
      antiarabe: false,
      modoadmin: false
    }
  }

  if (!settings[botNumber][chatId].antilinkWarnings) {
    settings[botNumber][chatId].antilinkWarnings = {}
  }

  settings[botNumber][chatId].antilinkWarnings[user] =
    (settings[botNumber][chatId].antilinkWarnings[user] || 0) + 1

  saveSettings(settings)
  return settings[botNumber][chatId].antilinkWarnings[user]
}

function resetWarning(botNumber, chatId, user) {
  const settings = readSettings()
  if (settings?.[botNumber]?.[chatId]?.antilinkWarnings?.[user]) {
    delete settings[botNumber][chatId].antilinkWarnings[user]
    saveSettings(settings)
  }
}

function isAdmin(participants, jid) {
  return !!participants.find(p => p.id === jid)?.admin
}

function detectLinks(text = '') {
  const urlRegex = /(?:https?://|ftp://|www.|(?:[a-zA-Z0-9-]+.)+[a-zA-Z]{2,})(?:[^s<]*)/gi
  return text.match(urlRegex) || []
}

function horrorStatus(name, enabled) {
  return `${enabled ? '🩸' : '☠️'} ${name}`
}

const handler = async (m, { conn, command, args }) => {
  const botNumber = conn.user?.jid || 'bot'
  const chatId = m.chat
  const chat = getChatConfig(botNumber, chatId)

  if (/^(on|off)$/i.test(command)) {
    const type = (args[0] || '').toLowerCase()
    const enable = command.toLowerCase() === 'on'
    const validTypes = ['antilink', 'welcome', 'antiarabe', 'modoadmin']

    if (!validTypes.includes(type)) {
      let lista = ''
      for (const t of validTypes) {
        lista += `${horrorStatus(t, chat[t])}
`
      }

      lista += `
🔪 modo antilink: *${chat.antilinkMode}*`
      lista += `
🧠 límite de castigo: *${chat.antilinkWarnLimit}*`

      return m.reply(
`⛓️ *DENJI BOT* ⛓️

🩸 *TABLERO DE CARNICERÍA DEL GRUPO* 🩸

${lista}

> Usa *.on <función>* o *.off <función>*
> Usa *.antilink delete* o *.antilink warnkick*`
      )
    }

    updateChatConfig(botNumber, chatId, { [type]: enable })

    if (type === 'antilink' && enable) {
      return m.reply(
`⛓️ *DENJI BOT* ⛓️

🩸 *ANTI-LINK ACTIVADO* 🩸
☠️ La carne extraña será olida.
🔪 Todo enlace será examinado.
🫀 Modo actual: *${chat.antilinkMode}*

> El demonio de los links ha despertado.`
      )
    }

    if (type === 'antilink' && !enable) {
      return m.reply(
`⛓️ *DENJI BOT* ⛓️

☠️ *ANTI-LINK DESACTIVADO* ☠️
🪦 La vigilancia ha cesado.
🩸 Los links ya no serán cazados.

> Por ahora... el matadero quedó en silencio.`
      )
    }

    return m.reply(
`⛓️ *DENJI BOT* ⛓️

${enable ? '🩸' : '☠️'} *${type.toUpperCase()} ${enable ? 'ACTIVADO' : 'DESACTIVADO'}*
> La configuración del grupo ha sido marcada con sangre.`
    )
  }

  if (/^antilink$/i.test(command)) {
    const mode = (args[0] || '').toLowerCase()

    if (!['delete', 'warnkick'].includes(mode)) {
      return m.reply(
`⛓️ *DENJI BOT* ⛓️

🩸 *MODOS DEL MATADERO ANTI-LINK* 🩸

🔪 *delete* → borra el mensaje con link
☠️ *warnkick* → borra el mensaje y al *3er link* expulsa al usuario

> Usa: *.antilink delete*
> Usa: *.antilink warnkick*`
      )
    }

    updateChatConfig(botNumber, chatId, { antilinkMode: mode })

    if (mode === 'delete') {
      return m.reply(
`⛓️ *DENJI BOT* ⛓️

🔪 *MODO DELETE ACTIVADO* 🔪
🩸 Los links serán descuartizados al instante.
🪓 El pecador seguirá vivo...
☠️ Pero su mensaje no.

> La sierra ya está encendida.`
      )
    }

    return m.reply(
`⛓️ *DENJI BOT* ⛓️

☠️ *MODO WARNKICK ACTIVADO* ☠️
🩸 Cada link dejará una herida.
🫀 A la *tercera marca* el usuario será expulsado.
🔪 Límite actual: *${chat.antilinkWarnLimit}*

> Tres cortes. Después, la ejecución.`
    )
  }

  if (/^resetwarn$/i.test(command)) {
    let user = m.mentionedJid?.[0] || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
    if (!user) {
      return m.reply(
`⛓️ *DENJI BOT* ⛓️

☠️ Debes mencionar a un usuario para limpiarle la sangre.
> Ejemplo: *.resetwarn @usuario*`
      )
    }

    resetWarning(botNumber, chatId, user)

    return m.reply(
`⛓️ *DENJI BOT* ⛓️

🩸 *ADVERTENCIAS REINICIADAS*
🔪 El historial de ${'@' + user.split('@')[0]} fue borrado del matadero.`,
      { mentions: [user] }
    )
  }
}

handler.help = [
  'on antilink',
  'off antilink',
  'on welcome',
  'off welcome',
  'on antiarabe',
  'off antiarabe',
  'on modoadmin',
  'off modoadmin',
  'antilink delete',
  'antilink warnkick',
  'resetwarn @user'
]

handler.tags = ['group']
handler.command = /^(on|off|antilink|resetwarn)$/i
handler.group = true
handler.admin = true

handler.before = async (m, { conn }) => {
  if (!m.isGroup) return

  const botNumber = conn.user?.jid || 'bot'
  const chatId = m.chat
  const chat = getChatConfig(botNumber, chatId)

  if (!chat.antilink && !chat.modoadmin && !chat.antiarabe && !chat.welcome) return

  const groupMetadata = await conn.groupMetadata(m.chat)
  const participants = groupMetadata.participants
  const userIsAdmin = isAdmin(participants, m.sender)

  if (chat.modoadmin && !userIsAdmin && !m.fromMe) return

  if (chat.antiarabe && m.messageStubType === 27) {
    const newJid = m.messageStubParameters?.[0]
    if (newJid) {
      const number = newJid.split('@')[0]
      const arabicPrefixes = ['212', '20', '971', '965', '966', '974', '973', '962']
      if (arabicPrefixes.some(prefix => number.startsWith(prefix))) {
        await conn.sendMessage(m.chat, {
          text: `⛓️ *DENJI BOT* ⛓️

☠️ *ANTI-ÁRABE ACTIVADO* ☠️
🩸 Una presencia prohibida fue detectada.
🔪 El objetivo será expulsado del matadero.`
        })
        await conn.groupParticipantsUpdate(m.chat, [newJid], 'remove')
        return true
      }
    }
  }

  if (chat.antilink) {
    const text = m?.text || ''
    const links = detectLinks(text)

    if (!userIsAdmin && links.length) {
      let ownCode = null
      try {
        ownCode = await conn.groupInviteCode(m.chat)
      } catch {}

      const ownGroupLinkFound = links.some(link => {
        if (!ownCode) return false
        return link.includes(`chat.whatsapp.com/${ownCode}`)
      })

      if (ownGroupLinkFound) return

      if (chat.antilinkMode === 'delete') {
        try {
          await conn.sendMessage(m.chat, { delete: m.key })
        } catch {}

        await conn.sendMessage(m.chat, {
          text: `⛓️ *DENJI BOT* ⛓️

🔪 *MODO DELETE* 🔪
🩸 @${m.sender.split('@')[0]}, tu mensaje fue arrancado del chat.
☠️ Aquí no sobreviven los links.

> El demonio ya probó tu olor.`,
          mentions: [m.sender]
        })

        return true
      }

      if (chat.antilinkMode === 'warnkick') {
        try {
          await conn.sendMessage(m.chat, { delete: m.key })
        } catch {}

        const warns = addWarning(botNumber, chatId, m.sender)
        const limit = chat.antilinkWarnLimit || 3

        if (warns >= limit) {
          await conn.sendMessage(m.chat, {
            text: `⛓️ *DENJI BOT* ⛓️

☠️ *EJECUCIÓN ANTI-LINK* ☠️
🩸 @${m.sender.split('@')[0]} alcanzó *${warns}/${limit}* marcas.
🔪 Su cuello ha sido ofrecido al matadero.
🪦 Será expulsado por compartir links prohibidos.

> Tres heridas. Ninguna misericordia.`,
            mentions: [m.sender]
          })

          await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
          resetWarning(botNumber, chatId, m.sender)
          return true
        } else {
          await conn.sendMessage(m.chat, {
            text: `⛓️ *DENJI BOT* ⛓️

🩸 *ADVERTENCIA ANTI-LINK* 🩸
🔪 @${m.sender.split('@')[0]} dejó un rastro prohibido.
☠️ Castigo actual: *${warns}/${limit}*
🪓 A la tercera falta, será expulsado.

> La sangre ya fue marcada.`,
            mentions: [m.sender]
          })
          return true
        }
      }
    }
  }

  if (chat.welcome && [27, 28, 32].includes(m.messageStubType)) {
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
      await conn.sendMessage(m.chat, {
        image: { url: profilePic },
        caption:
`⛓️ *DENJI BOT* ⛓️

🩸 *BIENVENID@ AL MATADERO* 🩸
🔪 ${userMention}
🫀 ${groupMetadata.subject}
☠️ Miembros: ${groupSize}

> Otra alma acaba de cruzar la puerta.`,
        mentions: [userId]
      })
    }

    if ([28, 32].includes(m.messageStubType)) {
      await conn.sendMessage(m.chat, {
        image: { url: profilePic },
        caption:
`⛓️ *DENJI BOT* ⛓️

☠️ *DESPEDIDA DEL MATADERO* ☠️
🪦 ${userMention}
🫀 ${groupMetadata.subject}
🩸 Miembros: ${groupSize}

> Otra cabeza menos en la carnicería.`,
        mentions: [userId]
      })
    }
  }
}

export default handler
