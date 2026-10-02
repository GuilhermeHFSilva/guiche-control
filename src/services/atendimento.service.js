const senhaRepository = require('../repositories/senha.repository');
const guicheRepository = require('../repositories/guiche.repository');
const atendimentoRepository = require('../repositories/atendimento.repository');

class AtendimentoService {
  getStatusFila() {
    const stats = senhaRepository.getQueueStats();
    const pendentes = senhaRepository.getFilaPendenteDetalhada();
    const ultimasChamadas = senhaRepository.getUltimasChamadas(5);
    const guiches = guicheRepository.findAll();

    return {
      stats,
      pendentes,
      ultimasChamadas,
      guiches
    };
  }

  getGuicheInfo(numeroGuiche) {
    const guiche = guicheRepository.findByNumero(numeroGuiche);
    if (!guiche) return null;

    const ultimoAtendimento = atendimentoRepository.findUltimoAtendimentoPorGuiche(guiche.id_guiche);
    const atendimentosHoje = atendimentoRepository.countAtendimentosHojePorGuiche(guiche.id_guiche);

    return {
      ...guiche,
      ultimoAtendimento,
      atendimentosHoje
    };
  }
}

module.exports = new AtendimentoService();
