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

function resetWarning(botNumber, chatId, user) {
  const settings = readSettings()
  if (settings?.[botNumber]?.[chatId]?.antilinkWarnings?.[user]) {
    delete settings[botNumber][chatId].antilinkWarnings[user]
    saveSettings(settings)
  }
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
      return conn.sendMessage(m.chat, {
        text:
`⛓️ *DENJI BOT* ⛓️

🩸 *ESTADO DEL MATADERO* 🩸

${chat.antilink ? '✅' : '❌'} antilink
${chat.welcome ? '✅' : '❌'} welcome
${chat.antiarabe ? '✅' : '❌'} antiarabe
${chat.modoadmin ? '✅' : '❌'} modoadmin

🔪 modo antilink: *${chat.antilinkMode}*
☠️ límite: *${chat.antilinkWarnLimit}*

> Usa *.on <función>* o *.off <función>*
> Usa *.antilink delete* o *.antilink warnkick*`
      }, { quoted: m })
    }

    updateChatConfig(botNumber, chatId, { [type]: enable })

    if (type === 'antilink' && enable) {
      return conn.sendMessage(m.chat, {
        text:
`⛓️ *DENJI BOT* ⛓️

🩸 *ANTI-LINK ACTIVADO* 🩸
🔪 Todo enlace será rastreado.
☠️ Nada escapará del matadero.
🫀 Modo actual: *${chat.antilinkMode}*

> El olor a link ya quedó marcado en este grupo.`
      }, { quoted: m })
    }

    if (type === 'antilink' && !enable) {
      return conn.sendMessage(m.chat, {
        text:
`⛓️ *DENJI BOT* ⛓️

☠️ *ANTI-LINK DESACTIVADO* ☠️
🪦 La cacería terminó.
🩸 Los links ya no serán mutilados.

> El demonio vuelve a dormir.`
      }, { quoted: m })
    }

    return conn.sendMessage(m.chat, {
      text:
`⛓️ *DENJI BOT* ⛓️

${enable ? '🩸' : '☠️'} *${type.toUpperCase()} ${enable ? 'ACTIVADO' : 'DESACTIVADO'}*
> La configuración fue escrita con sangre.`
    }, { quoted: m })
  }

  if (/^antilink$/i.test(command)) {
    const mode = (args[0] || '').toLowerCase()

    if (!['delete', 'warnkick'].includes(mode)) {
      return conn.sendMessage(m.chat, {
        text:
`⛓️ *DENJI BOT* ⛓️

🩸 *MODOS ANTI-LINK* 🩸

🔪 *delete* → elimina el mensaje con link
☠️ *warnkick* → elimina el mensaje y al tercer link expulsa

> Usa *.antilink delete*
> Usa *.antilink warnkick*`
      }, { quoted: m })
    }

    updateChatConfig(botNumber, chatId, { antilinkMode: mode })

    return conn.sendMessage(m.chat, {
      text: mode === 'delete'
        ? `⛓️ *DENJI BOT* ⛓️

🔪 *MODO DELETE ACTIVADO* 🔪
🩸 Los links serán arrancados del chat.
☠️ El usuario seguirá vivo... por ahora.`
        : `⛓️ *DENJI BOT* ⛓️

☠️ *MODO WARNKICK ACTIVADO* ☠️
🩸 Cada link dejará una advertencia.
🔪 A la tercera falta, el usuario será expulsado.`
    }, { quoted: m })
  }

  if (/^resetwarn$/i.test(command)) {
    let user = null

    if (m.mentionedJid?.[0]) {
      user = m.mentionedJid[0]
    } else if (m.quoted?.sender) {
      user = m.quoted.sender
    } else if (args[0]) {
      user = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'
    }

    if (!user) {
      return conn.sendMessage(m.chat, {
        text:
`⛓️ *DENJI BOT* ⛓️

☠️ *FALTA UNA PRESA*
🩸 Debes mencionar a alguien o responder su mensaje.

> Ejemplo:
*.resetwarn @usuario*
o responde un mensaje con *.resetwarn*`
      }, { quoted: m })
    }

    resetWarning(botNumber, chatId, user)

    return conn.sendMessage(m.chat, {
      text:
`⛓️ *DENJI BOT* ⛓️

🩸 *SANGRE LIMPIADA* 🩸
🔪 Se reiniciaron las advertencias de @${user.split('@')[0]}.
☠️ Su expediente fue arrancado del matadero.`,
      mentions: [user]
    }, { quoted: m })
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

export default handler
