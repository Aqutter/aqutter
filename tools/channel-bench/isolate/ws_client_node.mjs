// Node 的 WebSocket 客戶端（內建 WebSocket），連獨立伺服器 ws_server.dart，用來排除瀏覽器與 WebView2。
//   node tools/channel-bench/isolate/ws_client_node.mjs [埠，預設 8765]
const port = process.argv[2] ?? '8765'
const MB = 1024 * 1024
const now = () => performance.now()
const round = v => Math.round(v * 1000) / 1000

const open = () => new Promise((resolve, reject) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/`)
  socket.binaryType = 'arraybuffer'
  socket.onopen = () => resolve(socket)
  socket.onerror = () => reject(new Error('ws error'))
})

const down = async (count, bytes) => {
  const socket = await open()
  let received = 0
  let receivedBytes = 0
  const finished = new Promise((resolve) => {
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        resolve()
      }
      else {
        received += 1
        receivedBytes += event.data.byteLength
      }
    }
  })
  const t0 = now()
  socket.send(JSON.stringify({ mode: 'down', count, bytes }))
  await finished
  const ms = now() - t0
  socket.close()
  return { direction: 'down', count: received, bytesEach: bytes, ms: round(ms), mbPerSecond: round((receivedBytes / MB) / (ms / 1000)), messagesPerSecond: Math.round(received / (ms / 1000)) }
}

const up = async (count, bytes) => {
  const socket = await open()
  const chunk = new Uint8Array(bytes)
  const reply = new Promise((resolve) => {
    socket.onmessage = event => resolve(JSON.parse(event.data))
  })
  const t0 = now()
  for (let i = 0; i < count; i++) {
    socket.send(chunk)
    while (socket.bufferedAmount > 8 * MB) {
      await new Promise(resolve => setTimeout(resolve, 1))
    }
  }
  socket.send(JSON.stringify({ mode: 'upEnd' }))
  const result = await reply
  const ms = now() - t0
  socket.close()
  return { direction: 'up', count: result.count, bytesEach: bytes, ms: round(ms), mbPerSecond: round((result.bytes / MB) / (ms / 1000)), messagesPerSecond: Math.round(result.count / (ms / 1000)) }
}

const out = { client: `node ${process.version}`, results: [] }
try {
  out.results.push(await down(200, MB), await up(200, MB), await down(20000, 64), await up(20000, 64))
}
catch (error) {
  out.error = String(error)
}
console.log(JSON.stringify(out, null, 2))
process.exit(0)
