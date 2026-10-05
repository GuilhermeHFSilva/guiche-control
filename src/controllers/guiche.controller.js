/**
 * @fileoverview Controlador para ações e consultas relacionadas aos guichês de atendimento.
 */
const defaultFilaService = require('../services/fila.service');
const defaultGuicheRepo = require('../repositories/guiche.repository');
const defaultAtendimentoService = require('../services/atendimento.service');
const { NotFoundError } = require('../errors');

class GuicheController {
  constructor({
    filaService = defaultFilaService,
    guicheRepo = defaultGuicheRepo,
    atendimentoService = defaultAtendimentoService
  } = {}) {
    this.filaService = filaService;
    this.guicheRepo = guicheRepo;
    this.atendimentoService = atendimentoService;

    this.proximo = this.proximo.bind(this);
    this.rechamar = this.rechamar.bind(this);
    this.ausente = this.ausente.bind(this);
    this.finalizar = this.finalizar.bind(this);
    this.listarGuiches = this.listarGuiches.bind(this);
    this.obterGuiche = this.obterGuiche.bind(this);
  }

  /**
   * Chama a próxima senha com prioridade legal para o guichê.
   */
  proximo(req, res, next) {
    try {
      const guicheId = this._extrairGuicheId(req.body);
      const atendenteId = req.body?.atendenteId || `ATD-10${guicheId}`;
      const resultado = this.filaService.chamarProximaSenha({ guicheId, atendenteId });
      return res.status(200).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Re-anuncia a senha atual no painel público.
   */
  rechamar(req, res, next) {
    try {
      const guicheId = this._extrairGuicheId(req.body);
      const resultado = this.filaService.rechamarSenha({ guicheId });
      return res.status(200).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Marca o cliente atual como ausente e libera o guichê.
   */
  ausente(req, res, next) {
    try {
      const guicheId = this._extrairGuicheId(req.body);
      const resultado = this.filaService.marcarAusente({ guicheId });
      return res.status(200).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Conclui o atendimento atual no guichê.
   */
  finalizar(req, res, next) {
    try {
      const guicheId = this._extrairGuicheId(req.body);
      const resultado = this.filaService.finalizarAtendimento({ guicheId });
      return res.status(200).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Lista todos os guichês operacionais cadastrados.
   */
  listarGuiches(req, res, next) {
    try {
      const guiches = this.guicheRepo.findAll();
      return res.status(200).json({ sucesso: true, guiches });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Consulta os dados de um guichê específico por ID ou número.
   */
  obterGuiche(req, res, next) {
    try {
      const { id } = req.params;
      const guicheInfo = this.atendimentoService.getGuicheInfo(Number(id));

      if (!guicheInfo) {
        throw new NotFoundError(`Guichê ${id} não encontrado.`);
      }

      return res.status(200).json({ sucesso: true, guiche: guicheInfo });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Extrai o identificador numérico do guichê a partir do corpo da requisição.
   * @private
   */
  _extrairGuicheId(body = {}) {
    const rawId = body.guicheId ?? body.guiche ?? 1;
    return Number(rawId);
  }
}

module.exports = new GuicheController();
module.exports.GuicheController = GuicheController;
