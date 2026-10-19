import { fireEvent, render, screen } from '@testing-library/react';
import FriendCard from './FriendCard';

const person = {
  id: 'u1',
  name: 'Carlos Pedraza',
  career: 'Ing. Civil',
  countryOfOrigin: 'Colombia',
  languages: ['es', 'en'],
  hobbies: ['Guitarra', 'Escalada'],
};

function setup(relation, props = {}) {
  const handlers = { onAdd: vi.fn(), onAccept: vi.fn(), onReject: vi.fn(), onRemove: vi.fn() };
  render(<FriendCard person={person} relation={relation} {...handlers} {...props} />);
  return handlers;
}

describe('FriendCard', () => {
  it('muestra los datos de la persona', () => {
    setup(null);
    expect(screen.getByText('Carlos Pedraza')).toBeInTheDocument();
    expect(screen.getByText('Ing. Civil · Colombia')).toBeInTheDocument();
    expect(screen.getByText('ES')).toBeInTheDocument();
    expect(screen.getByText('Guitarra')).toBeInTheDocument();
    expect(screen.queryByText('Local')).toBeNull();
  });

  it('marca como "Local" a quien viene de Chile', () => {
    render(<FriendCard person={{ ...person, countryOfOrigin: 'Chile' }} relation={null} />);
    expect(screen.getByText('Local')).toBeInTheDocument();
  });

  it('sin relación permite agregar', () => {
    const { onAdd } = setup(null);
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('con una solicitud enviada permite cancelarla', () => {
    const { onRemove } = setup({ id: 'f1', status: 'pending', direction: 'sent' });
    expect(screen.getByRole('button', { name: 'Solicitud enviada' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('con una solicitud recibida permite aceptar o rechazar', () => {
    const { onAccept, onReject } = setup({ id: 'f1', status: 'pending', direction: 'received' });
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('con una amistad aceptada permite quitarla', () => {
    const { onRemove } = setup({ id: 'f1', status: 'accepted', direction: 'sent' });
    expect(screen.getByRole('button', { name: '✓ Amigos' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('bloquea las acciones mientras hay una petición en curso', () => {
    setup(null, { busy: true });
    expect(screen.getByRole('button', { name: '+ Agregar' })).toBeDisabled();
  });
});
