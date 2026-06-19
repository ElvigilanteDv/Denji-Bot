import fs from 'fs'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'
import gtts from 'node-gtts'

const VOCES = {
  'chica':   { nombre: '  Voz Femenina',   tipo: 'gtts',    lang: 'es'    },
  'hombre':  { nombre: '  Voz Masculina',  tipo: 'gtts',    lang: 'es-us' },
  'ingles':  { nombre: '🇺🇸 Inglés',         tipo: 'gtts',    lang: 'en'    },
  'brasil':  { nombre: '🇧🇷 Portugués',      tipo: 'gtts',    lang: 'pt'    },
  'japones': { nombre: '🇯🇵 Japonés',        tipo: 'gtts',    lang: 'ja'    },
  'frances': { nombre: '🇫🇷 Francés',        tipo: 'gtts',    lang: 'fr'    },

  'demonio': { nombre: '👹 Demonio',         tipo: 'stream',  voz: 'Brian'  },
  'sangre':  { nombre: '🩸 Sangre Fría',     tipo: 'stream',  voz: 'Russell'},
  'sierra':  { nombre: '🪚 Voz Sierra',      tipo: 'stream',  voz: 'Matthew'},
  'oscura':  { nombre: '🌑 Voz Oscura',      tipo: 'stream',  voz: 'Geraint'},
  'macabra': { nombre: '☠️ Macabra',         tipo: 'stream',  voz: 'Mia'    },
  'femenina':{ nombre: '👩 Femenina Fría',   tipo: 'stream',  voz: 'Emma'   },
  'seductora':{ nombre: '💋 Seductora',      tipo: 'stream',  voz: 'Amy'    },
  'cazadora':{ nombre: '🗡️ Cazadora',        tipo: 'stream',  voz: 'Nicole' },
  'guerrero':{ nombre: '⚔️ Guerrero',        tipo: 'stream',  voz: 'Joey'   },
}

async function generarGTTS(texto, lang) {
  const tts     = gtts(lang)
  const tmpPath = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`)

  await new Promise((resolve, reject) => {
    tts.save(tmpPath, texto, err => err ? reject(err) : resolve())
  })

  const buffer = fs.readFileSync(tmpPath)
  try { fs.unlinkSync(tmpPath) } catch {}
  return buffer
}

async function generarStream(texto, voz) {
  const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voz}&text=${encodeURIComponent(texto)}`
  const res  = await Promise.race([
    fetch(url),
    new Promise((_, rej) => setTimeout(() => rej('timeout'), 10000))
  ])

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  return buffer
}

const handler = async (m, { conn, text, usedPrefix, command }) => {

  if (!text) {
    const listaVoces = Object.entries(VOCES)
      .map(([k, v]) => `🩸 *${k}* — ${v.nombre}`)
      .join('\n')

    return m.reply([
      `🪚「 DENJI BOT — TTS3 」🩸`,
      ``,
      `💀 *Uso:*`,
      `${usedPrefix}${command} <texto>`,
      `${usedPrefix}${command} <voz>:<texto>`,
      ``,
      `📌 *Ejemplos:*`,
      `${usedPrefix}${command} La motosierra nunca duerme`,
      `${usedPrefix}${command} demonio:Voy a destrozarte`,
      `${usedPrefix}${command} sierra:Nadie escapa de mí`,
      ``,
      `🪚 *Voces disponibles:*`,
      listaVoces,
    ].join('\n'))
  }

  let vozKey     = 'chica'
  let textoFinal = text.trim()

  const matchVoz = textoFinal.match(/^([a-záéíóúñ]+):(.+)$/i)
  if (matchVoz) {
    const clave = matchVoz[1].toLowerCase()
    if (VOCES[clave]) {
      vozKey      = clave
      textoFinal  = matchVoz[2].trim()
    }
  }

  if (textoFinal.length > 500) {
    return m.reply([
      `🪚「 DENJI BOT — TTS3 」🩸`,
      ``,
      `❌ *Texto muy largo, ni la sierra aguanta tanto*`,
      `Máximo: *500 caracteres*`,
      `Tienes: *${textoFinal.length}*`,
    ].join('\n'))
  }

  const vozInfo = VOCES[vozKey]
  await m.react('🪚')

  try {
    let audioBuffer

    if (vozInfo.tipo === 'gtts') {
      audioBuffer = await generarGTTS(textoFinal, vozInfo.lang)
    } else {
      audioBuffer = await generarStream(textoFinal, vozInfo.voz)
    }

    await conn.sendMessage(m.chat, {
      audio:    audioBuffer,
      mimetype: 'audio/mpeg',
      ptt:      false
    }, { quoted: m })

    await conn.sendMessage(m.chat, {
      text: [
        `🪚「 DENJI BOT — TTS3 」🩸`,
        ``,
        `💀 *¡Denji rev la motosierra y generó el audio!*`,
        ``,
        `🪚 *Voz:* ${vozInfo.nombre}`,
        `📝 *Texto:* ${textoFinal.slice(0, 50)}${textoFinal.length > 50 ? '...' : ''}`,
        `🔤 *Caracteres:* ${textoFinal.length}`,
        ``,
        `> ${usedPrefix}${command} para ver todas las voces`,
      ].join('\n')
    }, { quoted: m })

    await m.react('🩸')

  } catch (e) {
    console.error('❌ [DENJI TTS3 ERROR]', e.message)
    await m.react('💀')

    if (vozInfo.tipo === 'stream') {
      try {
        const fallback = await generarGTTS(textoFinal, 'es')
        await conn.sendMessage(m.chat, {
          audio:    fallback,
          mimetype: 'audio/mpeg',
          ptt:      false
        }, { quoted: m })

        await m.reply(`☠️ La voz *${vozInfo.nombre}* no está disponible ahora\n🪚 Denji usó la voz predeterminada`)
        await m.react('🩸')
        return
      } catch {}
    }

    m.reply([
      `🪚「 DENJI BOT — TTS3 」🩸`,
      ``,
      `❌ *La motosierra no pudo generar el audio*`,
      `🔄 Intenta de nuevo`,
    ].join('\n'))
  }
}

handler.help    = ['tts3 <texto>']
handler.tags    = ['tools']
handler.command = ['tts3', 'voz3', 'hablar3']
handler.desc    = '🪚 TTS sangriento con múltiples voces de Denji'

export default handler
