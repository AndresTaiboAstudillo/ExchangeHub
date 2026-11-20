import { describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service.js';

describe('MailService.sendWelcome', () => {
  it('arma el correo de bienvenida y escapa el nombre en el HTML', async () => {
    const service = new MailService();
    const send = vi.spyOn(service, 'send').mockResolvedValue(undefined);

    await service.sendWelcome(
      { name: '<script>x</script>', email: 'ana@example.com' },
      'http://localhost:3000/login',
    );

    expect(send).toHaveBeenCalledOnce();
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe('ana@example.com');
    expect(mail.subject).toBe('¡Bienvenido a ExchangeHub!');
    expect(mail.text).toContain('http://localhost:3000/login');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});
