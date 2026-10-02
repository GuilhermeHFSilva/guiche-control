const sseService = require('../services/sse.service');

class SSEController {
  connectStream(req, res) {
    const { tipo = 'publico', guiche = null } = req.query;
    sseService.addClient(req, res, { tipo, guiche });
  }
}

module.exports = new SSEController();
