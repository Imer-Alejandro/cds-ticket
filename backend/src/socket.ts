import { Server as HTTPServer } from 'http'
import { Server } from 'socket.io'
import { verifyToken } from '../lib/auth'

const GLOBAL_KEY = '__socket_io_instance__'

declare global {
  var __socket_io_instance__: Server | undefined
}

export function initSocketServer(server: HTTPServer) {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token
      if (!token) return next(new Error('No autorizado'))
      const payload = await verifyToken(token as string)
      if (!payload) return next(new Error('Token inválido'))
      ;(socket as any).userId = payload.id as string
      next()
    } catch {
      next(new Error('Error de autenticación'))
    }
  })

  io.on('connection', (socket) => {
    const userId = (socket as any).userId
    socket.join(`user:${userId}`)
    console.log(`[Socket.IO] Usuario ${userId} conectado`)

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Usuario ${userId} desconectado`)
    })
  })

  globalThis.__socket_io_instance__ = io
  return io
}

export function getIO(): Server | null {
  return globalThis.__socket_io_instance__ || null
}

/**
 * Emite una notificación a un usuario específico
 */
export function notifyUser(userId: string, event: string, data: any) {
  const io = getIO()
  if (io) {
    io.to(`user:${userId}`).emit(event, data)
  }
}

/**
 * Emite una notificación a múltiples usuarios
 */
export function notifyUsers(userIds: string[], event: string, data: any) {
  userIds.forEach(userId => notifyUser(userId, event, data))
}

/**
 * Broadcast a todos los usuarios conectados
 */
export function broadcastNotification(event: string, data: any) {
  const io = getIO()
  if (io) {
    io.emit(event, data)
  }
}
