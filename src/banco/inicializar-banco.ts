import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { executar, listar, obter } from './conexao';
import { agoraIso } from '../util/serializacao';

interface DadosIniciaisProjeto {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  principal: number;
  status: 'ATIVO' | 'INATIVO';
}

interface DadosIniciaisRaia {
  id: string;
  projetoId: string;
  nome: string;
  ordem: number;
}

interface DadosIniciaisAtividade {
  id: string;
  projetoId: string;
  raiaId: string;
  titulo: string;
  descricao: string;
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  status: 'BACKLOG' | 'EM_ANDAMENTO' | 'BLOQUEADA' | 'CONCLUIDA';
  responsavel: string;
  prazo: string;
  etiquetas: unknown[];
  checklist: unknown[];
  comentarios: unknown[];
  ordem: number;
}

const RAIAS_PADRAO_PROJETO = ['Backlog', 'Em andamento', 'Teste', 'Aguardando publicacao', 'Concluidas'] as const;
const TABELAS = {
  usuarios: 'TB_Usuarios',
  usuariosAuth: 'TB_Usuarios_Auth',
  projetos: 'TB_Projetos',
  raias: 'TB_Raias',
  atividades: 'TB_Atividades',
  sessoesAuth: 'TB_Sessoes_Auth',
  desafios2fa: 'TB_Desafios_2FA',
} as const;
const IDS_SEED = {
  usuarios: {
    denner: '1d8b4f39-4c73-4f64-a1db-9b1f54d7c101',
    bruno: '4f94e1d7-2dfb-4c91-8f2f-7d57d4e27202',
    carla: 'a6b84303-3cb9-4fc4-8a4b-6b7a3bfdb303',
    diego: '7b4d0ef4-2d3d-4d03-97af-9043ff5af404',
  },
  projetos: {
    portalCorporativo: 'c0831f83-9d07-4f1e-8c18-2a7cce9a5101',
    appComercial: 'f8b1f2fd-90fe-4c8a-a59b-a3d86af85202',
    migracaoCrm: '3ac98317-a548-48fd-8d89-c0b28ca40303',
  },
  raias: {
    backlog: 'e46a2445-fd1d-4300-84d7-cdf7d5ad6101',
    andamento: 'fb94f0a8-c65d-4f3b-9a32-2ac3940f6202',
    teste: '7d34211c-3d54-40c9-bc73-c3bb26df6303',
    aguardandoPublicacao: 'aa9c56f5-8ac0-45ea-bd7e-c72e39076404',
    concluida: 'b1f45072-a8fc-460f-a253-4d9507c76505',
  },
  atividades: {
    backlogInicial: 'c6c568d7-1704-412c-b8d9-632e31d9a701',
  },
  checklist: {
    refinarEscopo: 'f58ced0c-4eb8-4a88-a4de-a4d0bebc8101',
    validarProduto: '6594ec11-48bc-4538-84e4-928f1e2f8202',
  },
} as const;

export async function criarTabelas(): Promise<void> {
  await executar('PRAGMA foreign_keys = ON');

  await executar(`
    CREATE TABLE IF NOT EXISTS ${TABELAS.usuarios} (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      iniciais TEXT NOT NULL,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    )
  `);

  await executar(`
    CREATE TABLE IF NOT EXISTS ${TABELAS.usuariosAuth} (
      usuario_id TEXT PRIMARY KEY,
      senha_hash TEXT NOT NULL,
      tentativas_falha INTEGER NOT NULL DEFAULT 0,
      bloqueado_ate TEXT,
      ultimo_login_em TEXT,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES ${TABELAS.usuarios}(id) ON DELETE CASCADE
    )
  `);

  await executar(`
    CREATE TABLE IF NOT EXISTS ${TABELAS.projetos} (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL,
      cor TEXT,
      principal INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    )
  `);

  await executar(`
    CREATE TABLE IF NOT EXISTS ${TABELAS.raias} (
      id TEXT PRIMARY KEY,
      projeto_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      ordem INTEGER NOT NULL,
      cor TEXT,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      FOREIGN KEY (projeto_id) REFERENCES ${TABELAS.projetos}(id) ON DELETE CASCADE
    )
  `);

  await executar(`
    CREATE TABLE IF NOT EXISTS ${TABELAS.atividades} (
      id TEXT PRIMARY KEY,
      projeto_id TEXT NOT NULL,
      raia_id TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      prioridade TEXT NOT NULL,
      status TEXT NOT NULL,
      responsavel TEXT NOT NULL,
      prazo TEXT NOT NULL,
      etiquetas_json TEXT NOT NULL,
      checklist_json TEXT NOT NULL,
      comentarios_json TEXT NOT NULL,
      ordem INTEGER NOT NULL,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      FOREIGN KEY (projeto_id) REFERENCES ${TABELAS.projetos}(id) ON DELETE CASCADE,
      FOREIGN KEY (raia_id) REFERENCES ${TABELAS.raias}(id) ON DELETE CASCADE
    )
  `);

  await executar(`
    CREATE TABLE IF NOT EXISTS ${TABELAS.sessoesAuth} (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expira_em TEXT NOT NULL,
      revogado_em TEXT,
      ip_origem TEXT,
      user_agent TEXT,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES ${TABELAS.usuarios}(id) ON DELETE CASCADE
    )
  `);

  await executar(`
    CREATE TABLE IF NOT EXISTS ${TABELAS.desafios2fa} (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      codigo_hash TEXT NOT NULL,
      tentativas_falha INTEGER NOT NULL DEFAULT 0,
      expira_em TEXT NOT NULL,
      consumido_em TEXT,
      ip_origem TEXT,
      user_agent TEXT,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES ${TABELAS.usuarios}(id) ON DELETE CASCADE
    )
  `);

  await executar(`CREATE INDEX IF NOT EXISTS IDX_TB_Raias_Projeto_Ordem ON ${TABELAS.raias}(projeto_id, ordem)`);
  await executar(`CREATE INDEX IF NOT EXISTS IDX_TB_Atividades_Projeto ON ${TABELAS.atividades}(projeto_id)`);
  await executar(`CREATE INDEX IF NOT EXISTS IDX_TB_Atividades_Raia_Ordem ON ${TABELAS.atividades}(raia_id, ordem)`);
  await executar(`CREATE INDEX IF NOT EXISTS IDX_TB_Sessoes_Auth_Usuario ON ${TABELAS.sessoesAuth}(usuario_id)`);
  await executar(`CREATE INDEX IF NOT EXISTS IDX_TB_Desafios_2FA_Usuario ON ${TABELAS.desafios2fa}(usuario_id)`);
  await executar(`CREATE INDEX IF NOT EXISTS IDX_TB_Desafios_2FA_Expira ON ${TABELAS.desafios2fa}(expira_em)`);
}

async function garantirUsuariosAuth(): Promise<void> {
  const agora = agoraIso();
  const senhaPadraoInicial = process.env.SENHA_PADRAO_INICIAL ?? 'Gestor@123';
  const hashSenhaPadrao = await bcrypt.hash(senhaPadraoInicial, 12);
  const usuarios = await listar<{ id: string }>(`SELECT id FROM ${TABELAS.usuarios}`);

  if (usuarios.length === 0) {
    return;
  }

  await executar(
    `INSERT OR IGNORE INTO ${TABELAS.usuariosAuth} (
      usuario_id, senha_hash, tentativas_falha, bloqueado_ate, ultimo_login_em, criado_em, atualizado_em
    )
    SELECT id, ?, 0, NULL, NULL, ?, ? FROM ${TABELAS.usuarios}`,
    [hashSenhaPadrao, agora, agora],
  );
}

export async function seedInicial(): Promise<void> {
  const projetoExistente = await obter<{ id: string }>(`SELECT id FROM ${TABELAS.projetos} LIMIT 1`);

  if (projetoExistente) {
    await garantirUsuariosAuth();
    return;
  }

  const agora = agoraIso();

  const usuarios = [
    { id: IDS_SEED.usuarios.denner, nome: 'Denner Lemos', email: 'dennerlemos.dev@gmail.com', iniciais: 'DL' },
    { id: IDS_SEED.usuarios.bruno, nome: 'Bruno Costa', email: 'bruno.costa@empresa.com', iniciais: 'BC' },
    { id: IDS_SEED.usuarios.carla, nome: 'Carla Souza', email: 'carla.souza@empresa.com', iniciais: 'CS' },
    { id: IDS_SEED.usuarios.diego, nome: 'Diego Lima', email: 'diego.lima@empresa.com', iniciais: 'DL' },
  ];

  for (const usuario of usuarios) {
    await executar(
      `INSERT INTO ${TABELAS.usuarios} (id, nome, email, iniciais, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [usuario.id, usuario.nome, usuario.email, usuario.iniciais, agora, agora],
    );
  }

  await garantirUsuariosAuth();

  const projetos: DadosIniciaisProjeto[] = [
    {
      id: IDS_SEED.projetos.portalCorporativo,
      nome: 'Portal Corporativo',
      descricao: 'Evolução do portal institucional com board visual por raias dinâmicas.',
      cor: '#2563eb',
      principal: 1,
      status: 'ATIVO',
    },
    {
      id: IDS_SEED.projetos.appComercial,
      nome: 'Aplicativo Comercial',
      descricao: 'Organização das iniciativas mobile para o ciclo Q2.',
      cor: '#0ea5e9',
      principal: 0,
      status: 'ATIVO',
    },
    {
      id: IDS_SEED.projetos.migracaoCrm,
      nome: 'Migração CRM',
      descricao: 'Planejamento técnico e acompanhamento da migração de dados de vendas.',
      cor: '#6366f1',
      principal: 0,
      status: 'ATIVO',
    },
  ];

  for (const projeto of projetos) {
    await executar(
      `INSERT INTO ${TABELAS.projetos} (id, nome, descricao, cor, principal, status, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [projeto.id, projeto.nome, projeto.descricao, projeto.cor, projeto.principal, projeto.status, agora, agora],
    );
  }

  const raias: DadosIniciaisRaia[] = RAIAS_PADRAO_PROJETO.map((nome, indice) => ({
    id:
      indice === 0
        ? IDS_SEED.raias.backlog
        : indice === 1
          ? IDS_SEED.raias.andamento
          : indice === 2
            ? IDS_SEED.raias.teste
            : indice === 3
              ? IDS_SEED.raias.aguardandoPublicacao
              : IDS_SEED.raias.concluida,
    projetoId: IDS_SEED.projetos.portalCorporativo,
    nome,
    ordem: indice + 1,
  }));

  for (const raia of raias) {
    await executar(
      `INSERT INTO ${TABELAS.raias} (id, projeto_id, nome, ordem, cor, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [raia.id, raia.projetoId, raia.nome, raia.ordem, null, agora, agora],
    );
  }

  const atividades: DadosIniciaisAtividade[] = [
    {
      id: IDS_SEED.atividades.backlogInicial,
      projetoId: IDS_SEED.projetos.portalCorporativo,
      raiaId: IDS_SEED.raias.backlog,
      titulo: 'Mapear backlog técnico inicial',
      descricao: 'Levantamento de histórias e alinhamento com arquitetura frontend.',
      prioridade: 'ALTA',
      status: 'BACKLOG',
      responsavel: 'Denner Lemos',
      prazo: '2026-04-04',
      etiquetas: [
        { nome: 'Arquitetura', cor: '#2563EB' },
        { nome: 'Planejamento', cor: '#7C3AED' },
      ],
      checklist: [
        { id: IDS_SEED.checklist.refinarEscopo, titulo: 'Refinar escopo', concluido: true },
        { id: IDS_SEED.checklist.validarProduto, titulo: 'Validar com produto', concluido: false },
      ],
      comentarios: [
        {
          id: randomUUID(),
          atividadeId: IDS_SEED.atividades.backlogInicial,
          usuarioId: IDS_SEED.usuarios.bruno,
          texto: 'Precisamos incluir riscos de integração com autenticação.',
          criadoEm: agora,
        },
      ],
      ordem: 1,
    },
  ];

  for (const atividade of atividades) {
    await executar(
      `INSERT INTO ${TABELAS.atividades} (
        id, projeto_id, raia_id, titulo, descricao, prioridade, status,
        responsavel, prazo, etiquetas_json, checklist_json, comentarios_json,
        ordem, criado_em, atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        atividade.id,
        atividade.projetoId,
        atividade.raiaId,
        atividade.titulo,
        atividade.descricao,
        atividade.prioridade,
        atividade.status,
        atividade.responsavel,
        atividade.prazo,
        JSON.stringify(atividade.etiquetas),
        JSON.stringify(atividade.checklist),
        JSON.stringify(atividade.comentarios),
        atividade.ordem,
        agora,
        agora,
      ],
    );
  }
}

export async function inicializarBanco(): Promise<void> {
  await criarTabelas();
  await seedInicial();
}
