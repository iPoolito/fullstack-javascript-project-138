import { jest } from '@jest/globals'
import nock from 'nock'
import fs from 'fs'
import pageLoader from '../src/pageLoader.js'

describe('Error Handling', () => {
  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit called with code: ${code}`)
    })

    nock('https://example.com').get('/').reply(200, '<html><body><h1>Mocked Page</h1></body></html>')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    nock.cleanAll()
  })

  test('should handle file system errors (no write access)', async () => {
    jest.spyOn(fs.promises, 'writeFile').mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })

    await expect(pageLoader('https://example.com', '/protected/path')).rejects.toThrow(
      'process.exit called with code: 1'
    )
  })

  test('should handle missing output directory', async () => {
    jest.spyOn(fs.promises, 'writeFile').mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    await expect(pageLoader('https://example.com', '/nonexistent/dir')).rejects.toThrow(
      'process.exit called with code: 1'
    )
  })

  test('should handle network errors', async () => {
    nock.cleanAll() // Clear existing mocks

    nock('https://example.com').get('/nonexistent').reply(404)

    await expect(pageLoader('https://example.com/nonexistent', './output')).rejects.toThrow(
      'process.exit called with code: 1'
    )
  })
})
