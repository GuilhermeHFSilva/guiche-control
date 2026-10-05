/**
 * @fileoverview Lógica do Totem de Autoatendimento touch-screen.
 * Gerencia a emissão de senhas por categoria e a exibição do bilhete térmico simulado.
 */

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    btnPreferencial: document.getElementById('btnPreferencial'),
    btnConvencional: document.getElementById('btnConvencional'),
    btnExames: document.getElementById('btnExames'),
    ticketModalOverlay: document.getElementById('ticketModalOverlay'),
    modalSenhaCode: document.getElementById('modalSenhaCode'),
    modalCategoriaName: document.getElementById('modalCategoriaName'),
    modalPosicaoFila: document.getElementById('modalPosicaoFila'),
    modalHoraEmissao: document.getElementById('modalHoraEmissao'),
    modalTimerText: document.getElementById('modalTimerText')
  };

  let modalTimerInterval = null;

  /**
   * Habilita ou desabilita os botões para evitar emissões duplicadas por toque acidental.
   * @param {boolean} disabled
   */
  function setButtonsDisabled(disabled) {
    if (elements.btnPreferencial) elements.btnPreferencial.disabled = disabled;
    if (elements.btnConvencional) elements.btnConvencional.disabled = disabled;
    if (elements.btnExames) elements.btnExames.disabled = disabled;
  }

  /**
   * Dispara a emissão de senha no backend para a categoria selecionada.
   * @param {string} categoria
   */
  async function emitirSenha(categoria) {
    setButtonsDisabled(true);
    try {
      const res = await fetch('/api/senhas/emissao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria,
          totemId: 'TOTEM-ENTRADA-01'
        })
      });

      const data = await res.json();

      if (data.sucesso) {
        exibirComprovante(data);
      } else {
        alert(data.mensagem || 'Não foi possível gerar a senha. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro na emissão de senha:', err);
      alert('Falha na comunicação com o servidor de atendimento.');
    } finally {
      setButtonsDisabled(false);
    }
  }

  /**
   * Fecha o modal de comprovante e limpa os timers.
   */
  function fecharModal() {
    if (modalTimerInterval) {
      clearInterval(modalTimerInterval);
      modalTimerInterval = null;
    }
    if (elements.ticketModalOverlay) {
      elements.ticketModalOverlay.classList.remove('active');
    }
  }

  /**
   * Exibe o modal com visual de bilhete impresso e inicia temporizador de retorno.
   * @param {object} ticketData
   */
  function exibirComprovante(ticketData) {
    if (elements.modalSenhaCode) elements.modalSenhaCode.textContent = ticketData.senhaEmitida;
    if (elements.modalCategoriaName) elements.modalCategoriaName.textContent = ticketData.categoria;
    if (elements.modalPosicaoFila) elements.modalPosicaoFila.textContent = `${ticketData.posicaoFila}º na fila`;
    if (elements.modalHoraEmissao) {
      elements.modalHoraEmissao.textContent = ticketData.horaEmissao || new Date().toLocaleTimeString('pt-BR');
    }

    if (elements.ticketModalOverlay) {
      elements.ticketModalOverlay.classList.add('active');
    }

    let countdown = 5;
    if (elements.modalTimerText) {
      elements.modalTimerText.textContent = `Retornando à tela inicial em ${countdown}s...`;
    }

    if (modalTimerInterval) {
      clearInterval(modalTimerInterval);
    }

    modalTimerInterval = setInterval(() => {
      countdown--;
      if (elements.modalTimerText) {
        elements.modalTimerText.textContent = `Retornando à tela inicial em ${countdown}s...`;
      }

      if (countdown <= 0) {
        fecharModal();
      }
    }, 1000);
  }

  // Listeners de seleção de categoria
  elements.btnPreferencial?.addEventListener('click', () => emitirSenha('PREFERENCIAL'));
  elements.btnConvencional?.addEventListener('click', () => emitirSenha('CONVENCIONAL'));
  elements.btnExames?.addEventListener('click', () => emitirSenha('EXAMES'));

  // Fechar comprovante ao clicar sobre o overlay
  elements.ticketModalOverlay?.addEventListener('click', fecharModal);
});
