/**
 * 鏡像幀的二進位格式（Dart → 網頁）。與 `aqutter_core` 的 `encodeAqutterNativeFrame` 成對。
 *
 * little-endian：`[w u32 | h u32 | fmt u32 | seq u32 | sentAt f64 (epoch ms)][payload]`。
 */

/** 標頭長度（bytes）。 */
export const AQUTTER_NATIVE_HEADER_LENGTH = 24

/** 幀的像素格式。 */
export enum AqutterNativeFormat {
  /** PNG 壓縮。 */
  Png = 0,
  /** 未壓縮 straight（非預乘）RGBA，每像素 4 bytes。 */
  Rgba = 1,
}

/** 解碼後的標頭。 */
export interface AqutterNativeFrameHeader {
  width: number
  height: number
  format: AqutterNativeFormat
  /** 每個工作階段遞增的序號；用來丟棄亂序的舊幀、回覆確認。 */
  seq: number
  /** 原生端送出時的 epoch 毫秒；用於估算延遲。 */
  sentAt: number
}

/** 一幀的標頭與 payload 視圖（不複製資料）。 */
export interface AqutterNativeFrame extends AqutterNativeFrameHeader {
  payload: Uint8Array
}

/** 解碼幀；長度不足、格式不明或 RGBA 長度與寬高不符時拋錯。 */
export const decodeAqutterNativeFrame = (buffer: ArrayBuffer): AqutterNativeFrame => {
  if (buffer.byteLength < AQUTTER_NATIVE_HEADER_LENGTH) {
    throw new Error(`[aqutterNative] frame too short: ${buffer.byteLength} bytes`)
  }
  const view = new DataView(buffer)
  const width = view.getUint32(0, true)
  const height = view.getUint32(4, true)
  const format = view.getUint32(8, true)
  const seq = view.getUint32(12, true)
  const sentAt = view.getFloat64(16, true)
  if (format !== AqutterNativeFormat.Png && format !== AqutterNativeFormat.Rgba) {
    throw new Error(`[aqutterNative] unknown frame format: ${format}`)
  }
  const payload = new Uint8Array(buffer, AQUTTER_NATIVE_HEADER_LENGTH)
  if (format === AqutterNativeFormat.Rgba && payload.length !== width * height * 4) {
    throw new Error(`[aqutterNative] RGBA payload ${payload.length} bytes does not match ${width}x${height}`)
  }
  return { width, height, format, seq, sentAt, payload }
}
