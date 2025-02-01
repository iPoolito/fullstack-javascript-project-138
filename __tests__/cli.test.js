import path from 'path'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import nock from 'nock'
import fetch from 'node-fetch' // Para la validación de los mocks
import downloadPage from '../src/pageLoader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('PageLoader with Fixtures', () => {
  const fixturesDir = path.join(__dirname, '../__fixtures__')
  const outputDir = path.join(fixturesDir, 'output')
  const expectedDir = path.join(fixturesDir, 'expected')

  beforeEach(async () => {
    await fs.rm(outputDir, { recursive: true, force: true })
    await fs.mkdir(outputDir, { recursive: true })

    // Activar depuración de nock para verificar coincidencias
    nock.emitter.on('no match', req => {
      console.log('No match for request:', req)
    })

    // Mock para las respuestas simuladas
    nock('https://google.com')
      .get('/')
      .reply(
        200,
        `<!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="utf-8">
            <title>Google</title>
            <link rel="stylesheet" href="/styles.css">
            <script src="/script.js"></script>
          </head>
          <body>
            <h1>Welcome to Google!</h1>
            <img src="/logo.png" alt="Google Logo" />
            <p>
              Visit our <a href="/about">About page</a> for more information.
            </p>
          </body>
        </html>`
      )

    nock('https://google.com').get('/logo.png').reply(200, 'fake-image-content', { 'Content-Type': 'image/png' })

    nock('https://google.com')
      .get('/styles.css')
      .reply(200, 'body { background-color: #f3f3f3; }', { 'Content-Type': 'text/css' })

    nock('https://google.com')
      .get('/script.js')
      .reply(200, 'console.log("Hello, world!");', { 'Content-Type': 'application/javascript' })
  })

  afterEach(() => {
    // Limpia todos los mocks después de cada prueba
    nock.cleanAll()
  })

  test('Mock works correctly', async () => {
    // Validación para asegurar que el mock responde correctamente
    const response = await fetch('https://google.com/')
    const body = await response.text()
    console.log('Mocked response:', body)
    expect(body).toContain('Welcome to Google')
  })

  test('Downloads HTML and resources correctly', async () => {
    const outputHtmlPath = path.join(outputDir, 'google.com.html')
    const expectedHtmlPath = path.join(expectedDir, 'google.com.html')
    const expectedFilesDir = path.join(expectedDir, 'google.com_files')
    const outputFilesDir = path.join(outputDir, 'google.com_files')

    // Llama la función principal
    console.log('Downloading page from https://google.com')
    await downloadPage('https://google.com', outputDir)

    // Verifica el archivo HTML descargado
    const outputHtml = await fs.readFile(outputHtmlPath, 'utf-8')
    const expectedHtml = await fs.readFile(expectedHtmlPath, 'utf-8')

    // Normalización para eliminar diferencias triviales
    const normalizeHtml = html =>
      html
        .replace(/\\/g, '/') // Reemplaza los separadores de Windows por '/'
        .replace(/\s+/g, ' ') // Elimina espacios y saltos de línea extras
        .replace(/>\s+</g, '><') // Elimina espacios entre etiquetas
        .replace(/(\s)\/>/g, '>') // Elimina espacios antes de "/>" en etiquetas autocontenidas
        .replace(/\/>/g, '>') // Remueve las barras de cierre innecesarias en HTML5
        .trim() // Remueve espacios en los extremos

    expect(normalizeHtml(outputHtml)).toEqual(normalizeHtml(expectedHtml))

    // Verifica los recursos descargados
    const outputFiles = await fs.readdir(outputFilesDir)
    const expectedFiles = await fs.readdir(expectedFilesDir)
    expect(outputFiles.sort()).toEqual(expectedFiles.sort())

    // Verifica el contenido de cada recurso
    await Promise.all(
      expectedFiles.map(async file => {
        const outputFilePath = path.join(outputFilesDir, file)
        const expectedFilePath = path.join(expectedFilesDir, file)

        const outputContent = await fs.readFile(outputFilePath, 'utf-8')
        const expectedContent = await fs.readFile(expectedFilePath, 'utf-8')

        // Normalización de contenido (elimina diferencias menores)
        const normalizeContent = content => content.replace(/\r\n/g, '\n').trim()

        expect(normalizeContent(outputContent)).toBe(normalizeContent(expectedContent))
      })
    )
  })
})
