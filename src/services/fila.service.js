const senhaRepository = require('../repositories/senha.repository');
const categoriaRepository = require('../repositories/categoria.repository');
const guicheRepository = require('../repositories/guiche.repository');
const atendimentoRepository = require('../repositories/atendimento.repository');
const sseService = require('./sse.service');

class FilaService {
  gerarSenha({ categoria = 'CONVENCIONAL', totemId = 'TOTEM-01' }) {
    let catObj = null;

    if (categoria.length === 1) {
      catObj = categoriaRepository.findByPrefix(categoria.toUpperCase());
    } else if (categoria.toUpperCase().includes('PREFERENCIAL')) {
      catObj = categoriaRepository.findByPrefix('P');
    } else if (categoria.toUpperCase().includes('EXAME')) {
      catObj = categoriaRepository.findByPrefix('E');
    } else {
      catObj = categoriaRepository.findByPrefix('C');
    }

    if (!catObj) {
      catObj = categoriaRepository.findByPrefix('C') || { id_categoria: 2, codigo_prefixo: 'C', nome_categoria: 'Atendimento Convencional' };
    }

    const proximoNum = senhaRepository.getProximoNumeroSequencial(catObj.id_categoria);
    const codigoSenha = `${catObj.codigo_prefixo}-${String(proximoNum).padStart(3, '0')}`;

    const novaSenha = senhaRepository.create({
      id_categoria: catObj.id_categoria,
      numero_sequencial: proximoNum,
      codigo_senha: codigoSenha
    });

    const posicaoFila = senhaRepository.getPosicaoFila(novaSenha.id_senha, catObj.id_categoria);
    const queueStats = senhaRepository.getQueueStats();

    // Notifica todas as telas conectadas via SSE sobre a atualização da fila
    sseService.broadcast('QUEUE_UPDATE', {
      tipo: 'QUEUE_UPDATE',
      ...queueStats
    });

    const horaEmissao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return {
      sucesso: true,
      senhaEmitida: codigoSenha,
      categoria: catObj.nome_categoria,
      posicaoFila,
      horaEmissao,
      mensagem: 'Aguarde o chamado no painel principal.'
    };
  }

  chamarProximaSenha({ guicheId, atendenteId = 'ATD-100' }) {
    const guiche = guicheRepository.findByNumero(guicheId) || guicheRepository.findById(guicheId);
    if (!guiche) {
      throw new Error(`Guichê ${guicheId} não foi encontrado no sistema.`);
    }

    // Busca a próxima senha pendente com prioridade legal (Preferencial > Convencional > Exames)
    const proximaSenha = senhaRepository.findNextPendingTicket();
    if (!proximaSenha) {
      return {
        sucesso: false,
        mensagem: 'Não há senhas aguardando no momento.'
      };
    }

    // Atualiza o status da senha para EM_ATENDIMENTO
    senhaRepository.updateStatus(proximaSenha.id_senha, 'EM_ATENDIMENTO');

    // Registra a sessão de atendimento
    const atendimento = atendimentoRepository.create({
      id_senha: proximaSenha.id_senha,
      id_guiche: guiche.id_guiche
    });

    // Atualiza o operador e status do guichê
    const nomeAtendente = atendenteId.startsWith('ATD-') ? `Atendente ${atendenteId}` : atendenteId;
    guicheRepository.updateOperador(guiche.id_guiche, nomeAtendente, 'EM_ATENDIMENTO');

    const queueStats = senhaRepository.getQueueStats();
    const ultimasChamadas = senhaRepository.getUltimasChamadas(5);
    const atendimentosHoje = atendimentoRepository.countAtendimentosHojePorGuiche(guiche.id_guiche);

    const payloadSSE = {
      tipo: 'SENHA_CHAMADA',
      senha: proximaSenha.codigo_senha,
      guiche: guiche.numero_guiche,
      nomeAtendente,
      timestamp: new Date().toISOString(),
      pessoasAguardando: queueStats.totalAguardando,
      historico: ultimasChamadas
    };

    // Broadcast do evento SSE de chamada de senha (alias: CALL_TICKET e SENHA_CHAMADA)
    sseService.broadcast('SENHA_CHAMADA', payloadSSE);
    sseService.broadcast('CALL_TICKET', payloadSSE);

    // Broadcast de atualização da contagem de fila
    sseService.broadcast('QUEUE_UPDATE', {
      tipo: 'QUEUE_UPDATE',
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
    const guiche = guicheRepository.findByNumero(guicheId) || guicheRepository.findById(guicheId);
    if (!guiche) {
      throw new Error(`Guichê ${guicheId} não foi encontrado no sistema.`);
    }

    const ultimoAtendimento = atendimentoRepository.findUltimoAtendimentoPorGuiche(guiche.id_guiche);
    if (!ultimoAtendimento) {
      return { sucesso: false, mensagem: 'Nenhum atendimento anterior encontrado para este guichê.' };
    }

    const queueStats = senhaRepository.getQueueStats();
    const ultimasChamadas = senhaRepository.getUltimasChamadas(5);

    const payloadSSE = {
      tipo: 'SENHA_CHAMADA',
      senha: ultimoAtendimento.codigo_senha,
      guiche: guiche.numero_guiche,
      nomeAtendente: guiche.nome_atendente || `Guichê ${guiche.numero_guiche}`,
      timestamp: new Date().toISOString(),
      pessoasAguardando: queueStats.totalAguardando,
      historico: ultimasChamadas,
      isRechamada: true
    };

    sseService.broadcast('SENHA_CHAMADA', payloadSSE);
    sseService.broadcast('CALL_TICKET', payloadSSE);

    return {
      sucesso: true,
      senhaChamada: ultimoAtendimento.codigo_senha,
      mensagem: `Rechamada de senha ${ultimoAtendimento.codigo_senha} enviada para a TV.`
    };
  }

  marcarAusente({ guicheId }) {
    const guiche = guicheRepository.findByNumero(guicheId) || guicheRepository.findById(guicheId);
    if (!guiche) throw new Error(`Guichê ${guicheId} não foi encontrado.`);

    const ultimoAtendimento = atendimentoRepository.findUltimoAtendimentoPorGuiche(guiche.id_guiche);
    if (!ultimoAtendimento) {
      return { sucesso: false, mensagem: 'Nenhum atendimento em andamento para marcar ausente.' };
    }

    senhaRepository.updateStatus(ultimoAtendimento.id_senha, 'CANCELADO_AUSENCIA');
    guicheRepository.updateStatus(guiche.id_guiche, 'DISPONIVEL');

    const queueStats = senhaRepository.getQueueStats();
    sseService.broadcast('QUEUE_UPDATE', { tipo: 'QUEUE_UPDATE', ...queueStats });

    return {
      sucesso: true,
      mensagem: `Senha ${ultimoAtendimento.codigo_senha} marcada como CANCELADO_AUSENCIA.`
    };
  }

  finalizarAtendimento({ guicheId }) {
    const guiche = guicheRepository.findByNumero(guicheId) || guicheRepository.findById(guicheId);
    if (!guiche) throw new Error(`Guichê ${guicheId} não foi encontrado.`);

    const ultimoAtendimento = atendimentoRepository.findUltimoAtendimentoPorGuiche(guiche.id_guiche);
    if (!ultimoAtendimento) {
      return { sucesso: false, mensagem: 'Nenhum atendimento para finalizar.' };
    }

    atendimentoRepository.finalizarAtendimento(ultimoAtendimento.id_atendimento);
    senhaRepository.updateStatus(ultimoAtendimento.id_senha, 'FINALIZADA');
    guicheRepository.updateStatus(guiche.id_guiche, 'DISPONIVEL');

    return {
      sucesso: true,
      mensagem: `Atendimento da senha ${ultimoAtendimento.codigo_senha} finalizado com sucesso.`
    };
  }
}

module.exports = new FilaService();
