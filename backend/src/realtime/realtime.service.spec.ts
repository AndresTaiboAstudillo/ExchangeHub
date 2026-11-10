import { describe, expect, it } from 'vitest';
import { RealtimeService } from './realtime.service.js';

describe('RealtimeService', () => {
  it('lleva la cuenta de conexiones por usuario (varias pestañas)', () => {
    const rt = new RealtimeService();
    expect(rt.isOnline('u')).toBe(false);
    expect(rt.connected('u')).toBe(true); // primera: pasa a en línea
    expect(rt.connected('u')).toBe(false);
    expect(rt.disconnected('u')).toBe(false); // queda una pestaña
    expect(rt.isOnline('u')).toBe(true);
    expect(rt.disconnected('u')).toBe(true); // última: se desconecta
    expect(rt.isOnline('u')).toBe(false);
  });

  it('no falla al emitir sin servidor asociado', () => {
    expect(() => new RealtimeService().emitToUser('u', 'x', {})).not.toThrow();
  });
});
