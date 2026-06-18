// © 2026 EL VIGILANTE & BRAYANRK - DENJI BOT
// HappyMod scraper - busca via Google, scrapea download.happymod.to con cheerio
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const SEP = '|~|'
const BASE_DL = 'https://download.happymod.to'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'


async function getHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    timeout: 20000
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
  return res.text()
}
──

// ─── Búsqueda Adaptada para happymod.to ────────────────────────────────────

async function searchHappymod(query) {
  // Apuntamos directamente a la URL de búsquedas de happymod.to
  const searchUrl = `https://happymod.to{encodeURIComponent(query)}`
  
  try {
    const html = await getHtml(searchUrl)
    const $ = cheerio.load(html)
    const results = []

    // En happymod.to, los resultados usan la clase '.pdt-app-box' o enlaces directos '-mod/'
    $('.pdt-app-box, .pd-list-item, a[href*="-mod/"]').each((_, el) => {
      let href = $(el).attr('href') || $(el).find('a').attr('href') || ''
      let text = $(el).text().trim()
      
      if (!href) return

      // Extraemos la ruta relativa del juego/app para tu comando
      const match = href.match(/(\/[^/]+-mod\/[^/]+\/?)/)
      
      if (match && results.length < 8) {
        const path = match[1].replace(/\/$/, '')
        
        // Limpiamos los textos basura del título para WhatsApp
        let name = text.split('\n')[0] 
          .replace(/mod apk.*/i, '')
          .replace(/download.*/i, '')
          .trim()
        
        // Si el contenedor no tenía texto limpio, usamos el nombre de la URL
        if (!name) {
          name = path.split('/')[2]?.replace(/-/g, ' ') || 'Unknown App'
        }
        
        // Evitamos meter la misma app dos veces en la lista
        if (!results.find(r => r.path === path)) {
          results.push({ name, path })
        }
      }
    })

    return results
  } catch (error) {
    console.error('[HAPPYMOD SEARCH ERROR]', error)
    return [] 
  }
}


// ─── Scraper de detalle de app (download.happymod.to) ────────────────────────

async function getAppDetail(path) {
  const url = `${BASE_DL}${path}/`
  const html = await getHtml(url)
  const $ = cheerio.load(html)

  const name = $('h1').first().text().replace(/v[\d.]+\s*mod apk.*/i, '').replace(/mod apk.*/i, '').trim()
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
  const size = $('a[href*="download.html"]').first().text().match(/[\d.]+ MB/i)?.[0] || ''

  return { name, icon, version, modFeatures, category, rating, requires, size, path }
}


async function getVersions(path) {
  const url = `${BASE_DL}${path}/download.html`
  const html = await getHtml(url)
  const $ = cheerio.load(html)
  const versions = []

  $('a[href*="downloading.html"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const fullText = $(el).text().replace(/\s+/g, ' ').trim()

    // Extraer versión del href
    const vFromHref = href.match(/\/([^/]+)\/downloading\.html$/)
    let version = vFromHref?.[1] || ''
    if (version === 'downloading') version = '' 

    const modText = fullText
      .replace(/.*?v?[\d]+\.[\d.]+/i, '')
      .replace(/^[\s-]+/, '')
      .replace(/mod\s*/i, '')
      .trim()
      .substring(0, 50) || 'Mod APK'

    if (!version) {
      const vFromText = fullText.match(/v?([\d]+\.[\d.]+)/)
      version = vFromText?.[1] || 'latest'
    }

    const hrefB64 = Buffer.from(href).toString('base64url')
    const label = `v${version}${modText ? ' — ' + modText : ''}`.substring(0, 60)

    if (!versions.find(v => v.href === href) && versions.length < 8) {
      versions.push({ version, modText, href, label })
    }
  })

  return versions
}


async function getMirrorLink(downloadingUrl) {
  const html = await getHtml(downloadingUrl)
  const $ = cheerio.load(html)

  const mirror = $('a[href*="happymod.net"]').filter((_, el) => {
    const href = $(el).attr('href') || ''
    return href.includes('download')
  }).attr('href')

  if (mirror) return mirror

  const match = html.match(/https?:\/\/happymod\.net\/[^"'\s]+download[^"'\s]*/i)
  return match?.[0] || ''
}


let handler = async (m, { conn, text, usedPrefix, command }) => {
  const query = text?.trim()

  if (!query) return conn.sendMessage(m.chat, {
    text: `🩸 DENJI BOT 🩸\n\n😈 *HappyMod MOD APK Scraper*\n\n> ${usedPrefix}${command} <nombre del juego/app>\n> Ejemplo: ${usedPrefix}${command} minecraft`
  }, { quoted: m })

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

    const rows = results.map(app => {
      const pathB64 = Buffer.from(app.path).toString('base64url')
      const nameB64 = Buffer.from(app.name).toString('base64url')
      return {
        header: '😈',
        title: app.name.substring(0, 35),
        description: app.path.split('/')[2] || 'mod apk',
        id: 'hmod' + SEP + pathB64 + SEP + nameB64
      }
    })

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'DENJI BOT - HAPPYMOD', subtitle: 'MOD APKs', hasMediaAttachment: false },
      body: { text: `🩸 DENJI BOT 🩸\n\n😈 HappyMod — *${query}*\n💀 ${rows.length} resultados\n\n> Elige cuál descargar` },
      footer: { text: '🩸 DENJI BOT 🩸 | happymod.to' },
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
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

  } catch (e) {
    console.error('[HAPPYMOD]', e)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error: ${e.message}`
    }, { quoted: m })
  }
}


async function mostrarVersiones(conn, m, path, appName) {
  const detail = await getAppDetail(path)
  const name = detail.name || appName

  const infoLines = [
    '🩸 DENJI BOT 🩸', '',
    `😈 *${name}*`,
    detail.version    ? `📌 Versión: ${detail.version}` : '',
    detail.modFeatures? `🔥 MOD: ${detail.modFeatures}` : '',
    detail.category   ? `🗂️ Categoría: ${detail.category}` : '',
    detail.size       ? `💾 Tamaño: ${detail.size}` : '',
    detail.rating     ? `⭐ Rating: ${detail.rating}` : '',
    detail.requires   ? `📱 Android: ${detail.requires}` : '',
  ].filter(Boolean).join('\n')

  await conn.sendMessage(m.chat, { text: infoLines }, { quoted: m })

  const versions = await getVersions(path)

  if (!versions.length) {
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 No se encontraron versiones\n> Descarga manual:\n${BASE_DL}${path}/download.html`
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
    header: { title: 'HAPPYMOD - VERSIONES', subtitle: name, hasMediaAttachment: false },
    body: { text: `🩸 DENJI BOT 🩸\n\n😈 *${name}*\n💀 ${rows.length} versiones disponibles\n\n> Elige cuál descargar` },
    footer: { text: '🩸 DENJI BOT 🩸 | happymod.to' },
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
    viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
  }, { quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  await m.react('🩸')
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
      const path = Buffer.from(parts[0], 'base64url').toString()
      const name = Buffer.from(parts[1], 'base64url').toString()
      await m.react('⏳')
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n😈 Obteniendo info de *${name}*...`
      }, { quoted: m })
      await mostrarVersiones(conn, m, path, name)
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
      try { directUrl = await getMirrorLink(downloadingUrl) } catch {}

      if (!directUrl) {
        await conn.sendMessage(m.chat, {
          text: `🩸 DENJI BOT 🩸\n\n⚠️ No se pudo obtener el APK directo.\n\n📥 *Descarga desde aquí:*\n${downloadingUrl}\n\n> Abre el link y toca "Download"`
        }, { quoted: m })
        await m.react('⚠️')
        return true
      }

      await conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n😈 Enviando MOD APK...'
      }, { quoted: m })

      try {
        await conn.sendMessage(m.chat, {
          document: { url: directUrl },
          mimetype: 'application/vnd.android.package-archive',
          fileName: 'HappyMod_mod.apk',
          caption: `🩸 DENJI BOT 🩸\n\n😈 *MOD APK — HappyMod*\n\n> ⚠️ Desactiva Google Play Protect antes de instalar`
        }, { quoted: m })
        await m.react('🩸')
      } catch (e) {
        await conn.sendMessage(m.chat, {
          text: `🩸 DENJI BOT 🩸\n\n⚠️ Fallo el envío: ${e.message}\n\n📥 Descárgalo manualmente:\n${directUrl}`
        }, { quoted: m })
        await m.react('⚠️')
      }
      return true
    }

    return false

  } catch (e) {
    console.error('[HAPPYMOD BEFORE]', e)
    await m.react('💀')
    conn.sendMessage(m.chat, {
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
