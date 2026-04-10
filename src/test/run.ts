import assert from 'node:assert/strict';

process.env.JWT_SEGREDO_ACESSO = 'teste-segredo-acesso';
process.env.JWT_SEGREDO_REFRESH = 'teste-segredo-refresh';
process.env.JWT_SEGREDO_DESAFIO = 'teste-segredo-desafio';
process.env.AUTH_2FA_ENABLED = 'false';

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

const tests: TestCase[] = [
  {
    name: 'AuthService incrementa tentativas quando senha é invalida',
    run: async () => {
      const { AuthService } = await import('../modules/auth/auth.service');
      const chamadas: Array<{ usuarioId: string; tentativas: number; bloqueadoAte: string | null }> = [];
      const usuario = {
        id: 'u1',
        nome: 'Teste',
        email: 'teste@empresa.com',
        iniciais: 'TE',
        senha_hash: '$2a$10$9X6CrfW2X6Q6YJ7cCkQ56uGf7wM0z6jwxKF1uHmIiMaTZGi99Z0eK',
        tentativas_falha: 2,
        bloqueado_ate: null,
      };

      const repository = {
        buscarUsuarioPorEmail: async () => usuario,
        incrementarTentativasFalha: async (usuarioId: string, tentativas: number, bloqueadoAte: string | null) => {
          chamadas.push({ usuarioId, tentativas, bloqueadoAte });
        },
        resetarTentativasFalha: async () => {},
        criarSessao: async () => {},
      };

      const service = new AuthService(
        repository as never,
        { enviarCodigoSegundoFator: async () => {} },
        async <T>(callback: () => Promise<T>) => callback(),
      );

      await assert.rejects(
        () =>
          service.login(
            { email: usuario.email, senha: 'senha-invalida' },
            { ipOrigem: '127.0.0.1', userAgent: 'node-test' },
          ),
        /Credenciais invalidas\./,
      );

      assert.equal(chamadas.length, 1);
      assert.equal(chamadas[0]?.usuarioId, 'u1');
      assert.equal(chamadas[0]?.tentativas, 3);
    },
  },
  {
    name: 'AuthService retorna tokens e usuario quando login é valido sem 2FA',
    run: async () => {
      const { AuthService } = await import('../modules/auth/auth.service');
      const { hashSync } = await import('bcryptjs');
      const usuario = {
        id: 'u2',
        nome: 'Teste',
        email: 'teste@empresa.com',
        iniciais: 'TE',
        senha_hash: hashSync('senha-forte', 10),
        tentativas_falha: 0,
        bloqueado_ate: null,
      };
      let resetou = false;
      let sessaoCriada = false;

      const repository = {
        buscarUsuarioPorEmail: async () => usuario,
        resetarTentativasFalha: async () => {
          resetou = true;
        },
        criarSessao: async () => {
          sessaoCriada = true;
        },
      };

      const service = new AuthService(
        repository as never,
        { enviarCodigoSegundoFator: async () => {} },
        async <T>(callback: () => Promise<T>) => callback(),
      );

      const resultado = await service.login(
        { email: usuario.email, senha: 'senha-forte' },
        { ipOrigem: '127.0.0.1', userAgent: 'node-test' },
      );

      assert.equal(resultado.requerSegundoFator, false);
      assert.ok('tokenAcesso' in resultado);
      assert.equal(resultado.usuario.email, usuario.email);
      assert.equal(resetou, true);
      assert.equal(sessaoCriada, true);
    },
  },
  {
    name: 'ProjetoService impede definir projeto inativo como principal',
    run: async () => {
      const { ProjetoService } = await import('../modules/projetos/projeto.service');
      const repository = {
        buscarProjetoPorId: async () => ({
          id: 'p1',
          nome: 'Projeto',
          descricao: 'Descricao',
          cor: null,
          principal: 0,
          status: 'INATIVO' as const,
          data_inicial: null,
          data_final: null,
          inativado_em: null,
          concluido_em: null,
          reativado_em: null,
          criado_em: '2025-01-01T00:00:00.000Z',
          atualizado_em: '2025-01-01T00:00:00.000Z',
        }),
      };

      const service = new ProjetoService(repository as never, async <T>(callback: () => Promise<T>) => callback());

      await assert.rejects(
        () => service.definirPrincipal('p1'),
        /Somente projetos ativos podem ser definidos como principal\./,
      );
    },
  },
  {
    name: 'ProjetoService impede transicao invalida de projeto concluido',
    run: async () => {
      const { ProjetoService } = await import('../modules/projetos/projeto.service');
      const repository = {
        buscarProjetoPorId: async () => ({
          id: 'p2',
          nome: 'Projeto',
          descricao: 'Descricao',
          cor: null,
          principal: 0,
          status: 'CONCLUIDO' as const,
          data_inicial: null,
          data_final: null,
          inativado_em: null,
          concluido_em: '2025-01-01T00:00:00.000Z',
          reativado_em: null,
          criado_em: '2025-01-01T00:00:00.000Z',
          atualizado_em: '2025-01-01T00:00:00.000Z',
        }),
      };

      const service = new ProjetoService(repository as never, async <T>(callback: () => Promise<T>) => callback());

      await assert.rejects(
        () => service.atualizarStatus('p2', { status: 'ATIVO' }),
        /Projetos concluídos não podem ser reativados ou inativados novamente\./,
      );
    },
  },
  {
    name: 'AtividadeService exige HU pai para BUGFIX',
    run: async () => {
      const { AtividadeService } = await import('../modules/atividades/atividade.service');

      const atividadeRepository = {};
      const raiaService = {
        buscarRaiaBacklogProjeto: async () => ({
          id: 'r1',
          projeto_id: 'p1',
          nome: 'Backlog',
          ordem: 1,
          cor: null,
          criado_em: '',
          atualizado_em: '',
        }),
      };
      const projetoRepository = {
        buscarProjetoPorId: async () => ({ id: 'p1' }),
      };

      const service = new AtividadeService(atividadeRepository as never, raiaService as never, projetoRepository as never);

      await assert.rejects(
        () =>
          service.criar('p1', {
            tipo: 'BUGFIX',
            titulo: 'Bug',
            descricao: 'Descricao',
            prioridade: 'ALTA',
            responsavel: 'Equipe',
            prazo: '2026-01-10',
          }),
        /BUGFIX e HOTFIX devem estar vinculados a uma HU\./,
      );
    },
  },
  {
    name: 'AtividadeService impede exclusao de atividade concluida',
    run: async () => {
      const { AtividadeService } = await import('../modules/atividades/atividade.service');

      const atividadeRepository = {
        buscarAtividadeComNomeRaia: async () => ({
          id: 'a1',
          projeto_id: 'p1',
          raia_id: 'r1',
          codigo_referencia: 'HU00001',
          tipo: 'HU' as const,
          atividade_pai_id: null,
          titulo: 'Tarefa',
          descricao: 'Descricao',
          descricao_detalhada: null,
          prioridade: 'ALTA' as const,
          status: 'CONCLUIDA' as const,
          responsavel: 'Equipe',
          prazo: '2026-01-10',
          data_conclusao: '2026-01-10T10:00:00.000Z',
          etiquetas_json: '[]',
          checklist_json: '[]',
          comentarios_json: '[]',
          ordem: 1,
          criado_em: '',
          atualizado_em: '',
          nome_raia: 'Concluídas',
        }),
      };

      const service = new AtividadeService(atividadeRepository as never, {} as never, {} as never);

      await assert.rejects(
        () => service.excluir('a1'),
        /Atividades concluídas não podem ser excluídas\./,
      );
    },
  },
];

async function main() {
  let falhas = 0;

  for (const caso of tests) {
    try {
      await caso.run();
      console.log(`PASS ${caso.name}`);
    } catch (erro) {
      falhas += 1;
      console.error(`FAIL ${caso.name}`);
      console.error(erro);
    }
  }

  if (falhas > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(`PASS ${tests.length} testes`);
}

void main();
