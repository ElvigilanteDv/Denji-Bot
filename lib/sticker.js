import { dirname } from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileTypeFromBuffer } from 'file-type'
import webp from 'node-webpmux'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))
const tmp = path.join(__dirname, '../tmp')
if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })

async function addExif(webpSticker, packname, author, categories = ['']) {
  try {
    const img = new webp.Image()
    const json = {
      'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
      'sticker-pack-name': packname || '⛓️🩸 DENJI BOT 🩸⛓️',
      'sticker-pack-publisher': author || '🩸 DENJI BOT © JM 🩸',
      'emojis': categories
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

const scaleFilter = `scale='if(gt(iw,ih),512,-2)':'if(gt(ih,iw),512,-2)',pad=512:512:(512-iw)/2:(512-ih)/2:color=#00000000,format=rgba`

async function stickerEstatico(buffer, packname, author) {
  const type = await fileTypeFromBuffer(buffer)
  if (!type || type.ext === 'bin') throw new Error('Tipo de archivo no soportado')

  const base = Date.now()
  const tmpIn  = path.join(tmp, `s_${base}.${type.ext}`)
  const tmpOut = path.join(tmp, `s_${base}.webp`)

  try {
    await fs.promises.writeFile(tmpIn, buffer)

    await execAsync([
      'ffmpeg -y',
      `-i "${tmpIn}"`,
      '-vcodec libwebp',
      `-vf "${scaleFilter}"`,
      '-pix_fmt yuva420p',
      '-qscale:v 80',
      '-preset picture',
      `"${tmpOut}"`
    ].join(' '))

    const buf = await fs.promises.readFile(tmpOut)
    if (!buf || buf.length < 100) throw new Error('Webp estático inválido')
    return buf
  } finally {
    fs.promises.unlink(tmpIn).catch(() => {})
    fs.promises.unlink(tmpOut).catch(() => {})
  }
}

async function stickerAnimado(buffer, packname, author) {
  const type = await fileTypeFromBuffer(buffer)
  if (!type || type.ext === 'bin') throw new Error('Tipo de archivo no soportado')

  const base = Date.now()
  const tmpIn  = path.join(tmp, `a_${base}.${type.ext}`)
  const tmpOut = path.join(tmp, `a_${base}.webp`)

  try {
    await fs.promises.writeFile(tmpIn, buffer)

    const { stdout } = await execAsync(
      `ffprobe -v error -select_streams v:0 -show_entries format=duration -of csv=p=0 "${tmpIn}"`
    ).catch(() => ({ stdout: '6' }))

    const durReal = parseFloat(stdout.trim()) || 6
    const dur     = Math.min(durReal, 6)

    const fps = dur <= 2 ? 20 : dur <= 4 ? 15 : 12

    const buildCmd = (fpsVal, qscale, compression, outPath) => [
      'ffmpeg -y',
      `-i "${tmpIn}"`,
      `-t ${dur}`,
      '-an',
      '-vcodec libwebp',
      '-loop 0',
      `-vf "fps=${fpsVal},${scaleFilter}"`,
      '-pix_fmt yuva420p',
      `-qscale:v ${qscale}`,
      `-compression_level ${compression}`,
      '-preset default',
      `"${outPath}"`
    ].join(' ')

    await execAsync(buildCmd(fps, 80, 4, tmpOut))
    let buf = await fs.promises.readFile(tmpOut)
    if (!buf || buf.length < 100) throw new Error('Webp animado inválido')

    if (buf.length > 500 * 1024) {
      console.log('[stickerAnimado] >500KB, recomprimiendo...')
      const tmpOut2 = path.join(tmp, `a_${base}_v2.webp`)
      await execAsync(buildCmd(Math.max(fps - 4, 8), 60, 6, tmpOut2))
      const buf2 = await fs.promises.readFile(tmpOut2).catch(() => null)
      fs.promises.unlink(tmpOut2).catch(() => {})
      if (buf2 && buf2.length >= 100) buf = buf2
    }

    return buf
  } finally {
    fs.promises.unlink(tmpIn).catch(() => {})
    fs.promises.unlink(tmpOut).catch(() => {})
  }
}

async function sticker(buffer, opts = {}) {
  if (!buffer || !buffer.length) throw new Error('Buffer vacío')

  const packname   = opts.packname   || global.packname || '⛓️🩸 DENJI BOT 🩸⛓️'
  const author     = opts.author     || global.author   || '🩸 DENJI BOT © JM 🩸'
  const categories = opts.categories || ['']

  const type = await fileTypeFromBuffer(buffer) || {}
  const isAnimated = /video/i.test(type.mime) || type.mime === 'image/gif'

  const raw = isAnimated
    ? await stickerAnimado(buffer, packname, author)
    : await stickerEstatico(buffer, packname, author)

  return addExif(raw, packname, author, categories)
}

export { sticker, stickerAnimado, stickerEstatico, addExif }
