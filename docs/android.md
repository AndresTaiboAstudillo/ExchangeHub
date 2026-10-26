# App Android (Capacitor)

La misma aplicación web se empaqueta como app Android con [Capacitor](https://capacitorjs.com): se
exporta como sitio estático (`next build` con `output: 'export'`) y un WebView de Android la carga desde
el propio dispositivo. La app solo habla con la API de NestJS, igual que la versión web.

```
Android (WebView, https://localhost)  ──HTTP──▶  NestJS  ──▶  PostgreSQL / servicio Python
```

## 1. Qué se agregó

| Archivo | Para qué |
|---|---|
| `frontend/next.config.js` | Con `BUILD_TARGET=mobile` exporta el sitio estático en `frontend/out`. La compilación web y la de Docker no cambian. |
| `frontend/capacitor.config.ts` | Identificador `cl.exchangehub.app`, carpeta web `out`, origen `https://localhost`. |
| `frontend/android/` | Proyecto nativo de Android (se versiona; Capacitor lo recomienda). |
| `frontend/android/app/src/debug/AndroidManifest.xml` | Permite tráfico `http` **solo** en compilaciones de depuración. |
| `backend/src/app.setup.ts` | `FRONTEND_ORIGIN` admite varios orígenes separados por comas (CORS). |

## 2. Requisitos en tu computador

- Android Studio con un emulador, o un teléfono Android con la depuración USB activada.
- JDK y SDK de Android según la guía de Capacitor para su versión 8
  (<https://capacitorjs.com/docs/getting-started/environment-setup>). El proyecto usa `minSdk 24`
  y `compileSdk 36`; Gradle se descarga solo.
- Node 22 y las dependencias del frontend (`npm ci` en `frontend/`).

## 3. Probar en el emulador

1. **Permitir el origen de la app en el backend.** En tu `.env`:
   `FRONTEND_ORIGIN=http://localhost:3000,https://localhost` y reinicia el backend
   (`docker compose up -d backend`). `https://localhost` es el origen desde el que Android sirve la app.
2. **Levantar la API** en tu computador (`docker compose up -d`; el backend queda en el puerto 8000).
3. **Compilar la web móvil y sincronizarla con el proyecto de Android**, desde `frontend/`:
   ```bash
   npm ci
   npm run mobile:sync:dev
   ```
   Usa por defecto `http://10.0.2.2:8000`, que es tu computador visto desde el emulador. Para otra
   dirección: `MOBILE_API_URL=http://192.168.1.50:8000 npm run mobile:sync:dev` (con un teléfono real,
   la IP de tu computador en la red; ambos deben estar en la misma red).
4. **Abrir en Android Studio y ejecutar:** `npm run mobile:open`, espera a que Gradle sincronice y pulsa
   *Run* sobre el emulador o el teléfono.

Cada vez que cambies el frontend, repite el paso 3 y vuelve a ejecutar desde Android Studio.

## 4. Seguridad: desarrollo y producción

| | Desarrollo (`mobile:sync:dev`) | Producción (`mobile:sync`) |
|---|---|---|
| API | `http://10.0.2.2:8000` (http) | Debe ser **https** (`MOBILE_API_URL=https://...`) |
| Tráfico http y contenido mixto | Permitido (`CAP_DEV=true`) y solo en la compilación *debug* | Bloqueado por Android |
| Copias de seguridad de Android | Desactivadas (`allowBackup=false`) | Desactivadas |

Con la compilación *release* Android bloquea todo el tráfico `http`; si la API no usa https, la app no
podrá conectarse. El token de sesión se guarda en `localStorage` del WebView, que queda dentro de la
carpeta privada de la app y fuera de las copias de seguridad.

## 5. Qué se verificó

En Chromium, con el tamaño de un teléfono (390 × 844 px), cargando el sitio exportado desde un servidor
estático contra el backend y PostgreSQL reales:

- Registro e inicio de sesión desde la interfaz, y redirección a `/inicio/`.
- Navegación directa a `/universidades/` (como al reabrir una pantalla): 24 tarjetas, 55 instituciones.
- Búsqueda «católica»: 7 resultados ordenados por relevancia.
- Sin desbordamiento horizontal, y la URL de la API incrustada en la compilación es la configurada.
- CORS permite `https://localhost` y `http://localhost:3000`, y rechaza otros orígenes (prueba e2e).

