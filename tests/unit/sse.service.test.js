/**
 * @fileoverview Testes unitários para o SSEService.
 * Valida o ciclo de vida de conexões SSE, headers, formatação de eventos e broadcast.
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { SSEService } = require('../../src/services/sse.service');
const { EventEmitter } = require('node:events');

/**
 * Mock para Response HTTP do Express/Node.
 */
class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = {};
    this.statusCode = 0;
    this.buffer = [];
    this.ended = false;
  }

  writeHead(status, headers) {
    this.statusCode = status;
    this.headers = headers;
  }

  write(chunk) {
    this.buffer.push(chunk);
    return true;
  }

  end() {
    this.ended = true;
    this.emit('finish');
  }
}

/**
 * Mock para Request HTTP do Express/Node.
 */
class MockRequest extends EventEmitter {
  constructor() {
    super();
    this.socket = { remoteAddress: '127.0.0.1' };
  }
}

describe('SSEService - Gerenciamento de Conexões e Broadcast', () => {
  let sseService;

  beforeEach(() => {
    sseService = new SSEService();
    sseService.stopHeartbeat();
  });

  afterEach(() => {
    sseService.closeAll();
  });

  it('deve registrar um novo cliente com os headers HTTP obrigatórios de SSE', () => {
    const req = new MockRequest();
    const res = new MockResponse();

    sseService.addClient(req, res, { tipo: 'publico' });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'text/event-stream');
    assert.equal(res.headers['Cache-Control'], 'no-cache, no-transform');
    assert.equal(res.headers['Connection'], 'keep-alive');
    assert.equal(sseService.getActiveClientsCount(), 1);

    // Deve ter enviado comentário de abertura e evento CONNECTED
    const output = res.buffer.join('');
    assert.ok(output.includes(': SSE Connection Established'));
    assert.ok(output.includes('event: CONNECTED'));
  });

  it('deve realizar broadcast de evento para múltiplos clientes conectados', () => {
    const res1 = new MockResponse();
    const res2 = new MockResponse();

    sseService.addClient(new MockRequest(), res1);
    sseService.addClient(new MockRequest(), res2);

    assert.equal(sseService.getActiveClientsCount(), 2);

    sseService.broadcast('TEST_EVENT', { mensagem: 'Olá Mundo' });

    const payload1 = res1.buffer.join('');
    const payload2 = res2.buffer.join('');

    assert.ok(payload1.includes('event: TEST_EVENT'));
    assert.ok(payload1.includes('{"mensagem":"Olá Mundo"}'));
    assert.ok(payload2.includes('event: TEST_EVENT'));
    assert.ok(payload2.includes('{"mensagem":"Olá Mundo"}'));
  });

  it('deve remover cliente automaticamente quando a requisição for encerrada (close)', () => {
    const req = new MockRequest();
    const res = new MockResponse();

    sseService.addClient(req, res);
    assert.equal(sseService.getActiveClientsCount(), 1);

    // Simula desconexão do cliente
    req.emit('close');
    assert.equal(sseService.getActiveClientsCount(), 0);
  });

  it('deve fechar todos os clientes no closeAll', () => {
    const res1 = new MockResponse();
    const res2 = new MockResponse();

    sseService.addClient(new MockRequest(), res1);
    sseService.addClient(new MockRequest(), res2);
    assert.equal(sseService.getActiveClientsCount(), 2);

    sseService.closeAll();
    assert.equal(sseService.getActiveClientsCount(), 0);
    assert.equal(res1.ended, true);
    assert.equal(res2.ended, true);
  });
});
