/**
 * @fileoverview Testes de integração de endpoints REST e SSE da API.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../../src/app');

describe('API Integration Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Inicia o app em uma porta dinâmica (0)
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /api/senhas/status deve retornar estatísticas da fila', async () => {
    const res = await fetch(`${baseUrl}/api/senhas/status`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.sucesso, true);
    assert.ok(data.stats !== undefined);
    assert.ok(Array.isArray(data.pendentes));
    assert.ok(Array.isArray(data.guiches));
  });

  it('POST /api/senhas/emissao deve gerar nova senha com sucesso (201)', async () => {
    const res = await fetch(`${baseUrl}/api/senhas/emissao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria: 'PREFERENCIAL', totemId: 'TOTEM-TESTE' })
    });
    const data = await res.json();

    assert.equal(res.status, 201);
    assert.equal(data.sucesso, true);
    assert.match(data.senhaEmitida, /^P-\d{3}$/);
    assert.equal(data.categoria, 'Atendimento Preferencial');
  });

  it('POST /api/atendimento/proximo deve chamar a próxima senha para o guichê (200)', async () => {
    const res = await fetch(`${baseUrl}/api/atendimento/proximo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guicheId: 1, atendenteId: 'ATD-101' })
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.sucesso, true);
    assert.match(data.senhaChamada, /^P-\d{3}$/);
  });

  it('POST /api/atendimento/rechamar deve rechamar a senha chamada no guichê', async () => {
    const res = await fetch(`${baseUrl}/api/atendimento/rechamar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guicheId: 1 })
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.sucesso, true);
    assert.match(data.senhaChamada, /^P-\d{3}$/);
  });

  it('POST /api/atendimento/finalizar deve concluir o atendimento do guichê', async () => {
    const res = await fetch(`${baseUrl}/api/atendimento/finalizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guicheId: 1 })
    });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.sucesso, true);
    assert.match(data.mensagem, /finalizado com sucesso/i);
  });

  it('GET /api/guiches deve listar os guichês cadastrados', async () => {
    const res = await fetch(`${baseUrl}/api/guiches`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.sucesso, true);
    assert.ok(Array.isArray(data.guiches));
    assert.ok(data.guiches.length >= 4);
  });

  it('GET /api/guiches/:id deve retornar detalhes do guichê solicitado', async () => {
    const res = await fetch(`${baseUrl}/api/guiches/1`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.sucesso, true);
    assert.equal(data.guiche.numero_guiche, 1);
  });

  it('GET /api/rota-inexistente deve retornar 404 estruturado', async () => {
    const res = await fetch(`${baseUrl}/api/rota-inexistente`);
    const data = await res.json();

    assert.equal(res.status, 404);
    assert.equal(data.sucesso, false);
    assert.match(data.mensagem, /não encontrada/i);
  });
});
