const defaultDb = require('../config/database');

class AtendimentoRepository {
  constructor(database = defaultDb) {
    this.db = database;
  }

  create({ id_senha, id_guiche }) {
    const stmt = this.db.prepare(`
      INSERT INTO ATENDIMENTO (id_senha, id_guiche, data_hora_chamada, data_hora_inicio, tempo_espera_segundos)
      SELECT ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
             CAST((julianday('now') - julianday(s.data_hora_emissao)) * 86400 AS INTEGER)
      FROM SENHA s
      WHERE s.id_senha = ?
    `);
    const info = stmt.run(Number(id_senha), Number(id_guiche), Number(id_senha));
    return this.findById(info.lastInsertRowid);
  }

  findById(idAtendimento) {
    const stmt = this.db.prepare(`
      SELECT a.*, s.codigo_senha, s.status_senha, g.numero_guiche, g.nome_atendente
      FROM ATENDIMENTO a
      JOIN SENHA s ON a.id_senha = s.id_senha
      JOIN GUICHE g ON a.id_guiche = g.id_guiche
      WHERE a.id_atendimento = ?
      LIMIT 1
    `);
    return stmt.get(Number(idAtendimento));
  }

  findUltimoAtendimentoPorGuiche(idGuiche) {
    const stmt = this.db.prepare(`
      SELECT a.*, s.codigo_senha, s.status_senha, g.numero_guiche, g.nome_atendente
      FROM ATENDIMENTO a
      JOIN SENHA s ON a.id_senha = s.id_senha
      JOIN GUICHE g ON a.id_guiche = g.id_guiche
      WHERE a.id_guiche = ?
      ORDER BY a.id_atendimento DESC
      LIMIT 1
    `);
    return stmt.get(Number(idGuiche));
  }

  finalizarAtendimento(idAtendimento) {
    const stmt = this.db.prepare(`
      UPDATE ATENDIMENTO 
      SET data_hora_fim = CURRENT_TIMESTAMP,
          duracao_atendimento_segundos = MAX(1, CAST((julianday('now') - julianday(COALESCE(data_hora_inicio, data_hora_chamada))) * 86400 AS INTEGER))
      WHERE id_atendimento = ?
    `);
    stmt.run(Number(idAtendimento));
    return this.findById(idAtendimento);
  }

  countAtendimentosHojePorGuiche(idGuiche) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as total 
      FROM ATENDIMENTO 
      WHERE id_guiche = ? 
        AND DATE(data_hora_chamada, 'localtime') = DATE('now', 'localtime')
    `);
    const res = stmt.get(Number(idGuiche));
    return res?.total ?? 0;
  }
}

module.exports = new AtendimentoRepository();
module.exports.AtendimentoRepository = AtendimentoRepository;
