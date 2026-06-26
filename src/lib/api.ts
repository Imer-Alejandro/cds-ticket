import { useAuthStore } from '@/store/useAuthStore'

export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().token
  const headers = new Headers(options.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(url, { ...options, headers, credentials: 'include' })
}

export async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await apiFetch(url)
    if (!res.ok) return fallback
    return await res.json()
  } catch {
    return fallback
  }
}
