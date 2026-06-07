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


    console.log('FB API RESPONSE:', JSON.stringify(json, null, 2))

    await conn.sendMessage(m.chat, {
      text: '🩸 DEBUG 🩸\n\n' + JSON.stringify(json, null, 2).slice(0, 1500)
    }, { quoted: m })

  } catch (e) {
    console.log(e)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error: ${e.message}`
    }, { quoted: m })
  }
}

handler.help = ['facebook']
handler.tags = ['downloader']
handler.command = /^(facebook|fb|fbdl|reel)$/i
handler.desc = 'Descarga videos, imágenes y reels de Facebook'

export default handler
