const defaultFilaService = require('../services/fila.service');
const defaultAtendimentoService = require('../services/atendimento.service');

class SenhaController {
  constructor({ filaService = defaultFilaService, atendimentoService = defaultAtendimentoService } = {}) {
    this.filaService = filaService;
    this.atendimentoService = atendimentoService;

    this.emissao = this.emissao.bind(this);
    this.listarStatusFila = this.listarStatusFila.bind(this);
  }

  emissao(req, res, next) {
    try {
      const { categoria = 'CONVENCIONAL', totemId = 'TOTEM-ENTRADA-01' } = req.body || {};
      const resultado = this.filaService.gerarSenha({ categoria, totemId });
      return res.status(201).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  listarStatusFila(req, res, next) {
    try {
      const status = this.atendimentoService.getStatusFila();
      return res.status(200).json({ sucesso: true, ...status });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new SenhaController();
module.exports.SenhaController = SenhaController;
