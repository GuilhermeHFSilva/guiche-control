const defaultSenhaRepo = require('../repositories/senha.repository');
const defaultCategoriaRepo = require('../repositories/categoria.repository');
const defaultGuicheRepo = require('../repositories/guiche.repository');
const defaultAtendimentoRepo = require('../repositories/atendimento.repository');
const defaultSseService = require('./sse.service');
const { CATEGORIAS, STATUS_SENHA, STATUS_GUICHE, SSE_EVENTS } = require('../constants');
const { NotFoundError, BadRequestError } = require('../errors');

class FilaService {
  constructor({
    senhaRepo = defaultSenhaRepo,
    categoriaRepo = defaultCategoriaRepo,
    guicheRepo = defaultGuicheRepo,
    atendimentoRepo = defaultAtendimentoRepo,
    sseService = defaultSseService
  } = {}) {
    this.senhaRepo = senhaRepo;
    this.categoriaRepo = categoriaRepo;
    this.guicheRepo = guicheRepo;
    this.atendimentoRepo = atendimentoRepo;
    this.sseService = sseService;
  }

  resolverCategoria(categoriaIdentificador = 'CONVENCIONAL') {
    const termo = String(categoriaIdentificador).trim().toUpperCase();

    if (termo.length === 1) {
      const encontrada = this.categoriaRepo.findByPrefix(termo);
      if (encontrada) return encontrada;
    }

    if (termo.includes('PREF')) {
      return this.categoriaRepo.findByPrefix(CATEGORIAS.PREFERENCIAL.prefixo) || CATEGORIAS.PREFERENCIAL;
    }
    if (termo.includes('EXAM')) {
      return this.categoriaRepo.findByPrefix(CATEGORIAS.EXAMES.prefixo) || CATEGORIAS.EXAMES;
    }

    return this.categoriaRepo.findByPrefix(CATEGORIAS.CONVENCIONAL.prefixo) || CATEGORIAS.CONVENCIONAL;
  }

  gerarSenha({ categoria = 'CONVENCIONAL', totemId = 'TOTEM-01' } = {}) {
    const cat = this.resolverCategoria(categoria);
    const idCategoria = cat.id_categoria || cat.id;
    const prefixo = cat.codigo_prefixo || cat.prefixo;
    const nomeCategoria = cat.nome_categoria || cat.nome;

    const proximoNum = this.senhaRepo.getProximoNumeroSequencial(idCategoria);
    const codigoSenha = `${prefixo}-${String(proximoNum).padStart(3, '0')}`;

    const novaSenha = this.senhaRepo.create({
      id_categoria: idCategoria,
      numero_sequencial: proximoNum,
      codigo_senha: codigoSenha
    });

    const posicaoFila = this.senhaRepo.getPosicaoFila(novaSenha.id_senha, idCategoria);
    this._notificarAtualizacaoFila();

    const horaEmissao = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    return {
      sucesso: true,
      senhaEmitida: codigoSenha,
      categoria: nomeCategoria,
      posicaoFila,
      horaEmissao,
      totemOrigem: totemId,
      mensagem: 'Aguarde o chamado no painel principal.'
    };
  }

  chamarProximaSenha({ guicheId, atendenteId = 'ATD-100' }) {
    const guiche = this._obterGuicheValido(guicheId);
    const proximaSenha = this._obterProximaSenhaDisponivel();

    if (!proximaSenha) {
      return {
        sucesso: false,
        mensagem: 'Não há senhas aguardando no momento.'
      };
    }

    this.atendimentoRepo.create({
      id_senha: proximaSenha.id_senha,
      id_guiche: guiche.id_guiche
    });

    const nomeAtendente = this._formatarNomeAtendente(atendenteId, guiche.nome_atendente);
    this.guicheRepo.updateOperador(guiche.id_guiche, nomeAtendente, STATUS_GUICHE.EM_ATENDIMENTO);

    const queueStats = this.senhaRepo.getQueueStats();
    const ultimasChamadas = this.senhaRepo.getUltimasChamadas(5);
    const atendimentosHoje = this.atendimentoRepo.countAtendimentosHojePorGuiche(guiche.id_guiche);

    const payload = this._criarPayloadChamada({
      codigoSenha: proximaSenha.codigo_senha,
      numeroGuiche: guiche.numero_guiche,
      nomeAtendente,
      totalAguardando: queueStats.totalAguardando,
      historico: ultimasChamadas
    });

    this.sseService.broadcast(SSE_EVENTS.SENHA_CHAMADA, payload);
    this.sseService.broadcast(SSE_EVENTS.CALL_TICKET, payload);
    this.sseService.broadcast(SSE_EVENTS.QUEUE_UPDATE, {
      tipo: SSE_EVENTS.QUEUE_UPDATE,
      ...queueStats
    });

    return {
      sucesso: true,
      senhaChamada: proximaSenha.codigo_senha,
      categoria: proximaSenha.nome_categoria,
      atendimentosRealizadosHoje: atendimentosHoje
    };
  }

  rechamarSenha({ guicheId }) {
    const guiche = this._obterGuicheValido(guicheId);
    const ultimoAtendimento = this.atendimentoRepo.findUltimoAtendimentoPorGuiche(guiche.id_guiche);

    if (!ultimoAtendimento) {
      return {
        sucesso: false,
        mensagem: 'Nenhum atendimento anterior encontrado para este guichê.'
      };
    }

    const queueStats = this.senhaRepo.getQueueStats();
    const ultimasChamadas = this.senhaRepo.getUltimasChamadas(5);

    const payload = this._criarPayloadChamada({
      codigoSenha: ultimoAtendimento.codigo_senha,
      numeroGuiche: guiche.numero_guiche,
      nomeAtendente: guiche.nome_atendente || `Guichê ${guiche.numero_guiche}`,
      totalAguardando: queueStats.totalAguardando,
      historico: ultimasChamadas,
      isRechamada: true
    });

    this.sseService.broadcast(SSE_EVENTS.SENHA_CHAMADA, payload);
    this.sseService.broadcast(SSE_EVENTS.CALL_TICKET, payload);

    return {
      sucesso: true,
      senhaChamada: ultimoAtendimento.codigo_senha,
      mensagem: `Rechamada de senha ${ultimoAtendimento.codigo_senha} enviada para a TV.`
    };
  }

  marcarAusente({ guicheId }) {
    const guiche = this._obterGuicheValido(guicheId);
    const ultimoAtendimento = this.atendimentoRepo.findUltimoAtendimentoPorGuiche(guiche.id_guiche);

    if (!ultimoAtendimento || ultimoAtendimento.status_senha !== STATUS_SENHA.EM_ATENDIMENTO) {
      return {
        sucesso: false,
        mensagem: 'Nenhum atendimento em andamento para marcar ausente.'
      };
    }

    this.senhaRepo.updateStatus(ultimoAtendimento.id_senha, STATUS_SENHA.CANCELADO_AUSENCIA);
    this.guicheRepo.updateStatus(guiche.id_guiche, STATUS_GUICHE.DISPONIVEL);
    this._notificarAtualizacaoFila();

    return {
      sucesso: true,
      mensagem: `Senha ${ultimoAtendimento.codigo_senha} marcada como ${STATUS_SENHA.CANCELADO_AUSENCIA}.`
    };
  }

  finalizarAtendimento({ guicheId }) {
    const guiche = this._obterGuicheValido(guicheId);
    const ultimoAtendimento = this.atendimentoRepo.findUltimoAtendimentoPorGuiche(guiche.id_guiche);

    if (!ultimoAtendimento || ultimoAtendimento.status_senha !== STATUS_SENHA.EM_ATENDIMENTO) {
      return {
        sucesso: false,
        mensagem: 'Nenhum atendimento para finalizar.'
      };
    }

    this.atendimentoRepo.finalizarAtendimento(ultimoAtendimento.id_atendimento);
    this.senhaRepo.updateStatus(ultimoAtendimento.id_senha, STATUS_SENHA.FINALIZADA);
    this.guicheRepo.updateStatus(guiche.id_guiche, STATUS_GUICHE.DISPONIVEL);
    this._notificarAtualizacaoFila();

    return {
      sucesso: true,
      mensagem: `Atendimento da senha ${ultimoAtendimento.codigo_senha} finalizado com sucesso.`
    };
  }

  _obterGuicheValido(identificadorGuiche) {
    if (!identificadorGuiche) {
      throw new BadRequestError('Identificador do guichê é obrigatório.');
    }
    const guiche = this.guicheRepo.findByNumero(identificadorGuiche) || this.guicheRepo.findById(identificadorGuiche);
    if (!guiche) {
      throw new NotFoundError(`Guichê ${identificadorGuiche} não foi encontrado no sistema.`);
    }
    return guiche;
  }

  _obterProximaSenhaDisponivel() {
    let proxima = this.senhaRepo.findNextPendingTicket();
    while (proxima) {
      const reservado = this.senhaRepo.claimTicketAtomic(proxima.id_senha);
      if (reservado) {
        return proxima;
      }
      proxima = this.senhaRepo.findNextPendingTicket();
    }
    return null;
  }

  _formatarNomeAtendente(atendenteId, nomePadrao) {
    if (nomePadrao && nomePadrao !== 'DISPONIVEL') return nomePadrao;
    if (typeof atendenteId === 'string' && atendenteId.startsWith('ATD-')) {
      return `Atendente ${atendenteId}`;
    }
    return atendenteId || 'Atendente';
  }

  _criarPayloadChamada({ codigoSenha, numeroGuiche, nomeAtendente, totalAguardando, historico, isRechamada = false }) {
    return {
      tipo: SSE_EVENTS.SENHA_CHAMADA,
      senha: codigoSenha,
      guiche: numeroGuiche,
      nomeAtendente,
      timestamp: new Date().toISOString(),
      pessoasAguardando: totalAguardando,
      historico,
      isRechamada
    };
  }

  _notificarAtualizacaoFila() {
    const queueStats = this.senhaRepo.getQueueStats();
    this.sseService.broadcast(SSE_EVENTS.QUEUE_UPDATE, {
      tipo: SSE_EVENTS.QUEUE_UPDATE,
      ...queueStats
    });
  }
}

module.exports = new FilaService();
module.exports.FilaService = FilaService;
