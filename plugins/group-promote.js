let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  const isOwner = global.owner.some(([num]) => m.sender.startsWith(num))

  if (!m.isGroup) return conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      '💀 *Este comando solo funciona en grupos*',
      '> No hay a quien dar poder aquí...',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })

  if (!isAdmin && !isOwner) return conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      '🗡️ *Acceso denegado, mortal*',
      '> Solo los administradores pueden',
      '> otorgar poder sobre otros',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })

  if (!isBotAdmin) return conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      '⚰️ *Denji no tiene poder aquí*',
      '> Hazme admin primero y entonces',
      '> verás de lo que soy capaz...',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })

  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  if (!who) return conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      '🔪 *¿A quién le doy el poder?*',
      '> Menciona o responde a alguien',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })

  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'promote')

    if (isOwner) {
      await conn.sendMessage(m.chat, {
        text: [
          '🩸 DENJI BOT 🩸',
          '',
          '👑 *El jefe ha hablado...*',
          `🗡️ @${who.split('@')[0]} ha sido ungido`,
          '> por orden directa del *OWNER*',
          '> Su voluntad es ley en este grupo',
          '> Que no abuse del poder que se le dio...',
          '',
          '🩸 DENJI BOT 🩸'
        ].join('\n'),
        mentions: [who]
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        text: [
          '🩸 DENJI BOT 🩸',
          '',
          `⚡ @${who.split('@')[0]} *ahora tiene el poder*`,
          '🔗 Usa bien lo que se te ha dado',
          '> O te lo arrebataré con mis propias manos...',
          '',
          '🩸 DENJI BOT 🩸'
        ].join('\n'),
        mentions: [who]
      }, { quoted: m })
    }

  } catch (e) {
    await conn.sendMessage(m.chat, {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        '💀 *Algo salió mal...*',
        '> No pude otorgar el poder',
        `> ${e.message}`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }
}

handler.help     = ['promote']
handler.tags     = ['group']
handler.command  = /^(promote|promover|daradmin)$/i
handler.desc     = 'Da admin a un miembro'
handler.admin    = true
handler.botAdmin = true

export default handler
