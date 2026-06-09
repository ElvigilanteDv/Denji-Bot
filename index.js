console.clear()
console.log('🪚🩸 DENJI BOT 🩸🪚')
import { join, dirname } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { setupMaster, fork } from 'cluster'
import { watchFile, unwatchFile } from 'fs'
import cfonts from 'cfonts'
const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(__dirname)
cfonts.say('DENJI BOT', {
  font: 'block',
  align: 'center',
  gradient: ['#ff0000', '#8b0000', '#ff4500'],
  background: 'Black',
  letterSpacing: 1,
  lineHeight: 1,
  space: true,
  maxLength: '0',
  env: 'node'
})
console.log('\x1b[31m%s\x1b[0m', '═'.repeat(60))
console.log('\x1b[31m%s\x1b[0m', '   🪚 DENJI BOT - MOTOSIERRA ENCENDIDA 🩸')
console.log('\x1b[31m%s\x1b[0m', '═'.repeat(60))
cfonts.say('EL VIGILANTE & BRAYANRK', {
  font: 'console',
  align: 'center',
  gradient: ['#ff0000', '#8b0000', '#ff4500'],
  env: 'node'
})
console.log('\x1b[31m%s\x1b[0m', '\n"🩸 La motosierra siempre estará encendida, pase lo que pase 🩸"')
console.log('\x1b[31m%s\x1b[0m', '═'.repeat(60) + '\n')
let isWorking = false
let restartCount = 0
async function launch(scripts) {
  if (isWorking) return
  isWorking = true
  restartCount++
  for (const script of scripts) {
    const args = [join(__dirname, script), ...process.argv.slice(2)]
    console.log('\x1b[31m%s\x1b[0m', `🪚 Denji rev la motosierra - Intento #${restartCount}`)
    console.log('\x1b[33m%s\x1b[0m', '🩸 Cargando sangre... 🩸\n')
    setupMaster({
      exec: args[0],
      args: args.slice(1),
    })
    let child = fork()
    child.on('exit', (code) => {
      console.log('\x1b[31m%s\x1b[0m', `\n💀 Denji fue derrotado (Código: ${code})`)
      if (code === 0) {
        console.log('\x1b[32m%s\x1b[0m', '✅ DENJI BOT apagó la motosierra tranquilamente')
        return
      }
      isWorking = false
      console.log('\x1b[33m%s\x1b[0m', '🔄 Denji está regenerando con sangre del diablo...')
      console.log('\x1b[31m%s\x1b[0m', '🪚 ¡Motosierra reactivándose! 🩸\n')
      setTimeout(() => {
        launch(scripts)
      }, 1000)
      watchFile(args[0], () => {
        unwatchFile(args[0])
        console.log('\x1b[31m%s\x1b[0m', '🔄 ¡Actualización detectada! Denji afila la sierra...')
        launch(scripts)
      })
    })
    child.on('message', (msg) => {
      if (msg === 'ready') {
        console.log('\x1b[32m%s\x1b[0m', '🩸 DENJI BOT ESTÁ LISTO 🩸')
        console.log('\x1b[31m%s\x1b[0m', '🪚 Motosierra completamente encendida 🩸\n')
      }
    })
  }
}
console.log('\x1b[31m%s\x1b[0m', '🪚 Invocando a Denji... 🩸\n')
launch(['main.js'])
setTimeout(() => {
  console.log('\x1b[31m%s\x1b[0m', `
╔════════════════════════════════════╗
║     🪚 DENJI BOT HA DESPERTADO 🩸  ║
║      💀 MOTOSIERRA ENCENDIDA 💀    ║
╚════════════════════════════════════╝
  `)
}, 2000)
process.on('uncaughtException', (err) => {
  console.log('\x1b[31m%s\x1b[0m', '💥 ¡La motosierra explotó! 💥')
  console.log('\x1b[33m%s\x1b[0m', '🔄 Denji está bebiendo sangre del diablo para recuperarse...')
  console.error(err)
})
process.on('unhandledRejection', (err) => {
  console.log('\x1b[31m%s\x1b[0m', '🩸 ¡La motosierra vio algo perturbador! 🩸')
  console.log('\x1b[33m%s\x1b[0m', '🔄 Denji cierra los ojos y rev la sierra con más fuerza...')
  console.error(err)
})
