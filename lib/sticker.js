import { dirname } from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import fluent_ffmpeg from 'fluent-ffmpeg'
import { fileTypeFromBuffer } from 'file-type'
import webp from 'node-webpmux'
import fetch from 'node-fetch'

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

function sticker6(img, url, packname, author) {
  return new Promise(async (resolve, reject) => {
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

      tmpIn = path.join(tmp, `${+new Date()}.${type.ext}`)
      tmpOut = tmpIn + '.webp'

      await fs.promises.writeFile(tmpIn, img)

      const isVideo = /video/i.test(type.mime)
      const isGif = type.mime === 'image/gif'
      const isAnimated = isVideo || isGif

      const videoFilter = isAnimated
        ? `scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse`
        : `scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=white@0.0`

      const opts = ['-vcodec', 'libwebp', '-vf', videoFilter, '-preset', 'default', '-an', '-vsync', '0', '-quality', '80']
      if (isAnimated) opts.push('-loop', '0', '-ss', '0', '-t', '5')

      let ff = fluent_ffmpeg(tmpIn)
      if (isVideo) ff = ff.inputFormat(type.ext)

      ff.addOutputOptions(opts)
        .toFormat('webp')
        .save(tmpOut)
        .on('error', async (err) => {
          await fs.promises.unlink(tmpIn).catch(() => {})
          await fs.promises.unlink(tmpOut).catch(() => {})
          reject(err)
        })
        .on('end', async () => {
          await fs.promises.unlink(tmpIn).catch(() => {})
          try {
            const buf = await fs.promises.readFile(tmpOut)
            await fs.promises.unlink(tmpOut).catch(() => {})
            resolve(buf)
          } catch (e) {
            reject(e)
          }
        })

    } catch (e) {
      if (tmpIn) await fs.promises.unlink(tmpIn).catch(() => {})
      if (tmpOut) await fs.promises.unlink(tmpOut).catch(() => {})
      reject(e)
    }
  })
}

async function sticker5(img, url, packname, author, categories = [''], extra = {}) {
  const { Sticker } = await import('wa-sticker-formatter')
  const stickerMetadata = {
    type: 'default',
    pack: packname || '⛓️ DENJI BOT',
    author: author || '© Creado por JM',
    categories,
    ...extra
  }
  return (new Sticker(img ? img : url, stickerMetadata)).toBuffer()
}

async function sticker(img, url, packname, author, categories = [''], extra = {}) {
  const pack = packname || global.packname || '⛓️ DENJI BOT'
  const auth = author || global.author || '© Creado por JM'

  const funcs = [
    sticker6,
    sticker5,
  ].filter(Boolean)

  let lastError
  for (let func of funcs) {
    try {
      const stiker = await func(img, url, pack, auth, categories, extra)
      if (!stiker || !stiker.length) throw new Error('Buffer vacío')

      const isWebp = stiker.slice(0, 4).toString() === 'RIFF' || stiker.includes('WEBP')
      if (!isWebp) throw new Error('No es WEBP válido')

      try {
        return await addExif(stiker, pack, auth, categories, extra)
      } catch (e) {
        console.error('[addExif fallback]', e.message)
        return stiker
      }
    } catch (err) {
      console.error(`[sticker ${func.name} failed]`, err.message)
      lastError = err
    }
  }

  throw lastError || new Error('No se pudo crear el sticker')
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
  sticker5,
  sticker6,
  addExif,
  support
}
