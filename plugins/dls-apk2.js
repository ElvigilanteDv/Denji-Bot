// © 2026 EL VIGILANTE & BRAYANRK - DENJI BOT
// Versión mejorada con selección interactiva - No quitar créditos
import { search, download } from 'aptoide-scraper'
import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const SEP = '|~|'

function parseSize(sizeStr) {
  if (!sizeStr) return 0
  const parts = sizeStr.trim().toUpperCase().split(' ')
  const value = parseFloat(parts[0])
  const unit = parts[1] || 'B'
  switch (unit) {
    case 'KB': return value * 1024
    case 'MB': return value * 1024 * 1024
    case 'GB': return value * 1024 * 1024 * 1024
    default: return value
  }
}

// ─── Handler principal ───────────────────────────────────────────────────────

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const query = text?.trim()

  if (!query) return conn.sendMessage(m.chat, {
    text: `🩸 DENJI BOT 🩸\n\n🔪 Busca y descarga APKs de Aptoide\n\n> ${usedPrefix}${command} <nombre de la app>\n> Ejemplo: ${usedPrefix}${command} minecraft`
  }, { quoted: m })

  await m.react('🩸')

  try {
    const results = await search(query)

    if (!results || results.length === 0) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n💀 No se encontraron resultados para *${query}*`
      }, { quoted: m })
    }

    // Si solo hay 1 resultado, descarga directo sin botones
    if (results.length === 1) {
      return await descargarYEnviar(conn, m, results[0].id, results[0].name)
    }

    // Mostrar botones con los primeros 8 resultados
    const lista = results.slice(0, 8)
    const rows = lista.map(app => {
      const pkgB64 = Buffer.from(app.id).toString('base64url')
      const nameB64 = Buffer.from(app.name || app.id).toString('base64url')
      return {
        header: '📦',
        title: (app.name || app.id).substring(0, 35),
        description: app.id.substring(0, 50),
        id: 'aptdl' + SEP + pkgB64 + SEP + nameB64
      }
    })

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'DENJI BOT - APTOIDE', subtitle: 'Elige el APK', hasMediaAttachment: false },
      body: { text: `🩸 DENJI BOT 🩸\n\n🔍 Búsqueda: *${query}*\n📦 ${lista.length} resultados\n\n> Elige cuál descargar` },
      footer: { text: '🩸 DENJI BOT 🩸' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '📦 RESULTADOS',
            sections: [{ title: query.toUpperCase().substring(0, 24), rows }]
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

  } catch (e) {
    console.error('[APTOIDE]', e)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error: ${e.message}`
    }, { quoted: m })
  }
}

// ─── Función de descarga y envío ─────────────────────────────────────────────

async function descargarYEnviar(conn, m, packageId, nombreHint = '') {
  await conn.sendMessage(m.chat, {
    text: `🩸 DENJI BOT 🩸\n\n⚰️ Obteniendo APK de *${nombreHint || packageId}*...`
  }, { quoted: m })

  try {
    const apkInfo = await download(packageId)

    if (!apkInfo) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 No se pudo obtener el APK\n> Intenta con otro nombre'
      }, { quoted: m })
    }

    const { name, package: id, size, icon, dllink: downloadUrl, lastup } = apkInfo

    if (!downloadUrl) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n💀 Este APK no tiene link de descarga disponible\n> Package: ${id}`
      }, { quoted: m })
    }

    // Thumbnail del ícono
    let thumbBuffer = null
    if (icon) {
      try {
        const res = await fetch(icon)
        thumbBuffer = Buffer.from(await res.arrayBuffer())
      } catch {}
    }

    const caption = `🩸 DENJI BOT 🩸\n\n🔪 *${name}*\n💀 Package: ${id}\n💀 Actualización: ${lastup}\n💀 Tamaño: ${size}\n\n> Scraper por *Denji Bot*`

    await conn.sendMessage(m.chat, {
      document: { url: downloadUrl },
      mimetype: 'application/vnd.android.package-archive',
      fileName: `${name}.apk`,
      caption,
      thumbnail: thumbBuffer
    }, { quoted: m })

    await m.react('🩸')

  } catch (e) {
    console.error('[APTOIDE DL]', e)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error al descargar: ${e.message}`
    }, { quoted: m })
  }
}

// ─── Handler.before — respuesta a los botones ────────────────────────────────

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('aptdl' + SEP)) return false

    const payload = id.slice(('aptdl' + SEP).length)
    const parts = payload.split(SEP)
    const packageId = Buffer.from(parts[0], 'base64url').toString()
    const nombre = Buffer.from(parts[1], 'base64url').toString()

    await m.react('⚰️')
    await descargarYEnviar(conn, m, packageId, nombre)
    return true

  } catch (e) {
    console.error('[APTOIDE BEFORE]', e)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error: ${e.message}`
    }, { quoted: m })
    return true
  }
}

handler.help = ['apk']
handler.tags = ['downloader']
handler.command = /^(apk|aptoide|apkdl)$/i
handler.desc = 'Busca y descarga APKs de Aptoide con selección interactiva'

export default handler
