import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { avatarSrc } from '../lib/format';
import Avatar from './Avatar';

const person = { id: 'u1', name: 'Ana Pérez', avatarUpdatedAt: '2026-11-18T10:00:00.000Z' };

describe('Avatar', () => {
  it('sin foto muestra la inicial', () => {
    const { container } = render(<Avatar person={{ id: 'u1', name: 'ana', avatarUpdatedAt: null }} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('con foto muestra la imagen versionada', () => {
    const { container } = render(<Avatar person={person} />);
    const img = container.querySelector('img');
    expect(img.getAttribute('src')).toBe(avatarSrc(person));
    expect(img.getAttribute('src')).toMatch(/\/avatars\/u1\?v=\d+$/);
    expect(screen.queryByText('A')).toBeNull();
  });

  it('si la imagen no carga vuelve a la inicial', () => {
    const { container } = render(<Avatar person={person} />);
    fireEvent.error(container.querySelector('img'));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('una foto nueva se intenta de nuevo aunque la anterior fallara', () => {
    const { container, rerender } = render(<Avatar person={person} />);
    fireEvent.error(container.querySelector('img'));
    rerender(<Avatar person={{ ...person, avatarUpdatedAt: '2026-11-19T10:00:00.000Z' }} />);
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('una persona oculta (sin id) muestra la inicial sin enlace de foto', () => {
    expect(avatarSrc({ id: null, name: 'Estudiante', avatarUpdatedAt: null })).toBeNull();
    expect(avatarSrc(null)).toBeNull();
    render(<Avatar person={{ id: null, name: 'Estudiante', avatarUpdatedAt: null }} />);
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('acepta contenido extra, como el punto de presencia', () => {
    render(
      <Avatar person={person}>
        <span role="img" aria-label="En línea" />
      </Avatar>,
    );
    expect(screen.getByRole('img', { name: 'En línea' })).toBeInTheDocument();
  });
});
