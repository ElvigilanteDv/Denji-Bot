import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
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

const scrapeMediafireFile = async (pageUrl) => {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  }

  const res = await fetch(pageUrl, { headers, redirect: 'follow', timeout: 30000 })
  const html = await res.text()
  const $ = cheerio.load(html)

  let directLink = null


  const btn = $('a#downloadButton, a.input.btn.btn-skyblue[href*="download"], a[id*="download"][href*="mediafire"]')
  if (btn.length) {
    directLink = btn.first().attr('href')
  }


  if (!directLink) {
    $('script').each((_, el) => {
      const src = $(el).html() || ''
      const match = src.match(/https:\/\/download\d+\.mediafire\.com\/[^"'\s]+/)
      if (match) directLink = match[0]
    })
  }

  if (!directLink) {
    const match = html.match(/https:\/\/download\d+\.mediafire\.com\/[^"'\s<>]+/)
    if (match) directLink = match[0]
  }

  if (!directLink) throw new Error('No se encontró link de descarga (posible captcha o archivo eliminado)')


  directLink = directLink.replace(/&amp;/g, '&').trim()


  const filename = $('div.filename, .dl-btn-label, #filename').first().text().trim()
    || directLink.split('/').pop().replace(/\+/g, ' ') || 'archivo'

  const sizeText = $('ul.details li:nth-child(2) span, .dl-btn-data, .details li span').first().text().trim()
  const mime = getMimeFromFilename(filename)

  console.log(`[MF DEBUG] Scraped → link: ${directLink}`)
  console.log(`[MF DEBUG] Scraped → filename: ${filename} | size: ${sizeText}`)

  return { link: directLink, filename, sizeText, mime }
}

const getMimeFromFilename = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map = {
    apk: 'application/vnd.android.package-archive',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    mp4: 'video/mp4',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    exe: 'application/x-msdownload',
    iso: 'application/x-iso9660-image',
  }
  return map[ext] || 'application/octet-stream'
}

const parseSize = (sizeText) => {
  if (!sizeText) return 0
  const match = sizeText.match(/([\d.]+)\s*(GB|MB|KB|B)/i)
  if (!match) return 0
  const n = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  if (unit === 'GB') return n * 1e9
  if (unit === 'MB') return n * 1e6
  if (unit === 'KB') return n * 1e3
  return n
}

const downloadAndSend = async (conn, m, pageUrl, filenameHint, mimeHint, sizeHint) => {
  await conn.sendMessage(m.chat, {
    text: `🩸 DENJI BOT 🩸\n\n🔍 Obteniendo link directo...`
  }, { quoted: m })

  const scraped = await scrapeMediafireFile(pageUrl)
  const filename = scraped.filename || filenameHint || 'archivo'
  const mime = scraped.mime || mimeHint || 'application/octet-stream'
  const sizeBytes = parseSize(scraped.sizeText) || parseInt(sizeHint) || 0

  console.log(`[MF DEBUG] Size calculado: ${formatSize(sizeBytes)}`)

  await conn.sendMessage(m.chat, {
    text: `🔍 *Link directo obtenido*\n\n📄 ${filename}\n📦 ${scraped.sizeText || formatSize(sizeBytes)}`
  }, { quoted: m })

  if (sizeBytes >= MAX_SIZE) {
    await m.react('❌')
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n❌ Archivo demasiado grande\n\n💀 Tamaño: ${scraped.sizeText || formatSize(sizeBytes)}\n💀 Límite: 2 GB\n\n> Descárgalo manualmente desde Mediafire`
    }, { quoted: m })
  }

  if (sizeBytes >= WARN_SIZE) {
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n⚠️ Archivo grande (${scraped.sizeText}), esto puede tardar varios minutos...`
    }, { quoted: m })
  }

  await conn.sendMessage(m.chat, {
    text: `🩸 DENJI BOT 🩸\n\n⚰️ Descargando ${filename}...`
  }, { quoted: m })

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.mediafire.com/',
  }

  const fileRes = await fetch(scraped.link, { headers, redirect: 'follow', timeout: 300000 })

  const ctGet = fileRes.headers.get('content-type')
  const clGet = fileRes.headers.get('content-length')
  console.log(`[MF DEBUG] GET final → status: ${fileRes.status} | ct: ${ctGet} | cl: ${clGet}`)

  if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status} al descargar`)
  if (ctGet?.includes('text/html')) throw new Error('Mediafire bloqueó la descarga (HTML recibido)')

  const buffer = Buffer.from(await fileRes.arrayBuffer())
  console.log(`[MF DEBUG] Buffer: ${formatSize(buffer.length)}`)

  if (buffer.length < 1024) throw new Error(`Archivo muy pequeño (${buffer.length} bytes)`)

  await conn.sendMessage(m.chat, {
    document: buffer,
    fileName: filename,
    mimetype: mime,
    caption: `🩸 DENJI BOT 🩸\n\n🔪 Descarga completada\n\n💀 Archivo: ${filename}\n💀 Tamaño: ${formatSize(buffer.length)}\n💀 Tipo: ${mime}`
  }, { quoted: m })
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

  if (isFolderUrl(text)) {
    try {
      const apiUrl = `https://api.delirius.store/download/mediafire?url=${encodeURIComponent(text)}`
      const res = await fetch(apiUrl, { timeout: 30000 })
      const json = await res.json()

      if (!json.status || !json.data?.length) throw new Error('No se pudo obtener la carpeta')

      const archivos = json.data.slice(0, 10)
      const rows = archivos.map((file, i) => {
        const size = parseSize(file.size)
        const tooLarge = size >= MAX_SIZE
        const icon = tooLarge ? '❌' : getIcon(file.mime)

        const pageUrl = `https://www.mediafire.com/file/${file.key || ''}/file`

        return {
          header: icon + ' ' + (file.extension || 'archivo').toUpperCase(),
          title: (file.filename || 'Sin nombre').substring(0, 35),
          description: `💀 ${file.size || '?'} | 📅 ${file.uploaded?.split(' ')[0] || '?'}`,
          id: 'mfdl_' + i + '_' + Buffer.from(file.link || pageUrl).toString('base64') + '_' + Buffer.from(file.filename || 'file').toString('base64') + '_' + (file.mime || 'application/octet-stream') + '_' + (file.size || '0')
        }
      })

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: 'DENJI BOT - MEDIAFIRE', subtitle: 'Selecciona un archivo', hasMediaAttachment: false },
        body: { text: `🩸 DENJI BOT 🩸\n\n🔪 Carpeta encontrada\n💀 ${json.data.length} archivos\n\n❌ = mayor a 2GB\n\n> Elige uno para descargar` },
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


  if (isFileUrl(text)) {
    try {

      const pageUrl = text.includes('/file/') ? text : `https://www.mediafire.com/file/${text}/file`
      await downloadAndSend(conn, m, pageUrl, null, null, 0)
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
