import { describe, expect, it } from 'vitest'

import { decodeMirrorFrame, GestureRecognizer, MIRROR_HEADER_LENGTH, MirrorFormat } from '../src/nativeview'
import type { NativeMirrorGesture, Scheduler } from '../src/nativeview'

const makeFrame = (width: number, height: number, format: number, payload: number[], sentAt = 1700000000000): ArrayBuffer => {
  const buffer = new ArrayBuffer(MIRROR_HEADER_LENGTH + payload.length)
  const view = new DataView(buffer)
  view.setUint32(0, width, true)
  view.setUint32(4, height, true)
  view.setUint32(8, format, true)
  view.setFloat64(12, sentAt, true)
  new Uint8Array(buffer, MIRROR_HEADER_LENGTH).set(payload)
  return buffer
}

describe('decodeMirrorFrame', () => {
  it('decodes the header and exposes the payload without copying', () => {
    const frame = decodeMirrorFrame(makeFrame(1, 1, MirrorFormat.Rgba, [9, 8, 7, 255]))
    expect(frame).toMatchObject({ width: 1, height: 1, format: MirrorFormat.Rgba, sentAt: 1700000000000 })
    expect([...frame.payload]).toEqual([9, 8, 7, 255])
  })

  it('accepts png payloads of any length', () => {
    expect(decodeMirrorFrame(makeFrame(10, 10, MirrorFormat.Png, [1, 2, 3])).format).toBe(MirrorFormat.Png)
  })

  it('rejects short frames, unknown formats and mismatched RGBA length', () => {
    expect(() => decodeMirrorFrame(new ArrayBuffer(4))).toThrow(/too short/)
    expect(() => decodeMirrorFrame(makeFrame(1, 1, 7, [0]))).toThrow(/unknown frame format/)
    expect(() => decodeMirrorFrame(makeFrame(2, 2, MirrorFormat.Rgba, [0, 0, 0, 0]))).toThrow(/does not match/)
  })
})

const fakeScheduler = (): Scheduler & { advance: (ms: number) => void } => {
  let time = 0
  let nextId = 1
  const timers = new Map<number, { at: number, callback: () => void }>()
  return {
    now: () => time,
    setTimeout: (callback, ms) => {
      const id = nextId++
      timers.set(id, { at: time + ms, callback })
      return id
    },
    clearTimeout: handle => void timers.delete(handle as number),
    advance: (ms) => {
      time += ms
      for (const [id, timer] of [...timers]) {
        if (timer.at <= time) {
          timers.delete(id)
          timer.callback()
        }
      }
    },
  }
}

const setup = () => {
  const scheduler = fakeScheduler()
  const events: NativeMirrorGesture[] = []
  const recognizer = new GestureRecognizer(g => events.push(g), () => ({ width: 200, height: 100 }), undefined, scheduler)
  return { scheduler, events, recognizer }
}

describe('GestureRecognizer', () => {
  it('emits a normalized tap', () => {
    const { events, recognizer } = setup()
    recognizer.pointerDown(1, { x: 100, y: 50 })
    recognizer.pointerUp(1, { x: 100, y: 50 })
    expect(events).toEqual([{ type: 'tap', x: 0.5, y: 0.5 }])
  })

  it('turns a second nearby tap into a doubleTap', () => {
    const { events, scheduler, recognizer } = setup()
    recognizer.pointerDown(1, { x: 20, y: 20 })
    recognizer.pointerUp(1, { x: 20, y: 20 })
    scheduler.advance(100)
    recognizer.pointerDown(1, { x: 22, y: 21 })
    recognizer.pointerUp(1, { x: 22, y: 21 })
    expect(events.map(e => e.type)).toEqual(['tap', 'doubleTap'])
  })

  it('does not double-tap when the second tap is late or far away', () => {
    const { events, scheduler, recognizer } = setup()
    recognizer.pointerDown(1, { x: 20, y: 20 })
    recognizer.pointerUp(1, { x: 20, y: 20 })
    scheduler.advance(400)
    recognizer.pointerDown(1, { x: 20, y: 20 })
    recognizer.pointerUp(1, { x: 20, y: 20 })
    recognizer.pointerDown(1, { x: 150, y: 80 })
    recognizer.pointerUp(1, { x: 150, y: 80 })
    expect(events.map(e => e.type)).toEqual(['tap', 'tap', 'tap'])
  })

  it('emits pan start / update / end with normalized deltas', () => {
    const { events, recognizer } = setup()
    recognizer.pointerDown(1, { x: 0, y: 0 })
    recognizer.pointerMove(1, { x: 4, y: 0 }) // within slop
    expect(events).toEqual([])
    recognizer.pointerMove(1, { x: 20, y: 0 })
    recognizer.pointerMove(1, { x: 60, y: 50 })
    recognizer.pointerUp(1, { x: 60, y: 50 })
    expect(events.map(e => e.type === 'pan' ? e.phase : e.type)).toEqual(['start', 'update', 'end'])
    expect(events[1]).toMatchObject({ dx: 40 / 200, dy: 50 / 100 })
  })

  it('emits longPress once and suppresses the tap', () => {
    const { events, scheduler, recognizer } = setup()
    recognizer.pointerDown(1, { x: 100, y: 50 })
    scheduler.advance(600)
    recognizer.pointerUp(1, { x: 100, y: 50 })
    expect(events.map(e => e.type)).toEqual(['longPress'])
  })

  it('moving cancels the long press', () => {
    const { events, scheduler, recognizer } = setup()
    recognizer.pointerDown(1, { x: 0, y: 0 })
    recognizer.pointerMove(1, { x: 50, y: 0 })
    scheduler.advance(600)
    expect(events.map(e => e.type)).not.toContain('longPress')
  })

  it('emits pinch with cumulative scale and ends without a trailing tap', () => {
    const { events, recognizer } = setup()
    recognizer.pointerDown(1, { x: 80, y: 50 })
    recognizer.pointerDown(2, { x: 120, y: 50 }) // distance 40
    recognizer.pointerMove(2, { x: 160, y: 50 }) // distance 80
    recognizer.pointerUp(2, { x: 160, y: 50 })
    recognizer.pointerUp(1, { x: 80, y: 50 })
    expect(events.map(e => e.type === 'pinch' ? `pinch:${e.phase}` : e.type)).toEqual(['pinch:start', 'pinch:update', 'pinch:end'])
    expect(events[1]).toMatchObject({ scale: 2, x: 0.6 })
  })

  it('cancel closes an in-progress pan', () => {
    const { events, recognizer } = setup()
    recognizer.pointerDown(1, { x: 0, y: 0 })
    recognizer.pointerMove(1, { x: 50, y: 0 })
    recognizer.cancel()
    expect(events.at(-1)).toMatchObject({ type: 'pan', phase: 'end' })
  })
})
