const filaService = require('../services/fila.service');
const guicheRepository = require('../repositories/guiche.repository');
const atendimentoService = require('../services/atendimento.service');

class GuicheController {
  proximo(req, res) {
    try {
      const { guicheId = 1, guiche = 1, atendenteId = 'ATD-104' } = req.body;
      const numGuiche = guicheId || guiche;

      const resultado = filaService.chamarProximaSenha({
        guicheId: Number(numGuiche),
        atendenteId
      });

      return res.status(200).json(resultado);
    } catch (error) {
      console.error('❌ Erro ao chamar próxima senha:', error);
      return res.status(500).json({ sucesso: false, mensagem: error.message || 'Erro ao chamar senha.' });
    }
  }

  rechamar(req, res) {
    try {
      const { guicheId = 1, guiche = 1 } = req.body;
      const numGuiche = guicheId || guiche;

      const resultado = filaService.rechamarSenha({ guicheId: Number(numGuiche) });
      return res.status(200).json(resultado);
    } catch (error) {
      console.error('❌ Erro ao rechamar senha:', error);
      return res.status(500).json({ sucesso: false, mensagem: error.message || 'Erro ao rechamar.' });
    }
  }

  ausente(req, res) {
    try {
      const { guicheId = 1, guiche = 1 } = req.body;
      const numGuiche = guicheId || guiche;

      const resultado = filaService.marcarAusente({ guicheId: Number(numGuiche) });
      return res.status(200).json(resultado);
    } catch (error) {
      console.error('❌ Erro ao marcar ausente:', error);
      return res.status(500).json({ sucesso: false, mensagem: error.message || 'Erro ao cancelar por ausência.' });
    }
  }

  finalizar(req, res) {
    try {
      const { guicheId = 1, guiche = 1 } = req.body;
      const numGuiche = guicheId || guiche;

      const resultado = filaService.finalizarAtendimento({ guicheId: Number(numGuiche) });
      return res.status(200).json(resultado);
    } catch (error) {
      console.error('❌ Erro ao finalizar atendimento:', error);
      return res.status(500).json({ sucesso: false, mensagem: error.message || 'Erro ao finalizar atendimento.' });
    }
  }

  listarGuiches(req, res) {
    try {
      const guiches = guicheRepository.findAll();
      return res.status(200).json({ sucesso: true, guiches });
    } catch (error) {
      console.error('❌ Erro ao listar guichês:', error);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar guichês.' });
    }
  }

  obterGuiche(req, res) {
    try {
      const { id } = req.params;
      const guicheInfo = atendimentoService.getGuicheInfo(Number(id));
      if (!guicheInfo) {
        return res.status(404).json({ sucesso: false, mensagem: 'Guichê não encontrado.' });
      }
      return res.status(200).json({ sucesso: true, guiche: guicheInfo });
    } catch (error) {
      return res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  }
}

module.exports = new GuicheController();
