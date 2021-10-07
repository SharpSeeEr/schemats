import { spawnSync } from 'child_process'
import * as assert from 'power-assert'

describe('schemats cli tool integration testing', () => {
  describe('schemats generate postgres', () => {
    let postgresUrl: string | undefined
    before(async function () {
      if (!process.env.POSTGRES_URL) {
        return this.skip()
      }
      postgresUrl = process.env.POSTGRES_URL
    })
    it('should run without error', () => {
      const { status } = spawnSync('node', [
        'bin/schemats', 'generate',
        '-c', postgresUrl as string,
        '-o', '/tmp/schemats_cli_postgres.ts'
      ], { encoding: 'utf-8' })
      assert.equal(0, status)
    })
  })
  describe('schemats generate mysql', () => {
    let mysqlUrl: string | undefined
    before(async function () {
      if (!process.env.MYSQL_URL) {
        return this.skip()
      }
    })
    it('should run without error', () => {
      const { status } = spawnSync('node', [
        'bin/schemats', 'generate',
        '-c', mysqlUrl as string,
        '-s', 'test',
        '-o', '/tmp/schemats_cli_postgres.ts'
      ])
      assert.equal(0, status)
    })
  })
})
