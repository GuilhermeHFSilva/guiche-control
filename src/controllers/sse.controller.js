const defaultSseService = require('../services/sse.service');

class SSEController {
  constructor(sseService = defaultSseService) {
    this.sseService = sseService;
    this.connectStream = this.connectStream.bind(this);
  }

  connectStream(req, res) {
    const { tipo = 'publico', guiche = null } = req.query;
    const guicheId = guiche ? Number(guiche) : null;
    this.sseService.addClient(req, res, { tipo, guiche: guicheId });
  }
}

module.exports = new SSEController();
module.exports.SSEController = SSEController;
