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

  rechamar(req, res, next) {
    try {
      const guicheId = this._extrairGuicheId(req.body);
      const resultado = this.filaService.rechamarSenha({ guicheId });
      return res.status(200).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  ausente(req, res, next) {
    try {
      const guicheId = this._extrairGuicheId(req.body);
      const resultado = this.filaService.marcarAusente({ guicheId });
      return res.status(200).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  finalizar(req, res, next) {
    try {
      const guicheId = this._extrairGuicheId(req.body);
      const resultado = this.filaService.finalizarAtendimento({ guicheId });
      return res.status(200).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  listarGuiches(req, res, next) {
    try {
      const guiches = this.guicheRepo.findAll();
      return res.status(200).json({ sucesso: true, guiches });
    } catch (error) {
      return next(error);
    }
  }

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

  _extrairGuicheId(body = {}) {
    const rawId = body.guicheId ?? body.guiche ?? 1;
    return Number(rawId);
  }
}

module.exports = new GuicheController();
module.exports.GuicheController = GuicheController;
