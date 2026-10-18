const { SSE_EVENTS } = require('../constants');

class SSEService {
  constructor() {
    this.clients = new Set();
    this.nextClientId = 1;
    this.heartbeatInterval = null;
    this.startHeartbeat();
  }

  addClient(req, res, metadata = {}) {
    const clientId = this.nextClientId++;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });

    res.write(`: SSE Connection Established (Client ID: ${clientId})\n\n`);

    const client = {
      id: clientId,
      res,
      tipo: metadata.tipo || 'publico',
      guiche: metadata.guiche || null,
      ip: req.ip || req.socket.remoteAddress,
      connectedAt: new Date()
    };

    this.clients.add(client);

    const cleanup = () => {
      if (this.clients.has(client)) {
        this.clients.delete(client);
      }
    };

    req.on('close', cleanup);
    res.on('error', cleanup);

    this.sendToClient(client, SSE_EVENTS.CONNECTED, {
      clientId: client.id,
      tipo: client.tipo,
      serverTime: new Date().toISOString()
    });

    return client;
  }

  sendToClient(client, eventName, data) {
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      client.res.write(`event: ${eventName}\n`);
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      this.removeClient(client);
    }
  }

  removeClient(client) {
    if (this.clients.has(client)) {
      this.clients.delete(client);
      try {
        client.res.end();
      } catch {
      }
    }
  }

  broadcast(eventName, data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const deadClients = [];

    for (const client of this.clients) {
      try {
        client.res.write(`event: ${eventName}\n`);
        client.res.write(`data: ${payload}\n\n`);
      } catch {
        deadClients.push(client);
      }
    }

    for (const dead of deadClients) {
      this.removeClient(dead);
    }
  }

  startHeartbeat(intervalMs = 20000) {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      const deadClients = [];
      const ping = `: heartbeat ${new Date().toISOString()}\n\n`;

      for (const client of this.clients) {
        try {
          client.res.write(ping);
        } catch {
          deadClients.push(client);
        }
      }

      for (const dead of deadClients) {
        this.removeClient(dead);
      }
    }, intervalMs);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  closeAll() {
    this.stopHeartbeat();
    for (const client of Array.from(this.clients)) {
      this.removeClient(client);
    }
    this.clients.clear();
  }

  getActiveClientsCount() {
    return this.clients.size;
  }
}

module.exports = new SSEService();
module.exports.SSEService = SSEService;
