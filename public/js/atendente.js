document.addEventListener('DOMContentLoaded', () => {
  const guicheSelect = document.getElementById('guicheSelect');
  const btnChamarProximo = document.getElementById('btnChamarProximo');
  const btnRechamar = document.getElementById('btnRechamar');
  const btnAusente = document.getElementById('btnAusente');
  const btnFinalizar = document.getElementById('btnFinalizar');
  const senhaAtualDisplay = document.getElementById('senhaAtualDisplay');
  const statusSseBadge = document.getElementById('statusSseBadge');
  
  // Elements for Statistics
  const statTotalAguardando = document.getElementById('statTotalAguardando');
  const statFilaPreferencial = document.getElementById('statFilaPreferencial');
  const statFilaConvencional = document.getElementById('statFilaConvencional');
  const queueTableBody = document.getElementById('queueTableBody');

  let currentGuicheId = parseInt(guicheSelect.value, 10);
  let eventSource = null;

  // Atualiza guichê selecionado
  guicheSelect.addEventListener('change', (e) => {
    currentGuicheId = parseInt(e.target.value, 10);
    carregarDadosGuiche();
  });

  function atualizarBadgeStatus(status, text) {
    statusSseBadge.className = `status-badge ${status}`;
    statusSseBadge.innerHTML = `<span class="status-dot"></span> ${text}`;
  }

  // Conexão EventSource (SSE) com resiliência e reconexão automática (RF-08)
  function initSSE() {
    atualizarBadgeStatus('reconnecting', 'Reconectando...');

    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(`/api/atendimento/stream?tipo=atendente&guiche=${currentGuicheId}`);

    eventSource.onopen = () => {
      atualizarBadgeStatus('', '[SSE OK]');
    };

    eventSource.addEventListener('CONNECTED', (e) => {
      atualizarBadgeStatus('', '[SSE Conectado]');
    });

    eventSource.addEventListener('QUEUE_UPDATE', (e) => {
      try {
        const data = JSON.parse(e.data);
        atualizarEstatisticas(data);
      } catch (err) {
        console.error('Erro ao processar QUEUE_UPDATE:', err);
      }
    });

    eventSource.addEventListener('SENHA_CHAMADA', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.guiche === currentGuicheId) {
          senhaAtualDisplay.textContent = data.senha;
          senhaAtualDisplay.classList.add('flash-call');
          setTimeout(() => senhaAtualDisplay.classList.remove('flash-call'), 2000);
        }
        carregarStatusFila();
      } catch (err) {
        console.error('Erro ao processar SENHA_CHAMADA:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.warn('⚠️ Conexão SSE oscilou. Tentando reconectar...');
      atualizarBadgeStatus('disconnected', '[Reconectando...]');
    };
  }

  function atualizarEstatisticas(data) {
    if (statTotalAguardando) statTotalAguardando.textContent = data.totalAguardando ?? 0;
    if (statFilaPreferencial) statFilaPreferencial.textContent = data.filaPreferencial ?? 0;
    if (statFilaConvencional) statFilaConvencional.textContent = data.filaConvencional ?? 0;
  }

  async function carregarStatusFila() {
    try {
      const res = await fetch('/api/senhas/status');
      const data = await res.json();
      if (data.sucesso) {
        atualizarEstatisticas(data.stats);
        renderizarTabelaFila(data.pendentes);
      }
    } catch (err) {
      console.error('Erro ao carregar status da fila:', err);
    }
  }

  async function carregarDadosGuiche() {
    try {
      const res = await fetch(`/api/guiches/${currentGuicheId}`);
      const data = await res.json();
      if (data.sucesso && data.guiche && data.guiche.ultimoAtendimento) {
        senhaAtualDisplay.textContent = data.guiche.ultimoAtendimento.codigo_senha;
      }
    } catch (err) {
      console.error('Erro ao carregar guichê:', err);
    }
    carregarStatusFila();
  }

  function renderizarTabelaFila(pendentes) {
    if (!queueTableBody) return;
    if (!pendentes || pendentes.length === 0) {
      queueTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhuma senha aguardando na fila.</td></tr>`;
      return;
    }

    queueTableBody.innerHTML = pendentes.map((item, index) => {
      const tagClass = item.codigo_prefixo === 'P' ? 'tag-p' : (item.codigo_prefixo === 'E' ? 'tag-e' : 'tag-c');
      return `
        <tr>
          <td><strong>${index + 1}º</strong></td>
          <td><span class="ticket-tag ${tagClass}">${item.codigo_senha}</span></td>
          <td>${item.nome_categoria}</td>
          <td>${item.hora_emissao} (${item.minutos_espera || 0} min)</td>
        </tr>
      `;
    }).join('');
  }

  // Ações de Botões
  btnChamarProximo.addEventListener('click', async () => {
    btnChamarProximo.disabled = true;
    try {
      const res = await fetch('/api/atendimento/proximo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guicheId: currentGuicheId, atendenteId: `ATD-10${currentGuicheId}` })
      });
      const data = await res.json();

      if (data.sucesso) {
        senhaAtualDisplay.textContent = data.senhaChamada;
      } else {
        alert(data.mensagem || 'Não há senhas pendentes na fila.');
      }
    } catch (err) {
      console.error('Erro ao chamar próximo:', err);
    } finally {
      btnChamarProximo.disabled = false;
    }
  });

  btnRechamar.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/atendimento/rechamar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guicheId: currentGuicheId })
      });
      const data = await res.json();
      if (!data.sucesso) alert(data.mensagem);
    } catch (err) {
      console.error('Erro ao rechamar:', err);
    }
  });

  btnAusente.addEventListener('click', async () => {
    if (!confirm('Deseja marcar a senha atual como cliente ausente?')) return;
    try {
      const res = await fetch('/api/atendimento/ausente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guicheId: currentGuicheId })
      });
      const data = await res.json();
      if (data.sucesso) {
        senhaAtualDisplay.textContent = '---';
        carregarStatusFila();
      }
    } catch (err) {
      console.error('Erro ao marcar ausente:', err);
    }
  });

  btnFinalizar.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/atendimento/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guicheId: currentGuicheId })
      });
      const data = await res.json();
      if (data.sucesso) {
        senhaAtualDisplay.textContent = '---';
        carregarStatusFila();
      }
    } catch (err) {
      console.error('Erro ao finalizar atendimento:', err);
    }
  });

  // Inicialização
  carregarDadosGuiche();
  initSSE();
});
