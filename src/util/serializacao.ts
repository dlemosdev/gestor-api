export function jsonSeguroParse<T>(valor: string | null | undefined, fallback: T): T {
  if (!valor) {
    return fallback;
  }

  try {
    return JSON.parse(valor) as T;
  } catch {
    return fallback;
  }
}

export function agoraIso(): string {
  return new Date().toISOString();
}
