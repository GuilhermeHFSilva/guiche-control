const filaService = require('../services/fila.service');
const atendimentoService = require('../services/atendimento.service');

class SenhaController {
  emissao(req, res) {
    try {
      const { categoria = 'CONVENCIONAL', totemId = 'TOTEM-ENTRADA-01' } = req.body;
      const resultado = filaService.gerarSenha({ categoria, totemId });
      return res.status(201).json(resultado);
    } catch (error) {
      console.error('❌ Erro na emissão de senha:', error);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao gerar senha.' });
    }
  }

  listarStatusFila(req, res) {
    try {
      const status = atendimentoService.getStatusFila();
      return res.status(200).json({ sucesso: true, ...status });
    } catch (error) {
      console.error('❌ Erro ao buscar status da fila:', error);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao consultar fila.' });
    }
  }
}

module.exports = new SenhaController();
