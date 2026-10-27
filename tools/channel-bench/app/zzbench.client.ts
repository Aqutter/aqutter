import { callPluginRaw, onPluginEventRaw } from '@aqutter/aqutter'

// 通道效能基準（只在暫存複本，不進任何 repo）。載入後 10 秒自動執行，結果由 Dart 寫成檔案。

const now = (): number => performance.now()

const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  return { n: values.length, meanMs: round(mean), p50Ms: round(at(0.5)), p95Ms: round(at(0.95)), p99Ms: round(at(0.99)), minMs: round(sorted[0] ?? 0), maxMs: round(sorted.at(-1) ?? 0) }
}

const round = (value: number): number => Math.round(value * 1000) / 1000

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const fromBase64 = (text: string): Uint8Array => {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const MB = 1024 * 1024

const runEvents = async (count: number, bytes: number, mode: 'seq' | 'burst') => {
  let received = 0
  let first = 0
  let last = 0
  const done = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`events timeout: received ${received}/${count}`)), 60_000)
    const stop = onPluginEventRaw('bench', 'event', () => {
      received += 1
      last = now()
      if (received === 1) {
        first = last
      }
      if (received === count) {
        clearTimeout(timer)
        stop()
        resolve()
      }
    })
  })
  const t0 = now()
  const dart = await callPluginRaw('bench', 'startEvents', { count, bytes, mode }) as { dartMs: number }
  await done
  const spanMs = Math.max(last - first, 0.001)
  return {
    count,
    bytes,
    mode,
    dartMs: dart.dartMs,
    totalMs: round(now() - t0),
    firstToLastMs: round(spanMs),
    eventsPerSecond: Math.round(((count - 1) / spanMs) * 1000),
  }
}

const openWs = (port: number): Promise<WebSocket> => new Promise((resolve, reject) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`)
  socket.binaryType = 'arraybuffer'
  socket.onopen = () => resolve(socket)
  socket.onerror = () => reject(new Error('ws error'))
})

const wsDown = async (port: number, count: number, bytes: number) => {
  const socket = await openWs(port)
  let received = 0
  let receivedBytes = 0
  const finished = new Promise<void>((resolve) => {
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        resolve()
      }
      else {
        received += 1
        receivedBytes += (event.data as ArrayBuffer).byteLength
      }
    }
  })
  const t0 = now()
  socket.send(JSON.stringify({ mode: 'down', count, bytes }))
  await finished
  const ms = now() - t0
  socket.close()
  return { direction: 'down', count: received, bytesEach: bytes, ms: round(ms), mbPerSecond: round((receivedBytes / MB) / (ms / 1000)), messagesPerSecond: Math.round(received / (ms / 1000)) }
}

const wsUp = async (port: number, count: number, bytes: number) => {
  const socket = await openWs(port)
  const chunk = new Uint8Array(bytes)
  const reply = new Promise<{ count: number, bytes: number }>((resolve) => {
    socket.onmessage = event => resolve(JSON.parse(event.data as string))
  })
  const t0 = now()
  for (let i = 0; i < count; i++) {
    socket.send(chunk)
    while (socket.bufferedAmount > 8 * MB) {
      await new Promise(resolve => setTimeout(resolve, 1))
    }
  }
  socket.send(JSON.stringify({ mode: 'upEnd' }))
  const result = await reply
  const ms = now() - t0
  socket.close()
  return { direction: 'up', count: result.count, bytesEach: bytes, ms: round(ms), mbPerSecond: round((result.bytes / MB) / (ms / 1000)), messagesPerSecond: Math.round(result.count / (ms / 1000)) }
}

const runAll = async (): Promise<void> => {
  const out: Record<string, unknown> = { userAgent: navigator.userAgent, startedAt: new Date().toISOString() }
  try {
    for (let i = 0; i < 50; i++) {
      await callPluginRaw('bench', 'ping', {})
    }

    // A. 小呼叫往返（循序）
    const rtt: number[] = []
    for (let i = 0; i < 300; i++) {
      const t = now()
      await callPluginRaw('bench', 'ping', { i })
      rtt.push(now() - t)
    }
    out.A_smallCallRoundTrip = stats(rtt)

    // B. 小呼叫吞吐（每批 100 個同時送出）
    {
      const t = now()
      for (let batch = 0; batch < 20; batch++) {
        await Promise.all(Array.from({ length: 100 }, (_, i) => callPluginRaw('bench', 'ping', { i })))
      }
      const seconds = (now() - t) / 1000
      out.B_smallCallThroughput = { calls: 2000, seconds: round(seconds), callsPerSecond: Math.round(2000 / seconds) }
    }

    // C. JSON 酬載（字串原樣往返）
    const json: Record<string, unknown> = {}
    for (const size of [1024, 65_536, MB, 4 * MB]) {
      const text = 'a'.repeat(size)
      const iterations = size >= MB ? 10 : 30
      const times: number[] = []
      for (let i = 0; i < iterations; i++) {
        const t = now()
        await callPluginRaw('bench', 'echo', { text })
        times.push(now() - t)
      }
      const s = stats(times)
      json[`${size}B`] = { ...s, roundTripMbPerSecond: round(((size * 2) / MB) / (s.meanMs / 1000)) }
    }
    out.C_jsonEcho = json

    // D. 二進位走 base64（1MB 往返，拆出編碼、呼叫、解碼）
    {
      const bytes = new Uint8Array(MB)
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = i % 251
      }
      const enc: number[] = []
      const call: number[] = []
      const dec: number[] = []
      for (let i = 0; i < 10; i++) {
        const t0 = now()
        const b64 = toBase64(bytes)
        const t1 = now()
        const reply = await callPluginRaw('bench', 'echo', { b64 }) as { b64: string }
        const t2 = now()
        const back = fromBase64(reply.b64)
        const t3 = now()
        if (back.length !== bytes.length) {
          throw new Error('base64 length mismatch')
        }
        enc.push(t1 - t0)
        call.push(t2 - t1)
        dec.push(t3 - t2)
      }
      const total = enc.map((v, i) => v + (call[i] ?? 0) + (dec[i] ?? 0))
      out.D_base64OneMbRoundTrip = { encode: stats(enc), call: stats(call), decode: stats(dec), total: stats(total), base64Chars: Math.ceil(MB / 3) * 4 }
    }

    // E. Dart -> 網頁事件
    out.E_events = [
      await runEvents(1000, 100, 'seq'),
      await runEvents(300, 10_000, 'seq'),
      await runEvents(50, 500_000, 'seq'),
      await runEvents(1000, 100, 'burst'),
      await runEvents(100, 10_000, 'burst'),
    ]

    // F. WebSocket 二進位
    const { port } = await callPluginRaw('bench', 'startWs', {}) as { port: number }
    out.F_webSocket = [
      await wsDown(port, 200, MB),
      await wsUp(port, 200, MB),
      await wsDown(port, 20_000, 64),
      await wsUp(port, 20_000, 64),
    ]
  }
  catch (error) {
    out.error = String((error as Error)?.stack ?? error)
  }
  out.finishedAt = new Date().toISOString()
  await callPluginRaw('bench', 'report', { json: JSON.stringify(out, null, 2) })
}

export default defineNuxtPlugin(() => {
  setTimeout(() => {
    void runAll()
  }, 10_000)
})
