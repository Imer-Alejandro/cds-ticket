import { getSession } from '@/lib/auth'
import { addClient, removeClient } from '@/lib/sse'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return new Response('No autorizado', { status: 401 })
  }

  const userId = session.id as string
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      addClient(userId, controller)

      controller.enqueue('event: connected\ndata: {"ok":true}\n\n')

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(': keepalive\n\n')
        } catch {
          clearInterval(keepAlive)
        }
      }, 30000)

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        removeClient(userId)
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
