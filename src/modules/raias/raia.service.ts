import { transacao } from '../../banco/conexao';
import { ApiErro } from '../../tipos/erros';
import { ProjetoRepository } from '../projetos/projeto.repository';
import { RaiaRepository } from './raia.repository';
import { mapearRaia, RaiaBanco, ReordenarRaiasInput } from './raia.types';

export class RaiaService {
  constructor(
    private readonly raiaRepository: RaiaRepository,
    private readonly projetoRepository: ProjetoRepository,
  ) {}

  async listarTodas() {
    const raias = await this.raiaRepository.listarTodas();
    return raias.map(mapearRaia);
  }

  async listarPorProjeto(projetoId: string) {
    await this.garantirProjetoExiste(projetoId);
    const raias = await this.raiaRepository.listarPorProjeto(projetoId);
    return raias.map(mapearRaia);
  }

  async reordenar(projetoId: string, dados: ReordenarRaiasInput) {
    await this.garantirProjetoExiste(projetoId);
    await transacao(() => this.raiaRepository.atualizarOrdem(projetoId, dados.raias));
    return this.listarPorProjeto(projetoId);
  }

  async buscarRaiaPorId(raiaId: string): Promise<RaiaBanco> {
    const raia = await this.raiaRepository.buscarPorId(raiaId);
    if (!raia) {
      throw new ApiErro('Raia nao encontrada.', 404);
    }
    return raia;
  }

  async buscarRaiaDoProjeto(raiaId: string, projetoId: string): Promise<RaiaBanco> {
    const raia = await this.raiaRepository.buscarPorIdEProjeto(raiaId, projetoId);
    if (!raia) {
      throw new ApiErro('Raia nao encontrada no projeto informado.', 404);
    }
    return raia;
  }

  async buscarRaiaBacklogProjeto(projetoId: string): Promise<RaiaBanco> {
    await this.garantirProjetoExiste(projetoId);
    const raia = await this.raiaRepository.buscarBacklogDoProjeto(projetoId);
    if (!raia) {
      throw new ApiErro('O projeto não possui uma raia Backlog configurada.', 400);
    }
    return raia;
  }

  private async garantirProjetoExiste(projetoId: string): Promise<void> {
    const projeto = await this.projetoRepository.buscarProjetoPorId(projetoId);
    if (!projeto) {
      throw new ApiErro('Projeto nao encontrado.', 404);
    }
  }
}

