import { callPluginRaw, defineAqutterNative } from '@aqutter/aqutter'

// Windows 鏡像基準（只在暫存複本）：mirror-demo 的 animate 讓整個畫面每一幀都在變，
// 不需要人操作就能量 fps、每幀大小與頻寬。載入後 12 秒開始，結果由 Dart 寫成檔案。

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const run = async (): Promise<void> => {
  const out: Record<string, unknown> = { userAgent: navigator.userAgent, startedAt: new Date().toISOString() }
  try {
    defineAqutterNative()
    const element = document.createElement('aqutter-native')
    element.setAttribute('session', 'mirror-demo')
    element.setAttribute('fit', 'cover')
    element.style.cssText = 'position:fixed;left:0;top:0;width:1100px;height:320px;z-index:99999'
    document.body.append(element)

    let frames = 0
    let bytes = 0
    let drawMs = 0
    let latencyMs = 0
    element.addEventListener('aqutter-frame', (event) => {
      const detail = (event as CustomEvent).detail as { bytes?: number, drawMs?: number, latencyMs?: number }
      frames += 1
      bytes += detail.bytes ?? 0
      drawMs += detail.drawMs ?? 0
      latencyMs += detail.latencyMs ?? 0
    })

    await sleep(3000)
    await callPluginRaw('mirror-demo', 'animate', { on: true })
    await sleep(4000)
    frames = 0
    bytes = 0
    drawMs = 0
    latencyMs = 0
    const t0 = performance.now()
    await sleep(10_000)
    const seconds = (performance.now() - t0) / 1000
    out.mirror = {
      seconds: Math.round(seconds * 100) / 100,
      frames,
      fps: Math.round((frames / seconds) * 10) / 10,
      kbPerFrame: Math.round(bytes / Math.max(frames, 1) / 1024),
      mbPerSecond: Math.round((bytes / 1048576 / seconds) * 10) / 10,
      meanDrawMs: Math.round((drawMs / Math.max(frames, 1)) * 100) / 100,
      meanLatencyMs: Math.round((latencyMs / Math.max(frames, 1)) * 100) / 100,
      element: `${element.clientWidth}x${element.clientHeight} dpr=${window.devicePixelRatio}`,
    }
    await callPluginRaw('mirror-demo', 'animate', { on: false })
  }
  catch (error) {
    out.error = String((error as Error)?.stack ?? error)
  }
  out.finishedAt = new Date().toISOString()
  await callPluginRaw('bench', 'report', { json: JSON.stringify(out) })
}

export default defineNuxtPlugin(() => {
  setTimeout(() => {
    void run()
  }, 12_000)
})
