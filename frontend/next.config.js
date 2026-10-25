/** @type {import('next').NextConfig} */

// Versión móvil (Capacitor): exportación estática que la app Android carga desde el propio
// dispositivo. Se activa con BUILD_TARGET=mobile (ver `npm run build:mobile`); el resto de
// compilaciones (web y Docker) no cambia.
const isMobile = process.env.BUILD_TARGET === "mobile";

const nextConfig = isMobile
  ? {
      output: "export",
      // /login/index.html en vez de /login.html: el servidor local de Capacitor no resuelve rutas sin extensión.
      trailingSlash: true,
      images: { unoptimized: true },
      // La API a la que llama la app. 10.0.2.2 es el computador anfitrión visto desde el emulador de
      // Android; con un teléfono real usa la IP de tu red (MOBILE_API_URL=http://192.168.x.x:8000).
      env: {
        NEXT_PUBLIC_API_URL:
          process.env.MOBILE_API_URL || "http://10.0.2.2:8000",
      },
    }
  : {};

module.exports = nextConfig;
