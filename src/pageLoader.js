import axios from 'axios'
import path from 'path'
import { promises as fs } from 'fs'
import { URL } from 'url'
import * as cheerio from 'cheerio'
import debug from 'debug'
import { Listr } from 'listr2'
import { urlToFilename, urlToDirname, getExtension, sanitizeOutputDir } from './utils.js'

const log = debug('page-loader')

// 🔹 Procesa y reemplaza las URLs de recursos dentro del HTML
const processResource = ($, tagName, attrName, baseUrl, baseDirname, assets) => {
  $(tagName).each((_, element) => {
    const $element = $(element)
    const attrValue = $element.attr(attrName)

    if (!attrValue) return

    const url = new URL(attrValue, baseUrl)

    // Solo procesar recursos que sean del mismo dominio
    if (url.origin !== baseUrl) return

    const slug = urlToFilename(`${url.hostname}${url.pathname}`)
    const filepath = path.join(baseDirname, slug)
    assets.push({ url, filename: slug })

    // Actualizar el atributo con la nueva ruta del archivo
    $element.attr(attrName, filepath)
  })
}

// 🔹 Obtiene y procesa todos los recursos del HTML
const processResources = ($, baseUrl, baseDirname) => {
  const assets = []

  processResource($, 'img', 'src', baseUrl, baseDirname, assets)
  processResource($, 'link[rel="stylesheet"]', 'href', baseUrl, baseDirname, assets)
  processResource($, 'script[src]', 'src', baseUrl, baseDirname, assets)

  return { html: $.html(), assets }
}

// 🔹 Función principal para descargar una página
const downloadPage = async (pageUrl, outputDirName) => {
  outputDirName = sanitizeOutputDir(outputDirName)

  log('url', pageUrl)
  log('output', outputDirName)

  const url = new URL(pageUrl)
  const slug = `${url.hostname}${url.pathname}`
  const filename = urlToFilename(slug)
  const fullOutputDirname = path.resolve(process.cwd(), outputDirName)
  const extension = getExtension(filename) === '.html' ? '' : '.html'
  const fullOutputFilename = path.join(fullOutputDirname, `${filename}${extension}`)
  const assetsDirname = urlToDirname(slug)
  const fullOutputAssetsDirname = path.join(fullOutputDirname, assetsDirname)

  let data
  const promise = axios
    .get(pageUrl)
    .then(response => {
      const html = response.data
      log(`✅ HTML: ${html}`)
      const $ = cheerio.load(html, { decodeEntities: false })
      data = processResources($, pageUrl, fullOutputAssetsDirname)
      return fs.access(fullOutputAssetsDirname).catch(() => fs.mkdir(fullOutputAssetsDirname))
    })
    .then(() => {
      log(`✅ HTML saved: ${fullOutputFilename}`)
      return fs.writeFile(fullOutputFilename, data.html)
    })
    .then(() => {
      const tasks = data.assets.map(asset => {
        log('asset', asset.url.toString(), asset.filename)
        return {
          title: asset.url.toString(),
          task: () => downloadAsset(fullOutputAssetsDirname, asset).catch(_.noop)
        }
      })
      // ¡Descargamos en paralelo!
      const listr = new Listr(tasks, { concurrent: true })
      return listr.run()
    })
    .then(() => {
      log(`🎉 File successfully saved at: ${fullOutputFilename}`)
      return { filepath: fullOutputFilename }
    })
  return promise
}

export default downloadPage
