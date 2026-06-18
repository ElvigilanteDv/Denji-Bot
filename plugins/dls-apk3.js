// © 2026 EL VIGILANTE & BRAYANRK - DENJI BOT
// HappyMod scraper con cheerio - No quitar créditos
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const SEP = '|~|'
const BASE_SEARCH = 'https://happymod.to'
const BASE_DL = 'https://download.happymod.to'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

// ─── Helpers de fetch ────────────────────────────────────────────────────────

async function getHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Referer': BASE_SEARCH
    },
    redirect: 'follow',
    timeout: 15000
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
  return res.text()
}

// ─── Scraper de búsqueda ─────────────────────────────────────────────────────

async function searchHappymod(query) {
  const url = `${BASE_SEARCH}/search/?q=${encodeURIComponent(query)}`
  const html = await getHtml(url)
  const $ = cheerio.load(html)
  const results = []

  // Cada resultado de búsqueda en happymod.to
  $('li.app-info-item, .search-list li, .mod-list li, .app-list li, li[class*="mod"], li[class*="app"]').each((_, el) => {
    const $el = $(el)
    const link = $el.find('a').first().attr('href') || ''
    const name = $el.find('.name, h3, .title, strong').first().text().trim()
    const pkg = $el.find('.package, .pkg, small').first().text().trim()
    const icon = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || ''
    const mod = $el.find('.mod-info, .mod, .features, em').first().text().trim()
    if (link && name) {
      results.push({ name, link, pkg, icon, mod })
    }
  })

  // Fallback: buscar cualquier enlace de app en la página
  if (!results.length) {
    $('a[href*="-mod/"]').each((_, el) => {
      const $el = $(el)
      const link = $el.attr('href') || ''
      const name = $el.find('img').attr('alt') || $el.text().trim() || ''
      const icon = $el.find('img').attr('src') || $el.find('img').attr('data-src') || ''
      if (link && name && !link.includes('javascript') && results.length < 8) {
        results.push({ name: name.replace(/mod apk.*/i, '').trim(), link, pkg: '', icon, mod: '' })
      }
    })
  }

  return results.slice(0, 8)
}

// ─── Scraper de detalle de app ───────────────────────────────────────────────

async function getAppDetail(appPath) {
  // appPath es el path relativo como /minecraft-pocket-edition.../com.mojang.minecraftpe/
  // Usamos el subdominio download que tiene mejor estructura
  const cleanPath = appPath.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '')
  const url = `${BASE_DL}${cleanPath}/`
  const html = await getHtml(url)
  const $ = cheerio.load(html)

  const name = $('h1').first().text().replace(/mod apk/i, '').trim() ||
               $('title').text().replace(/mod apk.*/i, '').trim()
  const icon = $('img').first().attr('src') || ''
  const version = $('table tr, .info-table tr').filter((_, el) =>
    /version/i.test($(el).find('td').first().text())
  ).find('td').last().text().trim() || ''
  const size = $('a[href*="download.html"]').first().text().match(/[\d.]+\s*MB/i)?.[0] || ''
  const rating = $('table tr').filter((_, el) =>
    /rating/i.test($(el).find('td').first().text())
  ).find('td').last().text().trim() || ''
  const modFeatures = $('table tr').filter((_, el) =>
    /mod feat/i.test($(el).find('td').first().text())
  ).find('td').last().text().trim() || ''
  const category = $('table tr').filter((_, el) =>
    /categ/i.test($(el).find('td').first().text())
  ).find('td').last().text().trim() || ''
  const requires = $('table tr').filter((_, el) =>
    /requir/i.test($(el).find('td').first().text())
  ).find('td').last().text().trim() || ''

  // Descarga: link al download.html de esta app
  const dlPageUrl = `${BASE_DL}${cleanPath}/download.html`

  return { name, icon, version, size, rating, modFeatures, category, requires, dlPageUrl, appPath: cleanPath }
}

// ─── Scraper de versiones disponibles ────────────────────────────────────────

async function getVersions(cleanPath) {
  const dlPageUrl = `${BASE_DL}${cleanPath}/download.html`
  const html = await getHtml(dlPageUrl)
  const $ = cheerio.load(html)
  const versions = []

  // Los links de versiones en download.html apuntan a /version/downloading.html
  $('a[href*="downloading.html"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    // Extraer versión del href o del texto
    const vMatch = href.match(/\/([^/]+)\/downloading\.html/) || text.match(/v([\d.]+)/)
    const version = vMatch?.[1] || text.substring(0, 40)
    // Extraer mods del texto
    const modText = text.replace(/minecraft.*?v?[\d.]+/i, '').replace(/mod/i, '').trim()
    if (href && version && versions.length < 6) {
      versions.push({ version, modText: modText || 'Mod', href })
    }
  })

  return versions
}

// ─── Obtener link de descarga del mirror ─────────────────────────────────────

async function getDirectDownload(downloadingUrl) {
  const html = await getHtml(downloadingUrl)
  const $ = cheerio.load(html)

  // El mirror en happymod.net sí da link directo
  const mirror = $('a[href*="happymod.net"][href*="download"]').attr('href') ||
                 $('a[href*="/download.html"]').filter((_, el) =>
                   $(el).attr('href')?.includes('happymod.net')
                 ).attr('href') || ''

  // También buscar en el texto de la página
  const mirrorMatch = html.match(/https:\/\/happymod\.net\/[^"'\s]+download\.html/)
  return mirror || mirrorMatch?.[0] || ''
}

// ─── Handler principal ───────────────────────────────────────────────────────

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const query = text?.trim()

  if (!query) return conn.sendMessage(m.chat, {
    text: `🩸 DENJI BOT 🩸\n\n😈 *HappyMod APK Scraper*\nMODs, hacks y APKs modificados\n\n> ${usedPrefix}${command} <nombre del juego/app>\n> Ejemplo: ${usedPrefix}${command} minecraft`
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
        text: `🩸 DENJI BOT 🩸\n\n💀 Sin resultados para *${query}* en HappyMod\n> Prueba con otro nombre`
      }, { quoted: m })
    }

    // Si hay 1 solo resultado, ir directo al detalle
    if (results.length === 1) {
      return await mostrarDetalle(conn, m, results[0].link, results[0].name)
    }

    // Mostrar lista con botones
    const rows = results.map(app => {
      const linkB64 = Buffer.from(app.link).toString('base64url')
      const nameB64 = Buffer.from(app.name).toString('base64url')
      return {
        header: '😈',
        title: app.name.substring(0, 35),
        description: (app.mod || app.pkg || 'MOD APK').substring(0, 50),
        id: 'hmod' + SEP + linkB64 + SEP + nameB64
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

// ─── Mostrar detalle + versiones de una app ───────────────────────────────────

async function mostrarDetalle(conn, m, appLink, appName) {
  try {
    const detail = await getAppDetail(appLink)
    const versions = await getVersions(detail.appPath)

    const infoLines = [
      '🩸 DENJI BOT 🩸',
      '',
      `😈 *${detail.name || appName}*`,
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
        text: `🩸 DENJI BOT 🩸\n\n💀 No se encontraron versiones descargables\n> Revisa manualmente: ${detail.dlPageUrl}`
      }, { quoted: m })
      await m.react('💀')
      return
    }

    // Mostrar versiones disponibles como botones
    const rows = versions.map(v => {
      const hrefB64 = Buffer.from(v.href).toString('base64url')
      const label = `v${v.version} — ${v.modText}`.substring(0, 35)
      return {
        header: '💾',
        title: label,
        description: v.modText.substring(0, 50) || 'MOD APK',
        id: 'hmoddl' + SEP + hrefB64
      }
    })

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'HAPPYMOD - VERSIONES', subtitle: detail.name || appName, hasMediaAttachment: false },
      body: { text: `🩸 DENJI BOT 🩸\n\n😈 *${detail.name || appName}*\n💀 ${rows.length} versiones disponibles\n\n> Elige cuál descargar` },
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

  } catch (e) {
    throw e
  }
}

// ─── Handler.before — respuesta a botones ────────────────────────────────────

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id) return false

    // Paso 1: eligió un juego → mostrar versiones
    if (id.startsWith('hmod' + SEP) && !id.startsWith('hmoddl' + SEP)) {
      const payload = id.slice(('hmod' + SEP).length)
      const parts = payload.split(SEP)
      const appLink = Buffer.from(parts[0], 'base64url').toString()
      const appName = Buffer.from(parts[1], 'base64url').toString()

      await m.react('⏳')
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n😈 Obteniendo info de *${appName}*...`
      }, { quoted: m })

      await mostrarDetalle(conn, m, appLink, appName)
      return true
    }

    // Paso 2: eligió una versión → obtener link directo y enviar
    if (id.startsWith('hmoddl' + SEP)) {
      const payload = id.slice(('hmoddl' + SEP).length)
      const downloadingUrl = Buffer.from(payload, 'base64url').toString()

      await m.react('⚰️')
      await conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n⚰️ Obteniendo link de descarga...'
      }, { quoted: m })

      // Intentar obtener mirror de happymod.net
      let directUrl = ''
      try {
        directUrl = await getDirectDownload(downloadingUrl)
      } catch {}

      if (!directUrl) {
        // Fallback: mandar el link de la página de descarga
        await conn.sendMessage(m.chat, {
          text: `🩸 DENJI BOT 🩸\n\n⚠️ No se pudo obtener el link directo automáticamente.\n\n📥 *Descarga desde aquí:*\n${downloadingUrl}\n\n> Abre el link, toca "Download" y el APK se descarga`
        }, { quoted: m })
        await m.react('⚠️')
        return true
      }

      // Tenemos mirror de happymod.net — enviar como documento
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n😈 Enviando MOD APK...\n> Esto puede tardar según el tamaño`
      }, { quoted: m })

      try {
        await conn.sendMessage(m.chat, {
          document: { url: directUrl },
          mimetype: 'application/vnd.android.package-archive',
          fileName: 'HappyMod_mod.apk',
          caption: `🩸 DENJI BOT 🩸\n\n😈 *MOD APK de HappyMod*\n\n> ⚠️ Desactiva Google Play Protect antes de instalar`
        }, { quoted: m })
        await m.react('🩸')
      } catch (sendErr) {
        // Si falla el envío directo, mandar el link
        await conn.sendMessage(m.chat, {
          text: `🩸 DENJI BOT 🩸\n\n⚠️ No pude enviar el APK directamente: ${sendErr.message}\n\n📥 *Descárgalo desde:*\n${directUrl}`
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
handler.command = /^(happymod|hmod|modapk)$/i
handler.desc = 'Busca y descarga MOD APKs de HappyMod (happymod.to)'

export default handler
