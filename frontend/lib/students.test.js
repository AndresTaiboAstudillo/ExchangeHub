import { filterStudents, isLocal } from './students';

const students = [
  { id: '1', name: 'Carlos Pedraza', career: 'Ing. Civil', countryOfOrigin: 'Colombia', universityOrigin: 'U. Nacional', languages: ['es', 'en'] },
  { id: '2', name: 'Hana Leung', career: 'Diseño Industrial', countryOfOrigin: 'Japón', universityOrigin: null, languages: ['ja', 'es'] },
  { id: '3', name: 'Ana Muñoz', career: 'Derecho', countryOfOrigin: ' CHILE ', universityOrigin: 'PUCV', languages: ['es', 'fr'] },
  { id: '4', name: 'Sin Datos', career: null, countryOfOrigin: null, universityOrigin: null, languages: [] },
];
const ids = (list) => list.map((s) => s.id);

describe('filterStudents', () => {
  it('sin filtros devuelve a todos', () => {
    expect(ids(filterStudents(students))).toEqual(['1', '2', '3', '4']);
  });

  it('distingue locales (Chile, sin importar mayúsculas ni espacios) de intercambio', () => {
    expect(isLocal(students[2])).toBe(true);
    expect(ids(filterStudents(students, { kind: 'local' }))).toEqual(['3']);
    expect(ids(filterStudents(students, { kind: 'intercambio' }))).toEqual(['1', '2', '4']);
  });

  it('busca por nombre, carrera, país o universidad', () => {
    expect(ids(filterStudents(students, { query: 'hana' }))).toEqual(['2']);
    expect(ids(filterStudents(students, { query: 'derecho' }))).toEqual(['3']);
    expect(ids(filterStudents(students, { query: 'japón' }))).toEqual(['2']);
    expect(ids(filterStudents(students, { query: 'pucv' }))).toEqual(['3']);
    expect(ids(filterStudents(students, { query: 'zzz' }))).toEqual([]);
  });

  it('filtra por carrera e idioma y combina filtros', () => {
    expect(ids(filterStudents(students, { career: 'Ing' }))).toEqual(['1']);
    expect(ids(filterStudents(students, { language: 'fr' }))).toEqual(['3']);
    expect(ids(filterStudents(students, { language: 'es', kind: 'intercambio' }))).toEqual(['1', '2']);
  });
});
