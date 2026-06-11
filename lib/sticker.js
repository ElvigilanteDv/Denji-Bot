import { dirname } from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileTypeFromBuffer } from 'file-type'
import webp from 'node-webpmux'
import fetch from 'node-fetch'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))
const tmp = path.join(__dirname, '../tmp')
if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })

async function addExif(webpSticker, packname, author, categories = [''], extra = {}) {
  try {
    const img = new webp.Image()
    const stickerPackId = crypto.randomBytes(32).toString('hex')
    const json = {
      'sticker-pack-id': stickerPackId,
      'sticker-pack-name': packname || '⛓️ DENJI BOT',
      'sticker-pack-publisher': author || '© Creado por JM',
      'emojis': categories,
      ...extra
    }
    const exifAttr = Buffer.from([
      0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,
      0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,
      0x00,0x00,0x16,0x00,0x00,0x00
    ])
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
    const exif = Buffer.concat([exifAttr, jsonBuffer])
    exif.writeUIntLE(jsonBuffer.length, 14, 4)
    await img.load(webpSticker)
    img.exif = exif
    return await img.save(null)
  } catch (e) {
    console.error('[addExif error]', e.message)
    return webpSticker
  }
}

async function stickerAnimado(img, url, packname, author) {
  let tmpIn = null
  let tmpOut = null
  try {
    if (url) {
      const res = await fetch(url)
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
      img = await res.buffer()
    }

    if (!img || !img.length) throw new Error('Buffer vacío')

    const type = await fileTypeFromBuffer(img) || { mime: 'application/octet-stream', ext: 'bin' }
    if (type.ext === 'bin') throw new Error('Tipo de archivo no soportado')

    const base = Date.now()
    tmpIn = path.join(tmp, `anim_${base}.${type.ext}`)
    tmpOut = path.join(tmp, `anim_${base}.webp`)

    await fs.promises.writeFile(tmpIn, img)

   const cmd = `ffmpeg -y -i "${tmpIn}" -ss 0 -t 6 -an -vcodec libwebp -loop 0 -vsync 0 -vf "fps=12,scale=480:480:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -qscale:v 60 -compression_level 6 "${tmpOut}"`

    await execAsync(cmd)

    const buf = await fs.promises.readFile(tmpOut)
    if (!buf || buf.length < 100) throw new Error('Webp inválido o vacío')
    return buf

  } finally {
    if (tmpIn) fs.promises.unlink(tmpIn).catch(() => {})
    if (tmpOut) fs.promises.unlink(tmpOut).catch(() => {})
  }
}

async function stickerEstatico(img, url, packname, author) {
  let tmpIn = null
  let tmpOut = null
  try {
    if (url) {
      const res = await fetch(url)
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
      img = await res.buffer()
    }

    if (!img || !img.length) throw new Error('Buffer vacío')

    const type = await fileTypeFromBuffer(img) || { mime: 'application/octet-stream', ext: 'bin' }
    if (type.ext === 'bin') throw new Error('Tipo de archivo no soportado')

    const base = Date.now()
    tmpIn = path.join(tmp, `static_${base}.${type.ext}`)
    tmpOut = path.join(tmp, `static_${base}.webp`)

    await fs.promises.writeFile(tmpIn, img)

    const cmd = `ffmpeg -y -i "${tmpIn}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -qscale 80 -preset picture "${tmpOut}"`

    await execAsync(cmd)

    const buf = await fs.promises.readFile(tmpOut)
    if (!buf || buf.length < 100) throw new Error('Webp inválido o vacío')
    return buf

  } finally {
    if (tmpIn) fs.promises.unlink(tmpIn).catch(() => {})
    if (tmpOut) fs.promises.unlink(tmpOut).catch(() => {})
  }
}

async function sticker5(img, url, packname, author, categories = [''], extra = {}) {
  try {
    const { Sticker } = await import('wa-sticker-formatter')
    const stickerMetadata = {
      type: 'default',
      pack: packname || '⛓️ DENJI BOT',
      author: author || '© Creado por JM',
      categories,
      ...extra
    }
    return await (new Sticker(img ? img : url, stickerMetadata)).toBuffer()
  } catch (e) {
    throw new Error('sticker5 falló: ' + e.message)
  }
}

async function sticker(img, url, packname, author, categories = [''], extra = {}) {
  const pack = packname || global.packname || '⛓️ DENJI BOT'
  const auth = author || global.author || '© Creado por JM'

  let isAnimated = false
  try {
    const checkBuf = img || (url ? await fetch(url).then(r => r.buffer()) : null)
    if (checkBuf) {
      const type = await fileTypeFromBuffer(checkBuf) || {}
      isAnimated = /video/i.test(type.mime) || type.mime === 'image/gif'
    }
  } catch {}

  const funcs = isAnimated
    ? [stickerAnimado, sticker5]
    : [stickerEstatico, sticker5]

  for (let func of funcs) {
    try {
      const stiker = await func(img, url, pack, auth, categories, extra)
      if (!stiker || stiker.length < 100) throw new Error('Buffer inválido')

      try {
        return await addExif(stiker, pack, auth, categories, extra)
      } catch (e) {
        console.error('[addExif fallback]', e.message)
        return stiker
      }
    } catch (err) {
      console.error(`[${func.name} failed]`, err.message)
    }
  }

  throw new Error('No se pudo crear el sticker con ningún método')
}

const support = {
  ffmpeg: true,
  ffprobe: true,
  ffmpegWebp: true,
  convert: true,
  magick: false,
  gm: false,
  find: false
}

global.support = support

export {
  sticker,
  stickerAnimado,
  stickerEstatico,
  sticker5,
  addExif,
  support
}
