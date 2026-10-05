/**
 * @fileoverview Wrapper para handlers assíncronos do Express.
 * Elimina boilerplate de try/catch repetitivo em controladores,
 * encaminhando rejeições de Promise para o middleware de erro centralizado.
 *
 * @param {Function} fn - Handler assíncrono (req, res, next)
 * @returns {Function} Express middleware handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
