import { decodeAqutterNativeFrame, AqutterNativeFormat } from './frame'
import type { AqutterNativeGesture } from './gestures'

/** 原生端的連線資訊（來自 bridge handler `native_endpoint`）。 */
export interface AqutterNativeEndpoint {
  port: number
  token: string
}

/** 網頁 → 原生的訊息：手勢，或自訂指令。 */
export type AqutterNativeMessage = AqutterNativeGesture | { type: 'command', name: string, args?: unknown }

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
  /** 每畫完一幀呼叫；`latencyMs` 為（網頁收到時間 − 原生送出時間），兩邊時鐘同機所以可信。 */
  onFrame?: (info: { width: number, height: number, latencyMs: number }) => void
}

const DEFAULT_RECONNECT_MS = 800

/**
 * 連到原生端的鏡像工作階段：把收到的幀畫進 canvas，並提供 [send] 回傳訊息。
 *
 * 斷線會自動重連（原生端重啟、WebView 重掛後仍能接回）。[stop] 之後不再重連。
 */
export class AqutterNative {
  private socket: WebSocket | null = null
  private stopped = true
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private readonly context: CanvasRenderingContext2D
  private readonly offscreen: HTMLCanvasElement
  private readonly offscreenContext: CanvasRenderingContext2D

  constructor(private readonly options: AqutterNativeOptions) {
    const context = options.canvas.getContext('2d')
    if (!context) {
      throw new Error('[aqutterNative] 2d canvas context is not available')
    }
    this.context = context
    this.offscreen = document.createElement('canvas')
    const offscreenContext = this.offscreen.getContext('2d')
    if (!offscreenContext) {
      throw new Error('[aqutterNative] 2d canvas context is not available')
    }
    this.offscreenContext = offscreenContext
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
    this.socket?.close()
    this.socket = null
  }

  /** 送訊息給原生端；尚未連線時丟棄並回傳 false。 */
  send(message: AqutterNativeMessage): boolean {
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
    socket.onopen = () => this.options.onStatus?.(true)
    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null
      }
      this.options.onStatus?.(false)
      this.scheduleReconnect()
    }
    socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        void this.draw(event.data)
      }
    }
  }

  private async draw(buffer: ArrayBuffer): Promise<void> {
    const frame = decodeAqutterNativeFrame(buffer)
    const { canvas } = this.options
    if (canvas.width !== frame.width || canvas.height !== frame.height) {
      canvas.width = frame.width
      canvas.height = frame.height
    }
    if (frame.format === AqutterNativeFormat.Rgba) {
      // 複製一份 payload：ImageData 需要自己擁有的 Uint8ClampedArray
      const pixels = new Uint8ClampedArray(frame.payload)
      this.context.putImageData(new ImageData(pixels, frame.width, frame.height), 0, 0)
    }
    else {
      const bitmap = await createImageBitmap(new Blob([frame.payload.slice()], { type: 'image/png' }))
      this.context.drawImage(bitmap, 0, 0, frame.width, frame.height)
      bitmap.close()
    }
    this.options.onFrame?.({ width: frame.width, height: frame.height, latencyMs: Date.now() - frame.sentAt })
  }
}
