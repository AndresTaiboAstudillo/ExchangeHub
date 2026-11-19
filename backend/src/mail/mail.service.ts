import { Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** Oculta el correo en los registros: a***@dominio.cl */
export const maskEmail = (email: string) =>
  email.replace(/^(.)[^@]*(@.*)$/, '$1***$2');

/**
 * Envío de correos por SMTP. Se configura con SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE y
 * SMTP_FROM. Sin SMTP_HOST no se envía nada: se deja un aviso en el registro (y, fuera de producción,
 * el contenido, para poder usar el enlace sin servidor de correo).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transport: Transporter | null | undefined;

  private getTransport(): Transporter | null {
    if (this.transport !== undefined) return this.transport;
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.transport = null;
      return null;
    }
    const user = process.env.SMTP_USER;
    this.transport = createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: user ? { user, pass: process.env.SMTP_PASS ?? '' } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    return this.transport;
  }

  async send(message: MailMessage): Promise<void> {
    const transport = this.getTransport();
    if (!transport) {
      this.logger.warn(
        `Correo no configurado (SMTP_HOST): no se envió "${message.subject}" a ${maskEmail(message.to)}`,
      );
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(`Contenido del correo:\n${message.text}`);
      }
      return;
    }
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? 'ExchangeHub <no-reply@exchangehub.local>',
      ...message,
    });
  }

  sendPasswordReset(
    user: { name: string; email: string },
    link: string,
    ttlMinutes: number,
  ): Promise<void> {
    const name = escapeHtml(user.name);
    return this.send({
      to: user.email,
      subject: 'Restablece tu contraseña de ExchangeHub',
      text: [
        `Hola ${user.name},`,
        '',
        'Recibimos una solicitud para restablecer la contraseña de tu cuenta de ExchangeHub.',
        `Abre este enlace (vale ${ttlMinutes} minutos y solo se puede usar una vez):`,
        link,
        '',
        'Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.',
      ].join('\n'),
      html: `<p>Hola ${name},</p>
<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de ExchangeHub.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#1B4332;color:#fff;border-radius:8px;text-decoration:none">Elegir una contraseña nueva</a></p>
<p>El enlace vale ${ttlMinutes} minutos y solo se puede usar una vez. Si el botón no funciona, copia esta dirección en el navegador:<br>${escapeHtml(link)}</p>
<p>Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.</p>`,
    });
  }

  sendPasswordChanged(user: { name: string; email: string }): Promise<void> {
    const name = escapeHtml(user.name);
    return this.send({
      to: user.email,
      subject: 'Tu contraseña de ExchangeHub cambió',
      text: [
        `Hola ${user.name},`,
        '',
        'La contraseña de tu cuenta de ExchangeHub acaba de cambiar y se cerraron tus otras sesiones.',
        'Si no fuiste tú, pide un nuevo enlace de recuperación de inmediato y avisa al equipo.',
      ].join('\n'),
      html: `<p>Hola ${name},</p>
<p>La contraseña de tu cuenta de ExchangeHub acaba de cambiar y se cerraron tus otras sesiones.</p>
<p>Si no fuiste tú, pide un nuevo enlace de recuperación de inmediato y avisa al equipo.</p>`,
    });
  }
}
