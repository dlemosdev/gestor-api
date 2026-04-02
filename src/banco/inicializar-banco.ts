import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { executar, listar, obter } from './conexao';
import { agoraIso } from '../util/serializacao';

interface DadosIniciaisProjeto {
  id: string;
  nome: string;
  descricao: string;
  principal: number;
  status: 'ATIVO' | 'INATIVO' | 'CONCLUIDO';
  dataInicial: string | null;
  dataFinal: string | null;
  inativadoEm: string | null;
  concluidoEm: string | null;
  reativadoEm: string | null;
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
  codigoReferencia: string;
  tipo: 'HU' | 'BUGFIX' | 'HOTFIX';
  atividadePaiId: string | null;
  titulo: string;
  descricao: string;
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  status: 'BACKLOG' | 'EM_ANDAMENTO' | 'BLOQUEADA' | 'CONCLUIDA';
  responsavel: string;
  prazo: string;
  dataConclusao: string | null;
  etiquetas: unknown[];
  checklist: unknown[];
  comentarios: unknown[];
  ordem: number;
}

const RAIAS_PADRAO_PROJETO = ['Backlog', 'Em andamento', 'Teste', 'Aguardando publicação', 'Concluídas'] as const;
const RAIAS_PADRAO_LEGADO_PARA_PT_BR = {
  'Aguardando publicacao': 'Aguardando publicação',
  Concluidas: 'Concluídas',
} as const;
const TABELAS = {
  usuarios: 'TB_Usuarios',
  usuariosAuth: 'TB_Usuarios_Auth',
  projetos: 'TB_Projetos',
  historicoProjetos: 'TB_Projetos_Historico',
  raias: 'TB_Raias',
  atividades: 'TB_Atividades',
  historicoAtividades: 'TB_Atividades_Historico',
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
      data_inicial TEXT,
      data_final TEXT,
      inativado_em TEXT,
      concluido_em TEXT,
      reativado_em TEXT,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    )
  `);

  await executar(`
    CREATE TABLE IF NOT EXISTS ${TABELAS.historicoProjetos} (
      id TEXT PRIMARY KEY,
      projeto_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      criado_em TEXT NOT NULL,
      FOREIGN KEY (projeto_id) REFERENCES ${TABELAS.projetos}(id) ON DELETE CASCADE
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
      codigo_referencia TEXT NOT NULL,
      tipo TEXT NOT NULL,
      atividade_pai_id TEXT,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      prioridade TEXT NOT NULL,
      status TEXT NOT NULL,
      responsavel TEXT NOT NULL,
      prazo TEXT NOT NULL,
      data_conclusao TEXT,
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
    CREATE TABLE IF NOT EXISTS ${TABELAS.historicoAtividades} (
      id TEXT PRIMARY KEY,
      atividade_id TEXT NOT NULL,
      projeto_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      origem TEXT,
      destino TEXT,
      criado_em TEXT NOT NULL,
      FOREIGN KEY (atividade_id) REFERENCES ${TABELAS.atividades}(id) ON DELETE CASCADE,
      FOREIGN KEY (projeto_id) REFERENCES ${TABELAS.projetos}(id) ON DELETE CASCADE
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
  await executar(`CREATE INDEX IF NOT EXISTS IDX_TB_Projetos_Historico_Projeto ON ${TABELAS.historicoProjetos}(projeto_id, criado_em DESC)`);
  await executar(`CREATE INDEX IF NOT EXISTS IDX_TB_Atividades_Projeto ON ${TABELAS.atividades}(projeto_id)`);
  await executar(`CREATE INDEX IF NOT EXISTS IDX_TB_Atividades_Raia_Ordem ON ${TABELAS.atividades}(raia_id, ordem)`);
  await executar(
    `CREATE INDEX IF NOT EXISTS IDX_TB_Atividades_Historico_Atividade ON ${TABELAS.historicoAtividades}(atividade_id, criado_em DESC)`,
  );
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

async function normalizarNomesPadraoRaias(): Promise<void> {
  for (const [nomeLegado, nomePtBr] of Object.entries(RAIAS_PADRAO_LEGADO_PARA_PT_BR)) {
    await executar(`UPDATE ${TABELAS.raias} SET nome = ?, atualizado_em = ? WHERE nome = ?`, [nomePtBr, agoraIso(), nomeLegado]);
  }
}

async function listarColunasAtividades(): Promise<string[]> {
  const colunas = await listar<{ name: string }>(`PRAGMA table_info(${TABELAS.atividades})`);
  return colunas.map((coluna) => coluna.name);
}

async function listarColunasProjetos(): Promise<string[]> {
  const colunas = await listar<{ name: string }>(`PRAGMA table_info(${TABELAS.projetos})`);
  return colunas.map((coluna) => coluna.name);
}

function formatarCodigoReferencia(prefixo: 'HU' | 'BG' | 'HF', sequencia: number): string {
  return `${prefixo}${String(sequencia).padStart(5, '0')}`;
}

async function garantirColunasAtividades(): Promise<void> {
  const colunas = await listarColunasAtividades();

  if (!colunas.includes('codigo_referencia')) {
    await executar(`ALTER TABLE ${TABELAS.atividades} ADD COLUMN codigo_referencia TEXT`);
  }

  if (!colunas.includes('tipo')) {
    await executar(`ALTER TABLE ${TABELAS.atividades} ADD COLUMN tipo TEXT NOT NULL DEFAULT 'HU'`);
  }

  if (!colunas.includes('atividade_pai_id')) {
    await executar(`ALTER TABLE ${TABELAS.atividades} ADD COLUMN atividade_pai_id TEXT`);
  }

  if (!colunas.includes('data_conclusao')) {
    await executar(`ALTER TABLE ${TABELAS.atividades} ADD COLUMN data_conclusao TEXT`);
  }

  await executar(`CREATE UNIQUE INDEX IF NOT EXISTS IDX_TB_Atividades_Codigo_Referencia ON ${TABELAS.atividades}(codigo_referencia)`);

  const atividadesExistentes = await listar<{ codigo_referencia: string }>(
    `SELECT codigo_referencia FROM ${TABELAS.atividades} WHERE codigo_referencia IS NOT NULL AND TRIM(codigo_referencia) <> ''`,
  );

  let sequenciaHu = 0;
  let sequenciaBugfix = 0;
  let sequenciaHotfix = 0;

  atividadesExistentes.forEach((atividade) => {
    const codigo = atividade.codigo_referencia.trim().toUpperCase();

    if (/^HU\d{5}$/.test(codigo)) {
      sequenciaHu = Math.max(sequenciaHu, Number(codigo.slice(2)));
    } else if (/^BG\d{5}$/.test(codigo)) {
      sequenciaBugfix = Math.max(sequenciaBugfix, Number(codigo.slice(2)));
    } else if (/^HF\d{5}$/.test(codigo)) {
      sequenciaHotfix = Math.max(sequenciaHotfix, Number(codigo.slice(2)));
    }
  });

  const atividadesSemCodigo = await listar<{ id: string; tipo: 'HU' | 'BUGFIX' | 'HOTFIX' }>(
    `SELECT id, COALESCE(tipo, 'HU') AS tipo
     FROM ${TABELAS.atividades}
     WHERE codigo_referencia IS NULL OR TRIM(codigo_referencia) = ''
     ORDER BY criado_em, id`,
  );

  for (const atividade of atividadesSemCodigo) {
    let codigoReferencia = '';

    if (atividade.tipo === 'BUGFIX') {
      sequenciaBugfix += 1;
      codigoReferencia = formatarCodigoReferencia('BG', sequenciaBugfix);
    } else if (atividade.tipo === 'HOTFIX') {
      sequenciaHotfix += 1;
      codigoReferencia = formatarCodigoReferencia('HF', sequenciaHotfix);
    } else {
      sequenciaHu += 1;
      codigoReferencia = formatarCodigoReferencia('HU', sequenciaHu);
    }

    await executar(`UPDATE ${TABELAS.atividades} SET codigo_referencia = ? WHERE id = ?`, [codigoReferencia, atividade.id]);
  }

  await executar(
    `UPDATE ${TABELAS.atividades}
     SET data_conclusao = COALESCE(data_conclusao, atualizado_em)
     WHERE id IN (
       SELECT a.id
       FROM ${TABELAS.atividades} a
       JOIN ${TABELAS.raias} r ON r.id = a.raia_id
       WHERE r.nome IN ('Concluidas', 'Concluídas')
     )`,
  );
}

async function garantirColunasProjetos(): Promise<void> {
  const colunas = await listarColunasProjetos();

  if (!colunas.includes('data_inicial')) {
    await executar(`ALTER TABLE ${TABELAS.projetos} ADD COLUMN data_inicial TEXT`);
  }

  if (!colunas.includes('data_final')) {
    await executar(`ALTER TABLE ${TABELAS.projetos} ADD COLUMN data_final TEXT`);
  }

  if (!colunas.includes('inativado_em')) {
    await executar(`ALTER TABLE ${TABELAS.projetos} ADD COLUMN inativado_em TEXT`);
  }

  if (!colunas.includes('concluido_em')) {
    await executar(`ALTER TABLE ${TABELAS.projetos} ADD COLUMN concluido_em TEXT`);
  }

  if (!colunas.includes('reativado_em')) {
    await executar(`ALTER TABLE ${TABELAS.projetos} ADD COLUMN reativado_em TEXT`);
  }
}

async function garantirHistoricoProjetosInicial(): Promise<void> {
  const totalHistoricos = await obter<{ total: number }>(`SELECT COUNT(1) AS total FROM ${TABELAS.historicoProjetos}`);

  if ((totalHistoricos?.total ?? 0) > 0) {
    return;
  }

  const projetos = await listar<{ id: string; criado_em: string }>(`SELECT id, criado_em FROM ${TABELAS.projetos}`);

  for (const projeto of projetos) {
    await executar(
      `INSERT INTO ${TABELAS.historicoProjetos} (id, projeto_id, tipo, descricao, criado_em)
       VALUES (?, ?, 'CRIADO', 'Projeto criado.', ?)`,
      [randomUUID(), projeto.id, projeto.criado_em],
    );
  }
}

async function garantirHistoricoAtividadesInicial(): Promise<void> {
  const totalHistoricos = await obter<{ total: number }>(`SELECT COUNT(1) AS total FROM ${TABELAS.historicoAtividades}`);

  if ((totalHistoricos?.total ?? 0) > 0) {
    return;
  }

  const atividades = await listar<{ id: string; projeto_id: string; criado_em: string }>(
    `SELECT id, projeto_id, criado_em FROM ${TABELAS.atividades}`,
  );

  for (const atividade of atividades) {
    await executar(
      `INSERT INTO ${TABELAS.historicoAtividades} (id, atividade_id, projeto_id, tipo, descricao, origem, destino, criado_em)
       VALUES (?, ?, ?, 'CRIADA', 'Atividade criada.', NULL, NULL, ?)`,
      [randomUUID(), atividade.id, atividade.projeto_id, atividade.criado_em],
    );
  }
}

export async function seedInicial(): Promise<void> {
  const projetoExistente = await obter<{ id: string }>(`SELECT id FROM ${TABELAS.projetos} LIMIT 1`);

  if (projetoExistente) {
    await garantirUsuariosAuth();
    await garantirColunasProjetos();
    await garantirColunasAtividades();
    await normalizarNomesPadraoRaias();
    await garantirHistoricoProjetosInicial();
    await garantirHistoricoAtividadesInicial();
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

  await normalizarNomesPadraoRaias();
}

export async function inicializarBanco(): Promise<void> {
  await criarTabelas();
  await garantirColunasProjetos();
  await garantirColunasAtividades();
  await seedInicial();
}
