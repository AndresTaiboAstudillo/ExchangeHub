// Filtros de la pestaña "Encontrar amigos".

export function isLocal(student) {
  return (student.countryOfOrigin ?? '').trim().toLowerCase() === 'chile';
}

/**
 * @param students  lista del directorio (GET /users)
 * @param filters   { query, kind: 'todos' | 'intercambio' | 'local', career, language }
 */
export function filterStudents(students, { query = '', kind = 'todos', career = '', language = '' } = {}) {
  const text = query.trim().toLowerCase();
  const careerText = career.trim().toLowerCase();

  return students.filter((s) => {
    if (kind === 'local' && !isLocal(s)) return false;
    if (kind === 'intercambio' && isLocal(s)) return false;
    if (careerText && !(s.career ?? '').toLowerCase().includes(careerText)) return false;
    if (language && !s.languages.includes(language)) return false;
    if (text) {
      const haystack = [s.name, s.career, s.countryOfOrigin, s.universityOrigin]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
}
