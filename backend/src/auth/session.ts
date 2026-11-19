/**
 * Un token emitido antes del último cambio de contraseña ya no vale. `iat` está en segundos, por eso se
 * compara contra el segundo del cambio (un inicio de sesión posterior en ese mismo segundo sigue siendo válido).
 */
export function isSessionRevoked(
  issuedAtSeconds: number | undefined,
  passwordChangedAt: Date | null,
): boolean {
  if (!passwordChangedAt) return false;
  if (typeof issuedAtSeconds !== 'number') return true;
  return issuedAtSeconds < Math.floor(passwordChangedAt.getTime() / 1000);
}
