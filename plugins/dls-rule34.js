import fetch from 'node-fetch'
import { proto } from '@whiskeysockets/baileys'
const RULE34_API_URL = 'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index'
const RULE34_TAGS_URL = 'https://api.rule34.xxx/index.php?page=dapi&s=tag&q=index'
const RULE34_AUTOCOMPLETE_URL = 'https://api.rule34.xxx/autocomplete.php'

async function searchRule34(tags, limit = 10, page = 0) {
  try {
    const params = new URLSearchParams({
      tags: tags,
      limit: limit,
      pid: page,
      json: 1
    })
    
    // Si tienes una API key, descomenta la siguiente línea
    // params.set('api_key', 'TU_API_KEY')
    
    const response = await fetch(`${RULE34_API_URL}?${params}`)
    const data = await response.json()
    
    if (!data || !Array.isArray(data)) {
      return []
    }
    
    return data
  } catch (error) {
    console.error('[RULE34 ERROR]', error.message)
    return []
  }
}
etas populares
async function getPopularTags(limit = 20) {
  try {
    const params = new URLSearchParams({
      limit: limit
    })
    
    const response = await fetch(`${RULE34_TAGS_URL}?${params}`)
    const data = await response.json()
    
    if (!data || !Array.isArray(data)) {
      return []
    }
    
    return data
  } catch (error) {
    console.error('[RULE34 TAGS ERROR]', error.message)
    return []
  }
}

async function autocompleteTag(query) {
  try {
    const params = new URLSearchParams({
      q: query
    })
    
    const response = await fetch(`${RULE34_AUTOCOMPLETE_URL}?${params}`)
    const data = await response.json()
    
    if (!data || !Array.isArray(data)) {
      return []
    }
    
    return data
  } catch (error) {
    console.error('[RULE34 AUTOCOMPLETE ERROR]', error.message)
    return []
  }
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    await m.react('🩸')
    
    try {
      const popularTags = await getPopularTags(15)
      
      if (!popularTags.length) {
        return conn.sendMessage(m.chat, {
          text: `🩸 DENJI BOT 🩸\n\n💀 No se pudieron cargar las etiquetas populares\n\n> ${usedPrefix}${command} <búsqueda>`
        }, { quoted: m })
      }
      
      const rows = popularTags.slice(0, 10).map((tag, index) => {
        return {
          header: `🔞 #${index + 1}`,
          title: tag.name || 'Sin nombre',
          description: `💀 ${tag.count || 0} posts`,
          id: `r34search${SEP}${tag.name}`
        }
      })
      
      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: 'DENJI BOT - RULE34', subtitle: 'Etiquetas populares', hasMediaAttachment: false },
        body: { text: `🩸 DENJI BOT 🩸\n\n🔞 Etiquetas populares\n💀 Elige una o busca algo específico\n\n> ${usedPrefix}${command} <búsqueda>` },
        footer: { text: '🩸 DENJI BOT 🩸' },
        nativeFlowMessage: {
          buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '🔞 POPULARES',
              sections: [{ title: '📋 ETIQUETAS POPULARES', rows }]
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
      console.log('[RULE34 ERROR]', e.message)
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n💀 Error al cargar etiquetas: ${e.message}\n\n> ${usedPrefix}${command} <búsqueda>`
      }, { quoted: m })
    }
    
    return
  }
  
  await m.react('🩸')
  
  try {

    const results = await searchRule34(text, 10)
    
    if (!results.length) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n💀 No se encontraron resultados para: *${text}*`
      }, { quoted: m })
    }
    
    const validResults = results.filter(post => post.file_url && post.file_url.trim() !== '')
    
    if (!validResults.length) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n💀 No hay imágenes disponibles para: *${text}*`
      }, { quoted: m })
    }
    
    // Enviar mensaje de carga
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔞 Enviando ${validResults.length} resultados de: *${text}*`
    }, { quoted: m })
    
    // Enviar imágenes
    let enviados = 0
    let fallidos = 0
    
    for (let i = 0; i < validResults.length; i++) {
      const post = validResults[i]
      try {
        await conn.sendMessage(m.chat, {
          image: { url: post.file_url },
          caption: i === 0 ? `🩸 DENJI BOT 🩸\n\n🔞 Rule34: *${text}*\n💀 \${validResults.length} resultados` : ''
        }, { quoted: i === 0 ? m : undefined })
        enviados++
      } catch (e) {
        console.log(`[RULE34] Falló resultado ${i}:`, e.message)
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
    console.log('[RULE34 ERROR]', e.message)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error al buscar: ${e.message}`
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
    
    if (id.startsWith('r34search' + SEP)) {
      const tag = id.slice(('r34search' + SEP).length)
      
      await m.react('🩸')
      
      try {
        const results = await searchRule34(tag, 10)
        
        if (!results.length) {
          await m.react('💀')
          return conn.sendMessage(m.chat, {
            text: `🩸 DENJI BOT 🩸\n\n💀 No se encontraron resultados para: *${tag}*`
          }, { quoted: m })
        }
        
        const validResults = results.filter(post => post.file_url && post.file_url.trim() !== '')
        
        if (!validResults.length) {
          await m.react('💀')
          return conn.sendMessage(m.chat, {
            text: `🩸 DENJI BOT 🩸\n\n💀 No hay imágenes disponibles para: *${tag}*`
          }, { quoted: m })
        }
        
        await conn.sendMessage(m.chat, {
          text: `🩸 DENJI BOT 🩸\n\n🔞 Enviando ${validResults.length} resultados de: *${tag}*`
        }, { quoted: m })
        
        let enviados = 0
        let fallidos = 0
        
        for (let i = 0; i < validResults.length; i++) {
          const post = validResults[i]
          try {
            await conn.sendMessage(m.chat, {
              image: { url: post.file_url },
              caption: i === 0 ? `🩸 DENJI BOT 🩸\n\n🔞 Rule34: *${tag}*\n💀 ${validResults.length} resultados` : ''
            }, { quoted: i === 0 ? m : undefined })
            enviados++
          } catch (e) {
            console.log(`[RULE34] Falló resultado ${i}:`, e.message)
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
        console.log('[RULE34 ERROR]', e.message)
        await m.react('💀')
        conn.sendMessage(m.chat, {
          text: `🩸 DENJI BOT 🩸\n\n💀 Error al buscar: ${e.message}`
        }, { quoted: m })
      }
      
      return true
    }
    
    return false
    
  } catch (e) {
    console.log('[RULE34 ERROR]', e.message)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error: ${e.message}`
    }, { quoted: m })
    return true
  }
}

handler.help = ['rule34']
handler.tags = ['downloader']
handler.command = /^(rule34|r34)$/i
handler.desc = 'Busca y envía imágenes de Rule34.xxx'

export default handler
