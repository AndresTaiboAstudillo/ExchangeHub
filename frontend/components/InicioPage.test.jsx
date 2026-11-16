import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InicioPage from './InicioPage';

let mapProps;
let params = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => params }));
vi.mock('./inicio/MapPanel', () => ({
  default: (props) => {
    mapProps = props;
    return <div data-testid="map">{props.items.length} en el mapa{props.status ? ` · ${props.status}` : ''}</div>;
  },
}));

const apiMock = vi.hoisted(() => ({
  mapListings: vi.fn(),
  mapZones: vi.fn(),
  mapUniversities: vi.fn(),
  mapPlaces: vi.fn(),
  placeReviews: vi.fn(),
  listingReviews: vi.fn(),
  savePlaceReview: vi.fn(),
  deleteReview: vi.fn(),
  createListing: vi.fn(),
  updateListing: vi.fn(),
  deleteListing: vi.fn(),
}));
vi.mock('../lib/api', () => ({ api: apiMock }));

const listings = [
  { id: 'l1', type: 'alojamiento', name: 'Habitación en Cerro Alegre', address: 'Almirante Montt 256', latitude: -33.04, longitude: -71.62, priceClp: 280000, availability: 'Disponible' },
  { id: 'l2', type: 'alojamiento', name: 'Departamento Viña', address: 'Av. Libertad 1050', latitude: -33.02, longitude: -71.55, priceClp: 195000, availability: '2 cupos' },
];
const zones = [{ id: 'z1', name: 'Cerro Alegre', safetyLevel: 'safe', description: 'Barrio turístico', safeHours: 'Hasta las 23:00', latCenter: -33.04, lngCenter: -71.62, radiusM: 350 }];

const universities = [
  { id: 'u1', name: 'Pontificia Universidad Católica de Valparaíso', category: 'universidad', ownership: 'particular_con_aportes', address: null, website: 'https://www.pucv.cl', latitude: -33.0338, longitude: -71.5963 },
  { id: 'u2', name: 'Instituto Profesional Ejemplo', category: 'instituto_profesional', ownership: 'privada', address: 'Calle 1', website: null, latitude: -33.0, longitude: -71.5 },
];

beforeEach(() => {
  vi.clearAllMocks();
  params = new URLSearchParams();
  apiMock.mapUniversities.mockResolvedValue(universities);
  apiMock.mapListings.mockResolvedValue(listings);
  apiMock.mapZones.mockResolvedValue(zones);
  apiMock.mapPlaces.mockResolvedValue({
    items: [{ id: 'p1', category: 'feria', name: 'Feria Argentina', address: null, latitude: -33.045, longitude: -71.609, openingHours: 'We,Sa 08:00-15:00', website: null, ratingAverage: 4.5, ratingCount: 2 }],
    total: 1,
    truncated: false,
  });
});

const viewport = (zoom = 14) => act(async () => mapProps.onViewportChange('-71.66,-33.06,-71.58,-33.02', zoom));

describe('Inicio', () => {
  it('lista los alojamientos del backend y los dibuja en el mapa', async () => {
    render(<InicioPage />);
    expect(await screen.findByText('Habitación en Cerro Alegre')).toBeInTheDocument();
    expect(screen.getByText('$280.000/mes')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent('2 en el mapa');
  });

  it('busca por nombre o dirección sin distinguir tildes', async () => {
    render(<InicioPage />);
    await screen.findByText('Departamento Viña');
    fireEvent.change(screen.getByLabelText('Buscar en la lista'), { target: { value: 'vina' } });
    expect(screen.queryByText('Habitación en Cerro Alegre')).toBeNull();
    expect(screen.getByTestId('map')).toHaveTextContent('1 en el mapa');
    fireEvent.change(screen.getByLabelText('Buscar en la lista'), { target: { value: 'zzz' } });
    expect(screen.getByText('Sin resultados para tu búsqueda.')).toBeInTheDocument();
  });

  it('al tocar una tarjeta se selecciona en el mapa', async () => {
    render(<InicioPage />);
    fireEvent.click(await screen.findByText('Departamento Viña'));
    expect(mapProps.selectedId).toBe('l2');
  });

  it('en Comercios pide los lugares de la zona visible y filtra por categoría', async () => {
    render(<InicioPage />);
    await screen.findByText('Departamento Viña');
    fireEvent.click(screen.getByRole('tab', { name: /Comercios/ }));
    await viewport();
    expect(await screen.findByText('Feria Argentina')).toBeInTheDocument();
    expect(apiMock.mapPlaces).toHaveBeenLastCalledWith({
      bbox: '-71.66,-33.06,-71.58,-33.02',
      category: ['feria', 'supermercado', 'minimarket', 'panaderia', 'verduleria', 'farmacia', 'lavanderia'],
    });

    fireEvent.click(screen.getByRole('button', { name: /Farmacia/ }));
    await waitFor(() =>
      expect(apiMock.mapPlaces).toHaveBeenLastCalledWith({ bbox: '-71.66,-33.06,-71.58,-33.02', category: ['farmacia'] }),
    );
  });

  it('en Alojamiento suma hoteles y hospedajes de OpenStreetMap a las piezas publicadas', async () => {
    apiMock.mapPlaces.mockResolvedValue({
      items: [{ id: 'h1', category: 'hostal', name: 'Hostal del Cerro', address: null, latitude: -33.04, longitude: -71.62, openingHours: null, website: null, ratingAverage: null, ratingCount: 0 }],
      total: 1,
      truncated: false,
    });
    render(<InicioPage />);
    await screen.findByText('Departamento Viña');
    await viewport();
    expect(await screen.findByText('Hostal del Cerro')).toBeInTheDocument();
    expect(apiMock.mapPlaces).toHaveBeenLastCalledWith({ bbox: '-71.66,-33.06,-71.58,-33.02', category: ['hotel', 'hostal', 'hospedaje'] });
    expect(screen.getByText('Departamento Viña')).toBeInTheDocument(); // sigue la lista publicada
    expect(screen.getByTestId('map')).toHaveTextContent('3 en el mapa');
    expect(screen.getByText('Hostal')).toBeInTheDocument(); // etiqueta de categoría

    // Solo hoteles: se ocultan las piezas publicadas.
    fireEvent.click(screen.getByRole('button', { name: /Hotel/ }));
    await waitFor(() =>
      expect(apiMock.mapPlaces).toHaveBeenLastCalledWith({ bbox: '-71.66,-33.06,-71.58,-33.02', category: ['hotel'] }),
    );
    expect(screen.queryByText('Departamento Viña')).toBeNull();

    // Solo piezas y departamentos: no se consulta OpenStreetMap.
    apiMock.mapPlaces.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Piezas y deptos/ }));
    expect(await screen.findByText('Departamento Viña')).toBeInTheDocument();
    expect(screen.queryByText('Hostal del Cerro')).toBeNull();
    expect(apiMock.mapPlaces).not.toHaveBeenCalled();
  });

  it('los hospedajes de OpenStreetMap se reseñan como lugares, no como alojamientos publicados', async () => {
    apiMock.mapPlaces.mockResolvedValue({
      items: [{ id: 'h1', category: 'hotel', name: 'Hotel Cerro', address: null, latitude: -33.04, longitude: -71.62, openingHours: null, website: null, ratingAverage: 4, ratingCount: 1 }],
      total: 1,
      truncated: false,
    });
    apiMock.placeReviews.mockResolvedValue({ summary: { count: 1, average: 4, distribution: [0, 0, 0, 1, 0] }, mine: null, items: [], nextCursor: null });
    render(<InicioPage />);
    await screen.findByText('Departamento Viña');
    await viewport();
    fireEvent.click(await screen.findByRole('button', { name: 'Reseñas de Hotel Cerro' }));
    expect(await screen.findByRole('dialog', { name: 'Hotel Cerro' })).toBeInTheDocument();
    expect(apiMock.placeReviews).toHaveBeenCalledWith('h1');
    expect(apiMock.listingReviews).not.toHaveBeenCalled();
  });

  it('con el mapa muy alejado no pide comercios y pide acercar', async () => {
    render(<InicioPage />);
    await screen.findByText('Departamento Viña');
    fireEvent.click(screen.getByRole('tab', { name: /Comercios/ }));
    await viewport(10);
    expect(apiMock.mapPlaces).not.toHaveBeenCalled();
    expect(screen.getAllByText('Acerca el mapa para ver comercios y servicios.').length).toBeGreaterThan(0);
    expect(screen.getByTestId('map')).toHaveTextContent('0 en el mapa');
  });

  it('avisa cuando los resultados se truncaron', async () => {
    apiMock.mapPlaces.mockResolvedValue({ items: [], total: 900, truncated: true });
    render(<InicioPage />);
    await screen.findByText('Departamento Viña');
    fireEvent.click(screen.getByRole('tab', { name: /Comercios/ }));
    await viewport();
    await waitFor(() => expect(screen.getByTestId('map')).toHaveTextContent('Mostrando 0 de 900'));
  });

  it('muestra las zonas con su nivel de seguridad', async () => {
    render(<InicioPage />);
    await screen.findByText('Departamento Viña');
    fireEvent.click(screen.getByRole('tab', { name: /Zonas/ }));
    const card = (await screen.findByText('Cerro Alegre')).closest('button');
    expect(within(card).getByText('Segura')).toBeInTheDocument();
    expect(within(card).getByText('🌙 Hasta las 23:00')).toBeInTheDocument();
  });

  it('muestra un aviso si el backend falla', async () => {
    apiMock.mapListings.mockRejectedValue(new Error('x'));
    render(<InicioPage />);
    expect(await screen.findByText(/No pudimos cargar los datos/)).toBeInTheDocument();
  });

  it('muestra la calificación del comercio y abre sus reseñas desde la tarjeta o el mapa', async () => {
    apiMock.placeReviews.mockResolvedValue({
      summary: { count: 2, average: 4.5, distribution: [0, 0, 0, 1, 1] },
      mine: null,
      items: [],
      nextCursor: null,
    });
    render(<InicioPage />);
    await screen.findByText('Departamento Viña');
    fireEvent.click(screen.getByRole('tab', { name: /Comercios/ }));
    await viewport();
    const open = await screen.findByRole('button', { name: 'Reseñas de Feria Argentina' });
    expect(open).toHaveTextContent('★ 4,5 (2)');
    // Los alojamientos no se reseñan.
    fireEvent.click(open);
    expect(await screen.findByRole('dialog', { name: 'Feria Argentina' })).toBeInTheDocument();
    expect(apiMock.placeReviews).toHaveBeenCalledWith('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // Desde el globo del mapa
    act(() => mapProps.onReviews('p1'));
    expect(await screen.findByRole('dialog', { name: 'Feria Argentina' })).toBeInTheDocument();
  });

  it('los alojamientos también se reseñan y su tarjeta muestra la calificación', async () => {
    apiMock.mapListings.mockResolvedValue([{ ...listings[0], ratingAverage: 3.5, ratingCount: 4 }, listings[1]]);
    apiMock.listingReviews.mockResolvedValue({
      summary: { count: 4, average: 3.5, distribution: [0, 1, 1, 2, 0] },
      mine: null,
      items: [],
      nextCursor: null,
    });
    render(<InicioPage />);
    const open = await screen.findByRole('button', { name: 'Reseñas de Habitación en Cerro Alegre' });
    expect(open).toHaveTextContent('★ 3,5 (4)');
    expect(screen.getByRole('button', { name: 'Reseñas de Departamento Viña' })).toHaveTextContent('Sin reseñas');
    fireEvent.click(open);
    expect(await screen.findByRole('dialog', { name: 'Habitación en Cerro Alegre' })).toBeInTheDocument();
    expect(apiMock.listingReviews).toHaveBeenCalledWith('l1');
  });

  it('las zonas no tienen botón de reseñas', async () => {
    render(<InicioPage />);
    await screen.findByText('Departamento Viña');
    fireEvent.click(screen.getByRole('tab', { name: /Zonas/ }));
    await screen.findByText('Cerro Alegre');
    expect(screen.queryByRole('button', { name: /^Reseñas de/ })).toBeNull();
  });

  it('la pestaña Universidades muestra las instituciones con ubicación y se filtra por tipo', async () => {
    render(<InicioPage />);
    await screen.findByText('Departamento Viña');
    fireEvent.click(screen.getByRole('tab', { name: /Universidades/ }));
    expect(await screen.findByText('Pontificia Universidad Católica de Valparaíso')).toBeInTheDocument();
    expect(screen.getByText('Universidad')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent('2 en el mapa');
    expect(apiMock.mapPlaces).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Institutos/ }));
    expect(screen.queryByText('Pontificia Universidad Católica de Valparaíso')).toBeNull();
    expect(screen.getByText('Instituto Profesional Ejemplo')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent('1 en el mapa');
  });

  it('al llegar desde Universidades (?universidad=id) abre esa pestaña y selecciona la institución', async () => {
    params = new URLSearchParams('universidad=u2');
    render(<InicioPage />);
    expect(await screen.findByText('Instituto Profesional Ejemplo')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Universidades/ })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(mapProps.selectedId).toBe('u2'));
  });

  it('un id desconocido no selecciona nada ni rompe la página', async () => {
    params = new URLSearchParams('universidad=inexistente');
    render(<InicioPage />);
    expect(await screen.findByText('Pontificia Universidad Católica de Valparaíso')).toBeInTheDocument();
    expect(mapProps.selectedId).toBeNull();
  });

  it('si fallan las universidades, las otras pestañas siguen funcionando', async () => {
    apiMock.mapUniversities.mockRejectedValue(new Error('x'));
    render(<InicioPage />);
    expect(await screen.findByText('Departamento Viña')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Universidades/ }));
    expect(await screen.findByText(/No pudimos cargar los datos/)).toBeInTheDocument();
  });

  describe('arriendos (administradores)', () => {
    it('una persona común no ve los botones para publicar, editar ni eliminar', async () => {
      render(<InicioPage />);
      await screen.findByText('Departamento Viña');
      expect(screen.queryByRole('button', { name: /Agregar arriendo/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Editar / })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Eliminar / })).toBeNull();
    });

    it('el botón de agregar solo está en la pestaña Alojamiento', async () => {
      render(<InicioPage canManage />);
      await screen.findByText('Departamento Viña');
      expect(screen.getByRole('button', { name: /Agregar arriendo/ })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: /Zonas/ }));
      expect(screen.queryByRole('button', { name: /Agregar arriendo/ })).toBeNull();
    });

    it('publica un arriendo eligiendo el punto en el mapa', async () => {
      const created = { id: 'l9', type: 'alojamiento', name: 'Pieza nueva', address: null, latitude: -33.04, longitude: -71.62, priceClp: 230000, availability: 'Disponible', description: null, ratingAverage: null, ratingCount: 0 };
      apiMock.createListing.mockResolvedValue(created);
      render(<InicioPage canManage />);
      await screen.findByText('Departamento Viña');
      fireEvent.click(screen.getByRole('button', { name: /Agregar arriendo/ }));
      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Pieza nueva' } });
      fireEvent.change(screen.getByLabelText(/Arriendo mensual/), { target: { value: '230.000' } });

      // Sin punto no se puede publicar.
      fireEvent.click(screen.getByRole('button', { name: 'Publicar arriendo' }));
      expect(await screen.findByText(/Marca el punto en el mapa/)).toBeInTheDocument();
      expect(apiMock.createListing).not.toHaveBeenCalled();

      // Elegir en el mapa: el formulario se oculta y el mapa queda en modo "elegir".
      fireEvent.click(screen.getByRole('button', { name: /Elegir en el mapa/ }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent('Toca el mapa');
      expect(mapProps.picking).toBe(true);

      act(() => mapProps.onPick(-33.04, -71.62));
      expect(mapProps.picking).toBe(false);
      expect(mapProps.pickedPoint).toEqual({ lat: -33.04, lng: -71.62 });
      // Vuelve el formulario con lo que ya estaba escrito y el punto elegido.
      expect(screen.getByLabelText('Nombre')).toHaveValue('Pieza nueva');
      expect(screen.getByLabelText('Latitud')).toHaveValue('-33.040000');

      fireEvent.click(screen.getByRole('button', { name: 'Publicar arriendo' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(apiMock.createListing).toHaveBeenCalledWith({
        name: 'Pieza nueva',
        address: null,
        latitude: -33.04,
        longitude: -71.62,
        description: null,
        priceClp: 230000,
        availability: 'Disponible',
      });
      expect(screen.getByText('Pieza nueva')).toBeInTheDocument();
      expect(mapProps.selectedId).toBe('l9');
      expect(mapProps.pickedPoint).toBeNull();
    });

    it('cancelar la elección del punto devuelve el formulario sin cambios', async () => {
      render(<InicioPage canManage />);
      await screen.findByText('Departamento Viña');
      fireEvent.click(screen.getByRole('button', { name: /Agregar arriendo/ }));
      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Borrador' } });
      fireEvent.click(screen.getByRole('button', { name: /Elegir en el mapa/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(mapProps.picking).toBe(false);
      expect(screen.getByLabelText('Nombre')).toHaveValue('Borrador');
    });

    it('si el servidor rechaza el arriendo, muestra el motivo y conserva el formulario', async () => {
      apiMock.createListing.mockRejectedValue(new Error('Requiere rol de administrador'));
      render(<InicioPage canManage />);
      await screen.findByText('Departamento Viña');
      fireEvent.click(screen.getByRole('button', { name: /Agregar arriendo/ }));
      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Pieza nueva' } });
      fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-33,04' } });
      fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '-71,62' } });
      fireEvent.click(screen.getByRole('button', { name: 'Publicar arriendo' }));
      expect(await screen.findByText('Requiere rol de administrador')).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre')).toHaveValue('Pieza nueva');
      expect(screen.getByRole('button', { name: 'Publicar arriendo' })).toBeEnabled();
    });

    it('edita un arriendo existente', async () => {
      apiMock.updateListing.mockResolvedValue({ ...listings[1], priceClp: 200000, description: null, ratingAverage: null, ratingCount: 0 });
      render(<InicioPage canManage />);
      await screen.findByText('Departamento Viña');
      fireEvent.click(screen.getByRole('button', { name: 'Editar Departamento Viña' }));
      expect(screen.getByRole('dialog', { name: 'Editar arriendo' })).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre')).toHaveValue('Departamento Viña');
      expect(screen.getByLabelText('Latitud')).toHaveValue('-33.02');
      expect(mapProps.pickedPoint).toEqual({ lat: -33.02, lng: -71.55 });
      fireEvent.change(screen.getByLabelText(/Arriendo mensual/), { target: { value: '200000' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(await screen.findByText('$200.000/mes')).toBeInTheDocument();
      expect(apiMock.updateListing).toHaveBeenCalledWith('l2', expect.objectContaining({ name: 'Departamento Viña', priceClp: 200000, latitude: -33.02 }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('elimina un arriendo solo tras confirmar', async () => {
      apiMock.deleteListing.mockResolvedValue(null);
      render(<InicioPage canManage />);
      await screen.findByText('Departamento Viña');
      fireEvent.click(screen.getByRole('button', { name: 'Eliminar Departamento Viña' }));
      fireEvent.click(screen.getByRole('button', { name: 'No' }));
      expect(apiMock.deleteListing).not.toHaveBeenCalled();
      expect(screen.getByText('Departamento Viña')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Eliminar Departamento Viña' }));
      fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
      await waitFor(() => expect(screen.queryByText('Departamento Viña')).toBeNull());
      expect(apiMock.deleteListing).toHaveBeenCalledWith('l2');
      expect(screen.getByTestId('map')).toHaveTextContent('1 en el mapa');
    });

    it('los hospedajes de OpenStreetMap no se pueden editar ni eliminar desde aquí', async () => {
      apiMock.mapPlaces.mockResolvedValue({
        items: [{ id: 'h1', category: 'hotel', name: 'Hotel Cerro', address: null, latitude: -33.04, longitude: -71.62, openingHours: null, website: null, ratingAverage: null, ratingCount: 0 }],
        total: 1,
        truncated: false,
      });
      render(<InicioPage canManage />);
      await screen.findByText('Departamento Viña');
      await viewport();
      await screen.findByText('Hotel Cerro');
      expect(screen.queryByRole('button', { name: 'Editar Hotel Cerro' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Editar Departamento Viña' })).toBeInTheDocument();
    });
  });
});
