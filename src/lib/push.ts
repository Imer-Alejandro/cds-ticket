"use client"

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported'

/** Estado actual del permiso de notificaciones del sistema. */
export function pushPermission(): PushPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Pide permiso para mostrar notificaciones del sistema. Debe llamarse tras una
 * acción del usuario (click) para que el navegador lo conceda.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export interface PushPayload {
  body?: string
  /** Identificador para agrupar/reemplazar avisos del mismo origen. */
  tag?: string
  /** Ruta a la que navegar al hacer click en el aviso. */
  url?: string
  icon?: string
}

/**
 * Muestra una notificación visual del sistema (solo si el permiso fue concedido).
 * Devuelve true si se pudo mostrar. Al hacer click enfoca la pestaña y navega.
 */
export function showPush(title: string, payload: PushPayload = {}): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  try {
    const notification = new Notification(title, {
      body: payload.body,
      tag: payload.tag,
      icon: payload.icon ?? '/favicon.ico',
    })
    notification.onclick = () => {
      window.focus()
      if (payload.url) window.location.href = payload.url
      notification.close()
    }
    return true
  } catch {
    return false
  }
}
