let handler = async (m, { conn }) => {
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender
  let name = '@' + who.split('@')[0]
  let porcentaje = Math.floor(Math.random() * 101)
  let emoji, frase, extra
  if (porcentaje >= 90) {
    emoji = '🏳️‍🌈'
    frase = 'Reina del Pride'
    extra = '🩸 Denji dice: arcoíris total, ni la motosierra te endereza'
  } else if (porcentaje >= 70) {
    emoji = '🌈'
    frase = 'Arcoíris brillante'
    extra = '🩸 Denji dice: se te nota hasta en cómo rev la motosierra'
  } else if (porcentaje >= 50) {
    emoji = '💅'
    frase = 'Bicurios@'
    extra = '🩸 Denji dice: un día te gustan ellos, otro ellas, otro día la motosierra'
  } else if (porcentaje >= 30) {
    emoji = '🤔'
    frase = 'En duda'
    extra = '🩸 Denji dice: ni tú sabes qué te gusta, pero la motosierra sí sabe'
  } else if (porcentaje >= 10) {
    emoji = '💪'
    frase = 'Casi hetero'
    extra = '🩸 Denji dice: muy macho pecho peludo pero con gustos finos igual que Pochita'
  } else {
    emoji = '🦅'
    frase = 'Hetero supremo'
    extra = '🩸 Denji dice: te gusta el pollo asado, el fútbol y rev motosierras'
  }
  let barra = ''
  let completado = Math.floor(porcentaje / 10)
  for (let i = 0; i < 10; i++) {
    barra += i < completado ? '🏳️‍🌈' : '🩸'
  }
  let texto = '🪚「 DENJI BOT — GAYMETRO 」🩸\n\n'
  texto += '💀 *Denji rev la motosierra y mide...*\n\n'
  texto += '🎯 ' + name + '\n\n'
  texto += emoji + ' *' + porcentaje + '%*\n'
  texto += barra + '\n\n'
  texto += '⚡ *' + frase + '*\n'
  texto += extra
  await conn.sendMessage(m.chat, { text: texto, mentions: [who] }, { quoted: m })
}
handler.help = ['gay']
handler.tags = ['diversion']
handler.command = /^(gay|gaymetro|lgbt)$/i
handler.desc = 'Denji rev la motosierra y mide qué tan gay eres 🪚🩸'
export default handler
