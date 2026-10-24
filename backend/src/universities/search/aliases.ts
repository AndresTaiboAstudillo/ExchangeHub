/**
 * Siglas y nombres de uso común de algunas universidades, curados a mano (no provienen de
 * ninguna de las fuentes). Se indexan con poco peso para que "usach" o "puc" encuentren la
 * institución aunque el nombre oficial no contenga la sigla. Clave: número de registro.
 */
export const ALIASES: Readonly<Record<string, string>> = {
  A1: 'uchile',
  A2: 'usach',
  A3: 'uv',
  A13: 'umce',
  A14: 'upla',
  A16: 'utem',
  A17: 'uoh',
  B1: 'puc uc',
  B2: 'udec',
  B3: 'usm utfsm',
  B4: 'pucv',
  B5: 'uach',
  C3: 'udp',
  C23: 'unab',
  C26: 'uai',
  C38: 'uandes',
  C49: 'udd',
};
