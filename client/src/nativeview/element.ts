import { BridgeHandler } from '../contract/bridge'
import { callFlutter } from '../index'
import { GestureRecognizer } from './gestures'
import { NativeMirror } from './mirror'
import type { MirrorFit, NativeMirrorMessage } from './mirror'

/** 預設的自訂元素標籤。 */
export const AQUTTER_NATIVE_TAG = 'aqutter-native'

const FITS: readonly MirrorFit[] = ['fill', 'contain', 'cover']

const TEMPLATE = `
<style>
  :host { display: block; position: relative; overflow: hidden; }
  canvas { display: block; width: 100%; height: 100%; touch-action: none; user-select: none; -webkit-user-select: none; }
</style>
<canvas part="canvas"></canvas>
`

/** `<aqutter-native>` 元素對外的介面。 */
export interface AqutterNativeElement extends HTMLElement {
  /** 送訊息給原生端；尚未連線時丟棄並回傳 false。 */
  send: (message: NativeMirrorMessage) => boolean
  /** 送自訂指令（原生端 `AqutterMirrorMessage.type == 'command'`）。 */
  sendCommand: (name: string, args?: unknown) => boolean
  readonly connected: boolean
}

/**
 * 建立元素類別。刻意包成函式而非頂層 `class … extends HTMLElement`：
 * 伺服端渲染（沒有 `HTMLElement`）也會 import 本套件，頂層 extends 會在 import 時就拋 ReferenceError。
 */
const createElementClass = (): CustomElementConstructor => {
  /**
   * `<aqutter-native session="map" fit="cover">`：顯示原生端鏡像過來的畫面，並把手勢回傳。
   *
   * | 屬性 | 說明 |
   * |---|---|
   * | `session` | 與原生端 `AqutterMirror.sessionId` 一致（必填） |
   * | `fit` | `fill`（預設）/ `contain` / `cover`，對應 `object-fit` |
   *
   * 事件（`CustomEvent`，不冒泡）：`aqutter-status`（`detail.connected`）、`aqutter-frame`
   * （`detail.width/height/latencyMs`）。方法：{@link send}、{@link sendCommand}。
   * 手勢訊息格式見 `NativeMirrorGesture`；元素只送出，不改變自身內容。
   */
  class AqutterNativeElement extends HTMLElement {
    static readonly observedAttributes = ['session', 'fit']

    private canvas: HTMLCanvasElement | null = null
    private mirror: NativeMirror | null = null
    private recognizer: GestureRecognizer | null = null

    connectedCallback(): void {
      if (!this.shadowRoot) {
        const root = this.attachShadow({ mode: 'open' })
        root.innerHTML = TEMPLATE
        this.canvas = root.querySelector('canvas')
        this.bindPointers()
      }
      this.applyFit()
      this.restart()
    }

    disconnectedCallback(): void {
      this.mirror?.stop()
      this.mirror = null
    }

    attributeChangedCallback(name: string): void {
      if (name === 'fit') {
        this.applyFit()
      }
      else if (this.isConnected) {
        this.restart()
      }
    }

    /** 送訊息給原生端；尚未連線時丟棄並回傳 false。 */
    send(message: NativeMirrorMessage): boolean {
      return this.mirror?.send(message) ?? false
    }

    /** 送自訂指令（原生端 `AqutterMirrorMessage.type == 'command'`）。 */
    sendCommand(name: string, args?: unknown): boolean {
      return this.send({ type: 'command', name, args })
    }

    get connected(): boolean {
      return this.mirror?.connected ?? false
    }

    private applyFit(): void {
      const fit = this.getAttribute('fit') as MirrorFit | null
      if (this.canvas) {
        this.canvas.style.objectFit = fit && FITS.includes(fit) ? fit : 'fill'
      }
    }

    private restart(): void {
      this.mirror?.stop()
      this.mirror = null
      const session = this.getAttribute('session')
      if (!session || !this.canvas) {
        return
      }
      this.mirror = new NativeMirror({
        session,
        canvas: this.canvas,
        resolveEndpoint: () => callFlutter(BridgeHandler.NativeMirrorEndpoint),
        onStatus: connected => this.dispatchEvent(new CustomEvent('aqutter-status', { detail: { connected } })),
        onFrame: info => this.dispatchEvent(new CustomEvent('aqutter-frame', { detail: info })),
      })
      this.mirror.start()
    }

    private bindPointers(): void {
      const canvas = this.canvas
      if (!canvas) {
        return
      }
      this.recognizer = new GestureRecognizer(
        gesture => this.send(gesture),
        () => ({ width: canvas.clientWidth, height: canvas.clientHeight }),
      )
      const local = (event: PointerEvent): { x: number, y: number } => {
        const rect = canvas.getBoundingClientRect()
        return { x: event.clientX - rect.left, y: event.clientY - rect.top }
      }
      canvas.addEventListener('pointerdown', (event) => {
        canvas.setPointerCapture(event.pointerId)
        this.recognizer?.pointerDown(event.pointerId, local(event))
      })
      canvas.addEventListener('pointermove', event => this.recognizer?.pointerMove(event.pointerId, local(event)))
      canvas.addEventListener('pointerup', event => this.recognizer?.pointerUp(event.pointerId, local(event)))
      canvas.addEventListener('pointercancel', () => this.recognizer?.cancel())
    }
}

  return AqutterNativeElement
}

/** 註冊自訂元素（冪等）。伺服端（沒有 `customElements`）呼叫是 no-op。 */
export const defineAqutterNative = (tag: string = AQUTTER_NATIVE_TAG): void => {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined' || customElements.get(tag)) {
    return
  }
  customElements.define(tag, createElementClass())
}
