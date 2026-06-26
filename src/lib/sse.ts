const encoder = new TextEncoder()

const clients = new Map<string, ReadableStreamDefaultController>()

export function addClient(userId: string, controller: ReadableStreamDefaultController) {
  clients.set(userId, controller)
}

export function removeClient(userId: string) {
  clients.delete(userId)
}

export function broadcastToUser(userId: string, event: string, data: any) {
  const controller = clients.get(userId)
  if (!controller) return
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  try {
    controller.enqueue(encoder.encode(message))
  } catch {
    clients.delete(userId)
  }
}

export function broadcastToAll(event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const [userId, controller] of clients) {
    try {
      controller.enqueue(encoder.encode(message))
    } catch {
      clients.delete(userId)
    }
  }
}

export function getConnectedUsers(): string[] {
  return Array.from(clients.keys())
}
