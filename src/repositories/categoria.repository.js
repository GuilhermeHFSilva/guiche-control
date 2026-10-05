/**
 * @fileoverview Repositório para operações na tabela CATEGORIA_SENHA.
 */
const defaultDb = require('../config/database');

class CategoriaRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} [database=defaultDb]
   */
  constructor(database = defaultDb) {
    this.db = database;
  }

  /**
   * Retorna todas as categorias ativas ordenadas por nível de prioridade.
   * @returns {Array<object>}
   */
  findAll() {
    const stmt = this.db.prepare(
      'SELECT * FROM CATEGORIA_SENHA WHERE ativo = 1 ORDER BY nivel_prioridade ASC'
    );
    return stmt.all();
  }

  /**
   * Busca uma categoria ativa pelo prefixo (ex: 'P', 'C', 'E').
   * @param {string} prefix
   * @returns {object|undefined}
   */
  findByPrefix(prefix) {
    const stmt = this.db.prepare(
      'SELECT * FROM CATEGORIA_SENHA WHERE codigo_prefixo = ? AND ativo = 1 LIMIT 1'
    );
    return stmt.get(prefix.toUpperCase());
  }

  /**
   * Busca uma categoria pelo ID.
   * @param {number} id
   * @returns {object|undefined}
   */
  findById(id) {
    const stmt = this.db.prepare(
      'SELECT * FROM CATEGORIA_SENHA WHERE id_categoria = ? LIMIT 1'
    );
    return stmt.get(Number(id));
  }

  /**
   * Busca uma categoria ativa por parte do nome.
   * @param {string} name
   * @returns {object|undefined}
   */
  findByName(name) {
    const stmt = this.db.prepare(
      'SELECT * FROM CATEGORIA_SENHA WHERE UPPER(nome_categoria) LIKE UPPER(?) AND ativo = 1 LIMIT 1'
    );
    return stmt.get(`%${name}%`);
  }
}

module.exports = new CategoriaRepository();
module.exports.CategoriaRepository = CategoriaRepository;
