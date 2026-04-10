import { transacao } from '../../banco/conexao';
import { Projeto } from '../../tipos/dominio';
import { ApiErro } from '../../tipos/erros';
import { ProjetoRepository } from './projeto.repository';
import {
  AtualizarProjetoInput,
  AtualizarStatusProjetoInput,
  CriarProjetoInput,
  HistoricoProjetoBanco,
  ProjetoBanco,
} from './projeto.types';

function mapearProjeto(linha: ProjetoBanco): Projeto {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    principal: Boolean(linha.principal),
    status: linha.status,
    dataInicial: linha.data_inicial,
    dataFinal: linha.data_final,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    inativadoEm: linha.inativado_em,
    concluidoEm: linha.concluido_em,
    reativadoEm: linha.reativado_em,
  };
}

function mapearHistoricoProjeto(linha: HistoricoProjetoBanco) {
  return {
    id: linha.id,
    projetoId: linha.projeto_id,
    tipo: linha.tipo,
    descricao: linha.descricao,
    criadoEm: linha.criado_em,
  };
}

function validarTransicaoStatusProjeto(statusAtual: Projeto['status'], novoStatus: Projeto['status']): void {
  if (statusAtual === novoStatus) {
    return;
  }

  if (statusAtual === 'CONCLUIDO') {
    throw new ApiErro('Projetos concluídos não podem ser reativados ou inativados novamente.', 400);
  }

  if (statusAtual === 'ATIVO' && (novoStatus === 'INATIVO' || novoStatus === 'CONCLUIDO')) {
    return;
  }

  if (statusAtual === 'INATIVO' && novoStatus === 'ATIVO') {
    return;
  }

  throw new ApiErro('Transição de status do projeto inválida.', 400);
}

type TransactionRunner = <T>(callback: () => Promise<T>) => Promise<T>;

export class ProjetoService {
  constructor(
    private readonly projetoRepository: ProjetoRepository,
    private readonly runInTransaction: TransactionRunner = transacao,
  ) {}

  async listarProjetos() {
    const projetos = await this.projetoRepository.listarProjetos();
    return projetos.map(mapearProjeto);
  }

  async obterProjeto(projetoId: string) {
    return mapearProjeto(await this.buscarProjetoOuFalhar(projetoId));
  }

  async listarHistorico(projetoId: string) {
    await this.buscarProjetoOuFalhar(projetoId);
    const historico = await this.projetoRepository.listarHistorico(projetoId);
    return historico.map(mapearHistoricoProjeto);
  }

  async criarProjeto(dados: CriarProjetoInput) {
    const projetoId = await this.runInTransaction(() => this.projetoRepository.criarProjeto(dados));
    return this.obterProjeto(projetoId);
  }

  async atualizarProjeto(projetoId: string, dados: AtualizarProjetoInput) {
    const projetoAtual = await this.buscarProjetoOuFalhar(projetoId);
    await this.projetoRepository.atualizarProjeto(projetoId, projetoAtual, dados);
    return this.obterProjeto(projetoId);
  }

  async definirPrincipal(projetoId: string) {
    const projetoAtual = await this.buscarProjetoOuFalhar(projetoId);

    if (projetoAtual.status !== 'ATIVO') {
      throw new ApiErro('Somente projetos ativos podem ser definidos como principal.', 400);
    }

    await this.runInTransaction(() => this.projetoRepository.definirPrincipal(projetoId));
    return this.obterProjeto(projetoId);
  }

  async atualizarStatus(projetoId: string, dados: AtualizarStatusProjetoInput) {
    const projetoAtual = await this.buscarProjetoOuFalhar(projetoId);
    validarTransicaoStatusProjeto(projetoAtual.status, dados.status);

    if (dados.status === projetoAtual.status) {
      return mapearProjeto(projetoAtual);
    }

    await this.projetoRepository.atualizarStatus(projetoId, projetoAtual, dados.status);
    return this.obterProjeto(projetoId);
  }

  private async buscarProjetoOuFalhar(projetoId: string): Promise<ProjetoBanco> {
    const projeto = await this.projetoRepository.buscarProjetoPorId(projetoId);
    if (!projeto) {
      throw new ApiErro('Projeto nao encontrado.', 404);
    }
    return projeto;
  }
}
