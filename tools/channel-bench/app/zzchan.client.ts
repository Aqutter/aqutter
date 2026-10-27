import { callFlutter, callPluginRaw } from '@aqutter/aqutter'

// 通用二進位通道的 Android 實機驗證（暫存複本）。載入後 10 秒自動執行。
const now = (): number => performance.now()
const round = (v: number): number => Math.round(v * 100) / 100

const open = async (name: string, tokenOverride?: string): Promise<WebSocket> => {
  const ep = await callFlutter('native_endpoint' as never) as unknown as { port: number, token: string }
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${ep.port}/channel/${name}?token=${tokenOverride ?? ep.token}`)
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => resolve(ws)
    ws.onerror = () => reject(new Error('refused'))
  })
}

const nextMessage = (ws: WebSocket): Promise<Uint8Array> => new Promise((resolve) => {
  ws.onmessage = e => resolve(new Uint8Array(e.data as ArrayBuffer))
})

const run = async () => {
  const out: Record<string, unknown> = { platform: navigator.userAgent }
  // 1. 被拒絕的情況
  const refused = async (name: string, token?: string) => open(name, token).then(() => false, () => true)
  out.refusedWrongToken = await refused('bench.bin', 'wrong')
  out.refusedUnknownName = await refused('bench.nope')

  const ws = await open('bench.bin')
  // 2. 正確性：2MB 圖樣來回
  const payload = new Uint8Array(2 * 1024 * 1024 + 1)
  payload[0] = 0
  for (let i = 1; i < payload.length; i++) payload[i] = i % 251
  let reply = nextMessage(ws)
  ws.send(payload)
  const echoed = await reply
  let ok = echoed.length === payload.length
  for (let i = 0; ok && i < payload.length; i += 997) ok = echoed[i] === payload[i]
  out.echo2MBIntact = ok

  // 3. 小訊息往返
  const rtts: number[] = []
  for (let i = 0; i < 300; i++) {
    const t = now()
    reply = nextMessage(ws)
    ws.send(new Uint8Array([0, 1, 2, 3]))
    await reply
    rtts.push(now() - t)
  }
  rtts.sort((a, b) => a - b)
  out.smallRtt = { meanMs: round(rtts.reduce((s, v) => s + v, 0) / rtts.length), p95Ms: round(rtts[Math.floor(rtts.length * 0.95)] ?? 0) }

  // 4. 下行 1MB x 100
  {
    const header = new DataView(new ArrayBuffer(9))
    header.setUint8(0, 1)
    header.setUint32(1, 100)
    header.setUint32(5, 1024 * 1024)
    let bytes = 0
    const t = now()
    await new Promise<void>((resolve) => {
      ws.onmessage = (e) => {
        const len = (e.data as ArrayBuffer).byteLength
        if (len === 1) resolve()
        else bytes += len
      }
      ws.send(header.buffer)
    })
    const sec = (now() - t) / 1000
    out.down1MB = { mbPerSec: round(bytes / 1048576 / sec), bytes }
  }
  // 5. 上行 1MB x 100
  {
    const chunk = new Uint8Array(1024 * 1024)
    chunk[0] = 3
    const t = now()
    for (let i = 0; i < 100; i++) {
      ws.send(chunk)
      while (ws.bufferedAmount > 8 * 1024 * 1024) await new Promise(r => setTimeout(r, 1))
    }
    reply = nextMessage(ws)
    ws.send(new Uint8Array([2]))
    const r = new DataView((await reply).buffer.slice(0))
    const sec = (now() - t) / 1000
    out.up1MB = { mbPerSec: round(100 / sec), receivedCount: r.getUint32(0), receivedBytes: r.getUint32(4) }
  }
  // 6. 關閉
  const closed = new Promise<number>(resolve => { ws.onclose = e => resolve(e.code) })
  ws.close()
  out.closeCode = await closed
  await callPluginRaw('bench', 'report', { json: JSON.stringify(out) })
}

if (typeof window !== 'undefined') {
  setTimeout(() => { run().catch(e => callPluginRaw('bench', 'report', { json: JSON.stringify({ error: String(e) }) })) }, 10000)
}
export default defineNuxtPlugin(() => {})
