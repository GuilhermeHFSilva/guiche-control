const defaultSenhaRepo = require('../repositories/senha.repository');
const defaultGuicheRepo = require('../repositories/guiche.repository');
const defaultAtendimentoRepo = require('../repositories/atendimento.repository');

class AtendimentoService {
  constructor({
    senhaRepo = defaultSenhaRepo,
    guicheRepo = defaultGuicheRepo,
    atendimentoRepo = defaultAtendimentoRepo
  } = {}) {
    this.senhaRepo = senhaRepo;
    this.guicheRepo = guicheRepo;
    this.atendimentoRepo = atendimentoRepo;
  }

  getStatusFila() {
    const stats = this.senhaRepo.getQueueStats();
    const pendentes = this.senhaRepo.getFilaPendenteDetalhada();
    const ultimasChamadas = this.senhaRepo.getUltimasChamadas(5);
    const guiches = this.guicheRepo.findAll();

    return {
      stats,
      pendentes,
      ultimasChamadas,
      guiches
    };
  }

  getGuicheInfo(numeroGuiche) {
    const guiche = this.guicheRepo.findByNumero(numeroGuiche) || this.guicheRepo.findById(numeroGuiche);
    if (!guiche) return null;

    const ultimoAtendimento = this.atendimentoRepo.findUltimoAtendimentoPorGuiche(guiche.id_guiche);
    const atendimentosHoje = this.atendimentoRepo.countAtendimentosHojePorGuiche(guiche.id_guiche);

    return {
      ...guiche,
      ultimoAtendimento,
      atendimentosHoje
    };
  }
}

module.exports = new AtendimentoService();
module.exports.AtendimentoService = AtendimentoService;
