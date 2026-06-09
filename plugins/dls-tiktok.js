import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

global.ttSearchCache = global.ttSearchCache || {}

function getDiamonds(user = {}) {
  if (typeof user.diamantes === 'number') return user.diamantes
  if (typeof user.diamond === 'number') return user.diamond
  return 0
}

function setDiamonds(user = {}, amount = 0) {
  if (user.diamantes !== undefined) user.diamantes = amount
  else if (user.diamond !== undefined) user.diamond = amount
  else user.diamantes = amount
}

function getCacheKey(chat, sender) {
  return `${chat}:${sender}`
}

async function sendTikTokMenu(m, conn, usedPrefix, command) {
  const media = await prepareWAMessageMedia(
    { image: { url: 'https://files.catbox.moe/r60c8l.jpg' } },
    { upload: conn.waUploadToServer }
  )

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: {
      title: 'DENJI BOT - TIKTOK',
      subtitle: 'Busca y descarga videos',
      hasMediaAttachment: true,
      imageMessage: media.imageMessage
    },
    body: {
      text:
        '🩸 DENJI BOT 🩸\n\n' +
        '🔪 Busca videos en TikTok\n\n' +
        `> ${usedPrefix + command} <búsqueda>\n` +
        `> Ejemplo: ${usedPrefix + command} Chaewon\n` +
        '> 💎 Cuesta 1 diamante por descarga'
    },
    footer: { text: '🩸 DENJI BOT 🩸' },
    nativeFlowMessage: {
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🎵 TIKTOK',
          sections: [{
            title: '🔍 BUSCAR',
            rows: [{
              header: '🎬 VIDEO',
              title: 'Buscar video',
              description: '💎 1 diamante | Ejemplo: Chaewon',
              id: 'tt_example'
            }]
          }]
        })
      }]
    }
  })

  const msg = generateWAMessageFromContent(
    m.chat,
    { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
    { quoted: m }
  )

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

async function searchTikTok(query) {
  const url = `https://api.delirius.store/search/tiktoksearch?query=${encodeURIComponent(query)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Error HTTP en búsqueda: ${res.status}`)
  const json = await res.json()

  if (!json?.status || !Array.isArray(json?.meta) || !json.meta.length) {
    throw new Error('No se encontraron resultados')
  }

  return json.meta
}

async function downloadTikTok(url) {
  const endpoint = `https://api.delirius.store/download/tiktok?url=${encodeURIComponent(url)}`
  const res = await fetch(endpoint)
  if (!res.ok) throw new Error(`Error HTTP en descarga: ${res.status}`)
  const json = await res.json()

  if (!json?.status || !json?.data?.meta?.media?.[0]?.org) {
    throw new Error('No se pudo descargar')
  }

  return json
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const who = m.sender
  let user = global.db.data.users[who]

  if (!user) {
    global.db.data.users[who] = { diamantes: 0 }
    user = global.db.data.users[who]
  }

  if (!text) {
    await sendTikTokMenu(m, conn, usedPrefix, command)
    return
  }

  const query = text.trim()
  const isDirectLink = query.includes('tiktok.com') || query.includes('vm.tiktok.com')

  if (isDirectLink) {
    const currentDiamonds = getDiamonds(user)
    if (currentDiamonds < 1) {
      return conn.sendMessage(m.chat, {
        text:
          '🩸 DENJI BOT 🩸\n\n' +
          '💀 No tienes suficientes diamantes\n\n' +
          '> Necesitas: 1 diamante\n' +
          `> Tienes: ${currentDiamonds} diamantes\n\n` +
          '> Usa #work para ganar'
      }, { quoted: m })
    }

    await m.react('⚰️')

    try {
      const json = await downloadTikTok(query)
      const newTotal = currentDiamonds - 1
      setDiamonds(user, newTotal)

      const videoUrl = json.data.meta.media[0].org

      await conn.sendMessage(m.chat, {
        video: { url: videoUrl },
        caption:
          '🩸 DENJI BOT 🩸\n\n' +
          '🔪 Descarga completada\n\n' +
          `💀 Video: ${json.data.title || ''}\n` +
          `💀 Autor: ${json.data.author?.nickname || ''}\n` +
          `💀 Duración: ${json.data.duration || 0}s\n` +
          `🩸 Diamantes restantes: ${newTotal}`
      }, { quoted: m })

      await m.react('🩸')
    } catch (e) {
      console.log('TT DIRECT ERROR =>', e)
      await m.react('💀')
      await conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 Error al descargar'
      }, { quoted: m })
    }

    return
  }

  await m.react('🩸')

  try {
    const resultados = (await searchTikTok(query)).slice(0, 10)
    const primeraImagen = resultados[0]?.author?.avatar || ''
    const cacheKey = getCacheKey(m.chat, m.sender)

    global.ttSearchCache[cacheKey] = {
      query,
      results: resultados,
      createdAt: Date.now()
    }

    let media = null
    if (primeraImagen) {
      media = await prepareWAMessageMedia(
        { image: { url: primeraImagen } },
        { upload: conn.waUploadToServer }
      )
    }

    const rows = resultados.map((video, i) => ({
      header: '🎬 ' + (video.author?.nickname || video.author?.username || 'Desconocido'),
      title: (video.title || 'Sin título').substring(0, 35),
      description: `⏱️ ${video.duration || '?'}s | ❤️ ${video.like?.toLocaleString?.() || '?'}`,
      id: `ttdl_${i}`
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: 'DENJI BOT - TIKTOK',
        subtitle: 'Selecciona un video',
        hasMediaAttachment: !!media,
        imageMessage: media ? media.imageMessage : undefined
      },
      body: {
        text:
          '🩸 DENJI BOT 🩸\n\n' +
          `🔪 Búsqueda: ${query}\n\n` +
          '> Elige un video\n' +
          '> 💎 1 diamante al descargar'
      },
      footer: { text: '🩸 DENJI BOT 🩸' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎬 RESULTADOS',
            sections: [{
              title: '📋 ' + query.toUpperCase(),
              rows
            }]
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.log('TT SEARCH ERROR =>', e)
    await m.react('💀')
    await conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 No se encontraron resultados'
    }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  console.log('====== TT DEBUG START ======')
  try {
    console.log('m.sender =>', m.sender)
    console.log('m.chat =>', m.chat)
    console.log('m.key =>', JSON.stringify(m.key, null, 2))
    console.log('m.text =>', m.text)
    console.log('FULL MESSAGE RAW =>')
    console.dir(m.message, { depth: null })
    console.log('FULL MESSAGE JSON =>', JSON.stringify(m.message, null, 2))
  } catch (e) {
    console.log('DEBUG LOG ERROR =>', e)
  }

  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  console.log('nativeFlow exists? =>', !!nativeFlow)

  if (!nativeFlow) {
    console.log('====== TT DEBUG END (NO NATIVE FLOW) ======')
    return false
  }

  try {
    console.log('NATIVE FLOW RAW =>')
    console.dir(nativeFlow, { depth: null })
    console.log('NATIVE FLOW JSON =>', JSON.stringify(nativeFlow, null, 2))
    console.log('paramsJson =>', nativeFlow.paramsJson)

    const params = JSON.parse(nativeFlow.paramsJson || '{}')
    console.log('PARSED PARAMS =>', JSON.stringify(params, null, 2))

    const selectedId =
      params?.id ||
      params?.selectedId ||
      params?.selectedRowId ||
      params?.single_select_reply?.selected_row_id ||
      null

    console.log('selectedId =>', selectedId)

    if (!selectedId || !selectedId.startsWith('ttdl_')) {
      console.log('====== TT DEBUG END (INVALID selectedId) ======')
      return false
    }

    const index = Number(selectedId.replace('ttdl_', ''))
    console.log('index =>', index)

    if (Number.isNaN(index)) {
      console.log('====== TT DEBUG END (NaN index) ======')
      return false
    }

    const who = m.sender
    let user = global.db.data.users[who]

    if (!user) {
      global.db.data.users[who] = { diamantes: 0, diamond: 0 }
      user = global.db.data.users[who]
    }

    const cacheKey = getCacheKey(m.chat, m.sender)
    const cache = global.ttSearchCache[cacheKey]

    console.log('cacheKey =>', cacheKey)
    console.log('cache exists? =>', !!cache)
    console.log('cache =>', JSON.stringify(cache, null, 2))

    if (!cache || !Array.isArray(cache.results) || !cache.results[index]) {
      await conn.sendMessage(m.chat, {
        text:
          '🩸 DENJI BOT 🩸\n\n' +
          '💀 La búsqueda expiró o no encontré ese resultado\n\n' +
          '> Haz la búsqueda otra vez'
      }, { quoted: m })

      console.log('====== TT DEBUG END (CACHE MISS) ======')
      return true
    }

    const misDiamantes = getDiamonds(user)
    console.log('misDiamantes =>', misDiamantes)

    if (misDiamantes < 1) {
      await conn.sendMessage(m.chat, {
        text:
          '🩸 DENJI BOT 🩸\n\n' +
          '💀 No tienes 1 diamante\n\n' +
          '> Usa #work para ganar'
      }, { quoted: m })

      console.log('====== TT DEBUG END (NO DIAMONDS) ======')
      return true
    }

    const selectedVideo = cache.results[index]
    const selectedVideoUrl = selectedVideo.url
    const fallbackTitle = selectedVideo.title || 'Sin título'

    console.log('selectedVideo =>', JSON.stringify(selectedVideo, null, 2))
    console.log('selectedVideoUrl =>', selectedVideoUrl)

    setDiamonds(user, misDiamantes - 1)

    await m.react('⚰️')
    await conn.sendMessage(m.chat, {
      text:
        '🩸 DENJI BOT 🩸\n\n' +
        '🔪 Descargando...\n' +
        '💎 -1 diamante'
    }, { quoted: m })

    const json = await downloadTikTok(selectedVideoUrl)
    console.log('download response =>', JSON.stringify(json, null, 2))

    const total = getDiamonds(user)
    const videoDownloadUrl = json.data.meta.media[0].org

    await conn.sendMessage(m.chat, {
      video: { url: videoDownloadUrl },
      caption:
        '🩸 DENJI BOT 🩸\n\n' +
        '🔪 Descarga completada\n\n' +
        `💀 Video: ${json.data.title || fallbackTitle}\n` +
        `💀 Autor: ${json.data.author?.nickname || selectedVideo.author?.nickname || ''}\n` +
        `💀 Duración: ${json.data.duration || selectedVideo.duration || 0}s\n` +
        `🩸 Diamantes restantes: ${total}`
    }, { quoted: m })

    await m.react('🩸')
    console.log('====== TT DEBUG END (SUCCESS) ======')
    return true
  } catch (e) {
    console.log('TT BEFORE ERROR =>', e)

    try {
      const who = m.sender
      const user = global.db.data.users[who]
      if (user) {
        const current = getDiamonds(user)
        setDiamonds(user, current + 1)
      }
    } catch (restoreError) {
      console.log('RESTORE DIAMONDS ERROR =>', restoreError)
    }

    await conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 Error: ' + e.message
    }, { quoted: m })

    await m.react('💀')
    console.log('====== TT DEBUG END (ERROR) ======')
    return true
  }
}

handler.help = ['tiktok', 'tt']
handler.tags = ['downloader']
handler.command = /^(tiktok|tt)$/i
handler.desc = 'Busca y descarga videos de TikTok 💎1'

export default handler
