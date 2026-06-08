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

function addWarning(botNumber, chatId, user) {
  const settings = readSettings()

  if (!settings[botNumber]) settings[botNumber] = {}
  if (!settings[botNumber][chatId]) {
    settings[botNumber][chatId] = getDefaultConfig()
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
  const urlRegex = /(?:https?:\/\/|ftp:\/\/|www\.|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(?:[^\s<]*)/gi
  return text.match(urlRegex) || []
}

const handler = {}

handler.before = async (m, { conn }) => {
  if (!m.isGroup) return
  if (!m.message) return

  const botNumber = conn.user?.jid || 'bot'
  const chatId = m.chat
  const chat = getChatConfig(botNumber, chatId)

  if (!chat.antilink) return

  if (m.fromMe) return
  if (isOwnerUser(m.sender)) return

  const text = m.text || ''
  if (!text) return

  const groupMetadata = await conn.groupMetadata(m.chat)
  const participants = groupMetadata.participants
  const userIsAdmin = isAdmin(participants, m.sender)

  if (userIsAdmin) return

  const links = detectLinks(text)
  if (!links.length) return

  let ownCode = null
  try {
    ownCode = await conn.groupInviteCode(m.chat)
  } catch {}

  const ownGroupLinkFound = links.some(link => {
    if (!ownCode) return false
    return link.includes(`chat.whatsapp.com/${ownCode}`)
  })

  if (ownGroupLinkFound) return

  try {
    await conn.sendMessage(m.chat, { delete: m.key })
  } catch {}

  if (chat.antilinkMode === 'delete') {
    await conn.sendMessage(m.chat, {
      text:
`⛓️ *DENJI BOT* ⛓️

🔪 *LINK ELIMINADO* 🔪
🩸 @${m.sender.split('@')[0]}, tu mensaje fue despedazado.
☠️ En este grupo los links no sobreviven.

> El demonio ya olió tu rastro.`,
      mentions: [m.sender]
    }, { quoted: m })

    return true
  }

  const warns = addWarning(botNumber, chatId, m.sender)
  const limit = chat.antilinkWarnLimit || 3

  if (warns >= limit) {
    await conn.sendMessage(m.chat, {
      text:
`⛓️ *DENJI BOT* ⛓️

☠️ *CASTIGO FINAL* ☠️
🩸 @${m.sender.split('@')[0]} alcanzó *${warns}/${limit}* advertencias.
🔪 El matadero ha dictado sentencia.
🪦 Será expulsado por insistir con links prohibidos.

> Tres heridas. Ninguna misericordia.`,
      mentions: [m.sender]
    }, { quoted: m })

    await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
    resetWarning(botNumber, chatId, m.sender)
    return true
  }

  await conn.sendMessage(m.chat, {
    text:
`⛓️ *DENJI BOT* ⛓️

🩸 *ADVERTENCIA ANTI-LINK* 🩸
🔪 @${m.sender.split('@')[0]} dejó un rastro prohibido.
☠️ Marca actual: *${warns}/${limit}*
🪓 A la tercera falta, caerá del grupo.

> La sangre ya fue marcada.`,
    mentions: [m.sender]
  }, { quoted: m })

  return true
}

export default handler
