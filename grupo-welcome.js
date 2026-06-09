import fs from 'fs'
import path from 'path'

const settingsPath = path.resolve('./json/settings.json')

function readSettings() {
  try {
    if (!fs.existsSync(settingsPath)) return {}
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  } catch { return {} }
}

function getChatConfig(botNumber, chatId) {
  const settings = readSettings()
  return settings?.[botNumber]?.[chatId] || {}
}

const handler = async (m, { conn }) => {}

handler.all = async function (m) {
  const conn = this

  conn.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      const botNumber = conn.user?.jid || 'bot'
      const chat = getChatConfig(botNumber, id)

      if (!chat.welcome) return

      let metadata = await conn.groupMetadata(id)
      let pp
      try {
        pp = await conn.profilePictureUrl(id, 'image')
      } catch {
        pp = 'https://files.catbox.moe/1hp2vx.jpg'
      }

      for (let user of participants) {
        if (action === 'add') {
          let texto
          if (chat.sWelcome) {
            texto = chat.sWelcome
              .replace(/@user/g, '@' + user.split('@')[0])
              .replace(/@group/g, metadata.subject)
              .replace(/@members/g, metadata.participants.length)
          } else {
            texto = '🪚「 DENJI BOT — BIENVENIDA SANGRIENTA 」🩸\n\n'
            texto += '💀 » *¡DENJI REV LA MOTOSIERRA!*\n'
            texto += '🩸 » @' + user.split('@')[0] + ' acaba de entrar al matadero\n'
            texto += '🪚 » Grupo: ' + metadata.subject + '\n'
            texto += '☠️ » Víctimas totales: ' + metadata.participants.length + '\n\n'
            texto += '> Bienvenid@ ... si es que sobrevives 🩸'
          }

          await conn.sendMessage(id, {
            image: { url: pp },
            caption: texto,
            mentions: [user]
          })

        } else if (action === 'remove') {
          let texto
          if (chat.sBye) {
            texto = chat.sBye
              .replace(/@user/g, '@' + user.split('@')[0])
              .replace(/@group/g, metadata.subject)
              .replace(/@members/g, metadata.participants.length)
          } else {
            texto = '🪚「 DENJI BOT — EXPULSADO DEL MATADERO 」🩸\n\n'
            texto += '💀 » *LA MOTOSIERRA LO DESPEDAZÓ*\n'
            texto += '🩸 » @' + user.split('@')[0] + ' fue cortado en pedazos\n'
            texto += '🪚 » Grupo: ' + metadata.subject + '\n'
            texto += '☠️ » Sobrevivientes: ' + metadata.participants.length + '\n\n'
            texto += '> No vuelvas... o Denji irá por ti 🩸'
          }

          await conn.sendMessage(id, {
            image: { url: pp },
            caption: texto,
            mentions: [user]
          })
        }
      }
    } catch (e) {
      console.error('Error en bienvenida:', e)
    }
  })
}

handler.help = []
handler.tags = []
handler.command = false

export default handler
