import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReviewsModal from './ReviewsModal';

const apiMock = vi.hoisted(() => ({
  placeReviews: vi.fn(),
  savePlaceReview: vi.fn(),
  listingReviews: vi.fn(),
  saveListingReview: vi.fn(),
  deleteReview: vi.fn(),
}));
vi.mock('../../lib/api', () => ({ api: apiMock }));

const place = {
  id: 'p1',
  name: 'Feria Argentina',
  emoji: '🛒',
  address: 'Av. Argentina',
  badge: { text: 'Feria', color: 'green' },
  footer: '🕐 Sa 08:00-15:00',
};
const when = '2026-11-13T12:00:00.000Z';
const review = (extra = {}) => ({
  id: 'r1',
  rating: 5,
  body: 'Todo muy fresco',
  createdAt: when,
  updatedAt: when,
  edited: false,
  own: false,
  author: { id: 'u2', name: 'María Jiménez', countryOfOrigin: 'España' },
  ...extra,
});
const page = (items = [], extra = {}) => ({
  summary: { count: items.length, average: items.length ? 5 : null, distribution: [0, 0, 0, 0, items.length] },
  mine: null,
  items,
  nextCursor: null,
  ...extra,
});

const setup = (props = {}) => {
  const onClose = vi.fn();
  const onRatingChange = vi.fn();
  render(<ReviewsModal place={place} onClose={onClose} onRatingChange={onRatingChange} {...props} />);
  return { onClose, onRatingChange };
};

beforeEach(() => vi.clearAllMocks());

describe('ReviewsModal', () => {
  it('muestra el comercio, el promedio y las reseñas con enlace al perfil', async () => {
    apiMock.placeReviews.mockResolvedValue(page([review()]));
    setup();
    expect(await screen.findByText('Todo muy fresco')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Feria Argentina' })).toBeInTheDocument();
    expect(screen.getByText('1 reseña')).toBeInTheDocument();
    expect(screen.getByText(/España/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver perfil de María Jiménez' })).toHaveAttribute('href', '/estudiante?id=u2');
  });

  it('sin reseñas invita a escribir la primera', async () => {
    apiMock.placeReviews.mockResolvedValue(page());
    setup();
    expect(await screen.findByText(/Sé la primera persona en opinar/)).toBeInTheDocument();
  });

  it('el perfil oculto aparece sin enlace', async () => {
    apiMock.placeReviews.mockResolvedValue(
      page([review({ author: { id: null, name: 'Estudiante', countryOfOrigin: null } })]),
    );
    setup();
    await screen.findByText('Todo muy fresco');
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Estudiante')).toBeInTheDocument();
  });

  it('exige elegir estrellas antes de publicar', async () => {
    apiMock.placeReviews.mockResolvedValue(page());
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige de 1 a 5 estrellas');
    expect(apiMock.savePlaceReview).not.toHaveBeenCalled();
  });

  it('publica una reseña, la agrega a la lista y avisa el nuevo promedio', async () => {
    apiMock.placeReviews.mockResolvedValue(page());
    const mine = review({ id: 'r9', rating: 4, body: 'Buenos precios', own: true, author: { id: 'me', name: 'Yo Mismo', countryOfOrigin: null } });
    apiMock.savePlaceReview.mockResolvedValue({
      review: mine,
      summary: { count: 1, average: 4, distribution: [0, 0, 0, 1, 0] },
    });
    const { onRatingChange } = setup();
    await screen.findByText(/Sé la primera/);
    fireEvent.click(screen.getByRole('radio', { name: /^4 estrellas/ }));
    fireEvent.change(screen.getByLabelText('Escribe una reseña'), { target: { value: '  Buenos precios ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByText('Reseña publicada ✓')).toBeInTheDocument();
    expect(apiMock.savePlaceReview).toHaveBeenCalledWith('p1', { rating: 4, body: 'Buenos precios' });
    expect(screen.getByText('Buenos precios', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar reseña' })).toBeInTheDocument();
    expect(onRatingChange).toHaveBeenCalledWith('p1', { average: 4, count: 1 });
  });

  it('precarga mi reseña para editarla, y se puede eliminar', async () => {
    const mine = review({ own: true, rating: 3, body: 'Regular', author: { id: 'me', name: 'Yo Mismo', countryOfOrigin: null } });
    apiMock.placeReviews.mockResolvedValueOnce(page([mine], { mine }));
    apiMock.deleteReview.mockResolvedValue(null);
    apiMock.placeReviews.mockResolvedValueOnce(page());
    const { onRatingChange } = setup();
    expect(await screen.findByLabelText('Escribe una reseña')).toHaveValue('Regular');
    expect(screen.getByRole('radio', { name: /^3 estrellas/ })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(apiMock.deleteReview).toHaveBeenCalledWith('r1'));
    expect(await screen.findByText('Reseña eliminada')).toBeInTheDocument();
    expect(screen.getByLabelText('Escribe una reseña')).toHaveValue('');
    expect(onRatingChange).toHaveBeenCalledWith('p1', { average: null, count: 0 });
  });

  it('carga más reseñas con el cursor', async () => {
    apiMock.placeReviews.mockResolvedValueOnce(page([review()], { nextCursor: 'r1' }));
    apiMock.placeReviews.mockResolvedValueOnce(page([review({ id: 'r2', body: 'Otra opinión' })]));
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más reseñas' }));
    expect(await screen.findByText('Otra opinión')).toBeInTheDocument();
    expect(apiMock.placeReviews).toHaveBeenLastCalledWith('p1', { cursor: 'r1' });
    expect(screen.queryByRole('button', { name: 'Ver más reseñas' })).toBeNull();
  });

  it('muestra el error del servidor al publicar y un aviso si no cargan', async () => {
    apiMock.placeReviews.mockResolvedValue(page());
    apiMock.savePlaceReview.mockRejectedValue(new Error('Comercio no encontrado'));
    setup();
    await screen.findByText(/Sé la primera/);
    fireEvent.click(screen.getByRole('radio', { name: /^5 estrellas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Comercio no encontrado');
  });

  it('avisa si las reseñas no cargan', async () => {
    apiMock.placeReviews.mockRejectedValue(new Error('x'));
    setup();
    expect(await screen.findByText(/No pudimos cargar las reseñas/)).toBeInTheDocument();
  });

  it('se cierra con Escape, con la X y al tocar fuera', async () => {
    apiMock.placeReviews.mockResolvedValue(page());
    const { onClose } = setup();
    await screen.findByText(/Sé la primera/);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('en un alojamiento usa los endpoints de alojamientos y muestra precio y descripción', async () => {
    const listing = { id: 'l1', kind: 'alojamiento', reviewTarget: 'listing', name: 'Pieza en Cerro Alegre', emoji: '🏠', price: '$280.000/mes', description: 'Vista al mar' };
    apiMock.listingReviews.mockResolvedValue(page());
    apiMock.saveListingReview.mockResolvedValue({
      review: review({ id: 'r5', own: true, rating: 5, body: null }),
      summary: { count: 1, average: 5, distribution: [0, 0, 0, 0, 1] },
    });
    const { onRatingChange } = setup({ place: listing });
    expect(await screen.findByText('$280.000/mes')).toBeInTheDocument();
    expect(screen.getByText('Vista al mar')).toBeInTheDocument();
    expect(apiMock.listingReviews).toHaveBeenCalledWith('l1');
    expect(apiMock.placeReviews).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: /^5 estrellas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await screen.findByText('Reseña publicada ✓');
    expect(apiMock.saveListingReview).toHaveBeenCalledWith('l1', { rating: 5, body: null });
    expect(apiMock.placeReviews).not.toHaveBeenCalled();
    expect(onRatingChange).toHaveBeenCalledWith('l1', { average: 5, count: 1 });
  });
});
