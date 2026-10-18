document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    guicheSelect: document.getElementById('guicheSelect'),
    operatorName: document.getElementById('operatorName'),
    statusSseBadge: document.getElementById('statusSseBadge'),
    senhaAtualDisplay: document.getElementById('senhaAtualDisplay'),
    btnChamarProximo: document.getElementById('btnChamarProximo'),
    btnRechamar: document.getElementById('btnRechamar'),
    btnAusente: document.getElementById('btnAusente'),
    btnFinalizar: document.getElementById('btnFinalizar'),
    statTotalAguardando: document.getElementById('statTotalAguardando'),
    statFilaPreferencial: document.getElementById('statFilaPreferencial'),
    statFilaConvencional: document.getElementById('statFilaConvencional'),
    queueTableBody: document.getElementById('queueTableBody')
  };

  let currentGuicheId = Number.parseInt(elements.guicheSelect.value, 10);
  let eventSource = null;

  function setStatusBadge(status, text) {
    if (!elements.statusSseBadge) return;
    elements.statusSseBadge.className = `status-badge ${status}`.trim();
    elements.statusSseBadge.innerHTML = `<span class="status-dot"></span> ${text}`;
  }

  function initSSE() {
    setStatusBadge('reconnecting', 'Reconectando...');

    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(`/api/atendimento/stream?tipo=atendente&guiche=${currentGuicheId}`);

    eventSource.onopen = () => {
      setStatusBadge('', '[SSE OK]');
    };

    eventSource.addEventListener('CONNECTED', () => {
      setStatusBadge('', '[SSE Conectado]');
    });

    eventSource.addEventListener('QUEUE_UPDATE', (e) => {
      try {
        const data = JSON.parse(e.data);
        renderStatistics(data);
      } catch (err) {
        console.error('Erro ao processar QUEUE_UPDATE:', err);
      }
    });

    eventSource.addEventListener('SENHA_CHAMADA', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.guiche === currentGuicheId) {
          highlightCurrentTicket(data.senha);
        }
        loadQueueStatus();
      } catch (err) {
        console.error('Erro ao processar SENHA_CHAMADA:', err);
      }
    });

    eventSource.onerror = () => {
      console.warn('⚠️ Conexão SSE oscilou. Tentando reconectar...');
      setStatusBadge('disconnected', '[Reconectando...]');
    };
  }

  function highlightCurrentTicket(ticketCode) {
    if (!elements.senhaAtualDisplay) return;
    elements.senhaAtualDisplay.textContent = ticketCode;
    elements.senhaAtualDisplay.classList.add('flash-call');
    setTimeout(() => elements.senhaAtualDisplay.classList.remove('flash-call'), 2000);
  }

  function renderStatistics(stats = {}) {
    if (elements.statTotalAguardando) elements.statTotalAguardando.textContent = stats.totalAguardando ?? 0;
    if (elements.statFilaPreferencial) elements.statFilaPreferencial.textContent = stats.filaPreferencial ?? 0;
    if (elements.statFilaConvencional) elements.statFilaConvencional.textContent = stats.filaConvencional ?? 0;
  }

  async function loadQueueStatus() {
    try {
      const res = await fetch('/api/senhas/status');
      const data = await res.json();
      if (data.sucesso) {
        renderStatistics(data.stats);
        renderQueueTable(data.pendentes);
      }
    } catch (err) {
      console.error('Erro ao carregar status da fila:', err);
    }
  }

  async function loadGuicheData() {
    try {
      const res = await fetch(`/api/guiches/${currentGuicheId}`);
      const data = await res.json();

      if (data.sucesso && data.guiche) {
        const { guiche } = data;
        if (elements.operatorName) {
          elements.operatorName.textContent = `${guiche.nome_atendente || 'Operador'} (Guichê ${guiche.numero_guiche})`;
        }
        if (elements.senhaAtualDisplay) {
          elements.senhaAtualDisplay.textContent = guiche.ultimoAtendimento?.codigo_senha || '---';
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados do guichê:', err);
    }
    loadQueueStatus();
  }

  function renderQueueTable(pendentes) {
    if (!elements.queueTableBody) return;

    if (!Array.isArray(pendentes) || pendentes.length === 0) {
      elements.queueTableBody.innerHTML = `
        <tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhuma senha aguardando na fila.</td></tr>
      `;
      return;
    }

    elements.queueTableBody.innerHTML = pendentes.map((item, index) => {
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

  async function sendAction(endpoint, payload) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  elements.guicheSelect.addEventListener('change', (e) => {
    currentGuicheId = Number.parseInt(e.target.value, 10);
    loadGuicheData();
    initSSE();
  });

  elements.btnChamarProximo.addEventListener('click', async () => {
    elements.btnChamarProximo.disabled = true;
    try {
      const data = await sendAction('/api/atendimento/proximo', {
        guicheId: currentGuicheId,
        atendenteId: `ATD-10${currentGuicheId}`
      });

      if (data.sucesso) {
        highlightCurrentTicket(data.senhaChamada);
      } else {
        alert(data.mensagem || 'Não há senhas pendentes na fila.');
      }
    } catch (err) {
      console.error('Erro ao chamar próximo:', err);
    } finally {
      elements.btnChamarProximo.disabled = false;
    }
  });

  elements.btnRechamar.addEventListener('click', async () => {
    try {
      const data = await sendAction('/api/atendimento/rechamar', { guicheId: currentGuicheId });
      if (!data.sucesso) alert(data.mensagem);
    } catch (err) {
      console.error('Erro ao rechamar:', err);
    }
  });

  elements.btnAusente.addEventListener('click', async () => {
    if (!confirm('Deseja marcar a senha atual como cliente ausente?')) return;
    try {
      const data = await sendAction('/api/atendimento/ausente', { guicheId: currentGuicheId });
      if (data.sucesso) {
        elements.senhaAtualDisplay.textContent = '---';
        loadQueueStatus();
      } else {
        alert(data.mensagem);
      }
    } catch (err) {
      console.error('Erro ao marcar ausente:', err);
    }
  });

  elements.btnFinalizar.addEventListener('click', async () => {
    try {
      const data = await sendAction('/api/atendimento/finalizar', { guicheId: currentGuicheId });
      if (data.sucesso) {
        elements.senhaAtualDisplay.textContent = '---';
        loadQueueStatus();
      } else {
        alert(data.mensagem);
      }
    } catch (err) {
      console.error('Erro ao finalizar atendimento:', err);
    }
  });

  loadGuicheData();
  initSSE();
});
