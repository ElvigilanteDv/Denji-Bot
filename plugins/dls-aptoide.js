import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const TMP_DIR = path.join(os.tmpdir(), 'denji-aptoide')
const MAX_APK_BYTES = 1.5 * 1024 * 1024 * 1024 // 1.5 GB — límite práctico (WA soporta hasta 2 GB)

function ensureTmp() {
  try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}
}
ensureTmp()

function deleteSafe(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p) } catch {}
}

async function downloadApk(url, destPath) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
    timeout: 10 * 60 * 1000
  })
  if (!res.ok) throw new Error(`Error descargando APK: HTTP ${res.status}`)

  // Revisar tamaño por Content-Length antes de descargar
  const contentLength = parseInt(res.headers.get('content-length') || '0', 10)
  if (contentLength > MAX_APK_BYTES) {
    throw new Error(`APK demasiado grande (${(contentLength / 1024 / 1024).toFixed(1)} MB)`)
  }

  // Stream directo al disco — no carga todo en RAM
  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(destPath)
    res.body.pipe(fileStream)
    res.body.on('error', reject)
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
  })

  const stat = fs.statSync(destPath)
  if (stat.size < 1000) throw new Error('El APK descargado está vacío o es inválido')
  if (stat.size > MAX_APK_BYTES) {
    deleteSafe(destPath)
    throw new Error(`APK demasiado grande (${(stat.size / 1024 / 1024).toFixed(1)} MB)`)
  }

  return stat.size
}

const SEP = '|~|'
const BASE = 'https://ws75.aptoide.com/api/7'

// ─── Helpers API ────────────────────────────────────────────────────────────

async function searchGames(query, limit = 8) {
  const url = `${BASE}/apps/search?query=${encodeURIComponent(query)}&limit=${limit}&language=es`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Aptoide API error ${res.status}`)
  const json = await res.json()
  if (json.info?.status !== 'OK') throw new Error('Aptoide devolvió error')
  return json.datalist?.list || []
}

async function getAppDetail(packageName) {
  const url = `${BASE}/apps/getApp?package_name=${encodeURIComponent(packageName)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Aptoide API error ${res.status}`)
  const json = await res.json()
  if (json.info?.status !== 'OK') throw new Error('No se encontró la app')
  return json.nodes?.meta?.data || null
}

async function getTopGames(limit = 10) {
  const url = `${BASE}/listTopApps?group=games&limit=${limit}&language=es`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Aptoide API error ${res.status}`)
  const json = await res.json()
  return json.datalist?.list || []
}

// ─── Formateadores ───────────────────────────────────────────────────────────

function formatSize(bytes = 0) {
  if (!bytes) return '?'
  const mb = bytes / 1024 / 1024
  return mb >= 1 ? mb.toFixed(1) + ' MB' : (bytes / 1024).toFixed(0) + ' KB'
}

function buildAptoideUrl(packageName) {
  return `https://aptoide.com/app/${packageName}`
}

function buildAppCard(app) {
  const name = app.name || app.package || 'Sin nombre'
  const pkg = app.package || ''
  const version = app.file?.vername || app.file?.vercode || '?'
  const size = formatSize(app.file?.filesize || app.size || 0)
  const rating = app.stats?.rating?.avg ? app.stats.rating.avg.toFixed(1) : '?'
  const downloads = app.stats?.downloads
    ? app.stats.downloads.toLocaleString()
    : '?'
  const apkUrl = app.file?.path || app.file?.apk?.path || ''
  const storeUrl = buildAptoideUrl(pkg)

  return { name, pkg, version, size, rating, downloads, apkUrl, storeUrl }
}

// ─── Handler principal ───────────────────────────────────────────────────────

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const input = text?.trim()

  if (!input) {
    return conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🎮 Scraper de juegos de Aptoide\n\n*Uso:*\n• ${usedPrefix}${command} <nombre del juego>\n• ${usedPrefix}${command} top — Ver juegos más populares\n\n> Powered by Aptoide API v7`
    }, { quoted: m })
  }

  await m.react('🩸')

  try {
    let lista = []

    if (input.toLowerCase() === 'top') {
      lista = await getTopGames(10)
      if (!lista.length) {
        await m.react('💀')
        return conn.sendMessage(m.chat, {
          text: '🩸 DENJI BOT 🩸\n\n💀 No se pudo obtener el top de juegos'
        }, { quoted: m })
      }
    } else {
      lista = await searchGames(input, 8)
      if (!lista.length) {
        await m.react('💀')
        return conn.sendMessage(m.chat, {
          text: `🩸 DENJI BOT 🩸\n\n💀 Sin resultados para: ${input}`
        }, { quoted: m })
      }
    }

    const rows = lista.slice(0, 8).map(app => {
      const pkg = app.package || ''
      const name = (app.name || pkg).substring(0, 35)
      const version = app.file?.vername || '?'
      const size = formatSize(app.file?.filesize || app.size || 0)
      const rating = app.stats?.rating?.avg ? app.stats.rating.avg.toFixed(1) + '⭐' : '?'
      const pkgB64 = Buffer.from(pkg).toString('base64url')
      const nameB64 = Buffer.from(name).toString('base64url')
      return {
        header: `🎮 v${version} | ${size}`,
        title: name,
        description: `${rating} | 📦 ${pkg.substring(0, 40)}`,
        id: 'aptg' + SEP + pkgB64 + SEP + nameB64
      }
    })

    const titulo = input.toLowerCase() === 'top' ? '🏆 TOP JUEGOS' : `🔍 ${input.toUpperCase().substring(0, 24)}`

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'DENJI BOT - APTOIDE GAMES', subtitle: 'Toca para ver el APK', hasMediaAttachment: false },
      body: { text: `🩸 DENJI BOT 🩸\n\n🎮 ${titulo}\n💀 ${rows.length} juegos encontrados\n\n> Elige uno para ver el enlace de descarga` },
      footer: { text: '🩸 DENJI BOT 🩸 | Aptoide API v7' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎮 RESULTADOS',
            sections: [{ title: titulo, rows }]
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

  } catch (e) {
    console.log('[APTOIDE ERROR]', e.message)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 Error: ' + e.message
    }, { quoted: m })
  }
}

// ─── Handler.before — detalle del juego seleccionado ────────────────────────

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('aptg' + SEP)) return false

    const payload = id.slice(('aptg' + SEP).length)
    const [pkgB64, nameB64] = payload.split(SEP)
    const pkg = Buffer.from(pkgB64, 'base64url').toString()
    const nombre = Buffer.from(nameB64, 'base64url').toString()

    await m.react('⏳')
    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n🎮 Obteniendo info de *${nombre}*...`
    }, { quoted: m })

    let card
    try {
      const detail = await getAppDetail(pkg)
      if (detail) {
        card = buildAppCard(detail)
      } else {
        throw new Error('Sin detalle')
      }
    } catch {
      card = {
        name: nombre,
        pkg,
        version: '?',
        size: '?',
        rating: '?',
        downloads: '?',
        apkUrl: '',
        storeUrl: buildAptoideUrl(pkg)
      }
    }

    // ── Info básica ──
    const infoText = [
      '🩸 DENJI BOT 🩸',
      '',
      `🎮 *${card.name}*`,
      `📦 Package: \`${card.pkg}\``,
      `📌 Versión: ${card.version}`,
      `💾 Tamaño: ${card.size}`,
      `⭐ Rating: ${card.rating}`,
      `📥 Descargas: ${card.downloads}`,
      '',
      `🔗 Aptoide: ${card.storeUrl}`,
    ].join('\n')

    await conn.sendMessage(m.chat, { text: infoText }, { quoted: m })

    // ── Intentar descargar y enviar el APK ──
    if (!card.apkUrl) {
      await conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 Este juego no tiene APK directo disponible en la API.\n> Descárgalo desde el link de Aptoide.'
      }, { quoted: m })
      await m.react('💀')
      return true
    }

    await conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n⚰️ Descargando APK de *${card.name}*...\n💀 Esto puede tardar según el tamaño`
    }, { quoted: m })

    const apkPath = path.join(TMP_DIR, `${pkg}-${Date.now()}.apk`)

    try {
      await downloadApk(card.apkUrl, apkPath)
      const apkStat = fs.statSync(apkPath)
      const sizeMb = (apkStat.size / 1024 / 1024).toFixed(1)
      const fileName = `${card.name.replace(/[^\w\s]/g, '').trim()}_v${card.version}.apk`

      await conn.sendMessage(m.chat, {
        document: { stream: fs.createReadStream(apkPath) },
        fileName,
        mimetype: 'application/vnd.android.package-archive',
        fileLength: apkStat.size,
        caption: `🩸 DENJI BOT 🩸\n\n🎮 *${card.name}*\n📌 v${card.version}\n💾 ${sizeMb} MB\n\n> ⚠️ Instala APKs solo de fuentes en las que confíes`
      }, { quoted: m })

      await m.react('🩸')

    } catch (dlErr) {
      // Si falló la descarga (muy pesado u otro error), mandar link como fallback
      await conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n⚠️ No pude enviar el APK directamente:\n_${dlErr.message}_\n\n📥 *Descárgalo manualmente:*\n${card.apkUrl}`
      }, { quoted: m })
      await m.react('⚠️')
    } finally {
      deleteSafe(apkPath)
    }

    return true

  } catch (e) {
    console.log('[APTOIDE ERROR]', e.message)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n💀 Error: ' + e.message
    }, { quoted: m })
    return true
  }
}

handler.help = ['aptoide']
handler.tags = ['tools']
handler.command = /^(aptoide|aptgame|apkgame)$/i
handler.desc = 'Busca juegos en Aptoide y obtiene el enlace de descarga APK'

export default handler
