import { Impit } from 'impit'

const impit = new Impit({ browser: 'chrome' })
const RE_URL = /(?:https?:\/\/)?(?:www\.|m\.|web\.|l\.)?facebook\.com\/[^\s<>"']+|fb\.watch\/[^\s<>"']+/i
const RE_ID = /\/reel\/(\d+)|[?&]v=(\d+)|\/videos\/(\d+)/
const RE_SHORT = /\/share\/(?:v|r|p)\/|fb\.watch\//
const HDR = { accept: 'text/html,application/xhtml+xml', 'accept-language': 'es-ES,es;q=0.9' }

const fb = async (url, { headers = {}, timeout = 45e3, binary = false } = {}) => {
  const res = await impit.fetch(url, {
    headers: { ...HDR, ...headers },
    signal: AbortSignal.timeout(timeout),
  })
  const body = binary ? Buffer.from(await res.bytes()) : await res.text()
  return { status: res.status, url: res.url, body }
}

const reelPage = id => `https://www.facebook.com/reel/${id}`
const reelId = u => (u.match(RE_ID) || []).slice(1).find(Boolean)
const unesc = s => s.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, '/')

const parseNum = v => {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).replace(/[^\d.,KMB]/gi, '').replace(',', '.'))
  if (Number.isNaN(n)) return null
  const u = String(v).toUpperCase()
  if (/K|MIL/.test(u)) return Math.round(n * 1e3)
  if (/M/.test(u)) return Math.round(n * 1e6)
  return Math.round(n)
}

const fromTitle = (t, k) => parseNum(t?.match(new RegExp(`([\\d.,]+)\\s*(mil|k|m)?\\s*${k}`, 'i'))?.[0])
const beforePost = (h, pid, re) => h.match(new RegExp(`${re.source}[\\s\\S]{0,8000}?"post_id":"${pid}"`))?.[1]

function parseStats(h, id) {
  const ogT = h.match(/property="og:title" content="([^"]+)"/i)?.[1]
  const ogD = h.match(/property="og:description" content="([^"]+)"/i)?.[1]
  const pid = h.match(new RegExp(`"video":\\{"id":"${id}"[\\s\\S]{0,12000}?"post_id":"(\\d+)"`))?.[1]
    || h.match(/"post_id":"(\d+)"/)?.[1]
  const last = ogT?.split('|').pop()?.trim()
  const s = {
    reelId: id,
    url: reelPage(id),
    description: ogD || (last && !/views|reproducciones|reactions|reacciones/i.test(last) ? last : null),
    views: +(h.match(/"(?:play|video_view|view)_count":(\d+)/)?.[1] || '') || fromTitle(ogT, 'reproducciones|views?'),
    reactions: pid ? +(beforePost(h, pid, /"unified_reactors":\{"count":(\d+)/) || '') : null,
    comments: pid ? +(beforePost(h, pid, /"total_comment_count":(\d+)/) || '') : null,
    shares: pid ? parseNum(beforePost(h, pid, /"share_count_reduced":"([^"]+)"/)) : null,
    ownerId: h.match(new RegExp(`facebook\\.com/(\\d+)/videos/[^"']*${id}`))?.[1],
  }
  if (!s.reactions) s.reactions = fromTitle(ogT, 'reacciones|reactions?')
  if (!s.views) s.views = fromTitle(ogT, 'reproducciones|views?')
  return s
}

function parseVideo(h, id) {
  const c = h.includes(`"id":"${id}"`) ? h.slice(h.indexOf(`"id":"${id}"`), h.indexOf(`"id":"${id}"`) + 25e3) : h
  const m = re => (c.match(re) || h.match(re))?.[1]
  return unesc(m(/"browser_native_hd_url":"((?:\\.|[^"\\])+)"/) || m(/"browser_native_sd_url":"((?:\\.|[^"\\])+)"/) || '')
}

async function getReel(text) {
  // Limpia el texto: extrae solo el link aunque venga con texto de más
  const raw = String(text || '').trim()
  const link = (raw.match(RE_URL)?.[0] || raw.split(/\s+/)[0])?.replace(/[.,;:!?)]+$/g, '')
  if (!link) return null
  const source = link.startsWith('http') ? link : `https://${link}`
  let id = reelId(source)
  let html

  if (!id && RE_SHORT.test(source)) {
    const r = await fb(source)
    id = reelId(r.url) || r.body.match(/\/reel\/(\d+)/)?.[1]
    html = r.body
    if (!id) return null
  }

  if (!id) return null
  const url = reelPage(id)
  if (!html) {
    const r = await fb(url)
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
    if (/login|two_step_verification/i.test(r.url)) throw new Error('Reel privado o requiere login')
    html = r.body
  }

  const stats = parseStats(html, id)
  stats.sourceUrl = source !== url ? source : undefined
  stats.videoUrl = parseVideo(html, id)
  return stats
}

const fmt = n => n == null ? '—' : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : `${n}`

const caption = s =>
  `🩸 DENJI BOT 🩸\n\n🔪 Descarga completada\n\n💀 ${s.description || 'Reel'}\n\n👁️ *${fmt(s.views)}* vistas\n❤️ *${fmt(s.reactions)}* reacciones\n💬 *${fmt(s.comments)}* comentarios\n↗️ *${fmt(s.shares)}* compartidos\n\n> ${s.url}`

let handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    if (!text) {
      return conn.sendMessage(m.chat, {
        text: `🩸 DENJI BOT 🩸\n\n🔪 Descarga reels y videos de Facebook\n\n> ${usedPrefix}${command} <link>\n> Ejemplo: ${usedPrefix}${command} https://facebook.com/reel/xxx\n\n💀 También funciona si mandas texto con el link`
      }, { quoted: m })
    }

    await m.react('🩸')

    const target = await getReel(text)
    if (!target) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 Link inválido\n\n> Usa un link de /reel/ o /share/v/...'
      }, { quoted: m })
    }

    await conn.sendMessage(m.chat, {
      text: '🩸 DENJI BOT 🩸\n\n⚰️ Descargando...'
    }, { quoted: m })

    if (!target.views && !target.reactions && !target.comments) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: '🩸 DENJI BOT 🩸\n\n💀 Reel privado o bloqueado'
      }, { quoted: m })
    }

    if (!target.videoUrl) {
      await m.react('💀')
      return conn.sendMessage(m.chat, {
        text: caption(target) + '\n\n⚠️ Stats OK pero video no disponible'
      }, { quoted: m })
    }

    const video = await fb(target.videoUrl, {
      binary: true,
      timeout: 120e3,
      headers: { referer: target.url, origin: 'https://www.facebook.com' },
    })

    if (video.status !== 200 || video.body.length < 5e3) {
      throw new Error('No se pudo descargar el video')
    }

    const name = `${(target.description || `reel_${target.reelId}`).replace(/[<>:"/\\|?*\n]/g, '').slice(0, 50)}.mp4`

    await conn.sendMessage(m.chat, {
      [(video.body.length > 99 * 1024 * 1024) ? 'document' : 'video']: video.body,
      mimetype: 'video/mp4',
      fileName: name,
      caption: caption(target),
    }, { quoted: m })

    await m.react('🩸')

  } catch (e) {
    console.error('[FBReel]', e)
    await m.react('💀')
    conn.sendMessage(m.chat, {
      text: `🩸 DENJI BOT 🩸\n\n💀 Error: ${e.message || e}`
    }, { quoted: m })
  }
}

handler.help = ['facebook']
handler.tags = ['downloader']
handler.command = /^(fb|fbreel|facebook|reel)$/i
handler.desc = 'Descarga reels y videos de Facebook'

export default handler
