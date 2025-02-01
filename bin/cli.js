#!/usr/bin/env node
import downloadPage from '../src/pageLoader.js' // Importa como default
import { program } from 'commander'
import path from 'path'

program
  .version('1.0.0')
  .description('Downloads a webpage and its resources.')
  .option('-o, --output [dir]', 'output directory (default: current working directory)', process.cwd())
  .arguments('<url>')
  .action((url, options) => {
    const outputDir = path.resolve(options.output)
    downloadPage(url, outputDir)
      .then(({ filepath }) => {
        console.log(`Page was successfully downloaded into '${filepath}'`)
      })
      .catch(error => {
        console.error(error.message)
        process.exit(1)
      })
  })

program.on('--help', () => {
  console.log('')
  console.log('Example usage:')
  console.log('  $ page-loader -o ./output https://example.com')
  console.log('')
})

program.parse(process.argv)
