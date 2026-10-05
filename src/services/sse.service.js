/**
 * @fileoverview Serviço para gerenciamento de conexões Server-Sent Events (SSE).
 * Fornece push em tempo real unidirecional, heartbeat com unref para evitar vazamento
 * no event loop do Node, e broadcast resiliente para navegadores e painéis.
 */
const { SSE_EVENTS } = require('../constants');

class SSEService {
  constructor() {
    /** @type {Set<object>} */
    this.clients = new Set();
    this.nextClientId = 1;
    this.heartbeatInterval = null;
    this.startHeartbeat();
  }

  /**
   * Registra um novo cliente SSE mantendo o canal HTTP aberto.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {object} [metadata={}]
   */
  addClient(req, res, metadata = {}) {
    const clientId = this.nextClientId++;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });

    // Envia comentário inicial para abrir imediatamente o fluxo no cliente
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

    // Notificação inicial de conexão confirmada
    this.sendToClient(client, SSE_EVENTS.CONNECTED, {
      clientId: client.id,
      tipo: client.tipo,
      serverTime: new Date().toISOString()
    });

    return client;
  }

  /**
   * Envia uma mensagem formatada segundo a especificação W3C SSE para um cliente específico.
   * @param {object} client
   * @param {string} eventName
   * @param {any} data
   */
  sendToClient(client, eventName, data) {
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      client.res.write(`event: ${eventName}\n`);
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      this.removeClient(client);
    }
  }

  /**
   * Remove o cliente e encerra o socket de forma segura.
   * @param {object} client
   */
  removeClient(client) {
    if (this.clients.has(client)) {
      this.clients.delete(client);
      try {
        client.res.end();
      } catch {
        // Ignora erros ao fechar socket já destruído
      }
    }
  }

  /**
   * Transmite um evento SSE para todos os clientes conectados.
   * @param {string} eventName
   * @param {any} data
   */
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

  /**
   * Inicia o timer de heartbeat (ping) com .unref() para não prender o event loop.
   * @param {number} [intervalMs=20000]
   */
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

    // Fundamental para testes unitários e encerramento limpo do processo Node
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Interrompe o heartbeat se estiver ativo.
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Encerra todas as conexões abertas (útil para graceful shutdown e testes).
   */
  closeAll() {
    this.stopHeartbeat();
    for (const client of Array.from(this.clients)) {
      this.removeClient(client);
    }
    this.clients.clear();
  }

  /**
   * Retorna a quantidade de clientes ativos no momento.
   * @returns {number}
   */
  getActiveClientsCount() {
    return this.clients.size;
  }
}

module.exports = new SSEService();
module.exports.SSEService = SSEService;
