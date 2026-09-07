import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import dotenv from 'dotenv'
import { initSocketServer } from './src/socket'
import { startMailListener } from './src/mail'

dotenv.config()
dotenv.config({ path: '.env.local', override: true })

const app = express()
const httpServer = createServer(app)
const port = parseInt(process.env.BACKEND_PORT || '3001', 10)

app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Initialize Socket.IO
initSocketServer(httpServer)

app.post('/socket/emit', (req, res) => {
  const { event, payload, room } = req.body || {}
  if (!event) {
    res.status(400).json({ error: 'event is required' })
    return
  }

  const io = (globalThis as any).__socket_io_instance__
  if (room) {
    io?.to(room).emit(event, payload)
  } else {
    io?.emit(event, payload)
  }

  res.json({ ok: true })
})

// Start Mail Listener
startMailListener()

httpServer.listen(port, () => {
  console.log(`✓ Backend servidor escuchando en http://localhost:${port}`)
  console.log(`✓ Socket.IO listo`)
  console.log(`✓ Mail listener iniciado`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n✓ Backend apagando...')
  httpServer.close(() => {
    console.log('✓ Servidor cerrado')
    process.exit(0)
  })
})
