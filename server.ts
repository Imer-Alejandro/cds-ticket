import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initSocketServer } from './src/lib/socket-server'
import { processIncomingEmails, startMailListener } from './src/lib/mail/listener'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  initSocketServer(server)

  startMailListener()

  server.listen(port, () => {
    console.log(`> Server listening on http://localhost:${port}`)
  })
})
