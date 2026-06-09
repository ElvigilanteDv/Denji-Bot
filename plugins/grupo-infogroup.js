let handler = async (m, { conn, groupMetadata, participants }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '⛓️ DENJI BOT ⛓️\n\n⚡ Solo para grupos' }, { quoted: m })

  let metadata = groupMetadata
  let chat = global.db.data.chats[m.chat]
  let pp
  try {
    pp = await conn.profilePictureUrl(m.chat, 'image')
  } catch {
    pp = 'https://files.catbox.moe/ks2023.jpg'
  }

  let texto = '⛓️ DENJI BOT ⛓️\n\n'
  texto += '🔩 *INFO DEL GRUPO*\n\n'
  texto += '📟 Nombre: ' + metadata.subject + '\n'
  texto += '🆔 ID: ' + metadata.id + '\n'
  texto += '👑 Creador: @' + metadata.owner?.split('@')[0] + '\n'
  texto += '📅 Creado: ' + new Date(metadata.creation * 1000).toLocaleString() + '\n'
  texto += '👥 Miembros: ' + participants.length + '\n'
  texto += '🛡️ Admins: ' + participants.filter(p => p.admin).length + '\n'
  texto += '📝 Descripción: ' + (metadata.desc || 'Ninguna') + '\n'
  texto += '🔒 Cerrado: ' + (metadata.announce ? 'Sí' : 'No') + '\n'
  texto += '⛓️ Bienvenida: ' + (chat?.welcome ? 'Activa' : 'Inactiva') + '\n'
  texto += '🔗 AntiLink: ' + (chat?.antiLink ? 'Activo' : 'Inactivo') + '\n'

  await conn.sendMessage(m.chat, {
    image: { url: pp },
    caption: texto,
    mentions: [metadata.owner]
  }, { quoted: m })
}

handler.help = ['infogrupo']
handler.tags = ['group']
handler.command = /^(infogrupo|groupinfo|gcinfo)$/i
handler.desc = 'Información del grupo'
handler.group = true

export default handler