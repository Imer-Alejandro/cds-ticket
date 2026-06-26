"use client"

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/useAuthStore'

interface NotificationEvent {
  type: string
  notificacion: {
    id: string; tipo: string; mensaje: string; leido: boolean; fecha: string
    ticket: { codigo: string; asunto: string }
  }
}

type EventCallback = (data: NotificationEvent) => void

const listeners = new Map<string, Set<EventCallback>>()

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
    if (!token || socketRef.current?.connected) return

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
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

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Desconectado')
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  return socketRef
}
