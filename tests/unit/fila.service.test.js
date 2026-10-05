/**
 * @fileoverview Testes unitários para o FilaService.
 * Valida a regra de negócio central, prioridade legal de atendimento e gestão de estados.
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, closeDatabase } = require('../../src/config/database');
const { CategoriaRepository } = require('../../src/repositories/categoria.repository');
const { GuicheRepository } = require('../../src/repositories/guiche.repository');
const { SenhaRepository } = require('../../src/repositories/senha.repository');
const { AtendimentoRepository } = require('../../src/repositories/atendimento.repository');
const { SSEService } = require('../../src/services/sse.service');
const { FilaService } = require('../../src/services/fila.service');
const { STATUS_SENHA, STATUS_GUICHE } = require('../../src/constants');

describe('FilaService - Regras de Negócio e Prioridade Legal', () => {
  let db;
  let sseService;
  let filaService;
  let senhaRepo;
  let guicheRepo;
  let atendimentoRepo;
  let categoriaRepo;

  beforeEach(() => {
    // Banco SQLite isolado em memória para testes 100% independentes e repetíveis
    db = createDatabase(':memory:');
    sseService = new SSEService();
    sseService.stopHeartbeat(); // Desliga timer durante teste

    categoriaRepo = new CategoriaRepository(db);
    guicheRepo = new GuicheRepository(db);
    senhaRepo = new SenhaRepository(db);
    atendimentoRepo = new AtendimentoRepository(db);

    filaService = new FilaService({
      senhaRepo,
      categoriaRepo,
      guicheRepo,
      atendimentoRepo,
      sseService
    });
  });

  afterEach(() => {
    sseService.closeAll();
    closeDatabase(db);
  });

  it('deve emitir senha preferencial com prefixo P e sequência correta', () => {
    const emissao = filaService.gerarSenha({ categoria: 'PREFERENCIAL', totemId: 'TOTEM-01' });

    assert.equal(emissao.sucesso, true);
    assert.equal(emissao.senhaEmitida, 'P-001');
    assert.equal(emissao.categoria, 'Atendimento Preferencial');
    assert.equal(emissao.posicaoFila, 1);
  });

  it('deve incrementar o sequencial de senhas da mesma categoria no mesmo dia', () => {
    const s1 = filaService.gerarSenha({ categoria: 'CONVENCIONAL' });
    const s2 = filaService.gerarSenha({ categoria: 'CONVENCIONAL' });

    assert.equal(s1.senhaEmitida, 'C-001');
    assert.equal(s2.senhaEmitida, 'C-002');
  });

  it('deve priorizar estritamente senhas Preferenciais (P) sobre Convencionais (C) e Exames (E)', () => {
    // Cenário: Chega primeiro uma convencional, depois um exame, e por último uma preferencial
    filaService.gerarSenha({ categoria: 'CONVENCIONAL' }); // C-001
    filaService.gerarSenha({ categoria: 'EXAMES' });        // E-001
    filaService.gerarSenha({ categoria: 'PREFERENCIAL' });   // P-001

    // 1º Chamado: DEVE ser a preferencial P-001 (Prioridade 1)
    const chamada1 = filaService.chamarProximaSenha({ guicheId: 1 });
    assert.equal(chamada1.sucesso, true);
    assert.equal(chamada1.senhaChamada, 'P-001');

    // 2º Chamado: DEVE ser a convencional C-001 (Prioridade 2)
    const chamada2 = filaService.chamarProximaSenha({ guicheId: 2 });
    assert.equal(chamada2.sucesso, true);
    assert.equal(chamada2.senhaChamada, 'C-001');

    // 3º Chamado: DEVE ser a entrega de exames E-001 (Prioridade 3)
    const chamada3 = filaService.chamarProximaSenha({ guicheId: 3 });
    assert.equal(chamada3.sucesso, true);
    assert.equal(chamada3.senhaChamada, 'E-001');
  });

  it('deve retornar mensagem amigável quando a fila estiver vazia', () => {
    const chamada = filaService.chamarProximaSenha({ guicheId: 1 });

    assert.equal(chamada.sucesso, false);
    assert.match(chamada.mensagem, /não há senhas aguardando/i);
  });

  it('deve permitir rechamar a senha atual do guichê', () => {
    filaService.gerarSenha({ categoria: 'CONVENCIONAL' });
    filaService.chamarProximaSenha({ guicheId: 1 });

    const rechamada = filaService.rechamarSenha({ guicheId: 1 });
    assert.equal(rechamada.sucesso, true);
    assert.equal(rechamada.senhaChamada, 'C-001');
  });

  it('deve marcar cliente como ausente e liberar o guichê para disponível', () => {
    filaService.gerarSenha({ categoria: 'CONVENCIONAL' });
    filaService.chamarProximaSenha({ guicheId: 1 });

    const resultado = filaService.marcarAusente({ guicheId: 1 });
    assert.equal(resultado.sucesso, true);

    const guiche = guicheRepo.findById(1);
    assert.equal(guiche.status_operacional, STATUS_GUICHE.DISPONIVEL);

    const ultimoAtendimento = atendimentoRepo.findUltimoAtendimentoPorGuiche(1);
    assert.equal(ultimoAtendimento.status_senha, STATUS_SENHA.CANCELADO_AUSENCIA);
  });

  it('deve finalizar atendimento com sucesso e liberar o guichê', () => {
    filaService.gerarSenha({ categoria: 'CONVENCIONAL' });
    filaService.chamarProximaSenha({ guicheId: 1 });

    const resultado = filaService.finalizarAtendimento({ guicheId: 1 });
    assert.equal(resultado.sucesso, true);

    const guiche = guicheRepo.findById(1);
    assert.equal(guiche.status_operacional, STATUS_GUICHE.DISPONIVEL);

    const ultimoAtendimento = atendimentoRepo.findUltimoAtendimentoPorGuiche(1);
    assert.equal(ultimoAtendimento.status_senha, STATUS_SENHA.FINALIZADA);
  });

  it('deve calcular estatísticas consolidadas da fila corretamente', () => {
    filaService.gerarSenha({ categoria: 'PREFERENCIAL' });
    filaService.gerarSenha({ categoria: 'PREFERENCIAL' });
    filaService.gerarSenha({ categoria: 'CONVENCIONAL' });
    filaService.gerarSenha({ categoria: 'EXAMES' });

    const stats = senhaRepo.getQueueStats();
    assert.equal(stats.totalAguardando, 4);
    assert.equal(stats.filaPreferencial, 2);
    assert.equal(stats.filaConvencional, 1);
    assert.equal(stats.filaExames, 1);
    assert.ok(stats.tempoMedioEsperaMinutos > 0);
  });
});
