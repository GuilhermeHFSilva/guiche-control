document.addEventListener('DOMContentLoaded', () => {
  const currentTicketCode = document.getElementById('currentTicketCode');
  const currentGuicheDisplay = document.getElementById('currentGuicheDisplay');
  const tvCallBanner = document.getElementById('tvCallBanner');
  const historyListContainer = document.getElementById('historyListContainer');
  const tvClock = document.getElementById('tvClock');
  const audioChime = document.getElementById('audioChime');

  let audioCtx = null;
  let eventSource = null;

  // Sintetizador Web Audio API para tocar o alarme sonoro (chime / gong) de chamada
  function playSyntheticChime() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Se existir o elemento <audio> de chime e ele carregar com sucesso, toca ele
      if (audioChime && audioChime.readyState >= 2) {
        audioChime.currentTime = 0;
        audioChime.play().catch(() => playBeepNotes());
        return;
      }
      playBeepNotes();
    } catch (e) {
      console.warn('Web Audio API chime fallback:', e);
    }
  }

  function playBeepNotes() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // Nota 1: G5 (783.99 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Nota 2: C6 (1046.50 Hz) - 150ms depois
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.15);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 1.2);
  }

  // Permite ativar áudio no primeiro clique na TV (política de Autoplay dos navegadores)
  document.body.addEventListener('click', () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, { once: true });

  // Atualizador de Relógio Digital
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    if (tvClock) {
      tvClock.textContent = `${hours}:${mins}:${secs}`;
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Conexão SSE
  function initSSE() {
    if (eventSource) eventSource.close();

    eventSource = new EventSource('/api/atendimento/stream?tipo=publico');

    eventSource.onopen = () => {
      console.log('📡 [TV SSE] Conectado ao feed de chamadas da sala de espera.');
    };

    const handleCall = (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('🔔 [TV Chamada Recebida]', data);

        // Atualiza a tela principal com destaque gigante
        if (currentTicketCode) currentTicketCode.textContent = data.senha;
        if (currentGuicheDisplay) currentGuicheDisplay.textContent = `GUICHÊ ${String(data.guiche).padStart(2, '0')}`;

        // Executa animação de flash verde no banner (RF-06)
        if (tvCallBanner) {
          tvCallBanner.classList.remove('flash-call');
          void tvCallBanner.offsetWidth; // Force reflow
          tvCallBanner.classList.add('flash-call');
        }

        // Reproduz o alarme sonoro (RF-06)
        playSyntheticChime();

        // Atualiza o painel de histórico (RF-07)
        if (data.historico) {
          renderHistorico(data.historico);
        } else {
          carregarHistorico();
        }
      } catch (err) {
        console.error('Erro ao processar evento de chamada:', err);
      }
    };

    eventSource.addEventListener('SENHA_CHAMADA', handleCall);
    eventSource.addEventListener('CALL_TICKET', handleCall);

    eventSource.onerror = (err) => {
      console.warn('⚠️ Conexão SSE da TV oscilou. EventSource reconectando automaticamente...');
    };
  }

  async function carregarHistorico() {
    try {
      const res = await fetch('/api/senhas/status');
      const data = await res.json();
      if (data.sucesso && data.ultimasChamadas) {
        renderHistorico(data.ultimasChamadas);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico inicial:', err);
    }
  }

  function renderHistorico(historico) {
    if (!historyListContainer) return;
    if (!historico || historico.length === 0) {
      historyListContainer.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px;">Nenhuma chamada recente.</div>`;
      return;
    }

    historyListContainer.innerHTML = historico.slice(0, 4).map(item => `
      <div class="history-item">
        <span class="history-item-code">${item.senha}</span>
        <span class="history-item-guiche">Guichê ${String(item.guiche).padStart(2, '0')}</span>
        <span class="history-item-time">${item.hora || ''}</span>
      </div>
    `).join('');
  }

  // Inicialização
  carregarHistorico();
  initSSE();
});
