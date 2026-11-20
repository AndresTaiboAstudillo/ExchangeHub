import { ConflictException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RealtimeService } from '../realtime/realtime.service.js';
import { AuthService } from './auth.service.js';

const dto = { name: 'Ana', email: 'ana@example.com', password: 'secreto123' };

function setup(create: ReturnType<typeof vi.fn>, sendWelcome = vi.fn()) {
  const prisma = { user: { create } } as unknown as PrismaService;
  const mail = { sendWelcome } as unknown as MailService;
  return {
    service: new AuthService(
      prisma,
      {} as JwtService,
      mail,
      {} as RealtimeService,
    ),
    sendWelcome,
  };
}

describe('AuthService.register', () => {
  it('envía el correo de bienvenida al usuario recién creado', async () => {
    const user = { id: '1', name: 'Ana', email: 'ana@example.com' };
    const { service, sendWelcome } = setup(
      vi.fn().mockResolvedValue(user),
      vi.fn().mockResolvedValue(undefined),
    );
    await expect(service.register(dto)).resolves.toEqual(user);
    expect(sendWelcome).toHaveBeenCalledWith(
      user,
      expect.stringMatching(/\/login$/),
    );
  });

  it('el registro funciona aunque el envío del correo falle', async () => {
    const user = { id: '1', name: 'Ana', email: 'ana@example.com' };
    const { service } = setup(
      vi.fn().mockResolvedValue(user),
      vi.fn().mockRejectedValue(new Error('smtp caído')),
    );
    await expect(service.register(dto)).resolves.toEqual(user);
  });

  it('el registro funciona aunque el servicio de correo lance de forma síncrona', async () => {
    const user = { id: '1', name: 'Ana', email: 'ana@example.com' };
    const { service } = setup(
      vi.fn().mockResolvedValue(user),
      vi.fn(() => {
        throw new TypeError('sendWelcome is not a function');
      }),
    );
    await expect(service.register(dto)).resolves.toEqual(user);
  });

  it('no envía correo si el email ya está registrado', async () => {
    const { service, sendWelcome } = setup(
      vi.fn().mockRejectedValue({ code: 'P2002' }),
    );
    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(sendWelcome).not.toHaveBeenCalled();
  });
});
