document.addEventListener('DOMContentLoaded', () => {
  const btnPreferencial = document.getElementById('btnPreferencial');
  const btnConvencional = document.getElementById('btnConvencional');
  const btnExames = document.getElementById('btnExames');
  const ticketModalOverlay = document.getElementById('ticketModalOverlay');
  const modalSenhaCode = document.getElementById('modalSenhaCode');
  const modalCategoriaName = document.getElementById('modalCategoriaName');
  const modalPosicaoFila = document.getElementById('modalPosicaoFila');
  const modalHoraEmissao = document.getElementById('modalHoraEmissao');
  const modalTimerText = document.getElementById('modalTimerText');

  let modalTimerInterval = null;

  async function emitirSenha(categoria) {
    disableButtons(true);
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
        exibirModalComprovante(data);
      } else {
        alert(data.mensagem || 'Erro ao gerar senha. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro na emissão de senha:', err);
      alert('Falha na comunicação com o servidor de atendimento.');
    } finally {
      disableButtons(false);
    }
  }

  function disableButtons(disabled) {
    if (btnPreferencial) btnPreferencial.disabled = disabled;
    if (btnConvencional) btnConvencional.disabled = disabled;
    if (btnExames) btnExames.disabled = disabled;
  }

  function exibirModalComprovante(data) {
    if (modalSenhaCode) modalSenhaCode.textContent = data.senhaEmitida;
    if (modalCategoriaName) modalCategoriaName.textContent = data.categoria;
    if (modalPosicaoFila) modalPosicaoFila.textContent = `${data.posicaoFila}º na fila`;
    if (modalHoraEmissao) modalHoraEmissao.textContent = data.horaEmissao || new Date().toLocaleTimeString();

    if (ticketModalOverlay) {
      ticketModalOverlay.classList.add('active');
    }

    let countdown = 5;
    if (modalTimerText) modalTimerText.textContent = `Retornando à tela inicial em ${countdown}s...`;

    if (modalTimerInterval) clearInterval(modalTimerInterval);

    modalTimerInterval = setInterval(() => {
      countdown--;
      if (modalTimerText) modalTimerText.textContent = `Retornando à tela inicial em ${countdown}s...`;

      if (countdown <= 0) {
        clearInterval(modalTimerInterval);
        if (ticketModalOverlay) ticketModalOverlay.classList.remove('active');
      }
    }, 1000);
  }

  if (btnPreferencial) btnPreferencial.addEventListener('click', () => emitirSenha('PREFERENCIAL'));
  if (btnConvencional) btnConvencional.addEventListener('click', () => emitirSenha('CONVENCIONAL'));
  if (btnExames) btnExames.addEventListener('click', () => emitirSenha('EXAMES'));

  // Fechar modal ao clicar fora ou na tela
  if (ticketModalOverlay) {
    ticketModalOverlay.addEventListener('click', () => {
      if (modalTimerInterval) clearInterval(modalTimerInterval);
      ticketModalOverlay.classList.remove('active');
    });
  }
});
