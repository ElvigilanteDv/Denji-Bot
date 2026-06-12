import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

let peleas = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0, health: 100, maxHealth: 100, attack: 10, defense: 5 }
    user = global.db.data.users[who]
  }

  if (peleas[who]) {
    let pelea = peleas[who]

    let sections = [{
      title: '🪚 ACCIONES DE COMBATE',
      rows: [
        { header: '🪚 ATACAR', title: 'Denji rev la motosierra', description: 'Daño: ' + Math.floor((user.attack || 10) * 0.3) + '-' + (user.attack || 10) + ' 🩸', id: 'acc_atacar' },
        { header: '🏃 HUIR', title: 'Escapar del matadero', description: 'Pierdes la pelea como cobarde', id: 'acc_huir' }
      ]
    }]

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🪚 DENJI BATTLE 🩸', subtitle: pelea.oponente.name, hasMediaAttachment: false },
      body: { text: '🪚「 DENJI BATTLE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » ' + pelea.oponente.name + '\n❤️ » Vida: ' + pelea.saludOponente + '/' + pelea.oponente.health + '\n🩸 » Ataque: ' + pelea.oponente.attack + '\n\n🪚 » Denji\n❤️ » Vida: ' + pelea.saludUsuario + '/' + (user.maxHealth || 100) + '\n🩸 » Ataque: ' + (user.attack || 10) + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' },
      footer: { text: '🪚 DENJI BOT — ¡MOTOSIERRA ENCENDIDA! 🩸' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({ title: '🪚 ACCIONES', sections })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    return
  }

  let sections = [{
    title: '💀 ELIGE TU VÍCTIMA',
    rows: [
      { header: '🐺 BESTIA', title: 'Demonios normales', description: 'Nivel 0+ | 5-35 💎', id: 'fight_bestia' },
      { header: '💀 BOSS', title: 'Demonios poderosos', description: 'Nivel 5+ | 50 💎', id: 'fight_boss' },
      { header: '☠️ FINAL BOSS', title: 'El Diablo Primordial', description: 'Nivel 10+ | 100 💎', id: 'fight_finalboss' }
    ]
  }]

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: { title: '🪚 DENJI BATTLE 🩸', subtitle: 'Elige tu víctima', hasMediaAttachment: false },
    body: { text: '🪚「 DENJI BATTLE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji busca a quién destrozar\n\n🪚 » Tu fuerza: ' + (user.attack || 10) + ' 🩸\n❤️ » Tu vida: ' + (user.health || 100) + '/' + (user.maxHealth || 100) + '\n⭐ » Tu nivel: ' + (user.level || 0) + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' },
    footer: { text: '🪚 DENJI BOT — ¡MOTOSIERRA ENCENDIDA! 🩸' },
    nativeFlowMessage: {
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({ title: '💀 VÍCTIMAS', sections })
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
    if (!id) return false

    let who = m.sender
    let user = global.db.data.users[who]
    if (!user) {
      global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0, health: 100, maxHealth: 100, attack: 10, defense: 5 }
      user = global.db.data.users[who]
    }

    if (id.startsWith('fight_')) {
      if (peleas[who]) {
        return conn.sendMessage(m.chat, { text: '🪚「 DENJI BATTLE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Ya estás en el matadero, termina primero\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
      }

      let tipo = id.replace('fight_', '')
      let oponente

      let bestias = [
        { name: '🐺 Demonio Lobo', attack: 12, health: 40, recompensa: 5, exp: 20 },
        { name: '🗡️ Demonio Bandido', attack: 15, health: 50, recompensa: 8, exp: 30 },
        { name: '🥷 Demonio Ninja', attack: 18, health: 60, recompensa: 10, exp: 40 },
        { name: '⚔️ Demonio Samurái', attack: 20, health: 70, recompensa: 15, exp: 50 },
        { name: '👹 Oni Menor', attack: 22, health: 80, recompensa: 20, exp: 60 }
      ]

      let bosses = [
        { name: '🐍 Demonio Serpiente', attack: 30, health: 150, recompensa: 50, exp: 100 },
        { name: '💀 Demonio del Dolor', attack: 35, health: 180, recompensa: 50, exp: 120 },
        { name: '🌑 Demonio de la Oscuridad', attack: 40, health: 200, recompensa: 50, exp: 150 },
        { name: '🩸 Diablo de la Sangre', attack: 45, health: 250, recompensa: 50, exp: 180 },
        { name: '❄️ Demonio del Hielo', attack: 38, health: 200, recompensa: 50, exp: 140 }
      ]

      if (tipo === 'bestia') {
        oponente = bestias[Math.floor(Math.random() * bestias.length)]
      } else if (tipo === 'boss') {
        if ((user.level || 0) < 5) {
          return conn.sendMessage(m.chat, { text: '🪚「 DENJI BATTLE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » Denji dice que no tienes nivel para un BOSS\n⭐ » Tu nivel: ' + (user.level || 0) + ' | Necesitas: 5\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
        }
        oponente = bosses[Math.floor(Math.random() * bosses.length)]
      } else if (tipo === 'finalboss') {
        if ((user.level || 0) < 10) {
          return conn.sendMessage(m.chat, { text: '🪚「 DENJI BATTLE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n☠️ » El Diablo Primordial se ríe de ti\n⭐ » Tu nivel: ' + (user.level || 0) + ' | Necesitas: 10\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
        }
        oponente = { name: '☠️ EL DIABLO PRIMORDIAL', attack: 60, health: 500, recompensa: 100, exp: 500 }
      }

      peleas[who] = {
        oponente: oponente,
        saludOponente: oponente.health,
        saludUsuario: user.health || 100
      }

      let sections = [{
        title: '🪚 ACCIONES DE COMBATE',
        rows: [
          { header: '🪚 ATACAR', title: 'Denji rev la motosierra', description: 'Daño: ' + Math.floor((user.attack || 10) * 0.3) + '-' + (user.attack || 10) + ' 🩸', id: 'acc_atacar' },
          { header: '🏃 HUIR', title: 'Escapar del matadero', description: 'Pierdes la pelea como cobarde', id: 'acc_huir' }
        ]
      }]

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: '🪚 DENJI BATTLE 🩸', subtitle: oponente.name, hasMediaAttachment: false },
        body: { text: '🪚「 DENJI BATTLE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » ¡' + oponente.name + ' aparece del inframundo!\n\n👹 » ' + oponente.name + '\n❤️ » Vida: ' + oponente.health + '/' + oponente.health + '\n🩸 » Ataque: ' + oponente.attack + '\n\n🪚 » Denji\n❤️ » Vida: ' + (user.health || 100) + '/' + (user.maxHealth || 100) + '\n🩸 » Ataque: ' + (user.attack || 10) + '\n\n🏆 » Botín: ' + oponente.recompensa + ' 💎 | ' + oponente.exp + ' exp\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' },
        footer: { text: '🪚 DENJI BOT — ¡MOTOSIERRA ENCENDIDA! 🩸' },
        nativeFlowMessage: {
          buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({ title: '🪚 ACCIONES', sections })
          }]
        }
      })

      const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
      }, { quoted: m })

      await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
      return true
    }

    if (id.startsWith('acc_')) {
      let accion = id.replace('acc_', '')
      let pelea = peleas[who]
      if (!pelea) return true

      if (accion === 'huir') {
        user.health = pelea.saludUsuario
        delete peleas[who]
        return conn.sendMessage(m.chat, { text: '🪚「 DENJI BATTLE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n🏃 » Huiste del matadero como cobarde\n💀 » Denji se avergüenza de ti\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
      }

      if (accion === 'atacar') {
        let ataqueMin = Math.floor((user.attack || 10) * 0.3)
        let ataqueMax = user.attack || 10
        let danoUsuario = Math.floor(Math.random() * (ataqueMax - ataqueMin + 1)) + ataqueMin

        let opAtaqueMin = Math.floor(pelea.oponente.attack * 0.3)
        let opAtaqueMax = pelea.oponente.attack
        let danoOponente = Math.floor(Math.random() * (opAtaqueMax - opAtaqueMin + 1)) + opAtaqueMin

        pelea.saludOponente -= danoUsuario

        if (pelea.saludOponente <= 0) {
          let op = pelea.oponente
          user.diamantes = (user.diamantes || 0) + op.recompensa
          user.exp = (user.exp || 0) + op.exp
          user.health = pelea.saludUsuario
          delete peleas[who]

          let texto = '🪚「 DENJI BATTLE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
          texto += '🏆 » ¡DENJI LO DESTROZÓ CON LA MOTOSIERRA!\n\n'
          texto += '💀 » ' + op.name + ' fue despedazado\n'
          texto += '🩸 » +' + op.recompensa + ' diamantes\n'
          texto += '⚡ » +' + op.exp + ' experiencia\n'
          texto += '🪚 » Total: ' + user.diamantes + ' 💎\n\n'
          texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ☠️ Nadie escapa de la motosierra'

          return conn.sendMessage(m.chat, { text: texto }, { quoted: m })
        }

        pelea.saludUsuario -= danoOponente

        if (pelea.saludUsuario <= 0) {
          let op = pelea.oponente
          user.health = Math.max(1, Math.floor((user.maxHealth || 100) * 0.3))
          delete peleas[who]

          let texto = '🪚「 DENJI BATTLE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
          texto += '💀 » ¡DENJI FUE DERROTADO!\n\n'
          texto += '👹 » ' + op.name + ' venció a la motosierra\n'
          texto += '❤️ » Vida restante: ' + user.health + '\n'
          texto += '🩸 » Cúrate antes de volver al matadero\n\n'
          texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> 🪚 Usa #curar para regenerarte'

          return conn.sendMessage(m.chat, { text: texto }, { quoted: m })
        }

        user.health = pelea.saludUsuario

        let sections = [{
          title: '🪚 ACCIONES DE COMBATE',
          rows: [
            { header: '🪚 ATACAR', title: 'Denji rev la motosierra', description: 'Daño: ' + Math.floor((user.attack || 10) * 0.3) + '-' + (user.attack || 10) + ' 🩸', id: 'acc_atacar' },
            { header: '🏃 HUIR', title: 'Escapar del matadero', description: 'Pierdes la pelea como cobarde', id: 'acc_huir' }
          ]
        }]

        const interactiveMessage = proto.Message.InteractiveMessage.create({
          header: { title: '🪚 DENJI BATTLE 🩸', subtitle: pelea.oponente.name, hasMediaAttachment: false },
          body: { text: '🪚「 DENJI BATTLE 」🩸\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n🪚 » Tu sierra hizo: -' + danoUsuario + ' ❤️\n💥 » Su golpe: -' + danoOponente + ' ❤️\n\n👹 » ' + pelea.oponente.name + ': ' + pelea.saludOponente + '/' + pelea.oponente.health + ' ❤️\n🪚 » Denji: ' + pelea.saludUsuario + '/' + (user.maxHealth || 100) + ' ❤️\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' },
          footer: { text: '🪚 DENJI BOT — ¡MOTOSIERRA ENCENDIDA! 🩸' },
          nativeFlowMessage: {
            buttons: [{
              name: 'single_select',
              buttonParamsJson: JSON.stringify({ title: '🪚 ACCIONES', sections })
            }]
          }
        })

        const msg = generateWAMessageFromContent(m.chat, {
          viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
        }, { quoted: m })

        await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
        return true
      }
    }

    return false

  } catch (e) {
    console.log(e)
    return false
  }
}

handler.help = ['pelear']
handler.tags = ['rpg']
handler.command = /^(pelear|battle|fight)$/i
handler.desc = 'Denji destrozа demonios con la motosierra 🪚🩸'

export default handler
