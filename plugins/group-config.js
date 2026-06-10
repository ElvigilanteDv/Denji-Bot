import fs from 'fs'
import path from 'path'

const settingsDir = path.resolve('./json')
const settingsPath = path.join(settingsDir, 'settings.json')

const ownerNumbers = [
  '5218444966582',
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
    antiarabe: false
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

  const modoadminActual = global.db.data.chats[m.chat]?.modoadmin || false

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
${modoadminActual ? '✅' : '❌'} modoadmin

🔪 modo antilink: *${chat.antilinkMode}*
☠️ límite de advertencias: *${chat.antilinkWarnLimit}*

> Usa *.on <función>* o *.off <función>*
> Usa *.antilink delete* o *.antilink warnkick*`
      }, { quoted: m })
    }

    if (type === 'modoadmin') {
      global.db.data.chats[m.chat].modoadmin = enable
      global.markDatabaseModified()

      return conn.sendMessage(m.chat, {
        text:
`⛓️ *DENJI BOT* ⛓️

${enable ? '🩸' : '☠️'} *MODOADMIN ${enable ? 'ACTIVADO' : 'DESACTIVADO'}*
${enable ? '🔪 Solo los admins pueden usar comandos.' : '🩸 Todos pueden usar comandos nuevamente.'}
> La configuración ha sido escrita con sangre.`
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

handler.before = async (m, { conn }) => {
  if (!m.isGroup) return

  const botNumber = conn.user?.jid || 'bot'
  const chatId = m.chat
  const chat = getChatConfig(botNumber, chatId)

  const modoadminActual = global.db.data.chats?.[m.chat]?.modoadmin || false
  if (modoadminActual) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const isUserAdmin = groupMetadata.participants.find(p => p.id === m.sender)?.admin
    if (!isUserAdmin && !m.fromMe) return
  }

  if (chat.antiarabe && m.messageStubType === 27) {
    const newJid = m.messageStubParameters?.[0]
    if (!newJid) return

    const number = newJid.split('@')[0].replace(/\D/g, '')
    const arabicPrefixes = ['212', '20', '971', '965', '966', '974', '973', '962']
    const isArab = arabicPrefixes.some(prefix => number.startsWith(prefix))

    if (isArab) {
      await conn.sendMessage(m.chat, {
        text:
`⛓️ *DENJI BOT* ⛓️

🩸 *ANTI-ÁRABE ACTIVADO*
☠️ El número +${number} no es bienvenido aquí.
🔪 Expulsado del matadero.

> [ Anti Árabe activado ]`
      })
      await conn.groupParticipantsUpdate(m.chat, [newJid], 'remove')
      return true
    }
  }

  if (chat.antilink) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const isUserAdmin = groupMetadata.participants.find(p => p.id === m.sender)?.admin
    const text = m?.text || ''

    const linkRegex = /chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}/i
    const linkRegex1 = /whatsapp\.com\/channel\/[0-9A-Za-z]{20,24}/i

    if (!isUserAdmin && (linkRegex.test(text) || linkRegex1.test(text))) {
      const userTag = `@${m.sender.split('@')[0]}`
      const delet = m.key.participant
      const msgID = m.key.id

      try {
        const ownGroupLink = `https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}`
        if (text.includes(ownGroupLink)) return
      } catch { }

      const mode = chat.antilinkMode || 'delete'
      const warnLimit = chat.antilinkWarnLimit || 3

      const deleteMsg = async () => {
        try {
          await conn.sendMessage(m.chat, {
            delete: {
              remoteJid: m.chat,
              fromMe: false,
              id: msgID,
              participant: delet
            }
          })
        } catch { }
      }

      if (mode === 'delete') {
        await deleteMsg()
        await conn.sendMessage(m.chat, {
          text:
`⛓️ *DENJI BOT* ⛓️

🔪 *LINK ELIMINADO*
🩸 ${userTag}, los links están prohibidos aquí.`,
          mentions: [m.sender]
        }, { quoted: m })

      } else {
        const settings = readSettings()
        if (!settings[botNumber]) settings[botNumber] = {}
        if (!settings[botNumber][chatId]) settings[botNumber][chatId] = getDefaultConfig()
        if (!settings[botNumber][chatId].antilinkWarnings) settings[botNumber][chatId].antilinkWarnings = {}
        if (!settings[botNumber][chatId].antilinkWarnings[m.sender]) settings[botNumber][chatId].antilinkWarnings[m.sender] = 0

        settings[botNumber][chatId].antilinkWarnings[m.sender]++
        const warns = settings[botNumber][chatId].antilinkWarnings[m.sender]
        saveSettings(settings)

        await deleteMsg()

        if (warns < warnLimit) {
          await conn.sendMessage(m.chat, {
            text:
`⛓️ *DENJI BOT* ⛓️

🩸 *ADVERTENCIA ${warns}/${warnLimit}*
🔪 ${userTag}, no se permiten links en el matadero.
☠️ A la advertencia ${warnLimit} serás expulsado.`,
            mentions: [m.sender]
          }, { quoted: m })
        } else {
          await conn.sendMessage(m.chat, {
            text:
`⛓️ *DENJI BOT* ⛓️

☠️ *EJECUTADO DEL MATADERO*
🩸 ${userTag} alcanzó ${warnLimit} advertencias por enviar links.
🔪 No hay misericordia aquí.`,
            mentions: [m.sender]
          }, { quoted: m })

          try {
            await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
          } catch {
            await conn.sendMessage(m.chat, {
              text: `⚠️ No pude expulsar a ${userTag}. Verifica mis permisos de admin.`,
              mentions: [m.sender]
            })
          }

          settings[botNumber][chatId].antilinkWarnings[m.sender] = 0
          saveSettings(settings)
        }
      }

      return true
    }
  }
}

export default handler
