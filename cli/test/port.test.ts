import { createServer } from 'node:net'
import type { Server } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'

import { isPortInUse } from '../src/shared.ts'

const servers: Server[] = []

/** 在指定位址的隨機埠上開一個聆聽者，回傳實際埠號。該位址族不可用時回傳 null。 */
const listenOn = (host: string): Promise<number | null> => new Promise((resolve) => {
  const server = createServer()
  server.once('error', () => resolve(null))
  server.listen(0, host, () => {
    servers.push(server)
    resolve((server.address() as { port: number }).port)
  })
})

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
})

describe('isPortInUse', () => {
  it('偵測綁在 127.0.0.1 的聆聽者', async () => {
    const port = await listenOn('127.0.0.1')
    expect(port).not.toBeNull()
    expect(await isPortInUse(port as number)).toBe(true)
  })

  it('偵測綁在 ::1 的聆聽者（localhost 解析成 IPv6 時會連到它）', async () => {
    const port = await listenOn('::1')
    if (port === null) {
      return // 本機沒有 IPv6 回送，略過
    }
    expect(await isPortInUse(port)).toBe(true)
  })

  it('沒有人聆聽的埠回傳 false', async () => {
    const port = await listenOn('127.0.0.1')
    expect(port).not.toBeNull()
    await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
    expect(await isPortInUse(port as number)).toBe(false)
  })
})
