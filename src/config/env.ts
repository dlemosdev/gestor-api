function lerTextoObrigatorio(nome: string): string {
  const valor = process.env[nome]?.trim();

  if (!valor) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${nome}`);
  }

  return valor;
}

function lerTextoOpcional(nome: string, fallback: string): string {
  const valor = process.env[nome]?.trim();
  return valor || fallback;
}

function lerNumeroOpcional(nome: string, fallback: number): number {
  const valor = process.env[nome]?.trim();

  if (!valor) {
    return fallback;
  }

  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    throw new Error(`Variavel de ambiente invalida: ${nome}`);
  }

  return numero;
}

function lerBooleanoOpcional(nome: string, fallback: boolean): boolean {
  const valor = process.env[nome]?.trim().toLowerCase();

  if (!valor) {
    return fallback;
  }

  return ['1', 'true', 'sim', 'yes', 'on'].includes(valor);
}

export const appConfig = {
  ambiente: lerTextoOpcional('NODE_ENV', 'development'),
  portaApi: lerNumeroOpcional('PORTA_API', 3333),
  origemFrontend: lerTextoOpcional('ORIGEM_FRONTEND', 'http://localhost:4200'),
  logNivel: lerTextoOpcional('LOG_NIVEL', process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  auth2faEnabled: lerBooleanoOpcional('AUTH_2FA_ENABLED', false),
  senhaPadraoInicial: lerTextoOpcional('SENHA_PADRAO_INICIAL', 'Gestor@123'),
  jwt: {
    segredoAcesso: lerTextoObrigatorio('JWT_SEGREDO_ACESSO'),
    segredoRefresh: lerTextoObrigatorio('JWT_SEGREDO_REFRESH'),
    segredoDesafio: lerTextoObrigatorio('JWT_SEGREDO_DESAFIO'),
    duracaoAcesso: lerTextoOpcional('JWT_DURACAO_ACESSO', '15m'),
    duracaoRefresh: lerTextoOpcional('JWT_DURACAO_REFRESH', '7d'),
    duracaoDesafio: lerTextoOpcional('JWT_DURACAO_DESAFIO', '10m'),
  },
  smtp: {
    host: process.env.SMTP_HOST?.trim() || null,
    porta: lerNumeroOpcional('SMTP_PORT', 587),
    seguro: lerBooleanoOpcional('SMTP_SEGURO', false),
    usuario: process.env.SMTP_USUARIO?.trim() || null,
    senha: process.env.SMTP_SENHA?.trim() || null,
    remetente: process.env.SMTP_REMETENTE?.trim() || null,
  },
} as const;

