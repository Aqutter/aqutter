import { describe, expect, it } from 'vitest'

import { AQUTTER_NATIVE_HEADER_LENGTH, AqutterNativeFormat, decodeAqutterNativeFrame, GestureRecognizer, peekAqutterNativeSeq } from '../src/nativeview'
import type { AqutterNativeGesture, Scheduler } from '../src/nativeview'

const makeFrame = (width: number, height: number, format: number, payload: number[], sentAt = 1700000000000, seq = 1): { header: ArrayBuffer, payload: ArrayBuffer } => {
  const header = new ArrayBuffer(AQUTTER_NATIVE_HEADER_LENGTH)
  const view = new DataView(header)
  view.setUint32(0, width, true)
  view.setUint32(4, height, true)
  view.setUint32(8, format, true)
  view.setUint32(12, seq, true)
  view.setFloat64(16, sentAt, true)
  const body = new ArrayBuffer(payload.length)
  new Uint8Array(body).set(payload)
  return { header, payload: body }
}

describe('decodeAqutterNativeFrame', () => {
  it('decodes the header and exposes the payload without copying', () => {
    const { header, payload } = makeFrame(1, 1, AqutterNativeFormat.Rgba, [9, 8, 7, 255])
    const frame = decodeAqutterNativeFrame(header, payload)
    expect(frame).toMatchObject({ width: 1, height: 1, format: AqutterNativeFormat.Rgba, seq: 1, sentAt: 1700000000000 })
    expect([...frame.payload]).toEqual([9, 8, 7, 255])
    expect(frame.payload.buffer).toBe(payload)
  })

  it('accepts png payloads of any length', () => {
    const { header, payload } = makeFrame(10, 10, AqutterNativeFormat.Png, [1, 2, 3])
    expect(decodeAqutterNativeFrame(header, payload).format).toBe(AqutterNativeFormat.Png)
  })

  it('rejects short headers, unknown formats and mismatched RGBA length', () => {
    expect(() => decodeAqutterNativeFrame(new ArrayBuffer(4), new ArrayBuffer(0))).toThrow(/too short/)
    const unknown = makeFrame(1, 1, 7, [0])
    expect(() => decodeAqutterNativeFrame(unknown.header, unknown.payload)).toThrow(/unknown frame format/)
    const mismatch = makeFrame(2, 2, AqutterNativeFormat.Rgba, [0, 0, 0, 0])
    expect(() => decodeAqutterNativeFrame(mismatch.header, mismatch.payload)).toThrow(/does not match/)
  })

  it('peeks the sequence number', () => {
    expect(peekAqutterNativeSeq(makeFrame(1, 1, AqutterNativeFormat.Rgba, [0, 0, 0, 0], 0, 42).header)).toBe(42)
    expect(peekAqutterNativeSeq(new ArrayBuffer(3))).toBe(0)
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
  const events: AqutterNativeGesture[] = []
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
