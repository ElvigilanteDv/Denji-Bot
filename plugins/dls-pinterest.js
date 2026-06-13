import fetch from 'node-fetch'

async function searchPinterest(query, limit) {
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

  const pageSize = 25
  const maxPages = 3
  const collected = []
  let bookmark = null

  for (let page = 0; page < maxPages && collected.length < limit * 2; page++) {
    const current = await fetchPage(query, "pins", bookmark, pageSize)
    collected.push(...current.results.filter(p => p && p.type === "pin"))
    if (!current.bookmark) break
    bookmark = current.bookmark
  }

  const seen = new Set()
  const results = []

  for (const pin of collected) {
    const u = pinUrl(pin)
    if (!u || seen.has(u)) continue
    seen.add(u)

    const videoUrl = extractVideoUrl(pin)
    const isMp4Pin = isMp4(videoUrl)
    const imageUrl = extractImageUrl(pin)
    const descarga = isMp4Pin ? videoUrl : imageUrl
    const tipo = isMp4Pin ? 'video' : 'imagen'

    if (!descarga) continue

    results.push({
      titulo: String(pin.title || pin.grid_title || '').trim() || null,
      tipo,
      descarga
    })

    if (results.length >= limit) break
  }

  return results
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    return conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '🔪 Busca y recibe imágenes/videos de Pinterest',
        '',
        `> ${usedPrefix}${command} <búsqueda>`,
        `> Ejemplo: ${usedPrefix}${command} Chainsaw Man`,
        '',
        '💀 Te manda hasta 10 resultados directo',
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }

  await m.react('🩸')

  try {
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔎 Buscando: *${text}*\n💀 Enviando resultados...`
    }, { quoted: m })

    const resultados = await searchPinterest(text, 10)

    if (!resultados.length) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 Sin resultados para: ' + text
      }, { quoted: m })
    }

    let enviados = 0
    let fallidos = 0

    for (let i = 0; i < resultados.length; i++) {
      const pin = resultados[i]
      try {
        if (pin.tipo === 'video') {
          await conn.sendMessage(m.chat, {
            video: { url: pin.descarga },
            caption: i === 0 ? `🩸 DENJI BOT 🩸\n\n🔪 Pinterest: *${text}*\n💀 ${resultados.length} resultados` : ''
          }, { quoted: i === 0 ? m : undefined })
        } else {
          await conn.sendMessage(m.chat, {
            image: { url: pin.descarga },
            caption: i === 0 ? `🩸 DENJI BOT 🩸\n\n🔪 Pinterest: *${text}*\n💀 ${resultados.length} resultados` : ''
          }, { quoted: i === 0 ? m : undefined })
        }
        enviados++
      } catch (e) {
        console.log(`[PIN] Falló resultado ${i}:`, e.message)
        fallidos++
      }
    }

    await m.react('🩸')

    if (fallidos > 0) {
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n✅ Enviados: *${enviados}*\n💀 Fallidos: *${fallidos}*`
      }, { quoted: m })
    }

  } catch (e) {
    console.log(e)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 Error al buscar: ' + e.message
    }, { quoted: m })
  }
}

handler.help = ['pinterest']
handler.tags = ['downloader']
handler.command = /^(pinterest|pin|pt)$/i
handler.desc = 'Busca y envía imágenes/videos de Pinterest directo'

export default handler
