import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const isFolderUrl = url => url.includes('/folder/') || url.includes('mediafire.com/folder')
const isFileUrl = url => url.includes('/file/') || url.includes('mediafire.com/file')

const MAX_SIZE = 2 * 1024 * 1024 * 1024
const WARN_SIZE = 200 * 1024 * 1024

const formatSize = bytes => {
  const n = parseInt(bytes)
  if (isNaN(n)) return 'Desconocido'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`
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

const getRealSize = async (url) => {
  try {
    const res = await fetch(url, { method: 'HEAD', timeout: 15000, redirect: 'follow' })
    const cl = res.headers.get('content-length')
    const ct = res.headers.get('content-type')
    console.log(`[MF DEBUG] HEAD → status: ${res.status} | url final: ${res.url} | content-length: ${cl} | content-type: ${ct}`)
    return cl ? parseInt(cl) : null
  } catch (e) {
    console.log(`[MF DEBUG] HEAD falló: ${e.message}`)
    return null
  }
}

const downloadAndSend = async (conn, m, fileLink, filename, mime, size) => {
  // ── DEBUG 1: info inicial ──
  console.log(`[MF DEBUG] ─────────────────────────────`)
  console.log(`[MF DEBUG] Archivo  : ${filename}`)
  console.log(`[MF DEBUG] MIME     : ${mime}`)
  console.log(`[MF DEBUG] Tamaño API: ${formatSize(size)} (${size} bytes)`)
  console.log(`[MF DEBUG] Link     : ${fileLink}`)

  await conn.sendMessage(m.chat, {
    text: `🔍 *DEBUG 1 — Info de la API*\n\n📄 Archivo: ${filename}\n📦 Tamaño API: ${formatSize(size)}\n🔗 Link: ${fileLink}`
  }, { quoted: m })

  // ── DEBUG 2: HEAD para verificar tamaño real ──
  const realSize = await getRealSize(fileLink)
  console.log(`[MF DEBUG] HEAD real size: ${realSize !== null ? formatSize(realSize) : 'null'}`)

  await conn.sendMessage(m.chat, {
    text: `🔍 *DEBUG 2 — HEAD al link*\n\n📦 Tamaño real (HEAD): ${realSize !== null ? formatSize(realSize) : 'null (sin content-length)'}`
  }, { quoted: m })

  const finalSize = realSize ?? parseInt(size) ?? 0

  if (finalSize >= MAX_SIZE) {
    await m.react('❌')
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n❌ Archivo demasiado grande\n\n💀 Tamaño: ${formatSize(finalSize)}\n💀 Límite: 2 GB\n\n> Descárgalo manualmente desde Mediafire`
    }, { quoted: m })
  }

  if (finalSize >= WARN_SIZE) {
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n⚠️ Archivo grande (${formatSize(finalSize)}), esto puede tardar varios minutos...`
    }, { quoted: m })
  }

  await conn.sendMessage(m.chat, {
    text: `🩸 DENJI BOT 🩸\n\n⚰️ Descargando ${filename}...`
  }, { quoted: m })

  // ── Descarga real ──
  console.log(`[MF DEBUG] Iniciando GET al link...`)
  const fileRes = await fetch(fileLink, {
    timeout: 300000,
    redirect: 'follow'
  })

  // ── DEBUG 3: respuesta del GET ──
  const finalUrl = fileRes.url
  const statusGet = fileRes.status
  const ctGet = fileRes.headers.get('content-type')
  const clGet = fileRes.headers.get('content-length')

  console.log(`[MF DEBUG] GET → status: ${statusGet} | url final: ${finalUrl}`)
  console.log(`[MF DEBUG] GET → content-type: ${ctGet} | content-length: ${clGet}`)

  await conn.sendMessage(m.chat, {
    text: `🔍 *DEBUG 3 — GET respuesta*\n\n🌐 Status: ${statusGet}\n📄 Content-Type: ${ctGet}\n📦 Content-Length: ${clGet ? formatSize(clGet) : 'null'}\n🔗 URL final: ${finalUrl}`
  }, { quoted: m })

  if (!fileRes.ok) throw new Error(`HTTP ${statusGet} al descargar`)

  // Si el content-type es HTML, Mediafire devolvió una página de error
  if (ctGet && ctGet.includes('text/html')) {
    const html = await fileRes.text()
    console.log(`[MF DEBUG] Respuesta HTML (primeros 500 chars): ${html.substring(0, 500)}`)
    await conn.sendMessage(m.chat, {
      text: `🔍 *DEBUG 4 — HTML recibido (error)*\n\n${html.substring(0, 300)}`
    }, { quoted: m })
    throw new Error('Mediafire devolvió HTML en vez del archivo (link expirado o bloqueado)')
  }

  const buffer = Buffer.from(await fileRes.arrayBuffer())

  // ── DEBUG 4: buffer resultado ──
  console.log(`[MF DEBUG] Buffer descargado: ${formatSize(buffer.length)} (${buffer.length} bytes)`)
  console.log(`[MF DEBUG] Primeros bytes (hex): ${buffer.slice(0, 16).toString('hex')}`)

  await conn.sendMessage(m.chat, {
    text: `🔍 *DEBUG 4 — Buffer descargado*\n\n📦 Tamaño buffer: ${formatSize(buffer.length)}\n🔢 Primeros bytes (hex): ${buffer.slice(0, 16).toString('hex')}`
  }, { quoted: m })

  if (buffer.length < 1024) {
    const preview = buffer.toString('utf8').substring(0, 200)
    console.log(`[MF DEBUG] Buffer muy pequeño, contenido: ${preview}`)
    await conn.sendMessage(m.chat, {
      text: `🔍 *DEBUG 5 — Buffer sospechoso*\n\nContenido: ${preview}`
    }, { quoted: m })
    throw new Error(`Archivo descargado muy pequeño (${buffer.length} bytes)`)
  }

  if (finalSize > 0 && buffer.length < finalSize * 0.95) {
    console.log(`[MF DEBUG] Buffer incompleto: esperado ${finalSize}, obtenido ${buffer.length}`)
    await conn.sendMessage(m.chat, {
      text: `🔍 *DEBUG 5 — Descarga incompleta*\n\nEsperado: ${formatSize(finalSize)}\nObtenido: ${formatSize(buffer.length)}`
    }, { quoted: m })
    throw new Error(`Descarga incompleta: esperado ${formatSize(finalSize)}, obtenido ${formatSize(buffer.length)}`)
  }

  console.log(`[MF DEBUG] ✅ Buffer OK, enviando a WhatsApp...`)

  await conn.sendMessage(m.chat, {
    document: buffer,
    fileName: filename,
    mimetype: mime,
    caption: `🩸 DENJI BOT 🩸\n\n🔪 Descarga completada\n\n💀 Archivo: ${filename}\n💀 Tamaño real: ${formatSize(buffer.length)}\n💀 Tipo: ${mime}`
  }, { quoted: m })

  console.log(`[MF DEBUG] ✅ Enviado correctamente`)
  console.log(`[MF DEBUG] ─────────────────────────────`)
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
      console.log(`[MF DEBUG] Consultando API carpeta: ${apiUrl}`)
      const res = await fetch(apiUrl, { timeout: 30000 })
      const json = await res.json()
      console.log(`[MF DEBUG] Respuesta API carpeta:`, JSON.stringify(json).substring(0, 500))

      if (!json.status || !json.data?.length) throw new Error('No se pudo obtener la carpeta')

      const archivos = json.data.slice(0, 10)
      const rows = archivos.map((file, i) => {
        const size = parseInt(file.size) || 0
        const tooLarge = size >= MAX_SIZE
        const icon = tooLarge ? '❌' : getIcon(file.mime)
        const sizeLabel = formatSize(file.size) + (tooLarge ? ' (muy grande)' : '')

        return {
          header: icon + ' ' + (file.mime || 'archivo').split('/')[1]?.toUpperCase(),
          title: (file.filename || 'Sin nombre').substring(0, 35),
          description: `💀 ${sizeLabel} | 📅 ${file.uploaded?.split(' ')[0] || '?'}`,
          id: 'mfdl_' + i + '_' + Buffer.from(file.link).toString('base64') + '_' + Buffer.from(file.filename || 'file').toString('base64') + '_' + (file.mime || 'application/octet-stream') + '_' + (file.size || '0')
        }
      })

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: 'DENJI BOT - MEDIAFIRE', subtitle: 'Selecciona un archivo', hasMediaAttachment: false },
        body: { text: `🩸 DENJI BOT 🩸\n\n🔪 Carpeta encontrada\n💀 ${json.data.length} archivos\n\n❌ = mayor a 2GB (no descargable)\n\n> Elige uno para descargar` },
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
      console.log(`[MF DEBUG] Error carpeta:`, e)
      await m.react('💀')
      conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error al obtener carpeta: ' + e.message }, { quoted: m })
    }
    return
  }

  // ── ARCHIVO INDIVIDUAL ──
  if (isFileUrl(text)) {
    try {
      const apiUrl = `https://api.delirius.store/download/mediafire?url=${encodeURIComponent(text)}`
      console.log(`[MF DEBUG] Consultando API archivo: ${apiUrl}`)
      const res = await fetch(apiUrl, { timeout: 30000 })
      const json = await res.json()
      console.log(`[MF DEBUG] Respuesta API archivo:`, JSON.stringify(json))

      if (!json.status || !json.data) throw new Error('No se pudo obtener el archivo')

      const file = Array.isArray(json.data) ? json.data[0] : json.data
      if (!file?.link) throw new Error('Sin link de descarga')

      await downloadAndSend(conn, m, file.link, file.filename || 'archivo', file.mime || 'application/octet-stream', file.size)
      await m.react('🩸')

    } catch (e) {
      console.log(`[MF DEBUG] Error archivo:`, e)
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
    const size = parts[5] || '0'
    const fileLink = Buffer.from(linkBase64, 'base64').toString()
    const filename = Buffer.from(nameBase64, 'base64').toString()

    await m.react('⚰️')
    await downloadAndSend(conn, m, fileLink, filename, mime, size)
    await m.react('🩸')
    return true

  } catch (e) {
    console.log(`[MF DEBUG] Error handler.before:`, e)
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
