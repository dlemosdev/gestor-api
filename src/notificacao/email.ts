import nodemailer from "nodemailer";

import { appConfig } from "../config/env";
import { ApiErro } from "../tipos/erros";
import { logger } from "../infra/logger";

let transporterCache: nodemailer.Transporter | null = null;

interface ConfiguracaoSmtp {
  host: string;
  porta: number;
  seguro: boolean;
  usuario: string;
  senha: string;
}

function obterConfiguracaoSmtp(): ConfiguracaoSmtp {
  const host = appConfig.smtp.host;
  const porta = appConfig.smtp.porta;
  const usuario = appConfig.smtp.usuario;
  const senha = appConfig.smtp.senha;

  if (!host || !porta || !usuario || !senha) {
    throw new ApiErro("Servico de e-mail nao configurado.", 500);
  }

  const seguro = appConfig.smtp.seguro;

  return {
    host,
    porta,
    seguro,
    usuario,
    senha,
  };
}

function obterTransporter(): nodemailer.Transporter {
  if (transporterCache) {
    return transporterCache;
  }

  const configuracao = obterConfiguracaoSmtp();

  transporterCache = nodemailer.createTransport({
    host: configuracao.host,
    port: configuracao.porta,
    secure: configuracao.seguro,
    auth: {
      user: configuracao.usuario,
      pass: configuracao.senha,
    },
  });

  return transporterCache;
}

export async function enviarCodigoSegundoFator(
  email: string,
  nome: string,
  codigo: string,
  validadeMinutos: number,
): Promise<void> {
  const remetente = appConfig.smtp.remetente;

  if (!remetente) {
    throw new ApiErro("Servico de e-mail nao configurado.", 500);
  }

  const transporter = obterTransporter();
  try {
    await transporter.sendMail({
      from: remetente,
      to: email,
      subject: "Codigo de verificacao - Gestor",
      text: `Ola, ${nome}. Seu codigo de verificacao e ${codigo}. Ele expira em ${validadeMinutos} minutos.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a;">
          <h2 style="margin:0 0 12px 0;">Verificacao de seguranca - Gestor</h2>
          <p style="margin:0 0 12px 0;">Ola, <strong>${nome}</strong>.</p>
          <p style="margin:0 0 10px 0;">Use o codigo abaixo para concluir seu acesso:</p>
          <div style="display:inline-block; font-size:28px; letter-spacing:6px; font-weight:700; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:10px; padding:12px 16px;">
            ${codigo}
          </div>
          <p style="margin:14px 0 0 0;">Este codigo expira em <strong>${validadeMinutos} minutos</strong>.</p>
        </div>
      `,
    });
  } catch (erro) {
    logger.error({
      msg: "falha ao enviar email de segundo fator",
      destinatario: email,
      detalhe: erro instanceof Error ? erro.message : "erro desconhecido",
      stack: erro instanceof Error ? erro.stack : undefined,
    });

    throw new ApiErro("Falha no servico de e-mail. Verifique a configuracao SMTP.", 502);
  }
}
