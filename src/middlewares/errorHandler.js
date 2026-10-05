/**
 * @fileoverview Middleware centralizado de tratamento de erros.
 * Garante respostas JSON consistentes e tratamento de exceções operacionais vs não tratadas.
 */
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isOperational = Boolean(err.isOperational);
  const statusCode = err.statusCode || (isOperational ? 400 : 500);
  const mensagem = isOperational
    ? err.message
    : (env.NODE_ENV === 'production' ? 'Erro interno no servidor.' : err.message || 'Erro interno no servidor.');

  if (!isOperational) {
    console.error('💥 [Erro Não Tratado]:', err);
  }

  return res.status(statusCode).json({
    sucesso: false,
    mensagem,
    ...(env.NODE_ENV === 'development' && !isOperational ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;
