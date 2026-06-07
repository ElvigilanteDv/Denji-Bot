import { exec } from 'child_process'

const handler = async (m, { conn }) => {
  let who = m.sender

  await conn.sendMessage(m.chat, { text: '⏳ Buscando actualizaciones para DENJI BOT...' }, { quoted: m })

  exec('git pull', async (err, stdout, stderr) => {
    if (err) {
      let error = err.message
      if (error.includes('not a git repository')) {
        await conn.sendMessage(m.chat, { text: '❌ No es un repositorio git' }, { quoted: m })
        return
      }
      if (error.includes('Could not resolve host')) {
        await conn.sendMessage(m.chat, { text: '❌ Sin conexión a internet' }, { quoted: m })
        return
      }
      if (error.includes('Merge conflict')) {
        await conn.sendMessage(m.chat, { text: '⚠️ Conflicto detectado\nUsa #exec git stash && git pull --force' }, { quoted: m })
        return
      }
      if (error.includes('Please commit')) {
        await conn.sendMessage(m.chat, { text: '⚠️ Tienes cambios locales\nUsa #exec git stash && git pull' }, { quoted: m })
        return
      }
      await conn.sendMessage(m.chat, { text: '❌ Error:\n' + error }, { quoted: m })
      return
    }

    if (stdout.includes('Already up to date')) {
      await conn.sendMessage(m.chat, {
        image: { url: 'https://files.catbox.moe/zl732h.jpg' },
        caption: '⛓️ DENJI BOT ⛓️\n\n⚡ Denji ya está en su mejor versión\n🔗 No hay actualizaciones pendientes\n\n> Solicitado por @' + who.split('@')[0],
        mentions: [who]
      }, { quoted: m })
      return
    }

    let creados = stdout.match(/create mode \d+ (.+)/g) || []
    let eliminados = stdout.match(/delete mode \d+ (.+)/g) || []

    let filesCreados = creados.map(c => c.split(' ').pop())
    let filesEliminados = eliminados.map(c => c.split(' ').pop())

    let texto = '⛓️ DENJI BOT ACTUALIZADO ⛓️\n\n'
    texto += '⚡ Denji se ha renovado\n\n'

    if (filesCreados.length > 0) {
      texto += '🔩 *Nuevos archivos:*\n'
      for (let file of filesCreados) {
        texto += '  ❀ ' + file + '\n'
      }
      texto += '\n'
    }

    let changedMatch = stdout.match(/(\d+) files? changed/)
    if (changedMatch) {
      texto += '🩸 *Archivos modificados:*\n'
      texto += '  ❀ ' + changedMatch[1] + ' archivo(s)\n\n'
    }

    if (filesEliminados.length > 0) {
      texto += '💀 *Archivos eliminados:*\n'
      for (let file of filesEliminados) {
        texto += '  ❀ ' + file + '\n'
      }
      texto += '\n'
    }

    let summary = stdout.match(/\d+ files? changed, \d+ insertions?\(\+\), \d+ deletions?\(-\)/)
    if (summary) {
      let nums = summary[0].match(/\d+/g)
      texto += '📊 *Resumen:*\n'
      texto += '  ❀ +' + nums[1] + ' línea(s) agregada(s)\n'
      texto += '  ❀ -' + nums[2] + ' línea(s) eliminada(s)\n\n'
    }

    texto += '> Actualizado por @' + who.split('@')[0]

    await conn.sendMessage(m.chat, {
      image: { url: 'https://files.catbox.moe/ks2023.jpg' },
      caption: texto,
      mentions: [who]
    }, { quoted: m })
  })
}

handler.help = ['update']
handler.tags = ['owner']
handler.command = /^(update|actualizar)$/i
handler.desc = 'Actualiza Denji a la última versión'
handler.owner = true

export default handler
