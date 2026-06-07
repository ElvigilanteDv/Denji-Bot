// © 2026 EL VIGILANTE & BRAYANRK - DENJI BOT
// Scraper adaptado por El Vigilante - No quitar créditos
import { search, download } from 'aptoide-scraper'
import fetch from 'node-fetch'

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

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const query = text?.trim()

  if (!query) return conn.sendMessage(m.chat, {
    text: `🩸 DENJI BOT 🩸\n\n🔪 Busca y descarga APKs de Aptoide\n\n> ${usedPrefix}${command} <nombre de la app>\n> Ejemplo: ${usedPrefix}${command} facebook`
  }, { quoted: m })

  await m.react('🩸')

  try {
    const searchA = await search(query)

    if (!searchA || searchA.length === 0) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n💀 No se encontraron resultados\n\n> No hay resultados para *${query}*`
      }, { quoted: m })
    }

    const apkInfo = await download(searchA[0].id)

    if (!apkInfo) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 No se pudo obtener la información\n\n> Intenta con otro nombre'
      }, { quoted: m })
    }

    const { name, package: id, size, icon, dllink: downloadUrl, lastup } = apkInfo
    const sizeBytes = parseSize(size)

    if (sizeBytes > 524288000) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n💀 Archivo demasiado grande *(${size})*\n\n> Descárgalo directamente:\n${downloadUrl}`
      }, { quoted: m })
    }

    let thumbBuffer = null
    if (icon) {
      try {
        const response = await fetch(icon)
        thumbBuffer = Buffer.from(await response.arrayBuffer())
      } catch {}
    }

    const caption = `🩸 DENJI BOT 🩸\n\n🔪 Nombre: *${name}*\n💀 Paquete: *${id}*\n💀 Actualización: *${lastup}*\n💀 Tamaño: *${size}*\n\n> Scraper por *Hinata*`

    await conn.sendMessage(m.chat, {
      document: { url: downloadUrl },
      mimetype: 'application/vnd.android.package-archive',
      fileName: `${name}.apk`,
      caption,
      thumbnail: thumbBuffer
    }, { quoted: m })

    await m.react('🩸')

  } catch (e) {
    console.error(e)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error al descargar\n\n> ${e.message}`
    }, { quoted: m })
  }
}

handler.help = ['apk2']
handler.tags = ['downloader']
handler.command = /^(apk2|aptoide|apkdl)$/i
handler.desc = 'Busca y descarga APKs de Aptoide'

export default handler
