import os from 'os'
import { execSync } from 'child_process'

function runCmd(cmd) {
  try { return execSync(cmd, { timeout: 3000 }).toString().trim() } catch { return null }
}

function getBattery() {
  try {
    const out = runCmd('termux-battery-status')
    if (out) {
      const json = JSON.parse(out)
      const icon = json.status === 'CHARGING' ? '⚡' : json.percentage > 50 ? '🔋' : '🪫'
      return `${icon} ${json.percentage}% — ${json.status === 'CHARGING' ? 'Cargando' : 'Descargando'}`
    }
  } catch {}
  return '❓ Instala Termux:API'
}

function getRamReal() {
  try {
    const meminfo = runCmd('cat /proc/meminfo')
    if (meminfo) {
      const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1] || 0)
      const avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1] || 0)
      const used = total - avail
      const toMB = kb => (kb / 1024).toFixed(0)
      return `${toMB(used)} MB / ${toMB(total)} MB (${((used/total)*100).toFixed(1)}%)`
    }
  } catch {}
  return `${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)} MB`
}

function getDisk() {
  try {
    const out = runCmd('df -h /data 2>/dev/null || df -h $HOME')
    if (out) {
      const line = out.split('\n').slice(-1)[0]
      const p = line.trim().split(/\s+/)
      return `${p[2]} usado / ${p[1]} total (${p[4]})`
    }
  } catch {}
  return 'N/A'
}

function getCPU() {
  try {
    const out = runCmd("grep 'Processor\|processor\|CPU' /proc/cpuinfo | head -1")
    if (out) return out.split(':')[1]?.trim()
  } catch {}
  return os.cpus()[0]?.model || 'ARM (Android)'
}

function getCPUCores() {
  try {
    const out = runCmd('nproc')
    if (out) return out + ' núcleos'
  } catch {}
  return os.cpus().length + ' núcleos'
}

function getLoad() {
  const load = os.loadavg()
  return `${load[0].toFixed(2)} | ${load[1].toFixed(2)} | ${load[2].toFixed(2)}`
}

function getAndroid() {
  try {
    const ver = runCmd('getprop ro.build.version.release')
    const sdk = runCmd('getprop ro.build.version.sdk')
    const brand = runCmd('getprop ro.product.brand')
    const model = runCmd('getprop ro.product.model')
    if (ver) return `${brand || ''} ${model || ''} — Android ${ver} (SDK ${sdk || '?'})`
  } catch {}
  return os.platform()
}

let handler = async (m, { conn }) => {
  let totalUsers = Object.keys(global.db.data.users).length
  let totalGroups = Object.keys(global.db.data.chats).filter(id => id.endsWith('@g.us')).length
  let totalCmds = Object.keys(global.plugins).length

  let uptime = process.uptime()
  let dias = Math.floor(uptime / 86400)
  let horas = Math.floor((uptime % 86400) / 3600)
  let minutos = Math.floor((uptime % 3600) / 60)
  let segundos = Math.floor(uptime % 60)

  const battery = getBattery()
  const ram = getRamReal()
  const disk = getDisk()
  const cpu = getCPU()
  const cores = getCPUCores()
  const load = getLoad()
  const android = getAndroid()
  const node = process.version

  const texto = [
    '🩸 DENJI BOT 🩸',
    '',
    '💀 *ESTADÍSTICAS DEL BOT*',
    '',
    `👤 Usuarios: *${totalUsers}*`,
    `👥 Grupos: *${totalGroups}*`,
    `🔪 Comandos: *${totalCmds}*`,
    `⏱️ Activo: *${dias}d ${horas}h ${minutos}m ${segundos}s*`,
    '',
    '🩸 *HARDWARE*',
    '',
    `🔋 Batería: *${battery}*`,
    `💾 RAM: *${ram}*`,
    `💿 Disco: *${disk}*`,
    `🖥️ CPU: *${cpu}*`,
    `⚙️ Núcleos: *${cores}*`,
    `📊 Carga CPU: *${load}*`,
    '',
    '⚰️ *SOFTWARE*',
    '',
    `📱 Dispositivo: *${android}*`,
    `📦 Node.js: *${node}*`,
    '',
    '🩸 DENJI BOT 🩸'
  ].join('\n')

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['botinfo']
handler.tags = ['info']
handler.command = /^(botinfo|stats|estado|info)$/i
handler.desc = 'Estadísticas completas del bot'

export default handler
