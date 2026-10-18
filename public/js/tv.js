document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    currentTicketCode: document.getElementById('currentTicketCode'),
    currentGuicheDisplay: document.getElementById('currentGuicheDisplay'),
    tvCallBanner: document.getElementById('tvCallBanner'),
    historyListContainer: document.getElementById('historyListContainer'),
    tvClock: document.getElementById('tvClock'),
    audioChime: document.getElementById('audioChime')
  };

  let audioCtx = null;
  let eventSource = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playCallAlert() {
    try {
      if (elements.audioChime && elements.audioChime.readyState >= 2) {
        elements.audioChime.currentTime = 0;
        elements.audioChime.play().catch(() => playSyntheticChime());
        return;
      }
      playSyntheticChime();
    } catch (e) {
      console.warn('Alerta sonoro:', e);
    }
  }

  function playSyntheticChime() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    playTone(ctx, 783.99, now, 0.6, 0.3);
    playTone(ctx, 1046.50, now + 0.15, 1.0, 0.4);
  }

  function playTone(ctx, frequency, startTime, duration, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  function speakTicket(senha, guicheNumero) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const text = `Senha ${senha.split('').join(' ')}, Guichê ${guicheNumero}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch {
    }
  }

  function startClock() {
    const update = () => {
      if (!elements.tvClock) return;
      const now = new Date();
      elements.tvClock.textContent = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };
    update();
    setInterval(update, 1000);
  }

  function triggerVisualCallAlert() {
    if (!elements.tvCallBanner) return;
    elements.tvCallBanner.classList.remove('flash-call');
    void elements.tvCallBanner.offsetWidth;
    elements.tvCallBanner.classList.add('flash-call');
  }

  function renderHistory(historico = []) {
    if (!elements.historyListContainer) return;

    if (!Array.isArray(historico) || historico.length === 0) {
      elements.historyListContainer.innerHTML = `
        <div style="color: var(--text-muted); text-align: center; padding: 20px;">
          Nenhuma chamada recente.
        </div>
      `;
      return;
    }

    elements.historyListContainer.innerHTML = historico.slice(0, 4).map(item => `
      <div class="history-item">
        <span class="history-item-code">${item.senha}</span>
        <span class="history-item-guiche">Guichê ${String(item.guiche).padStart(2, '0')}</span>
        <span class="history-item-time">${item.hora || ''}</span>
      </div>
    `).join('');
  }

  async function loadInitialHistory() {
    try {
      const res = await fetch('/api/senhas/status');
      const data = await res.json();
      if (data.sucesso && data.ultimasChamadas) {
        renderHistory(data.ultimasChamadas);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico inicial da TV:', err);
    }
  }

  function initSSE() {
    if (eventSource) eventSource.close();

    eventSource = new EventSource('/api/atendimento/stream?tipo=publico');

    eventSource.onopen = () => {
      console.log('📡 [TV SSE] Conectado ao feed em tempo real da sala de espera.');
    };

    const handleCallEvent = (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('🔔 [TV Chamada Recebida]:', data);

        if (elements.currentTicketCode) elements.currentTicketCode.textContent = data.senha;
        if (elements.currentGuicheDisplay) {
          elements.currentGuicheDisplay.innerHTML = `<span>🚪</span> GUICHÊ ${String(data.guiche).padStart(2, '0')}`;
        }

        triggerVisualCallAlert();
        playCallAlert();

        setTimeout(() => speakTicket(data.senha, data.guiche), 600);

        if (Array.isArray(data.historico)) {
          renderHistory(data.historico);
        } else {
          loadInitialHistory();
        }
      } catch (err) {
        console.error('Erro ao processar evento de chamada na TV:', err);
      }
    };

    eventSource.addEventListener('SENHA_CHAMADA', handleCallEvent);
    eventSource.addEventListener('CALL_TICKET', handleCallEvent);

    eventSource.onerror = () => {
      console.warn('⚠️ Conexão SSE da TV oscilou. Reconectando...');
    };
  }

  document.body.addEventListener('click', () => getAudioContext(), { once: true });

  startClock();
  loadInitialHistory();
  initSSE();
});
