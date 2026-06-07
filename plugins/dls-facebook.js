import fetch from 'node-fetch'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔪 Descarga videos, imágenes y reels de Facebook\n\n> ${usedPrefix}${command} <link>\n> Ejemplo: ${usedPrefix}${command} https://facebook.com/reel/xxx`
    }, { quoted: m })
  }

  if (!text.includes('facebook.com') && !text.includes('fb.watch')) {
    return conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 Solo links de Facebook'
    }, { quoted: m })
  }

  await m.react('🩸')

  try {
    let apiUrl = `https://api.delirius.store/download/facebook?url=${encodeURIComponent(text)}`
    let res = await fetch(apiUrl)
    let json = await res.json()

    if (!json.status || !json.data) {
      throw new Error('No se pudo obtener el contenido')
    }

    let data = json.data

    // Videos / Reels
    if (data.video || data.videos?.length) {
      let videoUrl = data.video || data.videos[0]
      let titulo = data.title || 'Sin título'
      let autor = data.author || data.page || 'Desconocido'

      await conn.sendMessage(m.chat, {
        video: { url: videoUrl },
        caption: `🩸 DENJI BOT 🩸\n\n🔪 Descarga completada\n\n💀 Título: ${titulo}\n💀 Autor: ${autor}`
      }, { quoted: m })

      await m.react('🩸')
      return
    }

    // Imágenes
    if (data.images?.length) {
      for (let i = 0; i < Math.min(data.images.length, 10); i++) {
        await conn.sendMessage(m.chat, {
          image: { url: data.images[i] },
          caption: i === 0 ? `🩸 DENJI BOT 🩸\n\n🔪 Descarga completada\n\n💀 ${data.images.length} imagen(es)` : ''
        }, { quoted: m })
      }

      await m.react('🩸')
      return
    }

    // Imagen única
    if (data.image) {
      await conn.sendMessage(m.chat, {
        image: { url: data.image },
        caption: `🩸 DENJI BOT 🩸\n\n🔪 Descarga completada`
      }, { quoted: m })

      await m.react('🩸')
      return
    }

    throw new Error('No se encontró contenido descargable')

  } catch (e) {
    console.log(e)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error al descargar\n\n> ${e.message}`
    }, { quoted: m })
  }
}

handler.help = ['facebook']
handler.tags = ['downloader']
handler.command = /^(facebook|fb|fbdl|reel)$/i
handler.desc = 'Descarga videos, imágenes y reels de Facebook'

export default handler
