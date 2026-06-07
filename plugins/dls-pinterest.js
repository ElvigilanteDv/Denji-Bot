import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const ORIGIN = "https://www.pinterest.com"
const ENDPOINT = `${ORIGIN}/resource/BaseSearchResource/get/`

function buildHeaders(sourceUrl) {
  return {
    "Accept": "application/json, text/javascript, */*, q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "X-APP-VERSION": "0ddf807",
    "X-Pinterest-AppState": "active",
    "X-Pinterest-Source-Url": sourceUrl,
    "X-Pinterest-PWS-Handler": "www/search/[scope].js",
    "screen-dpr": "1.84",
    "Referer": `${ORIGIN}${sourceUrl}`,
    "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.163 Mobile Safari/537.36"
  }
}

function buildUrl(query, scope, bookmark, pageSize) {
  const rs = "typed"
  const sourceUrl = `/search/${scope}/?q=${encodeURIComponent(query)}&rs=${encodeURIComponent(rs)}`
  const options = {
    query, scope, rs,
    redux_normalize_feed: true,
    source_url: sourceUrl,
    static_feed: false,
    page_size: pageSize,
    ...(bookmark ? { bookmarks: [bookmark] } : {})
  }
  const data = encodeURIComponent(JSON.stringify({ options, context: {} }))
  return `${ENDPOINT}?source_url=${encodeURIComponent(sourceUrl)}&data=${data}&_=${Date.now()}`
}

function isMp4(url) {
  if (!url) return false
  return String(url).split("?")[0].toLowerCase().endsWith(".mp4")
}

function pickMp4(videoList) {
  if (!videoList || typeof videoList !== "object") return null
  const order = ["V_1080P", "V_720P", "V_480P", "V_360P", "V_240P", "V_144P"]
  for (const k of order) {
    const u = videoList[k]?.url
    if (isMp4(u)) return u
  }
  for (const k of Object.keys(videoList)) {
    const u = videoList[k]?.url
    if (isMp4(u)) return u
  }
  return null
}

function extractVideoUrl(pin) {
  const direct = pickMp4(pin?.videos?.video_list)
  if (direct) return direct
  const pages = [
    ...(Array.isArray(pin?.story_pin_data?.pages) ? pin.story_pin_data.pages : []),
    ...(Array.isArray(pin?.story_pin_data?.pages_preview) ? pin.story_pin_data.pages_preview : [])
  ]
  for (const page of pages) {
    for (const block of (Array.isArray(page?.blocks) ? page.blocks : [])) {
      const u = pickMp4(block?.video?.video_list)
      if (u) return u
    }
  }
  return null
}

function extractImageUrl(pin) {
  const img = pin.images || {}
  return img["orig"]?.url || img["736x"]?.url || img["474x"]?.url || img["236x"]?.url || null
}

function getLikes(pin) {
  const rc = pin.reaction_counts
  if (rc && typeof rc === "object") return Number(rc["1"]) || Number(rc[1]) || 0
  return 0
}

function formatLikes(n) {
  if (n < 1000) return String(n)
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k`
}

function pinUrl(pin) {
  return pin?.id ? `https://www.pinterest.com/pin/${pin.id}/` : null
}

async function fetchPage(query, scope, bookmark, pageSize) {
  const sourceUrl = `/search/${scope}/?q=${encodeURIComponent(query)}&rs=typed`
  const url = buildUrl(query, scope, bookmark, pageSize)
  const resp = await fetch(url, { headers: buildHeaders(sourceUrl) })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const json = await resp.json()
  const rr = json.resource_response
  if (!rr || rr.code !== 0) throw new Error(`Pinterest error: ${rr?.message || "unknown"}`)
  return {
    results: Array.isArray(rr.data?.results) ? rr.data.results : [],
    bookmark: rr.bookmark && rr.bookmark !== "-end-" ? rr.bookmark : null
  }
}

async function buildVideoLookup(query, maxPages, pageSize) {
  const byId = new Map()
  let bookmark = null
  for (let page = 0; page < maxPages; page++) {
    const current = await fetchPage(query, "videos", bookmark, pageSize)
    for (const pin of current.results) {
      const u = extractVideoUrl(pin)
      if (isMp4(u) && pin.id) byId.set(String(pin.id), u)
    }
    if (!current.bookmark) break
    bookmark = current.bookmark
  }
  return byId
}

function normalizePin(pin, videoLookup) {
  const pinner = pin.pinner || {}
  const localVideo = extractVideoUrl(pin)
  const lookupVideo = videoLookup.get(String(pin.id || "")) || null
  const videoUrl = (isMp4(localVideo) ? localVideo : null) || (isMp4(lookupVideo) ? lookupVideo : null)
  const isVideo = Boolean(videoUrl)
  const likes = getLikes(pin)
  return {
    id: pin.id,
    titulo: String(pin.title || pin.grid_title || "").trim() || null,
    autor: String(pinner.full_name || pinner.username || "").trim() || null,
    likes: formatLikes(likes),
    tipo: isVideo ? "video" : "imagen",
    url: pinUrl(pin),
    descarga: isVideo ? videoUrl : extractImageUrl(pin)
  }
}

async function searchPinterest(query, limit) {
  const pageSize = 25
  const maxPages = 3
  const collected = []
  let bookmark = null
  for (let page = 0; page < maxPages && collected.length < limit; page++) {
    const current = await fetchPage(query, "pins", bookmark, pageSize)
    collected.push(...current.results.filter(p => p && p.type === "pin"))
    if (!current.bookmark) break
    bookmark = current.bookmark
  }
  const needsVideo = collected.some(p => p.is_video)
  const videoLookup = needsVideo ? await buildVideoLookup(query, maxPages, pageSize) : new Map()
  const seen = new Set()
  const results = []
  for (const pin of collected) {
    const u = pinUrl(pin)
    if (!u || seen.has(u)) continue
    seen.add(u)
    const normalized = normalizePin(pin, videoLookup)
    if (!normalized.descarga) continue
    results.push(normalized)
    if (results.length >= limit) break
  }
  return results
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'DENJI BOT - PINTEREST', subtitle: 'Busca imágenes y videos', hasMediaAttachment: false },
      body: { text: `🩸 DENJI BOT 🩸\n\n🔪 Busca imágenes y videos en Pinterest\n\n> ${usedPrefix}${command} <búsqueda>\n> Ejemplo: ${usedPrefix}${command} Chainsaw Man` },
      footer: { text: '🩸 DENJI BOT 🩸' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🔍 BÚSQUEDAS RÁPIDAS',
            sections: [{
              title: '💀 POPULARES',
              rows: [
                { header: '🗡️', title: 'Anime', description: 'Imágenes de anime', id: 'pin_Anime' },
                { header: '🩸', title: 'Chainsaw Man', description: 'Imágenes de Chainsaw Man', id: 'pin_Chainsaw Man' },
                { header: '💀', title: 'Dark Art', description: 'Arte oscuro', id: 'pin_Dark Art' },
                { header: '🔥', title: 'Wallpaper', description: 'Fondos de pantalla', id: 'pin_Wallpaper' }
              ]
            }]
          })
        }]
      }
    })
    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    return
  }

  await m.react('🩸')

  try {
    const resultados = await searchPinterest(text, 10)

    if (!resultados.length) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 Sin resultados para: ' + text
      }, { quoted: m })
    }

    const rows = resultados.map((pin, i) => ({
      header: pin.tipo === 'video' ? '🎬 VIDEO' : '🖼️ IMAGEN',
      title: (pin.titulo || 'Sin título').substring(0, 35),
      description: '💀 ' + (pin.autor || 'Desconocido') + ' | ❤️ ' + pin.likes,
      id: 'pindl_' + i + '_' + Buffer.from(pin.descarga).toString('base64').slice(0, 200) + '_' + pin.tipo
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'DENJI BOT - PINTEREST', subtitle: 'Selecciona un resultado', hasMediaAttachment: false },
      body: { text: '🩸 DENJI BOT 🩸\n\n🔪 Búsqueda: ' + text + '\n💀 ' + resultados.length + ' resultados\n\n> Elige uno' },
      footer: { text: '🩸 DENJI BOT 🩸' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '📌 RESULTADOS',
            sections: [{ title: '📋 ' + text.toUpperCase(), rows }]
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
    conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error al buscar: ' + e.message }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null

    // Búsquedas rápidas del menú inicial
    if (id?.startsWith('pin_')) {
      const query = id.replace('pin_', '')
      const resultados = await searchPinterest(query, 10)
      if (!resultados.length) {
        return conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Sin resultados' }, { quoted: m })
      }
      const rows = resultados.map((pin, i) => ({
        header: pin.tipo === 'video' ? '🎬 VIDEO' : '🖼️ IMAGEN',
        title: (pin.titulo || 'Sin título').substring(0, 35),
        description: '💀 ' + (pin.autor || 'Desconocido') + ' | ❤️ ' + pin.likes,
        id: 'pindl_' + i + '_' + Buffer.from(pin.descarga).toString('base64').slice(0, 200) + '_' + pin.tipo
      }))
      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: 'DENJI BOT - PINTEREST', subtitle: query, hasMediaAttachment: false },
        body: { text: '🩸 DENJI BOT 🩸\n\n🔪 Búsqueda: ' + query + '\n💀 ' + resultados.length + ' resultados\n\n> Elige uno' },
        footer: { text: '🩸 DENJI BOT 🩸' },
        nativeFlowMessage: {
          buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '📌 RESULTADOS',
              sections: [{ title: '📋 ' + query.toUpperCase(), rows }]
            })
          }]
        }
      })
      const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
      }, { quoted: m })
      await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
      return true
    }

    // Descarga del pin seleccionado
    if (!id?.startsWith('pindl_')) return false

    const parts = id.split('_')
    const urlBase64 = parts[2]
    const tipo = parts[3]
    const descargaUrl = Buffer.from(urlBase64, 'base64').toString()

    await m.react('⚰️')
    await conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n🔪 Descargando...' }, { quoted: m })

    if (tipo === 'video') {
      await conn.sendMessage(m.chat, {
        video: { url: descargaUrl },
        caption: '🩸 DENJI BOT 🩸\n\n🔪 Descarga completada\n\n💀 Pinterest'
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        image: { url: descargaUrl },
        caption: '🩸 DENJI BOT 🩸\n\n🔪 Descarga completada\n\n💀 Pinterest'
      }, { quoted: m })
    }

    await m.react('🩸')
    return true

  } catch (e) {
    console.log(e)
    await m.react('💀')
    conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error: ' + e.message }, { quoted: m })
    return true
  }
}

handler.help = ['pinterest']
handler.tags = ['downloader']
handler.command = /^(pinterest|pin|pt)$/i
handler.desc = 'Busca y descarga imágenes y videos de Pinterest'

export default handler
