/**
 * @fileoverview Repositório para operações na tabela ATENDIMENTO.
 */
const defaultDb = require('../config/database');

class AtendimentoRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} [database=defaultDb]
   */
  constructor(database = defaultDb) {
    this.db = database;
  }

  /**
   * Cria o registro inicial da sessão de atendimento para a senha chamada no guichê.
   * Calcula automaticamente o tempo de espera desde a emissão da senha.
   * @param {{ id_senha: number, id_guiche: number }} params
   * @returns {object|undefined}
   */
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

  /**
   * Busca um atendimento pelo ID com dados da senha e do guichê.
   * @param {number} idAtendimento
   * @returns {object|undefined}
   */
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

  /**
   * Busca a última chamada/atendimento realizada em um guichê específico.
   * @param {number} idGuiche
   * @returns {object|undefined}
   */
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

  /**
   * Finaliza o atendimento calculando a duração em segundos.
   * @param {number} idAtendimento
   * @returns {object|undefined}
   */
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

  /**
   * Conta a quantidade de atendimentos realizados hoje por um guichê.
   * @param {number} idGuiche
   * @returns {number}
   */
  countAtendimentosHojePorGuiche(idGuiche) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as total 
      FROM ATENDIMENTO 
      WHERE id_guiche = ? 
        AND DATE(data_hora_chamada) = DATE('now', 'localtime')
    `);
    const res = stmt.get(Number(idGuiche));
    return res?.total ?? 0;
  }
}

module.exports = new AtendimentoRepository();
module.exports.AtendimentoRepository = AtendimentoRepository;
