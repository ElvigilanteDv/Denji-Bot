import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const preguntas = [
  // Clásicos
  { pregunta: '¿En qué año se estrenó Titanic?', opciones: ['1995', '1996', '1997', '1998'], respuesta: 2 },
  { pregunta: '¿Quién dirigió El Padrino?', opciones: ['Scorsese', 'Spielberg', 'Coppola', 'Kubrick'], respuesta: 2 },
  { pregunta: '¿Qué actor interpreta a Forrest Gump?', opciones: ['Tom Cruise', 'Tom Hanks', 'Brad Pitt', 'Matt Damon'], respuesta: 1 },
  { pregunta: '¿En qué película dice "Hakuna Matata"?', opciones: ['Dumbo', 'Bambi', 'El Rey León', 'Aladdin'], respuesta: 2 },
  { pregunta: '¿Quién interpreta a Jack en Titanic?', opciones: ['Brad Pitt', 'Leo DiCaprio', 'Johnny Depp', 'Matt Damon'], respuesta: 1 },
  { pregunta: '¿Qué película ganó el Oscar 2020 a Mejor Película?', opciones: ['1917', 'Joker', 'Parasite', 'Ford vs Ferrari'], respuesta: 2 },
  { pregunta: '¿Quién es el director de Pulp Fiction?', opciones: ['Fincher', 'Tarantino', 'Nolan', 'Spielberg'], respuesta: 1 },
  { pregunta: '¿En qué película aparece el personaje Norman Bates?', opciones: ['El Resplandor', 'Psicosis', 'Halloween', 'Viernes 13'], respuesta: 1 },
  { pregunta: '¿Qué película tiene la frase "Hasta la vista, baby"?', opciones: ['Predator', 'RoboCop', 'Terminator 2', 'Total Recall'], respuesta: 2 },
  { pregunta: '¿Cuántas películas tiene la saga Star Wars principal?', opciones: ['6', '7', '8', '9'], respuesta: 3 },

  // Marvel / DC
  { pregunta: '¿Qué actor interpreta a Iron Man?', opciones: ['Chris Evans', 'Chris Hemsworth', 'Robert Downey Jr', 'Mark Ruffalo'], respuesta: 2 },
  { pregunta: '¿En qué película muere Tony Stark?', opciones: ['Infinity War', 'Civil War', 'Endgame', 'Age of Ultron'], respuesta: 2 },
  { pregunta: '¿Quién interpreta a Batman en el Dark Knight?', opciones: ['Ben Affleck', 'Val Kilmer', 'Christian Bale', 'Michael Keaton'], respuesta: 2 },
  { pregunta: '¿Qué personaje dice "I am Groot"?', opciones: ['Rocket', 'Groot', 'Thanos', 'Gamora'], respuesta: 1 },
  { pregunta: '¿Cuál fue la primera película del MCU?', opciones: ['Thor', 'Iron Man', 'Hulk', 'Capitán América'], respuesta: 1 },
  { pregunta: '¿Qué actor es el Joker en 2019?', opciones: ['Heath Ledger', 'Jack Nicholson', 'Joaquin Phoenix', 'Jared Leto'], respuesta: 2 },
  { pregunta: '¿Cómo se llama el escudo de Capitán América?', opciones: ['Vibranium', 'Adamantium', 'Titanio', 'Mithril'], respuesta: 0 },
  { pregunta: '¿Quién interpreta a Spider-Man en el MCU?', opciones: ['Andrew Garfield', 'Tobey Maguire', 'Tom Holland', 'Tom Hardy'], respuesta: 2 },
  { pregunta: '¿En qué película aparece Wakanda por primera vez?', opciones: ['Infinity War', 'Civil War', 'Black Panther', 'Age of Ultron'], respuesta: 1 },
  { pregunta: '¿Qué piedra del infinito tiene Visión en la frente?', opciones: ['Espacial', 'Mental', 'Tiempo', 'Poder'], respuesta: 1 },
  { pregunta: '¿Quién mató a Thanos al inicio de Endgame?', opciones: ['Iron Man', 'Thor', 'Hulk', 'Capitán América'], respuesta: 1 },
  { pregunta: '¿Cómo se llama el planeta de Thor?', opciones: ['Xandar', 'Sakaar', 'Asgard', 'Jotunheim'], respuesta: 2 },
  { pregunta: '¿Qué actor interpreta a Superman en Man of Steel?', opciones: ['Henry Cavill', 'Ben Affleck', 'Gal Gadot', 'Ezra Miller'], respuesta: 0 },
  { pregunta: '¿En qué película aparece Ant-Man por primera vez?', opciones: ['Civil War', 'Ant-Man', 'Age of Ultron', 'Thor'], respuesta: 1 },

  // Animación
  { pregunta: '¿Qué estudio hizo Toy Story?', opciones: ['DreamWorks', 'Disney', 'Pixar', 'Sony'], respuesta: 2 },
  { pregunta: '¿Cómo se llama el pez de Buscando a Nemo?', opciones: ['Nemo', 'Dory', 'Marlin', 'Crush'], respuesta: 0 },
  { pregunta: '¿Qué película de Disney tiene la canción Let it Go?', opciones: ['Brave', 'Moana', 'Frozen', 'Tangled'], respuesta: 2 },
  { pregunta: '¿Cómo se llama la rata de Ratatouille?', opciones: ['Pierre', 'Remy', 'Gusteau', 'Linguini'], respuesta: 1 },
  { pregunta: '¿Qué película de Pixar trata sobre emociones?', opciones: ['Soul', 'Luca', 'Coco', 'Intensamente'], respuesta: 3 },
  { pregunta: '¿En qué película aparece Shrek?', opciones: ['Shrek', 'Fiona', 'Burro', 'Ogro'], respuesta: 0 },
  { pregunta: '¿Cómo se llama el villano de El Rey León?', opciones: ['Scar', 'Mufasa', 'Simba', 'Rafiki'], respuesta: 0 },
  { pregunta: '¿Qué película de Pixar trata sobre Día de Muertos?', opciones: ['Soul', 'Brave', 'Coco', 'Up'], respuesta: 2 },
  { pregunta: '¿Cómo se llama el genio de Aladdin?', opciones: ['Jafar', 'Genio', 'Aladdín', 'Abu'], respuesta: 1 },
  { pregunta: '¿Qué animal es Dumbo?', opciones: ['Jirafa', 'Elefante', 'Hipopótamo', 'Rinoceronte'], respuesta: 1 },
  { pregunta: '¿Cómo se llama el caballo de Moana?', opciones: ['Maui', 'Hei Hei', 'Pua', 'Tamatoa'], respuesta: 2 },
  { pregunta: '¿Qué película tiene al personaje WALL-E?', opciones: ['Robots', 'WALL-E', 'Zootopia', 'Big Hero 6'], respuesta: 1 },

  // Terror / Suspense
  { pregunta: '¿Quién es el asesino de Scream?', opciones: ['Jason', 'Ghostface', 'Freddy', 'Michael'], respuesta: 1 },
  { pregunta: '¿En qué película aparece Pennywise?', opciones: ['Eso', 'Annabelle', 'La Conjura', 'Hereditary'], respuesta: 0 },
  { pregunta: '¿Qué actor interpreta a Freddy Krueger?', opciones: ['Robert Englund', 'Kane Hodder', 'Tony Moran', 'Brad Dourif'], respuesta: 0 },
  { pregunta: '¿De qué año es la película El Exorcista?', opciones: ['1968', '1971', '1973', '1975'], respuesta: 2 },
  { pregunta: '¿Qué película tiene la frase "Redrum"?', opciones: ['Poltergeist', 'El Resplandor', 'Misery', 'Carrie'], respuesta: 1 },
  { pregunta: '¿En qué película aparece Jigsaw?', opciones: ['Saw', 'Hostel', 'El Juego del Miedo', 'Cube'], respuesta: 0 },
  { pregunta: '¿Qué película de terror ganó el Oscar 2018?', opciones: ['Hereditary', 'Get Out', 'It', 'A Quiet Place'], respuesta: 1 },

  // Acción / Aventura
  { pregunta: '¿Qué actor es John Wick?', opciones: ['Tom Cruise', 'Keanu Reeves', 'Jason Statham', 'Liam Neeson'], respuesta: 1 },
  { pregunta: '¿En qué ciudad ocurre la mayoría de El Caballero de la Noche?', opciones: ['Metrópolis', 'Gotham', 'Nueva York', 'Chicago'], respuesta: 1 },
  { pregunta: '¿Cuántas películas tiene la saga Fast and Furious?', opciones: ['8', '9', '10', '11'], respuesta: 3 },
  { pregunta: '¿Qué actor es Ethan Hunt en Misión Imposible?', opciones: ['Tom Hanks', 'Tom Hardy', 'Tom Cruise', 'Tom Hiddleston'], respuesta: 2 },
  { pregunta: '¿Quién interpreta a James Bond en Casino Royale 2006?', opciones: ['Pierce Brosnan', 'Roger Moore', 'Daniel Craig', 'Sean Connery'], respuesta: 2 },
  { pregunta: '¿Qué película tiene la escena de la Matrix de balas?', opciones: ['Matrix Reloaded', 'Matrix', 'Matrix Revolutions', 'Matrix Resurrections'], respuesta: 1 },
  { pregunta: '¿Cómo se llama el barco de Piratas del Caribe?', opciones: ['Flying Dutchman', 'Black Pearl', 'Jolly Roger', 'Queen Anne'], respuesta: 1 },

  // Ciencia Ficción
  { pregunta: '¿Qué película tiene la frase "Houston, tenemos un problema"?', opciones: ['Gravity', 'Interstellar', 'Apollo 13', 'Armageddon'], respuesta: 2 },
  { pregunta: '¿Quién dirige Inception?', opciones: ['Spielberg', 'Fincher', 'Nolan', 'Villeneuve'], respuesta: 2 },
  { pregunta: '¿En qué planeta ocurre Avatar?', opciones: ['Pandora', 'Endor', 'Tatooine', 'Naboo'], respuesta: 0 },
  { pregunta: '¿Qué película trata sobre colonizar Marte?', opciones: ['Gravity', 'Interstellar', 'The Martian', 'Life'], respuesta: 2 },
  { pregunta: '¿Quién es el villano de Blade Runner?', opciones: ['HAL 9000', 'Roy Batty', 'Agent Smith', 'Skynet'], respuesta: 1 },
  { pregunta: '¿En qué año está ambientada Back to the Future?', opciones: ['1985', '1955', '2015', 'Las 3'], respuesta: 3 },
  { pregunta: '¿Qué actor es Neo en Matrix?', opciones: ['Hugo Weaving', 'Laurence Fishburne', 'Keanu Reeves', 'Carrie-Anne Moss'], respuesta: 2 },
  { pregunta: '¿Qué película ganó el Oscar a Mejor VFX en 2010?', opciones: ['Avatar', '2012', 'District 9', 'Star Trek'], respuesta: 0 },

  // Romance / Drama
  { pregunta: '¿Qué película tiene la canción "My Heart Will Go On"?', opciones: ['Ghost', 'Dirty Dancing', 'Titanic', 'Grease'], respuesta: 2 },
  { pregunta: '¿En qué ciudad ocurre Amélie?', opciones: ['Londres', 'Roma', 'París', 'Berlín'], respuesta: 2 },
  { pregunta: '¿Qué película tiene a Ryan Gosling y Rachel McAdams?', opciones: ['La La Land', 'The Notebook', 'Crazy Stupid Love', 'Blue Valentine'], respuesta: 1 },
  { pregunta: '¿Qué película de 2016 tiene a Ryan Gosling y Emma Stone?', opciones: ['Whiplash', 'La La Land', 'First Man', 'Drive'], respuesta: 1 },

  // Premios y datos
  { pregunta: '¿Qué película tiene más Oscars ganados?', opciones: ['Titanic', 'Ben-Hur', 'El Señor de los Anillos', 'Todas empatadas'], respuesta: 3 },
  { pregunta: '¿Qué director hizo Schindler\'s List?', opciones: ['Scorsese', 'Kubrick', 'Spielberg', 'Nolan'], respuesta: 2 },
  { pregunta: '¿Qué película tiene la mayor recaudación de la historia?', opciones: ['Avatar', 'Avengers Endgame', 'Titanic', 'Avatar 2'], respuesta: 0 },
  { pregunta: '¿Qué película de Nolan trata sobre sueños?', opciones: ['Memento', 'Interstellar', 'Inception', 'Tenet'], respuesta: 2 },
  { pregunta: '¿Qué actriz es Katniss en Los Juegos del Hambre?', opciones: ['Emma Watson', 'Jennifer Lawrence', 'Emma Stone', 'Shailene Woodley'], respuesta: 1 },
  { pregunta: '¿Quién compuso la música de Star Wars?', opciones: ['Hans Zimmer', 'John Williams', 'Ennio Morricone', 'Danny Elfman'], respuesta: 1 },
  { pregunta: '¿Qué película de 2014 ganó el Oscar a Mejor Película?', opciones: ['Gravity', 'El Gran Hotel Budapest', 'Boyhood', '12 años de esclavitud'], respuesta: 3 },
  { pregunta: '¿Qué actor ganó el Oscar por El Renacido?', opciones: ['Matt Damon', 'Michael Fassbender', 'Leonardo DiCaprio', 'Eddie Redmayne'], respuesta: 2 },
]

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0, triviaWins: 0 }
    user = global.db.data.users[who]
  }

  if (!global.triviaUsers) global.triviaUsers = {}

  if (global.triviaUsers[who]) {
    return conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n⚰️ Ya tienes una trivia activa\n> Respóndela primero!'
    }, { quoted: m })
  }

  let trivia = preguntas[Math.floor(Math.random() * preguntas.length)]

  global.triviaUsers[who] = {
    respuesta: trivia.respuesta,
    opciones: trivia.opciones,
    tiempo: Date.now() + 30000
  }

  let rows = trivia.opciones.map((op, i) => ({
    header: ['🅰️', '🅱️', '🇨', '🇩'][i],
    title: op,
    description: 'Opción ' + ['A', 'B', 'C', 'D'][i],
    id: 'trivia_' + i
  }))

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: { title: 'DENJI BOT - TRIVIA PELÍCULAS', subtitle: 'Responde en 30 segundos | 💎 2', hasMediaAttachment: false },
    body: {
      text: [
        '🩸 DENJI BOT 🩸',
        '',
        `🔪 *${trivia.pregunta}*`,
        '',
        '⏰ Tienes 30 segundos',
        '💎 Ganas 2 diamantes si aciertas',
        '',
        '> Elige tu respuesta'
      ].join('\n')
    },
    footer: { text: '🩸 DENJI BOT 🩸' },
    nativeFlowMessage: {
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🎬 OPCIONES',
          sections: [{ title: '💀 ' + trivia.pregunta.substring(0, 30), rows }]
        })
      }]
    }
  })

  const msg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
  }, { quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

  setTimeout(() => {
    if (global.triviaUsers && global.triviaUsers[who]) {
      const t = global.triviaUsers[who]
      delete global.triviaUsers[who]
      conn.sendMessage(m.chat, {
        text: [
          '🩸 DENJI BOT 🩸',
          '',
          '⏰ *¡Se acabó el tiempo!*',
          `🔪 La respuesta era: *${['A', 'B', 'C', 'D'][t.respuesta]}. ${t.opciones[t.respuesta]}*`,
          '',
          '> Usa #trivia para intentar de nuevo'
        ].join('\n')
      }, { quoted: m })
    }
  }, 30000)
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('trivia_')) return false

    let who = m.sender
    if (!global.triviaUsers || !global.triviaUsers[who]) return false

    let trivia = global.triviaUsers[who]
    let respuesta = parseInt(id.replace('trivia_', ''))
    delete global.triviaUsers[who]

    if (respuesta === trivia.respuesta) {
      let user = global.db.data.users[who]
      if (!user) {
        global.db.data.users[who] = { diamantes: 0, exp: 0, triviaWins: 0 }
        user = global.db.data.users[who]
      }
      user.diamantes = (user.diamantes || 0) + 2
      user.exp = (user.exp || 0) + 15
      user.triviaWins = (user.triviaWins || 0) + 1

      await conn.sendMessage(m.chat, {
        text: [
          '🩸 DENJI BOT 🩸',
          '',
          '🏆 *¡CORRECTO!*',
          `🔪 Era: *${['A', 'B', 'C', 'D'][trivia.respuesta]}. ${trivia.opciones[trivia.respuesta]}*`,
          '',
          '💎 +2 diamantes',
          '⚡ +15 exp',
          `🩸 Victorias: ${user.triviaWins}`,
          `💀 Total diamantes: ${user.diamantes}`,
          '',
          '> Usa #trivia para otra pregunta'
        ].join('\n')
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        text: [
          '🩸 DENJI BOT 🩸',
          '',
          '💀 *¡INCORRECTO!*',
          `🔪 La respuesta era: *${['A', 'B', 'C', 'D'][trivia.respuesta]}. ${trivia.opciones[trivia.respuesta]}*`,
          '',
          '> Usa #trivia para intentar de nuevo'
        ].join('\n')
      }, { quoted: m })
    }
    return true

  } catch (e) {
    console.log(e)
    return false
  }
}

handler.help = ['trivia']
handler.tags = ['game']
handler.command = /^(trivia|pelicula|cine)$/i
handler.desc = 'Trivia de películas | 💎 2'

export default handler
