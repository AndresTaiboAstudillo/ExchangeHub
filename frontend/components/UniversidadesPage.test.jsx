import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import UniversidadesPage from "./UniversidadesPage";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { universities: vi.fn(), universitiesSources: vi.fn() },
}));

const source = (code, extra = {}) => ({
  source: code,
  externalId: "x",
  url: code === "wikidata" ? "https://www.wikidata.org/wiki/Q611995" : null,
  fetchedAt: "2026-10-24T12:00:00.000Z",
  ...extra,
});

const uai = {
  id: "u-uai",
  name: "Universidad Adolfo Ibáñez",
  registryNumber: "C26",
  category: "universidad",
  ownership: "privada",
  operatingStatus: "funcionando",
  isVigente: true,
  website: "https://www.uai.cl",
  latitude: -33.486,
  longitude: -70.518,
  foundedYear: 1988,
  sources: [source("mineduc_ies"), source("wikidata")],
};
const bare = {
  id: "u-chile",
  name: "Universidad de Chile",
  registryNumber: "A1",
  category: "universidad",
  ownership: "estatal",
  operatingStatus: "en_proceso_de_cierre",
  isVigente: true,
  website: null,
  latitude: null,
  longitude: null,
  foundedYear: null,
  sources: [source("mineduc_ies")],
};

const page = (items, total = items.length) => ({
  items,
  total,
  limit: 24,
  offset: 0,
  query: null,
});
const lastParams = () => api.universities.mock.calls.at(-1)[0];

beforeEach(() => {
  api.universities.mockReset();
  api.universitiesSources.mockReset();
  api.universitiesSources.mockResolvedValue({
    sources: [
      {
        code: "mineduc_ies",
        lastFetchedAt: "2026-10-24T12:00:00.000Z",
        stale: false,
      },
    ],
  });
});

const setup = () => render(<UniversidadesPage debounceMs={0} />);

describe("UniversidadesPage", () => {
  it("lista las instituciones con sus datos", async () => {
    api.universities.mockResolvedValue(page([uai, bare]));
    setup();
    expect(screen.getByText("Cargando instituciones…")).toBeInTheDocument();

    const card = (await screen.findByText("Universidad Adolfo Ibáñez")).closest(
      "article",
    );
    expect(within(card).getByText("Privada")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "uai.cl" })).toHaveAttribute(
      "href",
      "https://www.uai.cl/",
    );
    expect(within(card).getByText("Fundada en 1988")).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: "Ver en el mapa" }),
    ).toHaveAttribute("href", expect.stringContaining("openstreetmap.org"));
    expect(within(card).queryByText(/Fuente:/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 instituciones");
  });

  it("pide por defecto solo universidades", async () => {
    api.universities.mockResolvedValue(page([uai]));
    setup();
    await screen.findByText("Universidad Adolfo Ibáñez");
    expect(lastParams()).toEqual({ category: "universidad", limit: 24 });
  });

  it("una institución con pocos datos lo dice y avisa su estado", async () => {
    api.universities.mockResolvedValue(page([bare]));
    setup();
    const card = (await screen.findByText("Universidad de Chile")).closest(
      "article",
    );
    expect(within(card).getByText("En proceso de cierre")).toBeInTheDocument();
    expect(
      within(card).getByText(/Aún no hay más datos públicos/),
    ).toBeInTheDocument();
    expect(within(card).queryByRole("link")).toBeNull();
  });

  it("nunca enlaza sitios que no sean http(s)", async () => {
    api.universities.mockResolvedValue(
      page([{ ...uai, website: "javascript:alert(1)" }]),
    );
    setup();
    const card = (await screen.findByText("Universidad Adolfo Ibáñez")).closest(
      "article",
    );
    expect(within(card).queryByText("javascript:alert(1)")).toBeNull();
    expect(within(card).queryByRole("link", { name: /alert/ })).toBeNull();
  });

  it("busca por texto y lo anuncia ordenado por relevancia", async () => {
    api.universities.mockResolvedValue(page([uai]));
    setup();
    await screen.findByText("Universidad Adolfo Ibáñez");
    api.universities.mockResolvedValue(page([bare]));
    fireEvent.change(screen.getByLabelText("Buscar institución"), {
      target: { value: "  usach " },
    });
    await waitFor(() => expect(lastParams().q).toBe("usach"));
    expect(await screen.findByText("Universidad de Chile")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "ordenadas por relevancia",
    );
  });

  it("el texto se envía con retardo, no en cada tecla", async () => {
    vi.useFakeTimers();
    try {
      api.universities.mockResolvedValue(page([uai]));
      render(<UniversidadesPage debounceMs={300} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      const before = api.universities.mock.calls.length;
      const input = screen.getByLabelText("Buscar institución");
      for (const value of ["u", "us", "usa", "usac"])
        fireEvent.change(input, { target: { value } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(299);
      });
      expect(api.universities.mock.calls.length).toBe(before);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2);
      });
      expect(api.universities.mock.calls.length).toBe(before + 1);
      expect(lastParams().q).toBe("usac");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cambia de categoría y de tipo de propiedad", async () => {
    api.universities.mockResolvedValue(page([uai]));
    setup();
    await screen.findByText("Universidad Adolfo Ibáñez");

    fireEvent.click(
      screen.getByRole("button", { name: "Institutos profesionales" }),
    );
    await waitFor(() =>
      expect(lastParams().category).toBe("instituto_profesional"),
    );
    expect(
      screen.getByRole("button", { name: "Institutos profesionales" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("category"));

    fireEvent.change(
      screen.getByLabelText("Tipo de institución por propiedad"),
      { target: { value: "estatal" } },
    );
    await waitFor(() => expect(lastParams().ownership).toBe("estatal"));
  });

  it("sin resultados sugiere qué probar", async () => {
    api.universities.mockResolvedValue(page([], 0));
    setup();
    expect(
      await screen.findByText(/No encontramos instituciones/),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultados");
  });

  it("muestra el error y permite reintentar", async () => {
    api.universities.mockRejectedValueOnce(
      new Error("El servidor tuvo un problema."),
    );
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El servidor tuvo un problema.",
    );
    api.universities.mockResolvedValue(page([uai]));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByText("Universidad Adolfo Ibáñez"),
    ).toBeInTheDocument();
  });

  it("carga más resultados con el desplazamiento correcto", async () => {
    api.universities.mockResolvedValueOnce(page([uai], 2));
    setup();
    await screen.findByText("Universidad Adolfo Ibáñez");
    api.universities.mockResolvedValueOnce(page([bare], 2));
    fireEvent.click(
      screen.getByRole("button", { name: "Cargar más instituciones" }),
    );
    expect(await screen.findByText("Universidad de Chile")).toBeInTheDocument();
    expect(lastParams().offset).toBe(1);
    expect(
      screen.queryByRole("button", { name: "Cargar más instituciones" }),
    ).toBeNull();
  });

  it('si falla "cargar más" conserva lo ya cargado y avisa', async () => {
    api.universities.mockResolvedValueOnce(page([uai], 2));
    setup();
    await screen.findByText("Universidad Adolfo Ibáñez");
    api.universities.mockRejectedValueOnce(new Error("Sin conexión"));
    fireEvent.click(
      screen.getByRole("button", { name: "Cargar más instituciones" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
    expect(screen.getByText("Universidad Adolfo Ibáñez")).toBeInTheDocument();
  });

  it("descarta una respuesta vieja que llega después de una búsqueda nueva", async () => {
    let resolveOld;
    api.universities.mockReturnValueOnce(
      new Promise((resolve) => (resolveOld = resolve)),
    );
    setup();
    api.universities.mockResolvedValue(page([bare]));
    fireEvent.change(screen.getByLabelText("Buscar institución"), {
      target: { value: "chile" },
    });
    expect(await screen.findByText("Universidad de Chile")).toBeInTheDocument();
    await act(async () => resolveOld(page([uai])));
    expect(screen.queryByText("Universidad Adolfo Ibáñez")).toBeNull();
  });

  it("informa la frescura de los datos y avisa si están desactualizados", async () => {
    api.universities.mockResolvedValue(page([uai]));
    api.universitiesSources.mockResolvedValue({
      sources: [
        {
          code: "mineduc_ies",
          lastFetchedAt: "2026-08-01T00:00:00.000Z",
          stale: true,
        },
      ],
    });
    setup();
    expect(
      await screen.findByText(/podrían estar desactualizados/),
    ).toBeInTheDocument();
  });

  it("si no se puede consultar la frescura, la página funciona igual", async () => {
    api.universities.mockResolvedValue(page([uai]));
    api.universitiesSources.mockRejectedValue(new Error("x"));
    setup();
    expect(
      await screen.findByText("Universidad Adolfo Ibáñez"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Datos del Ministerio/)).toBeNull();
  });
});
