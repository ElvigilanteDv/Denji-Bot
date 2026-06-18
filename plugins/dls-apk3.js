// © 2026 EL VIGILANTE & BRAYANRK - DENJI BOT
// HappyMod scraper - busca, resuelve descarga y envía APK si el servidor lo expone

import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const SEP = '|~|'
const BASE = 'https://download.happymod.to'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

// Carpeta temporal local del proyecto, evita EACCES en /tmp dentro de Termux
const TEMP_DIR = path.join(process.cwd(), 'tmp')

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }
}

async function getHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    redirect: 'follow'
  })

  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
  return await res.text()
}

async function downloadFile(url, outPath, redirectCount = 0) {
  if (redirectCount > 8) throw new Error('Demasiados redirects')

  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http
    const file = fs.createWriteStream(outPath)

    const req = client.get(url, {
      headers: {
        'User-Agent': UA,
        'Referer': url,
        'Accept': '*/*'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        const nextUrl = new URL(res.headers.location, url).toString()
        return resolve(downloadFile(nextUrl, outPath, redirectCount + 1))
      }

      if (res.statusCode !== 200) {
        file.close(() => fs.unlink(outPath, () => {}))
        return reject(new Error(`HTTP ${res.statusCode}`))
      }

      res.pipe(file)
      file.on('finish', () => file.close(() => resolve(outPath)))
      file.on('error', err => {
        file.close(() => fs.unlink(outPath, () => {}))
        reject(err)
      })
    })

    req.on('error', err => {
      file.close(() => fs.unlink(outPath, () => {}))
      reject(err)
    })
  })
}

async function searchHappymod(query) {
  const url = new URL(`${BASE}/search.html`)
  url.searchParams.set('q', query)

  try {
    const html = await getHtml(url.toString())
    const $ = cheerio.load(html)
    const results = []

    $('a[href*="-mod/"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const match = href.match(/(\/[^/]+-mod\/[^/]+\/?)/)
      if (!match) return

      const appPath = match[1].replace(/\/$/, '')
      let name = text
        .replace(/mod apk.*/i, '')
        .replace(/download.*/i, '')
        .trim()

      if (!name) {
        name = appPath.split('/')[2]?.replace(/-/g, ' ') || 'Unknown App'
      }

      if (!results.find(r => r.path === appPath) && results.length < 8) {
        results.push({ name, path: appPath })
      }
    })

    return results
  } catch (error) {
    console.error('[HAPPYMOD SEARCH ERROR]', error)
    return []
  }
}

async function getAppDetail(appPath) {
  const url = `${BASE}${appPath}/`
  const html = await getHtml(url)
  const $ = cheerio.load(html)

  const name = $('h1').first().text()
    .replace(/v[\d.]+\s*mod apk.*/i, '')
    .replace(/mod apk.*/i, '')
    .trim()

  const icon = $('img').first().attr('src') || ''

  const tableData = {}
  $('table tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length >= 2) {
      const key = $(cells[0]).text().trim().toLowerCase()
      const val = $(cells[1]).text().trim()
      tableData[key] = val
    }
  })

  const version = tableData['version'] || ''
  const modFeatures = tableData['mod feaures'] || tableData['mod features'] || tableData['mod'] || ''
  const category = tableData['category'] || ''
  const rating = tableData['rating'] || ''
  const requires = tableData['requires'] || ''
  const size = $('a[href*="download.html"]').first().text().match(/[\d.]+\s?MB/i)?.[0] || ''

  return { name, icon, version, modFeatures, category, rating, requires, size, path: appPath }
}

async function getVersions(appPath) {
  const url = `${BASE}${appPath}/download.html`
  const html = await getHtml(url)
  const $ = cheerio.load(html)
  const versions = []

  $('a[href*="downloading.html"], a[href*="download"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const fullText = $(el).text().replace(/\s+/g, ' ').trim()

    let version = ''
    const vFromHref = href.match(/\/([^/]+)\/downloading\.html$/)
    if (vFromHref?.[1] && vFromHref[1] !== 'downloading') version = vFromHref[1]

    if (!version) {
      const vFromText = fullText.match(/v?([\d]+\.[\d.]+)/i)
      version = vFromText?.[1] || 'latest'
    }

    const modText = fullText
      .replace(/.*?v?[\d]+\.[\d.]+/i, '')
      .replace(/^[\s-]+/, '')
      .replace(/mod\s*/i, '')
      .trim()
      .substring(0, 50) || 'Mod APK'

    const absoluteHref = /^https?:\/\//i.test(href) ? href : new URL(href, `${BASE}${appPath}/download.html`).toString()

    if (!versions.find(v => v.href === absoluteHref) && versions.length < 8) {
      versions.push({
        version,
        modText,
        href: absoluteHref,
        label: `v${version}${modText ? ' — ' + modText : ''}`.substring(0, 60)
      })
    }
  })

  return versions
}

async function getMirrorLink(downloadingUrl) {
  const html = await getHtml(downloadingUrl)
  const $ = cheerio.load(html)

  const candidates = []

  $('a[href], button, [data-href], [data-url]').each((_, el) => {
    const href =
      $(el).attr('href') ||
      $(el).attr('data-href') ||
      $(el).attr('data-url') ||
      ''

    const text = ($(el).text() || '').trim().toLowerCase()
    if (!href) return

    if (
      href.includes('.apk') ||
      href.includes('.xapk') ||
      href.includes('download') ||
      href.includes('server') ||
      text.includes('download') ||
      text.includes('apk') ||
      text.includes('xapk')
    ) {
      candidates.push(href)
    }
  })

  const normalized = [...new Set(candidates)]
    .map(u => /^https?:\/\//i.test(u) ? u : new URL(u, downloadingUrl).toString())
    .filter(u => /apk|xapk|download|server|downloading/i.test(u))

  if (normalized.length) return normalized[0]

  const htmlMatch =
    html.match(/https?:\/\/[^"'`\s>]+\.apk[^"'`\s>]*/i) ||
    html.match(/https?:\/\/[^"'`\s>]+\.xapk[^"'`\s>]*/i) ||
    html.match(/https?:\/\/[^"'`\s>]+download[^"'`\s>]*/i)

  if (htmlMatch?.[0]) return htmlMatch[0]

  return downloadingUrl
}

async function mostrarVersiones(conn, m, appPath, appName) {
  const detail = await getAppDetail(appPath)
  const name = detail.name || appName
  const versions = await getVersions(appPath)

  const infoLines = [
    '🩸 DENJI BOT 🩸',
    '',
    `😈 *${name}*`,
    detail.version ? `📌 Versión: ${detail.version}` : '',
    detail.modFeatures ? `🔥 MOD: ${detail.modFeatures}` : '',
    detail.category ? `🗂️ Categoría: ${detail.category}` : '',
    detail.size ? `💾 Tamaño: ${detail.size}` : '',
    detail.rating ? `⭐ Rating: ${detail.rating}` : '',
    detail.requires ? `📱 Android: ${detail.requires}` : '',
  ].filter(Boolean).join('\n')

  await conn.sendMessage(m.chat, { text: infoLines }, { quoted: m })

  if (!versions.length) {
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 No se encontraron versiones\n\n📥 Descarga manual:\n${BASE}${appPath}/download.html`
    }, { quoted: m })
    await m.react('💀')
    return
  }

  const rows = versions.map(v => ({
    header: '💾',
    title: `v${v.version}`.substring(0, 35),
    description: v.modText.substring(0, 50),
    id: 'hmoddl' + SEP + Buffer.from(v.href).toString('base64url')
  }))

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: {
      title: 'HAPPYMOD - VERSIONES',
      subtitle: name,
      hasMediaAttachment: false
    },
    body: {
      text: `🩸 DENJI BOT 🩸\n\n😈 *${name}*\n💀 ${rows.length} versiones disponibles\n\n> Elige cuál descargar`
    },
    footer: {
      text: '🩸 DENJI BOT 🩸 | happymod.to'
    },
    nativeFlowMessage: {
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '💾 VERSIONES MOD',
          sections: [{ title: 'ELIGE UNA', rows }]
        })
      }]
    }
  })

  const msg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: {
      message: {
        messageContextInfo: {},
        interactiveMessage
      }
    }
  }, { quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  await m.react('🩸')
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const query = text?.trim()

  if (!query) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n😈 *HappyMod MOD APK Scraper*\n\n> ${usedPrefix}${command} <nombre del juego/app>\n> Ejemplo: ${usedPrefix}${command} minecraft`
    }, { quoted: m })
  }

  await m.react('🩸')

  try {
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔍 Buscando *${query}* en HappyMod...`
    }, { quoted: m })

    const results = await searchHappymod(query)

    if (!results.length) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n💀 Sin resultados para *${query}* en HappyMod\n> Prueba con otro nombre o en inglés`
      }, { quoted: m })
    }

    if (results.length === 1) {
      return await mostrarVersiones(conn, m, results[0].path, results[0].name)
    }

    const rows = results.map(app => ({
      header: '😈',
      title: app.name.substring(0, 35),
      description: app.path.split('/')[2] || 'mod apk',
      id: 'hmod' + SEP + Buffer.from(app.path).toString('base64url') + SEP + Buffer.from(app.name).toString('base64url')
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: 'DENJI BOT - HAPPYMOD',
        subtitle: 'MOD APKs',
        hasMediaAttachment: false
      },
      body: {
        text: `🩸 DENJI BOT 🩸\n\n😈 HappyMod — *${query}*\n💀 ${rows.length} resultados\n\n> Elige cuál descargar`
      },
      footer: {
        text: '🩸 DENJI BOT 🩸 | happymod.to'
      },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '😈 RESULTADOS',
            sections: [{ title: query.toUpperCase().substring(0, 24), rows }]
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {},
          interactiveMessage
        }
      }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.error('[HAPPYMOD]', e)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error: ${e.message}`
    }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id) return false

    if (id.startsWith('hmod' + SEP) && !id.startsWith('hmoddl' + SEP)) {
      const payload = id.slice(('hmod' + SEP).length)
      const parts = payload.split(SEP)
      const appPath = Buffer.from(parts[0], 'base64url').toString()
      const appName = Buffer.from(parts[1], 'base64url').toString()

      await m.react('⏳')
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n😈 Obteniendo info de *${appName}*...`
      }, { quoted: m })

      await mostrarVersiones(conn, m, appPath, appName)
      return true
    }

    if (id.startsWith('hmoddl' + SEP)) {
      const payload = id.slice(('hmoddl' + SEP).length)
      const downloadingUrl = Buffer.from(payload, 'base64url').toString()

      await m.react('⚰️')
      await conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n⚰️ Obteniendo link de descarga...'
      }, { quoted: m })

      let directUrl = ''
      try {
        directUrl = await getMirrorLink(downloadingUrl)
      } catch (e) {
        console.error('[HAPPYMOD MIRROR]', e)
      }

      if (!directUrl) directUrl = downloadingUrl

      ensureTempDir()
      const ext = /\.xapk(\?|$)/i.test(directUrl) ? '.xapk' : '.apk'
      const fileName = path.join(TEMP_DIR, `happymod-${Date.now()}${ext}`)

      try {
        await conn.sendMessage(m.chat, {
          text: `🩸 DENJI BOT 🩸\n\n📥 Descargando archivo...\n> Esto puede tardar un poco`
        }, { quoted: m })

        await downloadFile(directUrl, fileName)

        await conn.sendMessage(m.chat, {
          document: fs.readFileSync(fileName),
          mimetype: ext === '.xapk'
            ? 'application/octet-stream'
            : 'application/vnd.android.package-archive',
          fileName: `HappyMod${ext}`,
          caption: `🩸 DENJI BOT 🩸\n\n😈 *MOD ${ext.toUpperCase().replace('.', '')} — HappyMod*`
        }, { quoted: m })

        fs.unlink(fileName, () => {})
        await m.react('🩸')
      } catch (e) {
        console.error('[HAPPYMOD DOWNLOAD]', e)

        await conn.sendMessage(m.chat, {
          text: `🩸 DENJI BOT 🩸\n\n⚠️ No se pudo descargar el archivo automáticamente.\n\n📥 Abre esto manualmente:\n${downloadingUrl}`
        }, { quoted: m })

        await m.react('⚠️')
      }

      return true
    }

    return false
  } catch (e) {
    console.error('[HAPPYMOD BEFORE]', e)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error: ${e.message}`
    }, { quoted: m })
    return true
  }
}

handler.help = ['apk3']
handler.tags = ['downloader']
handler.command = /^(apk3|hmod|modapk)$/i
handler.desc = 'Busca y descarga MOD APKs de HappyMod (happymod.to)'

export default handler
