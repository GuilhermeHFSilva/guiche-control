class SSEService {
  constructor() {
    this.clients = new Set();
    this.nextClientId = 1;
    this.initHeartbeat();
  }

  addClient(req, res, metadata = {}) {
    const clientId = this.nextClientId++;

    // Configura os cabeçalhos HTTP para manter o canal SSE aberto
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Desabilita buffering no NGINX se houver proxy
      'Access-Control-Allow-Origin': '*'
    });

    // Envia o comentário inicial de confirmação de conexão
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
    console.log(`📡 [SSE] Novo cliente conectado: ID ${client.id} (Tipo: ${client.tipo}, Guichê: ${client.guiche || 'N/A'}). Total ativos: ${this.clients.size}`);

    // Envia evento de boas-vindas / sincronização inicial
    this.sendToClient(client, 'CONNECTED', {
      clientId: client.id,
      tipo: client.tipo,
      serverTime: new Date().toISOString()
    });

    req.on('close', () => {
      this.clients.delete(client);
      console.log(`🔌 [SSE] Cliente desconectado: ID ${client.id}. Total ativos: ${this.clients.size}`);
    });
  }

  sendToClient(client, eventName, data) {
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      client.res.write(`event: ${eventName}\n`);
      client.res.write(`data: ${payload}\n\n`);
    } catch (err) {
      console.error(`❌ [SSE] Erro ao enviar mensagem para cliente ID ${client.id}:`, err.message);
      this.clients.delete(client);
    }
  }

  broadcast(eventName, data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    let count = 0;

    for (const client of this.clients) {
      try {
        client.res.write(`event: ${eventName}\n`);
        client.res.write(`data: ${payload}\n\n`);
        count++;
      } catch (err) {
        console.error(`❌ [SSE] Falha no broadcast para cliente ID ${client.id}:`, err.message);
        this.clients.delete(client);
      }
    }

    console.log(`📢 [SSE Broadcast] Evento '${eventName}' enviado para ${count} cliente(s).`);
  }

  initHeartbeat() {
    // Heartbeat a cada 20s para manter as conexões ativas e prevenir timeouts de firewall/proxy
    setInterval(() => {
      for (const client of this.clients) {
        try {
          client.res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
        } catch (err) {
          this.clients.delete(client);
        }
      }
    }, 20000);
  }

  getActiveClientsCount() {
    return this.clients.size;
  }
}

module.exports = new SSEService();
