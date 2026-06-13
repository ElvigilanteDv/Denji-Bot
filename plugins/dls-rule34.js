import fetch from 'node-fetch'

const handler = async (m, { conn, args, usedPrefix, command }) => {
  // Unir los argumentos para formar el tag de búsqueda
  const text = args.join(' ')
  
  // Verificar si se proporcionó texto después del comando
  if (!text) {
    throw `🩸 Usa ${usedPrefix + command} <tag>\nEjemplo: ${usedPrefix + command} miku`
  }

  await m.react('🩸')

  try {
    const params = new URLSearchParams({
      tags: text,
      limit: 10,
      json: 1
    })

    const response = await fetch(`https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&${params}`)
    const data = await response.json()

    if (!data || !Array.isArray(data) || data.length === 0) {
      await m.react('💀')
      return conn.reply(m.chat, `🩸 No se encontraron resultados para "${text}"`, m)
    }

    // Filtrar solo resultados con imagen válida
    const validResults = data.filter(post => post.file_url && post.file_url.trim() !== '')

    if (!validResults.length) {
      await m.react('💀')
      return conn.reply(m.chat, `🩸 No hay imágenes disponibles para "${text}"`, m)
    }

    // Enviar mensaje de carga
    await conn.reply(m.chat, `🩸 Enviando ${validResults.length} resultados de "${text}"`, m)

    // Enviar imágenes
    let enviados = 0
    let fallidos = 0

    for (let i = 0; i < validResults.length; i++) {
      const post = validResults[i]
      try {
        await conn.sendMessage(m.chat, {
          image: { url: post.file_url },
          caption: i === 0 ? `🩸 Rule34: ${text}` : ''
        }, { quoted: i === 0 ? m : undefined })
        enviados++
      } catch (e) {
        console.log(`[RULE34] Error enviando imagen ${i}:`, e.message)
        fallidos++
      }
    }

    await m.react('🩸')

    if (fallidos > 0) {
      await conn.reply(m.chat, `🩸 Enviados: ${enviados}, Fallidos: ${fallidos}`, m)
    }

  } catch (error) {
    console.error('[RULE34 ERROR]', error.message)
    await m.react('💀')
    conn.reply(m.chat, `🩸 Error: ${error.message}`, m)
  }
}

handler.help = ['rule34']
handler.tags = ['nsfw']
handler.command = ['rule34', 'r34']
handler.register = true
handler.level = 5
handler.group = true

export default handler
