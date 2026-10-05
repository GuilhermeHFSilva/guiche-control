/**
 * @fileoverview Classe base para erros operacionais da aplicação.
 */

class AppError extends Error {
  /**
   * @param {string} message - Mensagem legível para o cliente
   * @param {number} [statusCode=500] - Código de status HTTP
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
