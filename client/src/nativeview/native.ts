import { AQUTTER_NATIVE_HEADER_LENGTH, AqutterNativeFormat, decodeAqutterNativeFrame } from './frame'
import type { AqutterNativeFrame } from './frame'
import type { AqutterNativeGesture } from './gestures'

/** 原生端的連線資訊（來自 bridge handler `native_endpoint`）。 */
export interface AqutterNativeEndpoint {
  port: number
  token: string
}

/** 網頁 → 原生的訊息：手勢，或自訂指令。 */
export type AqutterNativeMessage = AqutterNativeGesture | { type: 'command', name: string, args?: unknown }

/** 協定內部訊息：確認收幀、回報顯示尺寸。由本類別自動送出，不屬於 [AqutterNativeMessage]。 */
type ControlMessage =
  | { type: 'ack', seq: number }
  | { type: 'resize', width: number, height: number, dpr: number }
  | { type: 'visibility', visible: boolean }

/** 顯示尺寸（CSS 像素）與裝置像素比。 */
export interface AqutterNativeViewportInfo {
  width: number
  height: number
  devicePixelRatio: number
}

/** 顯示模式，對應 CSS `object-fit`。 */
export type AqutterNativeFit = 'fill' | 'contain' | 'cover'

export interface AqutterNativeOptions {
  /** 與原生端 `AqutterNative.sessionId` 一致。 */
  session: string
  canvas: HTMLCanvasElement
  /** 取得連線資訊；通常是 `() => callFlutter(BridgeHandler.NativeEndpoint)`。 */
  resolveEndpoint: () => Promise<AqutterNativeEndpoint>
  /** 斷線後重連的間隔（毫秒）。 */
  reconnectMs?: number
  /** 連線狀態改變時呼叫。 */
  onStatus?: (connected: boolean) => void
  /**
   * 取得目前顯示尺寸。提供後會回報給原生端（連線時與 [AqutterNative.reportSize] 被呼叫時），
   * 原生端據此只擷取網頁實際需要的像素，而不是固定解析度。
   */
  measure?: () => AqutterNativeViewportInfo | null
  /** 每畫完一幀呼叫；`latencyMs` 為（網頁收到時間 − 原生送出時間），兩邊時鐘同機所以可信。 */
  onFrame?: (info: { width: number, height: number, bytes: number, latencyMs: number }) => void
}

const DEFAULT_RECONNECT_MS = 800

/** 排程下一次繪製；沒有 `requestAnimationFrame` 的環境退回 setTimeout。 */
const scheduleFrame = (callback: () => void): void => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => callback())
    return
  }
  setTimeout(callback, 0)
}

/**
 * 連到原生端的鏡像工作階段：把收到的幀畫進 canvas，並提供 [send] 回傳訊息。
 *
 * - 斷線會自動重連（原生端重啟、WebView 重掛後仍能接回）。[stop] 之後不再重連。
 * - 同一個繪製週期內收到多幀只畫最新一幀；被丟棄、亂序或解碼失敗的幀也會回覆確認，
 *   否則原生端會以為網頁卡住而停止送幀（流量控制，見 `doc/nativeview.md`）。
 * - 繪製 RGBA 不複製像素：`ImageData` 直接包住收到的緩衝區。
 */
export class AqutterNative {
  private socket: WebSocket | null = null
  private stopped = true
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private readonly context: CanvasRenderingContext2D

  /** 等待下一個繪製週期的幀；只留最新一幀。 */
  private pending: ArrayBuffer | null = null
  private frameScheduled = false
  /** 已經開始繪製的最大序號，用來丟棄亂序的舊幀。 */
  private lastSeq = -1
  /** 每次開始繪製遞增；非同步解碼（PNG）完成後若已有更新的繪製就放棄。 */
  private drawToken = 0
  private lastReported = ''
  private visible = true
  private lastVisibleSent: boolean | null = null

  constructor(private readonly options: AqutterNativeOptions) {
    const context = options.canvas.getContext('2d')
    if (!context) {
      throw new Error('[aqutterNative] 2d canvas context is not available')
    }
    this.context = context
  }

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  start(): void {
    if (!this.stopped) {
      return
    }
    this.stopped = false
    void this.connect()
  }

  stop(): void {
    this.stopped = true
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.pending = null
    this.socket?.close()
    this.socket = null
  }

  /** 送訊息給原生端；尚未連線時丟棄並回傳 false。 */
  send(message: AqutterNativeMessage): boolean {
    return this.sendRaw(message)
  }

  /** 重新量測並把顯示尺寸回報給原生端（尺寸沒變就不送）。元素大小改變時呼叫。 */
  reportSize(): void {
    const viewport = this.options.measure?.()
    if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
      return
    }
    const key = `${viewport.width}x${viewport.height}@${viewport.devicePixelRatio}`
    if (key === this.lastReported) {
      return
    }
    if (this.sendRaw({ type: 'resize', width: viewport.width, height: viewport.height, dpr: viewport.devicePixelRatio })) {
      this.lastReported = key
    }
  }

  /**
   * 設定元素目前是否看得到（在畫面內、分頁可見）。看不到時原生端暫停擷取與送幀，看得到時立刻補一幀。
   * 狀態沒變不重送；連線時會補送目前狀態。
   */
  setVisible(visible: boolean): void {
    this.visible = visible
    this.flushVisible()
  }

  private flushVisible(): void {
    if (this.lastVisibleSent === this.visible) {
      return
    }
    if (this.sendRaw({ type: 'visibility', visible: this.visible })) {
      this.lastVisibleSent = this.visible
    }
  }

  private sendRaw(message: AqutterNativeMessage | ControlMessage): boolean {
    if (!this.connected) {
      return false
    }
    this.socket?.send(JSON.stringify(message))
    return true
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) {
      return
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, this.options.reconnectMs ?? DEFAULT_RECONNECT_MS)
  }

  private async connect(): Promise<void> {
    let endpoint: AqutterNativeEndpoint
    try {
      endpoint = await this.options.resolveEndpoint()
    }
    catch {
      this.scheduleReconnect()
      return
    }
    if (this.stopped) {
      return
    }
    const url = `ws://127.0.0.1:${endpoint.port}/native/${encodeURIComponent(this.options.session)}?token=${encodeURIComponent(endpoint.token)}`
    const socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
    this.socket = socket
    socket.onopen = () => {
      // 新連線：序號與尺寸回報都重來（原生端的工作階段可能重建過）
      this.lastSeq = -1
      this.lastReported = ''
      this.lastVisibleSent = null
      this.options.onStatus?.(true)
      this.reportSize()
      this.flushVisible()
    }
    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null
      }
      this.pending = null
      this.options.onStatus?.(false)
      this.scheduleReconnect()
    }
    socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.enqueue(event.data)
      }
    }
  }

  /** 收到一幀：只留最新的，下一個繪製週期再畫。被取代的舊幀立刻確認。 */
  private enqueue(buffer: ArrayBuffer): void {
    if (this.pending) {
      this.ack(this.pending)
    }
    this.pending = buffer
    if (!this.frameScheduled) {
      this.frameScheduled = true
      scheduleFrame(() => {
        this.frameScheduled = false
        const next = this.pending
        this.pending = null
        if (next) {
          void this.draw(next)
        }
      })
    }
  }

  /** 讀出幀序號並回覆確認；緩衝區不合法時序號用 0（原生端只用計數）。 */
  private ack(buffer: ArrayBuffer): void {
    const seq = buffer.byteLength >= AQUTTER_NATIVE_HEADER_LENGTH ? new DataView(buffer).getUint32(12, true) : 0
    this.sendRaw({ type: 'ack', seq })
  }

  private async draw(buffer: ArrayBuffer): Promise<void> {
    let frame: AqutterNativeFrame
    try {
      frame = decodeAqutterNativeFrame(buffer)
    }
    catch {
      this.ack(buffer)
      return
    }
    try {
      if (frame.seq <= this.lastSeq) {
        return // 亂序的舊幀
      }
      this.lastSeq = frame.seq
      const token = ++this.drawToken
      const { canvas } = this.options
      if (frame.format === AqutterNativeFormat.Rgba) {
        if (canvas.width !== frame.width || canvas.height !== frame.height) {
          canvas.width = frame.width
          canvas.height = frame.height
        }
        // 不複製：ImageData 直接包住收到的緩衝區（跳過標頭）
        const pixels = new Uint8ClampedArray(frame.payload.buffer as ArrayBuffer, frame.payload.byteOffset, frame.payload.byteLength)
        this.context.putImageData(new ImageData(pixels, frame.width, frame.height), 0, 0)
      }
      else {
        const bitmap = await createImageBitmap(new Blob([frame.payload.slice()], { type: 'image/png' }))
        if (token !== this.drawToken) {
          bitmap.close() // 解碼期間已經有更新的幀開始繪製
          return
        }
        if (canvas.width !== frame.width || canvas.height !== frame.height) {
          canvas.width = frame.width
          canvas.height = frame.height
        }
        this.context.drawImage(bitmap, 0, 0, frame.width, frame.height)
        bitmap.close()
      }
      this.options.onFrame?.({ width: frame.width, height: frame.height, bytes: buffer.byteLength, latencyMs: Date.now() - frame.sentAt })
    }
    finally {
      this.sendRaw({ type: 'ack', seq: frame.seq })
    }
  }
}
