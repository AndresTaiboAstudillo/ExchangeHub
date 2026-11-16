import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EMPTY_LISTING } from '../../lib/listingForm';
import ListingFormModal from './ListingFormModal';

const setup = (props = {}) => {
  const handlers = { onSubmit: vi.fn().mockResolvedValue(undefined), onCancel: vi.fn(), onPickLocation: vi.fn() };
  render(<ListingFormModal mode="create" initial={EMPTY_LISTING} {...handlers} {...props} />);
  return handlers;
};
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('ListingFormModal', () => {
  it('no envía y marca los campos con error', async () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar arriendo' }));
    expect(await screen.findByText(/al menos 3 letras/)).toBeInTheDocument();
    expect(screen.getByText(/Marca el punto en el mapa/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía el cuerpo ya convertido (coma decimal, precio con puntos)', async () => {
    const { onSubmit } = setup();
    fill('Nombre', '  Pieza luminosa ');
    fill('Dirección', 'Calle 1');
    fill('Latitud', '-33,0437');
    fill('Longitud', '-71,6288');
    fill(/Arriendo mensual/, '$ 190.000');
    fill('Disponibilidad', '2 cupos');
    fill('Descripción', 'Con desayuno');
    fireEvent.click(screen.getByRole('button', { name: 'Publicar arriendo' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Pieza luminosa',
      address: 'Calle 1',
      latitude: -33.0437,
      longitude: -71.6288,
      description: 'Con desayuno',
      priceClp: 190000,
      availability: '2 cupos',
    });
  });

  it('ofrece elegir el punto en el mapa y recuerda lo escrito', () => {
    const { onPickLocation } = setup();
    fill('Nombre', 'Borrador');
    expect(screen.queryByText('Punto listo ✓')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Elegir en el mapa/ }));
    expect(onPickLocation).toHaveBeenCalledWith(expect.objectContaining({ name: 'Borrador' }));
  });

  it('con punto válido lo indica y permite cambiarlo', () => {
    setup({ initial: { ...EMPTY_LISTING, latitude: '-33.04', longitude: '-71.6' } });
    expect(screen.getByText('Punto listo ✓')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cambiar punto en el mapa/ })).toBeInTheDocument();
  });

  it('en edición cambia los textos y conserva una disponibilidad personalizada', () => {
    setup({ mode: 'edit', initial: { ...EMPTY_LISTING, name: 'X', availability: 'Desde marzo' } });
    expect(screen.getByRole('dialog', { name: 'Editar arriendo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    expect(screen.getByLabelText('Disponibilidad')).toHaveValue('Desde marzo');
  });

  it('muestra el error del servidor y deja volver a intentar', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Sin permiso'));
    setup({ onSubmit, initial: { ...EMPTY_LISTING, name: 'Pieza', latitude: '-33', longitude: '-71' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar arriendo' }));
    expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar arriendo' })).toBeEnabled();
  });

  it('se cierra con Escape, con la X y al tocar fuera', () => {
    const { onCancel } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('dialog').parentElement);
    expect(onCancel).toHaveBeenCalledTimes(3);
  });
});
