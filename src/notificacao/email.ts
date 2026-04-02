import nodemailer from 'nodemailer';

import { ApiErro } from '../tipos/erros';

let transporterCache: nodemailer.Transporter | null = null;

function booleanoAmbiente(valor: string | undefined, fallback: boolean): boolean {
  if (!valor) {
    return fallback;
  }

  return ['1', 'true', 'sim', 'yes'].includes(valor.toLowerCase());
}

function obterTransporter(): nodemailer.Transporter {
  if (transporterCache) {
    return transporterCache;
  }

  const host = process.env.SMTP_HOST;
  const porta = Number(process.env.SMTP_PORT ?? '587');
  const usuario = process.env.SMTP_USUARIO;
  const senha = process.env.SMTP_SENHA;

  if (!host || !porta || !usuario || !senha) {
    throw new ApiErro('Serviço de e-mail não configurado.', 500);
  }

  const seguro = booleanoAmbiente(process.env.SMTP_SEGURO, porta === 465);

  transporterCache = nodemailer.createTransport({
    host,
    port: porta,
    secure: seguro,
    auth: {
      user: usuario,
      pass: senha,
    },
  });

  return transporterCache;
}

export async function enviarCodigoSegundoFator(email: string, nome: string, codigo: string, validadeMinutos: number): Promise<void> {
  const remetente = process.env.SMTP_REMETENTE;

  if (!remetente) {
    throw new ApiErro('Serviço de e-mail não configurado.', 500);
  }

  const transporter = obterTransporter();

  await transporter.sendMail({
    from: remetente,
    to: email,
    subject: 'Código de verificação - Gestor',
    text: `Olá, ${nome}. Seu código de verificação é ${codigo}. Ele expira em ${validadeMinutos} minutos.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin:0 0 12px 0;">Verificação de segurança - Gestor</h2>
        <p style="margin:0 0 12px 0;">Olá, <strong>${nome}</strong>.</p>
        <p style="margin:0 0 10px 0;">Use o código abaixo para concluir seu acesso:</p>
        <div style="display:inline-block; font-size:28px; letter-spacing:6px; font-weight:700; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:10px; padding:12px 16px;">
          ${codigo}
        </div>
        <p style="margin:14px 0 0 0;">Este código expira em <strong>${validadeMinutos} minutos</strong>.</p>
      </div>
    `,
  });
}
