/**
 * 把指標事件辨識成語意手勢，供回傳給原生端。座標一律為 0..1 的正規化值（相對元素大小）。
 *
 * 辨識規則：
 * - 單指按下後移動超過 {@link GestureOptions.slop} → `pan`（start / update / end）
 * - 單指在 slop 內放開 → `tap`；{@link GestureOptions.doubleTapMs} 內於近處再點一次 → `doubleTap`
 *   （第一下的 `tap` 已先送出，不延遲等待）
 * - 單指按住超過 {@link GestureOptions.longPressMs} 沒移動 → `longPress`（放開後不再送 `tap`）
 * - 第二指按下 → 結束 pan、開始 `pinch`（`scale` 為自 pinch 開始的累計倍率，`x`/`y` 為兩指中心）
 */

export type GesturePhase = 'start' | 'update' | 'end'

export type NativeMirrorGesture =
  | { type: 'tap' | 'doubleTap' | 'longPress', x: number, y: number }
  | { type: 'pan', phase: GesturePhase, x: number, y: number, dx: number, dy: number }
  | { type: 'pinch', phase: GesturePhase, scale: number, x: number, y: number }

export interface GestureOptions {
  /** 判定為移動的像素門檻。 */
  slop: number
  longPressMs: number
  doubleTapMs: number
  /** 兩次點擊被視為「同一處」的最大距離（像素）。 */
  doubleTapDistance: number
}

export const DEFAULT_GESTURE_OPTIONS: GestureOptions = {
  slop: 8,
  longPressMs: 500,
  doubleTapMs: 300,
  doubleTapDistance: 32,
}

interface Point {
  x: number
  y: number
}

/** 計時器介面；測試時注入假的。 */
export interface Scheduler {
  now: () => number
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

const realScheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

export class GestureRecognizer {
  private readonly pointers = new Map<number, Point>()
  private origin: Point | null = null
  private last: Point | null = null
  private panning = false
  private longPressed = false
  private longPressTimer: unknown = null
  private lastTap: { at: number, point: Point } | null = null

  private pinchStartDistance = 0
  private pinching = false

  constructor(
    private readonly emit: (gesture: NativeMirrorGesture) => void,
    /** 元素目前的 CSS 尺寸；每次事件重新讀取，因為元素可能被縮放。 */
    private readonly size: () => { width: number, height: number },
    private readonly options: GestureOptions = DEFAULT_GESTURE_OPTIONS,
    private readonly scheduler: Scheduler = realScheduler,
  ) {}

  private normalize(point: Point): Point {
    const { width, height } = this.size()
    return { x: width > 0 ? point.x / width : 0, y: height > 0 ? point.y / height : 0 }
  }

  private center(): Point {
    const points = [...this.pointers.values()]
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    }
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()]
    return distance(a, b)
  }

  private clearLongPress(): void {
    if (this.longPressTimer !== null) {
      this.scheduler.clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  pointerDown(id: number, point: Point): void {
    this.pointers.set(id, point)
    if (this.pointers.size === 1) {
      this.origin = point
      this.last = point
      this.panning = false
      this.longPressed = false
      this.longPressTimer = this.scheduler.setTimeout(() => {
        this.longPressTimer = null
        if (!this.panning && this.origin) {
          this.longPressed = true
          const n = this.normalize(this.origin)
          this.emit({ type: 'longPress', x: n.x, y: n.y })
        }
      }, this.options.longPressMs)
      return
    }
    if (this.pointers.size === 2) {
      this.clearLongPress()
      this.endPan()
      this.pinching = true
      this.pinchStartDistance = Math.max(this.pinchDistance(), 1)
      const c = this.normalize(this.center())
      this.emit({ type: 'pinch', phase: 'start', scale: 1, x: c.x, y: c.y })
    }
  }

  pointerMove(id: number, point: Point): void {
    if (!this.pointers.has(id)) {
      return
    }
    this.pointers.set(id, point)
    if (this.pinching && this.pointers.size >= 2) {
      const c = this.normalize(this.center())
      this.emit({ type: 'pinch', phase: 'update', scale: this.pinchDistance() / this.pinchStartDistance, x: c.x, y: c.y })
      return
    }
    if (this.pointers.size !== 1 || !this.origin || !this.last) {
      return
    }
    if (!this.panning) {
      if (distance(point, this.origin) < this.options.slop) {
        return
      }
      this.clearLongPress()
      this.panning = true
      const n = this.normalize(point)
      this.emit({ type: 'pan', phase: 'start', x: n.x, y: n.y, dx: 0, dy: 0 })
      this.last = point
      return
    }
    const { width, height } = this.size()
    const to = this.normalize(point)
    const delta = { dx: width > 0 ? (point.x - this.last.x) / width : 0, dy: height > 0 ? (point.y - this.last.y) / height : 0 }
    this.last = point
    this.emit({ type: 'pan', phase: 'update', x: to.x, y: to.y, ...delta })
  }

  pointerUp(id: number, point: Point): void {
    if (!this.pointers.has(id)) {
      return
    }
    this.pointers.delete(id)
    if (this.pinching) {
      if (this.pointers.size < 2) {
        const c = this.normalize(point)
        this.emit({ type: 'pinch', phase: 'end', scale: 1, x: c.x, y: c.y })
        this.pinching = false
        // 剩下的手指不再接續成 pan／tap：避免收尾時誤觸
        this.origin = null
        this.last = null
      }
      return
    }
    this.clearLongPress()
    if (this.panning) {
      this.endPan()
    }
    else if (!this.longPressed && this.origin) {
      this.finishTap(this.origin)
    }
    this.origin = null
    this.last = null
  }

  /** 系統取消（例如指標被攔截）：收尾進行中的手勢，不送 tap。 */
  cancel(): void {
    this.clearLongPress()
    if (this.panning) {
      this.endPan()
    }
    if (this.pinching) {
      this.pinching = false
      this.emit({ type: 'pinch', phase: 'end', scale: 1, x: 0.5, y: 0.5 })
    }
    this.pointers.clear()
    this.origin = null
    this.last = null
  }

  private endPan(): void {
    if (!this.panning) {
      return
    }
    this.panning = false
    const n = this.normalize(this.last ?? { x: 0, y: 0 })
    this.emit({ type: 'pan', phase: 'end', x: n.x, y: n.y, dx: 0, dy: 0 })
  }

  private finishTap(point: Point): void {
    const now = this.scheduler.now()
    const n = this.normalize(point)
    const previous = this.lastTap
    if (previous && now - previous.at <= this.options.doubleTapMs && distance(previous.point, point) <= this.options.doubleTapDistance) {
      this.lastTap = null
      this.emit({ type: 'doubleTap', x: n.x, y: n.y })
      return
    }
    this.lastTap = { at: now, point }
    this.emit({ type: 'tap', x: n.x, y: n.y })
  }
}
