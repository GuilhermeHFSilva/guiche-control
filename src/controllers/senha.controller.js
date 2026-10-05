/**
 * @fileoverview Controlador para emissão e status das senhas de atendimento.
 */
const defaultFilaService = require('../services/fila.service');
const defaultAtendimentoService = require('../services/atendimento.service');

class SenhaController {
  constructor({ filaService = defaultFilaService, atendimentoService = defaultAtendimentoService } = {}) {
    this.filaService = filaService;
    this.atendimentoService = atendimentoService;

    this.emissao = this.emissao.bind(this);
    this.listarStatusFila = this.listarStatusFila.bind(this);
  }

  /**
   * Emite uma nova senha de atendimento no totem.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  emissao(req, res, next) {
    try {
      const { categoria = 'CONVENCIONAL', totemId = 'TOTEM-ENTRADA-01' } = req.body || {};
      const resultado = this.filaService.gerarSenha({ categoria, totemId });
      return res.status(201).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retorna as estatísticas consolidadas e senhas pendentes na fila.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
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
