/**
 * @fileoverview Repositório para operações na tabela GUICHE.
 */
const defaultDb = require('../config/database');
const { STATUS_GUICHE } = require('../constants');

class GuicheRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} [database=defaultDb]
   */
  constructor(database = defaultDb) {
    this.db = database;
  }

  /**
   * Retorna todos os guichês ordenados pelo número do guichê.
   * @returns {Array<object>}
   */
  findAll() {
    const stmt = this.db.prepare('SELECT * FROM GUICHE ORDER BY numero_guiche ASC');
    return stmt.all();
  }

  /**
   * Busca um guichê pelo número operacional.
   * @param {number} numeroGuiche
   * @returns {object|undefined}
   */
  findByNumero(numeroGuiche) {
    const stmt = this.db.prepare('SELECT * FROM GUICHE WHERE numero_guiche = ? LIMIT 1');
    return stmt.get(Number(numeroGuiche));
  }

  /**
   * Busca um guichê pelo ID primário.
   * @param {number} idGuiche
   * @returns {object|undefined}
   */
  findById(idGuiche) {
    const stmt = this.db.prepare('SELECT * FROM GUICHE WHERE id_guiche = ? LIMIT 1');
    return stmt.get(Number(idGuiche));
  }

  /**
   * Atualiza o operador e o status do guichê.
   * @param {number} idGuiche
   * @param {string} nomeAtendente
   * @param {string} [statusOperacional=STATUS_GUICHE.EM_ATENDIMENTO]
   * @returns {object|undefined}
   */
  updateOperador(idGuiche, nomeAtendente, statusOperacional = STATUS_GUICHE.EM_ATENDIMENTO) {
    const stmt = this.db.prepare(`
      UPDATE GUICHE 
      SET nome_atendente = ?, status_operacional = ?, data_ultimo_acesso = CURRENT_TIMESTAMP 
      WHERE id_guiche = ?
    `);
    stmt.run(nomeAtendente, statusOperacional, Number(idGuiche));
    return this.findById(idGuiche);
  }

  /**
   * Atualiza apenas o status operacional do guichê.
   * @param {number} idGuiche
   * @param {string} statusOperacional
   * @returns {object|undefined}
   */
  updateStatus(idGuiche, statusOperacional) {
    const stmt = this.db.prepare(`
      UPDATE GUICHE 
      SET status_operacional = ?, data_ultimo_acesso = CURRENT_TIMESTAMP 
      WHERE id_guiche = ?
    `);
    stmt.run(statusOperacional, Number(idGuiche));
    return this.findById(idGuiche);
  }
}

module.exports = new GuicheRepository();
module.exports.GuicheRepository = GuicheRepository;
