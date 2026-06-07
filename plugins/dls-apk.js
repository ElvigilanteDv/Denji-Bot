import fetch from 'node-fetch'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🔪 Busca y descarga APKs\n\n> ${usedPrefix}${command} <nombre>\n> Ejemplo: ${usedPrefix}${command} Minecraft`
    }, { quoted: m })
  }

  await m.react('🩸')

  try {
    let apiUrl = `https://api.delirius.store/download/apk?query=${encodeURIComponent(text)}`
    let res = await fetch(apiUrl)
    let json = await res.json()

    if (!json.status || !json.data) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 No se encontró: ' + text
      }, { quoted: m })
    }

    let { name, size, image, download, developer, stats, publish } = json.data

    let texto = '🩸 DENJI BOT 🩸\n\n'
    texto += '🔪 *' + name + '*\n'
    texto += '💀 Developer: ' + (developer || 'N/A') + '\n'
    texto += '💀 Tamaño: ' + size + '\n'
    texto += '💀 Publicado: ' + (publish || 'N/A') + '\n'
    texto += '💀 Descargas: ' + (stats?.downloads?.toLocaleString() || 'N/A') + '\n'
    texto += '💀 Rating: ' + (stats?.rating?.average || 'N/A') + '\n\n'
    texto += '> Enviando archivo...'

    await conn.sendMessage(m.chat, {
      image: { url: image || 'https://files.catbox.moe/r60c8l.jpg' },
      caption: texto
    }, { quoted: m })

    await conn.sendMessage(m.chat, {
      document: { url: download },
      fileName: name + '.apk',
      mimetype: 'application/vnd.android.package-archive'
    }, { quoted: m })

    await m.react('🩸')

  } catch (e) {
    console.log(e)
    await m.react('💀')
    conn.sendMessage(m.chat, { text: '🩸 DENJI BOT 🩸\n\n💀 Error al buscar' }, { quoted: m })
  }
}

handler.help = ['apk']
handler.tags = ['downloader']
handler.command = /^(apk|apkdl|descargarapk)$/i
handler.desc = 'Descarga APKs'

export default handler
