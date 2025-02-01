import axios from 'axios'
import path from 'path'
import { promises as fs } from 'fs'
import { URL } from 'url'
import * as cheerio from 'cheerio'
import debug from 'debug'
import _ from 'lodash'
import { Listr } from 'listr2'
import { urlToFilename, urlToDirname, getExtension, sanitizeOutputDir } from './utils.js'

const log = debug('page-loader')

// 🔹 Procesa y reemplaza las URLs de recursos dentro del HTML
const processResource = ($, tagName, attrName, baseUrl, baseDirname, assets) => {
  const $elements = $(tagName).toArray()
  const elementsWithUrls = $elements
    .map(element => $(element))
    .filter($element => $element.attr(attrName))
    .map($element => ({ $element, url: new URL($element.attr(attrName), baseUrl) }))
    .filter(({ url }) => url.origin === baseUrl)

  elementsWithUrls.forEach(({ $element, url }) => {
    const slug = urlToFilename(`${url.hostname}${url.pathname}`)
    const filepath = path.join(baseDirname, slug)
    assets.push({ url, filename: slug })
    $element.attr(attrName, filepath)
  })
}

// 🔹 Obtiene y procesa todos los recursos del HTML
const processResources = (baseUrl, baseDirname, html) => {
  const $ = cheerio.load(html, { decodeEntities: false })
  const assets = []

  processResource($, 'img', 'src', baseUrl, baseDirname, assets)
  processResource($, 'link', 'href', baseUrl, baseDirname, assets)
  processResource($, 'script', 'src', baseUrl, baseDirname, assets)

  return { html: $.html(), assets }
}

const downloadAsset = (dirname, { url, filename }) =>
  axios.get(url.toString(), { responseType: 'arraybuffer' }).then(response => {
    const fullPath = path.join(dirname, filename)
    return fs.writeFile(fullPath, response.data)
  })

// 🔹 Función principal para descargar una página
const downloadPage = async (pageUrl, outputDirName = '') => {
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

      data = processResources(url.origin, assetsDirname, html)
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
