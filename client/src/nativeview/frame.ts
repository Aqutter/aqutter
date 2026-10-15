/**
 * 鏡像幀的二進位格式（Dart → 網頁）。與 `aqutter_core` 的 `encodeAqutterMirrorFrame` 成對。
 *
 * little-endian：`[w u32 | h u32 | fmt u32 | sentAt f64 (epoch ms)][payload]`。
 */

/** 標頭長度（bytes）。 */
export const MIRROR_HEADER_LENGTH = 20

/** 幀的像素格式。 */
export enum MirrorFormat {
  /** PNG 壓縮。 */
  Png = 0,
  /** 未壓縮 straight（非預乘）RGBA，每像素 4 bytes。 */
  Rgba = 1,
}

/** 解碼後的標頭。 */
export interface MirrorFrameHeader {
  width: number
  height: number
  format: MirrorFormat
  /** 原生端送出時的 epoch 毫秒；用於估算延遲。 */
  sentAt: number
}

/** 一幀的標頭與 payload 視圖（不複製資料）。 */
export interface MirrorFrame extends MirrorFrameHeader {
  payload: Uint8Array
}

/** 解碼幀；長度不足、格式不明或 RGBA 長度與寬高不符時拋錯。 */
export const decodeMirrorFrame = (buffer: ArrayBuffer): MirrorFrame => {
  if (buffer.byteLength < MIRROR_HEADER_LENGTH) {
    throw new Error(`[nativeMirror] frame too short: ${buffer.byteLength} bytes`)
  }
  const view = new DataView(buffer)
  const width = view.getUint32(0, true)
  const height = view.getUint32(4, true)
  const format = view.getUint32(8, true)
  const sentAt = view.getFloat64(12, true)
  if (format !== MirrorFormat.Png && format !== MirrorFormat.Rgba) {
    throw new Error(`[nativeMirror] unknown frame format: ${format}`)
  }
  const payload = new Uint8Array(buffer, MIRROR_HEADER_LENGTH)
  if (format === MirrorFormat.Rgba && payload.length !== width * height * 4) {
    throw new Error(`[nativeMirror] RGBA payload ${payload.length} bytes does not match ${width}x${height}`)
  }
  return { width, height, format, sentAt, payload }
}
