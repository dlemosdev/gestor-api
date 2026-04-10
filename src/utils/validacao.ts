import { ValidationError } from '../tipos/erros';

export function garantirObjeto(valor: unknown, contexto: string): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new ValidationError(`Payload invalido para ${contexto}.`);
  }

  return valor as Record<string, unknown>;
}

export function lerStringObrigatoria(
  objeto: Record<string, unknown>,
  campo: string,
  opcoes?: { trim?: boolean; minimo?: number },
): string {
  const valorBruto = objeto[campo];
  const valor = typeof valorBruto === 'string' ? valorBruto : String(valorBruto ?? '');
  const texto = opcoes?.trim === false ? valor : valor.trim();

  if (!texto) {
    throw new ValidationError('Falha de validacao.', [{ campo, mensagem: 'Campo obrigatorio.' }]);
  }

  if (opcoes?.minimo && texto.length < opcoes.minimo) {
    throw new ValidationError('Falha de validacao.', [{ campo, mensagem: `Campo deve ter no minimo ${opcoes.minimo} caracteres.` }]);
  }

  return texto;
}

