# ExchangeHub

Next.js (App Router) + Tailwind CSS, con **rutas reales** por sección.

## Instalación

```bash
npm install
npm run dev
```

Abre http://localhost:3000 — te redirige a `/login` o `/inicio` según la sesión.

## Rutas

```
/            → redirige a /login o /inicio según sesión (localStorage)
/login       → LandingPage (login/registro)
/inicio      → mapa + listados (ruta protegida)
/universidades
/comunidad
/perfil
```

Las 4 rutas protegidas están agrupadas con un *route group* `app/(main)/` que
comparte un mismo layout (Navbar + verificación de sesión) sin agregar
`/main` a la URL.

## Estructura

```
app/
  layout.jsx          # fuentes + envuelve todo en <AppProvider>
  providers.jsx        # Context: sesión, toast, y los 2 modales globales
  page.jsx             # "/" — redirige según sesión
  login/page.jsx        # "/login"
  (main)/
    layout.jsx           # Navbar + guardia de sesión, compartido por las 4 rutas
    inicio/page.jsx
    universidades/page.jsx
    comunidad/page.jsx
    perfil/page.jsx
  globals.css

components/
  Navbar.jsx           # usa next/link + usePathname (ruta activa)
  Toast.jsx
  Badge.jsx            # badges y estrellas reutilizables
  LandingPage.jsx       # login / registro (recibe onLogin)
  InicioPage.jsx         # layout con sidebar + mapa
    inicio/ListingCard.jsx
    inicio/MapPanel.jsx
  UniversidadesPage.jsx
  ComunidadPage.jsx       # tabs Foro / Amigos
    comunidad/ForoTab.jsx
    comunidad/PostCard.jsx
    comunidad/AmigosTab.jsx
    comunidad/FriendCard.jsx
  PerfilPage.jsx
    perfil/ToggleSwitch.jsx
  DetailModal.jsx        # montado globalmente vía providers.jsx
  NewPostModal.jsx        # montado globalmente vía providers.jsx

data/
  listings.js          # alojamiento, comercios, zonas, pines del mapa
  detailData.js         # contenido del modal de detalle
  universities.js
  posts.js
  friends.js
```

## Agregar una página nueva con su propia URL

1. Crea `app/(main)/mi-pagina/page.jsx` (usa el `(main)` si quieres Navbar +
   sesión protegida automáticamente).
2. Si necesita toast o abrir un modal, usa `const { toast } = useApp()` desde
   `app/providers.jsx`.
3. Agrégala al array `NAV_ITEMS` en `components/Navbar.jsx`.

La sesión se guarda en `localStorage` (clave `exchangehub_logged_in`) solo
para que la demo sobreviva un refresh; en producción esto debería venir de
tu backend/autenticación real (cookies, JWT, etc.).

## Tailwind

Los tokens de color/tipografía originales están en `tailwind.config.js`
(`forest`, `forest-mid`, `forest-lt`, `amber`, `amber-lt`, `surface`,
`surface-2`, `ink`, `ink-mid`, `muted`, `border`), junto con los `boxShadow`
`card` / `card-lg` que reemplazan las sombras del CSS original.
