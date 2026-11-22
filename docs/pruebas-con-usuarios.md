# Pruebas con usuarios: compartir la app con un solo túnel (ngrok)

El frontend y el backend se publican por el mismo dirección usando el servicio `proxy` de `docker-compose.yml`
(Caddy, `infra/proxy/Caddyfile`): las páginas van al frontend y las rutas de la API y de Socket.IO al backend.
Así basta **un** túnel y una sola dirección, que es lo que permite el plan gratuito de ngrok (un dominio).

```
persona ──https──► ngrok ──► localhost:8080 (proxy) ──┬─► backend:8000  (/auth, /users, /posts, /socket.io…)
                                                      └─► frontend:3000 (todo lo demás)
```

## Pasos
1. En el `.env` de la raíz, con **tu dominio de ngrok** (ngrok lo muestra en su panel, "Domains"):
   ```
   NEXT_PUBLIC_API_URL=https://TU-DOMINIO.ngrok-free.dev
   FRONTEND_ORIGIN=http://localhost:3000,https://TU-DOMINIO.ngrok-free.dev
   FRONTEND_URL=https://TU-DOMINIO.ngrok-free.dev
   TRUST_PROXY=2
   ```
   (Sin barra final. La misma dirección va en `NEXT_PUBLIC_API_URL` y en `FRONTEND_URL`.)
2. `docker compose up -d --build` (hay que reconstruir: `NEXT_PUBLIC_API_URL` se graba al compilar el frontend).
3. En otra terminal: `ngrok http 8080` (puerto del proxy, no 3000 ni 8000). Con un dominio reservado:
   `ngrok http --url=TU-DOMINIO.ngrok-free.dev 8080`.
4. Comparte `https://TU-DOMINIO.ngrok-free.dev`. La primera vez, ngrok (plan gratuito) muestra una pantalla de aviso
   con un botón «Visit Site»; después no vuelve a aparecer en ese navegador.

## Qué queda público y qué no
- Salen por el túnel solo las rutas que usa la app (incluidas `/health` y `/health/ready`). `/metrics`, `/python` y la documentación `/docs` no: para esas, usa `http://localhost:8000` en tu propio equipo.
- Los correos (recuperar contraseña) siguen yendo a Mailpit (`http://localhost:8025`, solo tu computador) salvo que
  configures un SMTP real (`SMTP_*`). No expongas Mailpit: cualquiera podría leer los enlaces de recuperación.
- Mientras el túnel esté abierto, cualquiera con la dirección puede registrarse y usar la app. Ciérralo al terminar.
- La app Android compilada usa la dirección con que se construyó; este túnel sirve para la versión web.

## Después
Para volver al uso local, quita `NEXT_PUBLIC_API_URL` (o ponla en `http://localhost:8000`) y `TRUST_PROXY`, y reconstruye.
