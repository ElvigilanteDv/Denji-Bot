import fs from 'fs'
import path from 'path'

const settingsDir = path.resolve('./json')
const settingsPath = path.join(settingsDir, 'settings.json')

const ownerNumbers = [
  '5028444966582',
  '573223090406'
]

function getOwners() {
  return ownerNumbers.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
}

function isOwnerUser(jid = '') {
  return getOwners().includes(jid)
}

function ensureSettingsFile() {
  if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true })
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2), 'utf8')
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
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8')
}

function getDefaultConfig() {
  return {
    antilink: false,
    antilinkMode: 'delete',
    antilinkWarnLimit: 3,
    antilinkWarnings: {},
    welcome: false,
    antiarabe: false,
    modoadmin: false
  }
}

function getChatConfig(botNumber, chatId) {
  const settings = readSettings()

  if (!settings[botNumber]) settings[botNumber] = {}
  if (!settings[botNumber][chatId]) {
    settings[botNumber][chatId] = getDefaultConfig()
    saveSettings(settings)
  }

  return settings[botNumber][chatId]
}

function updateChatConfig(botNumber, chatId, newData) {
  const settings = readSettings()

  if (!settings[botNumber]) settings[botNumber] = {}
  settings[botNumber][chatId] = {
    ...getDefaultConfig(),
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
☠️ límite de advertencias: *${chat.antilinkWarnLimit}*

> Usa *.on <función>* o *.off <función>*
> Usa *.antilink delete* o *.antilink warnkick*`
      }, { quoted: m })
    }

    updateChatConfig(botNumber, chatId, { [type]: enable })

    if (type === 'antilink' && enable) {
      const updated = getChatConfig(botNumber, chatId)
      return conn.sendMessage(m.chat, {
        text:
`⛓️ *DENJI BOT* ⛓️

🩸 *ANTI-LINK ACTIVADO* 🩸
🔪 Todo enlace será rastreado.
☠️ El matadero ya abrió sus puertas.
🫀 Modo actual: *${updated.antilinkMode}*

> El demonio del link ha sido liberado.`
      }, { quoted: m })
    }

    if (type === 'antilink' && !enable) {
      return conn.sendMessage(m.chat, {
        text:
`⛓️ *DENJI BOT* ⛓️

☠️ *ANTI-LINK DESACTIVADO* ☠️
🪦 La carnicería se detuvo.
🩸 Los links ya no serán cazados.

> Por ahora, el matadero quedó en silencio.`
      }, { quoted: m })
    }

    return conn.sendMessage(m.chat, {
      text:
`⛓️ *DENJI BOT* ⛓️

${enable ? '🩸' : '☠️'} *${type.toUpperCase()} ${enable ? 'ACTIVADO' : 'DESACTIVADO'}*
> La configuración ha sido escrita con sangre.`
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
☠️ El usuario seguirá vivo... por ahora.

> La sierra ya está encendida.`
        : `⛓️ *DENJI BOT* ⛓️

☠️ *MODO WARNKICK ACTIVADO* ☠️
🩸 Cada link dejará una advertencia.
🔪 A la tercera falta, el usuario será ejecutado del grupo.

> Tres heridas. Ninguna misericordia.`
    }, { quoted: m })
  }

  if (/^resetwarn$/i.test(command)) {
    let user = null

    if (m.mentionedJid?.[0]) {
      user = m.mentionedJid[0]
    } else if (m.quoted?.sender) {
      user = m.quoted.sender
    } else if (m.quoted?.participant) {
      user = m.quoted.participant
    } else if (m.quoted?.key?.participant) {
      user = m.quoted.key.participant
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

    if (isOwnerUser(user)) {
      return conn.sendMessage(m.chat, {
        text:
`⛓️ *DENJI BOT* ⛓️

☠️ *ACCESO DENEGADO*
🩸 No puedes tocar el expediente de un owner.
🔪 Su nombre está fuera del matadero.`
      }, { quoted: m })
    }

    resetWarning(botNumber, chatId, user)

    return conn.sendMessage(m.chat, {
      text:
`⛓️ *DENJI BOT* ⛓️

🩸 *SANGRE LIMPIADA* 🩸
🔪 Se reiniciaron las advertencias de @${user.split('@')[0]}.
☠️ Su historial fue arrancado del matadero.`,
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
