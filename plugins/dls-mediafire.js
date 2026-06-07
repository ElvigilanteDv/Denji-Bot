
import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const isFolderUrl = url => url.includes('/folder/') || url.includes('mediafire.com/folder')
const isFileUrl = url => url.includes('/file/') || url.includes('mediafire.com/file')

const formatSize = bytes => {
  const n = parseInt(bytes)
  if (isNaN(n)) return 'Desconocido'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`
  return `${n} B`
}

const getIcon = mime => {
  if (!mime) return '📄'
  if (mime.startsWith('video')) return '🎬'
  if (mime.startsWith('image')) return '🖼️'
  if (mime.startsWith('audio')) return '🎵'
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return '🗜️'
  if (mime.includes('pdf')) return '📕'
  if (mime.includes('apk')) return '📱'
  return '📄'
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔪 Descarga archivos de Mediafire\n\n💀 Carpeta:\n> ${usedPrefix}${command} https://mediafire.com/folder/xxx\n\n💀 Archivo:\n> ${usedPrefix}${command} https://mediafire.com/file/xxx`
    }, { quoted: m })
  }

  if (!text.includes('mediafire.com')) {
    return conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 Solo links de Mediafire'
    }, { quoted: m })
  }

  await m.react('🩸')

  // ── CARPETA ──
  if (isFolderUrl(text)) {
    try {
      const apiUrl = `https://api.delirius.store/download/mediafire?url=${encodeURIComponent(text)}`
      const res = await fetch(apiUrl)
      const json = await res.json()

      if (!json.status || !json.data?.length) throw new Error('No se pudo obtener la carpeta')

      const archivos = json.data.slice(0, 10)
      const rows = archivos.map((file, i) => ({
        header: getIcon(file.mime) + ' ' + (file.mime || 'archivo').split('/')[1]?.toUpperCase(),
        title: (file.filename || 'Sin nombre').substring(0, 35),
        description: '💀 ' + formatSize(file.size) + ' | 📅 ' + (file.uploaded?.split(' ')[0] || '?'),
        id: 'mfdl_' + i + '_' + Buffer.from(file.link).toString('base64') + '_' + Buffer.from(file.filename || 'file').toString('base64') + '_' + (file.mime || 'application/octet-stream')
      }))

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: 'DENJI BOT - MEDIAFIRE', subtitle: 'Selecciona un archivo', hasMediaAttachment: false },
        body: { text: `🩸 DENJI BOT 🩸\n\n🔪 Carpeta encontrada\n💀 ${json.data.length} archivos\n\n> Elige uno para descargar` },
        footer: { text: '🩸 DENJI BOT 🩸' },
        nativeFlowMessage: {
          buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '📂 ARCHIVOS',
              sections: [{ title: '💀 CARPETA MEDIAFIRE', rows }]
            })
          }]
        }
      })

      const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
      }, { quoted: m })

      await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

    } catch (e) {
      console.log(e)
      await m.react('💀')
      conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error al obtener carpeta: ' + e.message }, { quoted: m })
    }
    return
  }

  // ── ARCHIVO INDIVIDUAL ──
  if (isFileUrl(text)) {
    try {
      const apiUrl = `https://api.delirius.store/download/mediafire?url=${encodeURIComponent(text)}`
      const res = await fetch(apiUrl)
      const json = await res.json()

      if (!json.status || !json.data) throw new Error('No se pudo obtener el archivo')

      // Si devuelve un solo archivo
      const file = Array.isArray(json.data) ? json.data[0] : json.data
      if (!file?.link) throw new Error('Sin link de descarga')

      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n⚰️ Descargando archivo...`
      }, { quoted: m })

      const mime = file.mime || 'application/octet-stream'
      const filename = file.filename || 'archivo'

      await conn.sendMessage(m.chat, {
        document: { url: file.link },
        fileName: filename,
        mimetype: mime,
        caption: `🩸 DENJI BOT 🩸\n\n🔪 Descarga completada\n\n💀 Archivo: ${filename}\n💀 Tamaño: ${formatSize(file.size)}\n💀 Tipo: ${mime}`
      }, { quoted: m })

      await m.react('🩸')

    } catch (e) {
      console.log(e)
      await m.react('💀')
      conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error al descargar: ' + e.message }, { quoted: m })
    }
    return
  }

  await m.react('💀')
  conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Link no reconocido\n\n> Usa un link de /folder/ o /file/' }, { quoted: m })
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id?.startsWith('mfdl_')) return false

    const parts = id.split('_')
    const linkBase64 = parts[2]
    const nameBase64 = parts[3]
    const mime = parts[4] || 'application/octet-stream'
    const fileLink = Buffer.from(linkBase64, 'base64').toString()
    const filename = Buffer.from(nameBase64, 'base64').toString()

    await m.react('⚰️')
    await conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n🔪 Descargando...' }, { quoted: m })

    await conn.sendMessage(m.chat, {
      document: { url: fileLink },
      fileName: filename,
      mimetype: mime,
      caption: `🩸 DENJI BOT 🩸\n\n🔪 Descarga completada\n\n💀 ${filename}`
    }, { quoted: m })

    await m.react('🩸')
    return true

  } catch (e) {
    console.log(e)
    await m.react('💀')
    conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error: ' + e.message }, { quoted: m })
    return true
  }
}

handler.help = ['mediafire']
handler.tags = ['downloader']
handler.command = /^(mediafire|mf|mfdl)$/i
handler.desc = 'Descarga archivos y carpetas de Mediafire'

export default handler
