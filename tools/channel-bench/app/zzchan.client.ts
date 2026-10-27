import { AqutterPluginError, callPluginRaw, getTransportState, onPluginEventRaw, onTransportState } from '@aqutter/aqutter'

// 統一傳輸的 Android 實機驗證（暫存複本）。載入後 10 秒自動執行。
const now = (): number => performance.now()
const round = (v: number): number => Math.round(v * 100) / 100
const call = async (method: string, payload?: unknown): Promise<any> => await callPluginRaw('bench', method, payload)
const codeOf = async (promise: Promise<unknown>): Promise<string> => await promise.then(() => 'resolved', (e) => e instanceof AqutterPluginError ? e.code : `other:${String(e)}`)
const toB64 = (bytes: Uint8Array): string => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s) }
const fromB64 = (text: string): Uint8Array => { const bin = atob(text); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out }

const run = async () => {
  const out: Record<string, unknown> = { platform: navigator.userAgent }
  const states: string[] = []
  onTransportState(s => states.push(s))

  // 1. 小呼叫往返
  const rtts: number[] = []
  for (let i = 0; i < 300; i++) {
    const t = now()
    await call('ping')
    rtts.push(now() - t)
  }
  rtts.sort((a, b) => a - b)
  out.smallRtt = { meanMs: round(rtts.reduce((s, v) => s + v, 0) / rtts.length), p95Ms: round(rtts[Math.floor(rtts.length * 0.95)] ?? 0) }

  // 2. 正確性：2MB 二進位來回
  const payload = new Uint8Array(2 * 1024 * 1024 + 1)
  for (let i = 0; i < payload.length; i++) payload[i] = i % 251
  const echoed = (await call('echo', { data: payload, tag: 'x', nested: [payload.subarray(10, 20)] })) as { data: Uint8Array, tag: string, nested: Uint8Array[] }
  let ok = echoed.data instanceof Uint8Array && echoed.data.length === payload.length && echoed.tag === 'x' && echoed.nested[0]!.length === 10
  for (let i = 0; ok && i < payload.length; i += 997) ok = echoed.data[i] === payload[i]
  out.echo2MBIntact = ok

  // 3. 1MB 往返：二進位 對 base64（同一條傳輸）
  const mb = new Uint8Array(1024 * 1024)
  for (let i = 0; i < mb.length; i++) mb[i] = i % 251
  const N = 20
  let t0 = now()
  for (let i = 0; i < N; i++) await call('echo', { data: mb })
  const binMs = (now() - t0) / N
  t0 = now()
  for (let i = 0; i < N; i++) { const r = await call('echo', { b64: toB64(mb) }); fromB64(r.b64) }
  const b64Ms = (now() - t0) / N
  out.roundTrip1MB = { binaryMs: round(binMs), base64Ms: round(b64Ms), speedup: round(b64Ms / binMs) }

  // 4. 下行 / 上行吞吐
  t0 = now()
  let bytes = 0
  for (let i = 0; i < 100; i++) bytes += ((await call('source', { bytes: 1024 * 1024 })) as { data: Uint8Array }).data.length
  out.down1MB = { mbPerSec: round(bytes / 1048576 / ((now() - t0) / 1000)) }
  t0 = now()
  let up = 0
  for (let i = 0; i < 100; i++) up += ((await call('sink', { data: mb })) as { length: number }).length
  out.up1MB = { mbPerSec: round(up / 1048576 / ((now() - t0) / 1000)), receivedBytes: up }

  // 5. 事件（帶二進位）
  let received = 0
  let receivedBytes = 0
  onPluginEventRaw('bench', 'event', (p) => { received++; receivedBytes += (p as { data: Uint8Array }).data.length })
  t0 = now()
  await call('startEvents', { count: 200, bytes: 100 * 1024 })
  await new Promise(r => setTimeout(r, 500))
  out.events = { sent: 200, received, receivedBytes, ms: round(now() - t0 - 500) }

  // 6. 錯誤碼
  out.errors = {
    notFound: await codeOf(call('nope')),
    thrown: await codeOf(call('boom')),
    coded: await codeOf(call('coded')),
    unknownPlugin: await codeOf(callPluginRaw('ghost', 'x')),
  }

  // 7. 殼重啟伺服器：進行中的呼叫 TRANSPORT_CLOSED、自動重連、之後呼叫恢復
  const restartAt = now()
  const inflight = codeOf(call('slow'))
  await new Promise(r => setTimeout(r, 100))
  await call('restartHost')
  const inflightCode = await inflight
  const t1 = now()
  const afterRestart = await call('ping').then(() => 'ok', (e) => String(e))
  out.restart = { inflightCode, afterRestart, reconnectedAfterMs: round(now() - t1), stateAfter: getTransportState(), states: [...states], totalMs: round(now() - restartAt) }

  await call('report', { json: JSON.stringify(out) })
}

if (typeof window !== 'undefined') {
  setTimeout(() => { run().catch(e => call('report', { json: JSON.stringify({ error: String(e) }) })) }, 10000)
}
export default defineNuxtPlugin(() => {})
