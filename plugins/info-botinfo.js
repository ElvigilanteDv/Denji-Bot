import os from 'os'
import process from 'process'
import speed from 'performance-now'

let handler = async (m, { conn, usedPrefix }) => {
  const start = speed()

  await m.react('🪚')

  const msg = await conn.sendMessage(m.chat, {
    text: '⏳ *Denji está revisando la máquina...*'
  }, { quoted: m })

  const ping = (speed() - start).toFixed(0)

  const { emoji, estado, color } =
    ping < 50  ? { emoji: '⚡', estado: 'Ultra Rápido', color: '🟢' } :
    ping < 150 ? { emoji: '🪚', estado: 'Óptimo',       color: '🟢' } :
    ping < 300 ? { emoji: '🔥', estado: 'Estable',      color: '🟡' } :
    ping < 500 ? { emoji: '💨', estado: 'Lento',        color: '🟠' } :
                 { emoji: '🐌', estado: 'Crítico',      color: '🔴' }

  const uptime = process.uptime()
  const dias   = Math.floor(uptime / 86400)
  const horas  = Math.floor((uptime % 86400) / 3600)
  const mins   = Math.floor((uptime % 3600) / 60)
  const segs   = Math.floor(uptime % 60)
  const uptimeStr = [
    dias  && `${dias}d`,
    horas && `${horas}h`,
    mins  && `${mins}m`,
    `${segs}s`
  ].filter(Boolean).join(' ')

  const totalRam   = os.totalmem()
  const freeRam    = os.freemem()
  const usedRam    = totalRam - freeRam
  const totalMB    = (totalRam / 1024 / 1024).toFixed(0)
  const usedMB     = (usedRam  / 1024 / 1024).toFixed(0)
  const freeMB     = (freeRam  / 1024 / 1024).toFixed(0)
  const ramPercent = ((usedRam / totalRam) * 100).toFixed(1)

  const barraRAM = (() => {
    const lleno = Math.round((usedRam / totalRam) * 10)
    return '🩸'.repeat(lleno) + '⬛'.repeat(10 - lleno)
  })()

  const ramColor =
    ramPercent < 50 ? '🟢' :
    ramPercent < 75 ? '🟡' :
    ramPercent < 90 ? '🟠' : '🔴'

  const cpus      = os.cpus()
  const cpuModel  = cpus[0]?.model?.trim() || 'Desconocido'
  const cpuCores  = cpus.length
  const platform  = `${os.platform()} ${os.arch()}`
  const hostname  = os.hostname()

  const totalPlugins = Object.keys(global.plugins || {}).length
  const totalSubBots = (global.conns || []).filter(c => c?.user).length
  const totalUsers   = Object.keys(global.db?.data?.users || {}).length
  const totalChats   = Object.keys(global.db?.data?.chats || {}).length

  const botName = conn.user?.name || global.namebot || 'Denji Bot'
  const botNum  = conn.user?.jid?.split('@')[0] || '?'

  const txt = [
    `🪚「 DENJI BOT — STATUS 」🩸`,
    ``,
    `💀 *${botName}*`,
    `📱 +${botNum}`,
    `🟢 *Online y la motosierra encendida*`,
    ``,
    `🏓 *PING*`,
    `${color} ${emoji} *${ping} ms* — ${estado}`,
    ``,
    `⏱️ *UPTIME*`,
    `☠️ *Activo:* ${uptimeStr}`,
    ``,
    `💾 *RAM*`,
    `${ramColor} ${barraRAM} ${ramPercent}%`,
    `🩸 *Usado:*  ${usedMB} MB`,
    `✅ *Libre:*  ${freeMB} MB`,
    `📊 *Total:*  ${totalMB} MB`,
    ``,
    `🖥️ *SISTEMA*`,
    `💻 *SO:*     ${platform}`,
    `🏷️ *Host:*   ${hostname}`,
    `⚙️ *CPU:*    ${cpuModel.slice(0, 25)}`,
    `🔧 *Núcleos:* ${cpuCores}`,
    ``,
    `📊 *ESTADÍSTICAS DEL MATADERO*`,
    `🪚 *Plugins:*  ${totalPlugins}`,
    `🩸 *SubBots:*  ${totalSubBots}`,
    `👥 *Usuarios:* ${totalUsers.toLocaleString()}`,
    `💬 *Chats:*    ${totalChats.toLocaleString()}`,
    `📌 *Prefijo:*  ${usedPrefix}`,
    ``,
    `ℹ️ *INFO*`,
    `🪚 *Bot:*      Denji Bot`,
    `👑 *Creador:*  © JM`,
    `📦 *Versión:*  ${global.vs || '1.0.0'}`,
    `🔗 *Base:*     Baileys ${global.baileys || ''}`,
    ``,
    `☠️ *La motosierra nunca se apaga*`,
  ].join('\n')

  try {
    await conn.sendMessage(m.chat, { text: txt, edit: msg.key })
  } catch {
    await conn.sendMessage(m.chat, { text: txt }, { quoted: m })
  }

  await m.react('🪚')
}

handler.help    = ['status']
handler.tags    = ['info']
handler.command = /^(status|estado|stats|sistema)$/i
handler.desc    = '🪚 Estado del sistema con la motosierra de Denji'

export default handler
