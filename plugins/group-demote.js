let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  const isOwner = global.owner.some(([num]) => m.sender.startsWith(num))

  if (!m.isGroup) return conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      '💀 *Este comando solo funciona en grupos*',
      '> No hay a quien arrancarle el poder aquí...',
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
      '> arrebatarle el poder a alguien',
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
      '> me encargaré de los demás...',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })

  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null

  if (!who) return conn.sendMessage(m.chat, {
    text: [
      '🩸 DENJI BOT 🩸',
      '',
      '🔪 *¿A quién le arranco el poder?*',
      '> Menciona o responde a alguien',
      '',
      '🩸 DENJI BOT 🩸'
    ].join('\n')
  }, { quoted: m })

  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'demote')

    if (isOwner) {
      await conn.sendMessage(m.chat, {
        text: [
          '🩸 DENJI BOT 🩸',
          '',
          '👑 *El jefe ha decidido...*',
          `🔪 @${who.split('@')[0]} ha sido despojado`,
          '> por orden directa del *OWNER*',
          '> El poder que tenías ya no existe',
          '> Vuelve a tu lugar, mortal...',
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
          `💀 @${who.split('@')[0]} *ha perdido el poder*`,
          '🔪 Lo que se da, se puede quitar',
          '> Tu reinado ha terminado...',
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
        '> No pude arrebatarle el poder',
        `> ${e.message}`,
        '',
        '🩸 DENJI BOT 🩸'
      ].join('\n')
    }, { quoted: m })
  }
}

handler.help     = ['demote']
handler.tags     = ['group']
handler.command  = /^(demote|degradar|quitaradmin)$/i
handler.desc     = 'Quita admin a un miembro'
handler.admin    = false
handler.botAdmin = true

export default handler
