const db = require('../config/database');

class SenhaRepository {
  getProximoNumeroSequencial(idCategoria) {
    const stmt = db.prepare(`
      SELECT COALESCE(MAX(numero_sequencial), 0) + 1 AS proximo
      SELECT_MAX: SELECT COALESCE(MAX(numero_sequencial), 0) + 1 AS proximo 
      FROM SENHA 
      WHERE id_categoria = ? 
        AND DATE(data_hora_emissao) = DATE('now', 'localtime')
    `);
    
    // SQLite query simplificada
    const query = db.prepare(`
      SELECT COALESCE(MAX(numero_sequencial), 0) + 1 AS proximo
      FROM SENHA 
      WHERE id_categoria = ? 
        AND DATE(data_hora_emissao) = DATE('now', 'localtime')
    `);
    const res = query.get(idCategoria);
    return res ? res.proximo : 1;
  }

  create({ id_categoria, numero_sequencial, codigo_senha }) {
    const stmt = db.prepare(`
      INSERT INTO SENHA (id_categoria, numero_sequencial, codigo_senha, status_senha, data_hora_emissao)
      VALUES (?, ?, ?, 'AGUARDANDO', CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(id_categoria, numero_sequencial, codigo_senha);
    return this.findById(info.lastInsertRowid);
  }

  findById(idSenha) {
    const stmt = db.prepare(`
      SELECT s.*, c.codigo_prefixo, c.nome_categoria, c.nivel_prioridade
      FROM SENHA s
      JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria
      WHERE s.id_senha = ?
      LIMIT 1
    `);
    return stmt.get(idSenha);
  }

  findNextPendingTicket() {
    const stmt = db.prepare(`
      SELECT s.*, c.codigo_prefixo, c.nome_categoria, c.nivel_prioridade
      FROM SENHA s
      JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria
      WHERE s.status_senha = 'AGUARDANDO'
      ORDER BY c.nivel_prioridade ASC, s.id_senha ASC
      LIMIT 1
    `);
    return stmt.get();
  }

  updateStatus(idSenha, statusSenha) {
    const stmt = db.prepare(`
      UPDATE SENHA 
      SET status_senha = ? 
      WHERE id_senha = ?
    `);
    stmt.run(statusSenha, idSenha);
    return this.findById(idSenha);
  }

  getPosicaoFila(idSenha, idCategoria) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as posicao
      FROM SENHA
      WHERE id_categoria = ?
        AND status_senha = 'AGUARDANDO'
        AND id_senha <= ?
    `);
    const res = stmt.get(idCategoria, idSenha);
    return res ? res.posicao : 1;
  }

  getQueueStats() {
    const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM SENHA WHERE status_senha = 'AGUARDANDO'`);
    const prefStmt = db.prepare(`
      SELECT COUNT(*) as count FROM SENHA s 
      JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria 
      WHERE s.status_senha = 'AGUARDANDO' AND c.codigo_prefixo = 'P'
    `);
    const convStmt = db.prepare(`
      SELECT COUNT(*) as count FROM SENHA s 
      JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria 
      WHERE s.status_senha = 'AGUARDANDO' AND c.codigo_prefixo = 'C'
    `);
    const examStmt = db.prepare(`
      SELECT COUNT(*) as count FROM SENHA s 
      JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria 
      WHERE s.status_senha = 'AGUARDANDO' AND c.codigo_prefixo = 'E'
    `);

    const totalAguardando = totalStmt.get().count;
    const filaPreferencial = prefStmt.get().count;
    const filaConvencional = convStmt.get().count;
    const filaExames = examStmt.get().count;

    // Tempo médio estimado: ~3 min por pessoa à frente na fila
    const tempoMedioEsperaMinutos = Math.max(1, Math.round(totalAguardando * 2.5));

    return {
      totalAguardando,
      filaPreferencial,
      filaConvencional,
      filaExames,
      tempoMedioEsperaMinutos
    };
  }

  getUltimasChamadas(limit = 5) {
    const stmt = db.prepare(`
      SELECT 
        s.codigo_senha as senha,
        g.numero_guiche as guiche,
        strftime('%H:%M', a.data_hora_chamada, 'localtime') as hora,
        a.data_hora_chamada as timestamp,
        g.nome_atendente as nomeAtendente
      FROM ATENDIMENTO a
      JOIN SENHA s ON a.id_senha = s.id_senha
      JOIN GUICHE g ON a.id_guiche = g.id_guiche
      ORDER BY a.id_atendimento DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  getFilaPendenteDetalhada() {
    const stmt = db.prepare(`
      SELECT 
        s.id_senha,
        s.codigo_senha,
        c.nome_categoria,
        c.codigo_prefixo,
        c.nivel_prioridade,
        strftime('%H:%M', s.data_hora_emissao, 'localtime') as hora_emissao,
        CAST((julianday('now') - julianday(s.data_hora_emissao)) * 24 * 60 AS INTEGER) as minutos_espera
      FROM SENHA s
      JOIN CATEGORIA_SENHA c ON s.id_categoria = c.id_categoria
      WHERE s.status_senha = 'AGUARDANDO'
      ORDER BY c.nivel_prioridade ASC, s.id_senha ASC
    `);
    return stmt.all();
  }
}

module.exports = new SenhaRepository();
