let handler = async (m, { conn }) => {
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender
  let name = '@' + who.split('@')[0]
  let porcentaje = Math.floor(Math.random() * 101)

  let emoji, frase, extra

  if (porcentaje >= 90) {
    emoji = '👩‍❤️‍💋‍👩'
    frase = 'Lesbiana Legendaria'
    extra = 'Dueña del Sapphic Fest, colecciona camisas de cuadros'
  } else if (porcentaje >= 70) {
    emoji = '💋'
    frase = 'Arcoíris femenino'
    extra = 'Se te nota en la playlist y en las uñas cortas'
  } else if (porcentaje >= 50) {
    emoji = '💅'
    frase = 'Bicuriosa'
    extra = 'Te gustan los chicos pero las chicas te ponen nerviosa'
  } else if (porcentaje >= 30) {
    emoji = '🤔'
    frase = 'En duda'
    extra = 'A veces miras a tu amiga y te preguntas cosas'
  } else if (porcentaje >= 10) {
    emoji = '💪'
    frase = 'Casi hetero'
    extra = 'Te gustan los chicos pero reconoces la belleza femenina'
  } else {
    emoji = '👸'
    frase = 'Hetero total'
    extra = 'Hombres, hombres y más hombres, cero dudas'
  }

  let barra = ''
  let completado = Math.floor(porcentaje / 10)
  for (let i = 0; i < 10; i++) {
    barra += i < completado ? '👩‍❤️‍💋‍👩' : '⬛'
  }

  let texto = '⛓️ DENJI BOT ⛓️\n\n'
  texto += '🔩 Lesbómetro\n\n'
  texto += '🎯 ' + name + '\n\n'
  texto += emoji + ' ' + porcentaje + '%\n'
  texto += barra + '\n'
  texto += frase + '\n'
  texto += extra

  await conn.sendMessage(m.chat, { text: texto, mentions: [who] }, { quoted: m })
}

handler.help = ['lesbiana']
handler.tags = ['diversion']
handler.command = /^(lesbiana|lesbimetro|lesbi)$/i
handler.desc = 'Mide qué tan lesbiana eres'

export default handler