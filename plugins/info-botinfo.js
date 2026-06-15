import os from 'os'
import { execSync } from 'child_process'

function runCmd(cmd) {
  try { return execSync(cmd, { timeout: 3000 }).toString().trim() } catch { return null }
}

function getBattery() {
  try {
    // Termux
    const cap = runCmd('termux-battery-status')
    if (cap) {
      const json = JSON.parse(cap)
      const icon = json.status === 'CHARGING' ? '⚡' : json.percentage > 50 ? '🔋' : '🪫'
      return `${icon} ${json.percentage}% (${json.status === 'CHARGING' ? 'Cargando' : 'Descargando'})`
    }
  } catch {}
  try {
    const cap = runCmd('cat /sys/class/power_supply/battery/capacity')
    const status = runCmd('cat /sys/class/power_supply/battery/status')
    if (cap) return `🔋 ${cap}% (${status || '?'})`
  } catch {}
  return '❓ N/A'
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
  const mem = process.memoryUsage()
  return `${(mem.rss / 1024 / 1024).toFixed(0)} MB (proceso)`
}

function getDisk() {
  try {
    const out = runCmd('df -h /data 2>/dev/null || df -h / 2>/dev/null')
    if (out) {
      const line = out.split('\n').find(l => l.includes('/'))
      if (line) {
        const p = line.split(/\s+/)
        return `${p[2]} usado / ${p[1]} total (${p[4]})`
      }
    }
  } catch {}
  return 'N/A'
}

function getCPU() {
  try {
    const hw = runCmd('cat /proc/cpuinfo | grep "Hardware" | head -1')
    if (hw) return hw.split(':')[1]?.trim() || os.cpus()[0]?.model
    const model = runCmd("cat /proc/cpuinfo | grep 'model name' | head -1")
    if (model) return model.split(':')[1]?.trim()
  } catch {}
  return os.cpus()[0]?.model || 'N/A'
}

function getCPUUsage() {
  try {
    const out = runCmd("top -bn1 | grep 'Cpu\\|%Cpu' | head -1")
    if (out) {
      const idle = out.match(/(\d+\.?\d*)\s*id/)?.[1]
      if (idle) return `${(100 - parseFloat(idle)).toFixed(1)}%`
    }
    const load = os.loadavg()
    const cores = os.cpus().length
    return `${((load[0] / cores) * 100).toFixed(1)}% (carga)`
  } catch {}
  return 'N/A'
}

function getTemp() {
  try {
    const temp = runCmd('cat /sys/class/thermal/thermal_zone0/temp')
    if (temp) return `${(parseInt(temp) / 1000).toFixed(1)}°C`
    const temp2 = runCmd('termux-sensor -s "Battery Temperature" -n 1 2>/dev/null')
    if (temp2) {
      const val = JSON.parse(temp2)?.values?.[0]
      if (val) return `${val.toFixed(1)}°C`
    }
  } catch {}
  return 'N/A'
}

function getAndroidVersion() {
  try {
    const ver = runCmd('getprop ro.build.version.release')
    const sdk = runCmd('getprop ro.build.version.sdk')
    if (ver) return `Android ${ver} (SDK ${sdk || '?'})`
  } catch {}
  return os.platform()
}

function getNetworkSpeed() {
  try {
    const net = runCmd('cat /proc/net/dev | grep -E "wlan|rmnet" | head -1')
    if (net) {
      const parts = net.trim().split(/\s+/)
      const rx = (parseInt(parts[1]) / 1024 / 1024).toFixed(2)
      const tx = (parseInt(parts[9]) / 1024 / 1024).toFixed(2)
      return `↓ ${rx} MB | ↑ ${tx} MB`
    }
  } catch {}
  return 'N/A'
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
  const cpuUsage = getCPUUsage()
  const temp = getTemp()
  const android = getAndroidVersion()
  const network = getNetworkSpeed()
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
    '💀 *HARDWARE*',
    '',
    `🔋 Batería: *${battery}*`,
    `🌡️ Temperatura: *${temp}*`,
    `💾 RAM: *${ram}*`,
    `💿 Disco: *${disk}*`,
    `🖥️ CPU: *${cpu}*`,
    `⚡ Uso CPU: *${cpuUsage}*`,
    `📡 Red: *${network}*`,
    '',
    '💀 *SOFTWARE*',
    '',
    `📱 Sistema: *${android}*`,
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
