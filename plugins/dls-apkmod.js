// © 2026 JM - DENJI BOT
// No quitar créditos

import fetch from 'node-fetch'

const API_KEY = 'dvyer343179430300'
const API_URL = 'https://dv-yer-api.online/apkmoddl'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const query = text?.trim()

  if (!query) return conn.sendMessage(m.chat, {
    text: `⛓️ DENJI BOT ⛓️\n\n⚡ Descarga APKs modificados\n\n> ${usedPrefix}${command} <nombre>\n> Ejemplo: ${usedPrefix}${command} free fire mod`
  }, { quoted: m })

  await m.react('🔍')

  try {
    const res = await fetch(`${API_URL}?q=${encodeURIComponent(query)}&apikey=${API_KEY}`)
    const json = await res.json()

    if (!json.ok || !json.download_url) {
      await m.react('❌')
      return conn.sendMessage(m.chat, {
        text: `⛓️ DENJI BOT ⛓️\n\n💀 No se encontró el APK\n\n> Intenta con otro nombre`
      }, { quoted: m })
    }

    const title = json.title || query
    const version = json.version || 'Desconocida'
    const filesize = json.filesize || 'Desconocido'
    const description = json.description || ''
    const icon = json.icon || null
    const downloadUrl = json.download_url
    const filename = json.filename || `${title}.apk`

    const caption = `⛓️ DENJI BOT ⛓️\n\n🔩 *${title}*\n🩸 Versión: *${version}*\n💀 Tamaño: *${filesize}*\n${description ? `📟 Info: _${description.slice(0, 100)}..._\n` : ''}\n> APK Mod`

    await m.react('⏳')

    let thumbBuffer = null
    if (icon) {
      try {
        thumbBuffer = Buffer.from(await fetch(icon).then(r => r.arrayBuffer()))
      } catch {}
    }

    try {
      await conn.sendMessage(m.chat, {
        document: { url: downloadUrl },
        mimetype: 'application/vnd.android.package-archive',
        fileName: filename,
        caption,
        thumbnail: thumbBuffer
      }, { quoted: m })
    } catch {
      await conn.sendMessage(m.chat, {
        text: `${caption}\n\n> 🔗 ${downloadUrl}`
      }, { quoted: m })
    }

    await m.react('✅')

  } catch (e) {
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `⛓️ DENJI BOT ⛓️\n\n💀 Error al descargar\n\n> ${e.message}`
    }, { quoted: m })
  }
}

handler.help = ['apkmod']
handler.tags = ['downloader']
handler.command = /^(apkmod|modapk)$/i
handler.desc = 'Descarga APKs modificados'

export default handler