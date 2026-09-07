"use client"

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/useAuthStore'

interface NotificationEvent {
  type: string
  notificacion: {
    id: string; tipo: string; mensaje: string; leido: boolean; fecha: string
    ticket: { id: string; codigo: string; asunto: string }
  }
}

type EventCallback = (data: NotificationEvent) => void

const listeners = new Map<string, Set<EventCallback>>()
let socketInstance: Socket | null = null

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

export function onNotificacion(event: string, callback: EventCallback) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event)!.add(callback)
  return () => { listeners.get(event)?.delete(callback) }
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const { token } = useAuthStore()

  useEffect(() => {
    if (!token) return

    if (socketInstance?.connected) {
      socketRef.current = socketInstance
      return
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      console.log('[Socket.IO] Conectado a', SOCKET_URL)
    })

    socket.on('notificacion', (data: NotificationEvent) => {
      const cbs = listeners.get('notificacion')
      if (cbs) cbs.forEach(cb => cb(data))
    })

    socket.on('nuevoTicket', (data: any) => {
      const cbs = listeners.get('nuevoTicket')
      if (cbs) cbs.forEach(cb => cb(data))
    })

    socket.on('ticketUpdated', (data: any) => {
      const cbs = listeners.get('ticketUpdated')
      if (cbs) cbs.forEach(cb => cb(data))
    })

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Desconectado')
    })

    socketInstance = socket
    socketRef.current = socket

    return () => {
      if (socketRef.current === socket) {
        socket.disconnect()
        socketRef.current = null
        socketInstance = null
      }
    }
  }, [token])

  return socketRef
}
