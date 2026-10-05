/**
 * @fileoverview Controlador do endpoint Server-Sent Events (SSE).
 */
const defaultSseService = require('../services/sse.service');

class SSEController {
  constructor(sseService = defaultSseService) {
    this.sseService = sseService;
    this.connectStream = this.connectStream.bind(this);
  }

  /**
   * Conecta um cliente ao stream SSE.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  connectStream(req, res) {
    const { tipo = 'publico', guiche = null } = req.query;
    const guicheId = guiche ? Number(guiche) : null;
    this.sseService.addClient(req, res, { tipo, guiche: guicheId });
  }
}

module.exports = new SSEController();
module.exports.SSEController = SSEController;
