import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

let juegos = {}

const palabras = [
  // Animales
  'elefante', 'cocodrilo', 'mariposa', 'tortuga', 'serpiente', 'pantera', 'delfin', 'aguila',
  'tiburon', 'camello', 'gorila', 'leopardo', 'flamenco', 'pingüino', 'canguro',
  // Países
  'argentina', 'colombia', 'venezuela', 'brasil', 'australia', 'japon', 'alemania',
  'portugal', 'noruega', 'tailandia', 'indonesia', 'egipto', 'marruecos', 'turquia',
  // Comida
  'hamburguesa', 'espagueti', 'ensalada', 'chocolate', 'helado', 'pizza', 'sushi',
  'empanada', 'tamalito', 'arepa', 'ceviche', 'paella', 'lasaña', 'burrito',
  // Tecnología
  'computadora', 'telefono', 'internet', 'satelite', 'programa', 'software', 'monitor',
  'teclado', 'audifonos', 'impresora', 'servidor', 'algoritmo', 'aplicacion',
  // Naturaleza
  'montaña', 'volcan', 'cascada', 'desierto', 'tormenta', 'arcoiris', 'glaciar',
  'peninsula', 'horizonte', 'relámpago', 'huracán', 'terremoto', 'tsunami',
  // Deportes
  'futbol', 'baloncesto', 'beisbol', 'natacion', 'atletismo', 'ciclismo', 'boxeo',
  'voleibol', 'gimnasia', 'skateboard', 'escalada', 'karate',
  // Profesiones
  'arquitecto', 'ingeniero', 'maestro', 'bombero', 'detective', 'astronauta',
  'carpintero', 'fotografo', 'cocinero', 'piloto', 'medico', 'abogado',
  // Objetos cotidianos
  'paraguas', 'mochila', 'espejo', 'linterna', 'calendario', 'escalera',
  'martillo', 'tijeras', 'reloj', 'sombrero', 'bufanda', 'billetera',
  // Colores y formas
  'triangulo', 'rectangulo', 'hexagono', 'cilindro', 'esfera', 'piramide',
  // Random divertido
  'cumpleaños', 'vacaciones', 'aventura', 'misterio', 'fantasia', 'universo',
  'galaxia', 'nebulosa', 'dimension', 'laberinto', 'tesoro', 'castillo'
]

let handler = async (m, { conn }) => {
  let who = m.sender

  if (juegos[who]) {
    await mostrarTablero(conn, m, who)
    return
  }

  let palabra = palabras[Math.floor(Math.random() * palabras.length)]
  let oculta = '_ '.repeat(palabra.length).trim()

  juegos[who] = {
    palabra,
    oculta,
    intentos: 6,
    usadas: []
  }

  await mostrarTablero(conn, m, who)
}

async function mostrarTablero(conn, m, who) {
  let juego = juegos[who]
  if (!juego) return

  let muñecos = [
    '```\n   ┌─────┐\n   │     \n   │     \n   │     \n   │     \n  ─┴─────```',
    '```\n   ┌─────┐\n   │     O\n   │     \n   │     \n   │     \n  ─┴─────```',
    '```\n   ┌─────┐\n   │     O\n   │     │\n   │     \n   │     \n  ─┴─────```',
    '```\n   ┌─────┐\n   │     O\n   │    ─│\n   │     \n   │     \n  ─┴─────```',
    '```\n   ┌─────┐\n   │     O\n   │    ─┼─\n   │     \n   │     \n  ─┴─────```',
    '```\n   ┌─────┐\n   │     O\n   │    ─┼─\n   │    ╱ \n   │     \n  ─┴─────```',
    '```\n   ┌─────┐\n   │     O\n   │    ─┼─\n   │    ╱╲\n   │     \n  ─┴─────```'
  ]
  let idx = 6 - juego.intentos

  let todasLetras = 'abcdefghijklmnopqrstuvwxyz'.split('')
  let rows = todasLetras.map(l => ({
    header: juego.usadas.includes(l) ? '❌' : '✅',
    title: l.toUpperCase(),
    description: juego.usadas.includes(l) ? 'Ya usada' : 'Disponible',
    id: 'ah_' + l
  }))

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: { title: 'DENJI BOT - AHORCADO', subtitle: 'Adivina la palabra | 💎 3', hasMediaAttachment: false },
    body: {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        muñecos[idx],
        '',
        `🔪 Vidas: ${'🩸'.repeat(juego.intentos)}${'💀'.repeat(6 - juego.intentos)} (${juego.intentos}/6)`,
        `💀 Palabra: *${juego.oculta}*`,
        `⚰️ Letras usadas: ${juego.usadas.length ? juego.usadas.map(l => l.toUpperCase()).join(' ') : 'Ninguna'}`,
        `💀 Letras: ${juego.palabra.length} letras`,
        '',
        '> Elige una letra'
      ].join('\n')
    },
    footer: { text: '🩸 DENJI BOT 🩸' },
    nativeFlowMessage: {
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🔤 ELIGE UNA LETRA',
          sections: [{ title: '💀 ABECEDARIO', rows }]
        })
      }]
    }
  })

  const msg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
  }, { quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('ah_')) return false

    let who = m.sender
    if (!juegos[who]) return false

    let juego = juegos[who]
    let letra = id.replace('ah_', '')

    if (juego.usadas.includes(letra)) {
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n⚰️ Ya usaste la *${letra.toUpperCase()}*\n> Elige otra letra`
      }, { quoted: m })
      await mostrarTablero(conn, m, who)
      return true
    }

    juego.usadas.push(letra)

    if (juego.palabra.includes(letra)) {
      let oculta = ''
      for (let l of juego.palabra) {
        oculta += juego.usadas.includes(l) ? l + ' ' : '_ '
      }
      juego.oculta = oculta.trim()

      if (!juego.oculta.includes('_')) {
        let user = global.db.data.users[who]
        if (!user) {
          global.db.data.users[who] = { diamantes: 0 }
          user = global.db.data.users[who]
        }
        user.diamantes = (user.diamantes || 0) + 3
        delete juegos[who]
        await conn.sendMessage(m.chat, {
          text: [
            '🩸 DENJI BOT 🩸',
            '',
            '🏆 *¡GANASTE EL AHORCADO!*',
            '',
            `🔪 Palabra: *${juego.palabra.toUpperCase()}*`,
            `💀 Letras usadas: ${juego.usadas.length}`,
            `💎 +3 diamantes ganados`,
            `🩸 Total: ${user.diamantes} 💎`,
            '',
            '> La sangre del ahorcado fue tuya...'
          ].join('\n')
        }, { quoted: m })
        return true
      }

      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n🔪 ¡Letra *${letra.toUpperCase()}* correcta!`
      }, { quoted: m })
      await mostrarTablero(conn, m, who)
      return true

    } else {
      juego.intentos--

      if (juego.intentos <= 0) {
        delete juegos[who]
        await conn.sendMessage(m.chat, {
          text: [
            '🩸 DENJI BOT 🩸',
            '',
            '💀 *FUISTE AHORCADO*',
            '',
            `🔪 La palabra era: *${juego.palabra.toUpperCase()}*`,
            '⚰️ No te quedaron vidas...',
            '',
            '> Usa #ahorcado para intentar de nuevo'
          ].join('\n')
        }, { quoted: m })
        return true
      }

      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n💀 Letra *${letra.toUpperCase()}* incorrecta\n🩸 Vidas restantes: ${juego.intentos}`
      }, { quoted: m })
      await mostrarTablero(conn, m, who)
      return true
    }

  } catch (e) {
    console.log(e)
    return false
  }
}

handler.help = ['ahorcado']
handler.tags = ['game']
handler.command = /^(ahorcado|hangman)$/i
handler.desc = 'Juego del ahorcado | 💎 3'

export default handler
