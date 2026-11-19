# Autenticación y recuperación de contraseña

## Sesión
- Registro (`POST /auth/register`, siempre rol `user`) e inicio de sesión (`POST /auth/login`).
- Contraseñas con bcrypt (10 rondas); si el correo no existe se compara contra un hash falso para que el
  tiempo de respuesta no revele qué correos están registrados.
- Token JWT HS256 de 1 hora (`JWT_EXPIRES_IN_SECONDS`). En cada petición, `JwtAuthGuard` verifica la firma, que la
  cuenta exista y que el token no sea anterior al último cambio de contraseña. El chat (Socket.IO) hace las mismas
  comprobaciones al conectar.

## Límite de intentos
`RateLimitGuard` (en memoria) responde `429` con la cabecera `Retry-After`. Cada 15 minutos:

| Endpoint | Por dirección + correo | Por dirección |
|---|---|---|
| `POST /auth/login` | 10 | 50 |
| `POST /auth/forgot-password` | 3 | 10 |
| `POST /auth/reset-password` | — | 10 |

Detrás de un proxy inverso, define `TRUST_PROXY=1`; si no, todas las personas comparten la IP del proxy.
`RATE_LIMIT_DISABLED=true` lo apaga (solo lo usan las pruebas automáticas).

## Recuperación de contraseña
1. **Pedir el enlace** (`/recuperar` → `POST /auth/forgot-password`). La respuesta es idéntica exista o no el
   correo, y el envío no se espera, para no revelar qué cuentas existen. Si la cuenta existe se crea un token
   aleatorio de 256 bits (`randomBytes(32)`); en la base solo se guarda su **huella HMAC-SHA256** (con una clave derivada de `JWT_SECRET`; si la cambias, los enlaces pendientes dejan de valer)
   (`password_reset_tokens`). Un solo enlace vigente por cuenta: pedir otro anula el anterior.
2. **Correo** con el enlace `…/restablecer?token=…`, de **30 minutos** y un solo uso.
3. **Elegir la contraseña** (`/restablecer` → `POST /auth/reset-password`). El token se consume con un
   `DELETE … WHERE expires_at > now()` dentro de una transacción, de modo que dos usos simultáneos no pasan ambos.
   Enlace inexistente, usado o vencido dan el mismo error.
4. **Efectos**: se guarda el hash nuevo y `users.password_changed_at`; los tokens JWT emitidos antes de ese
   momento dejan de valer, se cierran los sockets abiertos de la cuenta y se envía un aviso de cambio por correo.

## Correo
`MailService` usa nodemailer con `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM`.

- **Pruebas locales**: `docker compose up` incluye **Mailpit**; los correos llegan a http://localhost:8025 sin
  salir a Internet.
- **Producción**: apunta `SMTP_*` a un proveedor real y quita el servicio `mailpit` del compose. Configura SPF/DKIM
  del dominio remitente para que los correos no caigan en spam.
- Sin `SMTP_HOST` no se envía nada: se deja un aviso en el registro (y, fuera de producción, el contenido del correo).
  Los registros nunca incluyen el token y enmascaran el correo (`a***@dominio.cl`).


