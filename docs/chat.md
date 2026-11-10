# Chat 1 a 1 y notificaciones

Mensajería en tiempo real entre **amigos aceptados**, más un centro de notificaciones. El frontend habla
solo con NestJS (HTTP para el historial, Socket.IO para el tiempo real); el servicio Python no interviene.

## Reglas
- Solo se puede chatear con una amistad en estado `accepted`, y se verifica en **cada** mensaje: si la
  amistad se elimina, el envío y la lectura del historial se rechazan (403).
- Mensajes de texto de 1 a 2000 caracteres (se recorta el espacio sobrante).
- Máximo 20 mensajes cada 10 segundos por usuario (ventana deslizante en memoria).
- Un mensaje se considera leído cuando el destinatario abre la conversación (`readAt`).

## Modelo de datos (migración `20261110000000_chat`)
| Tabla | Contenido |
| --- | --- |
| `conversations` | Una por pareja. El par se guarda ordenado (`user_a_id < user_b_id`, restricción `CHECK`) y es único. |
| `messages` | `conversation_id`, `sender_id`, `body` (1–2000, `CHECK`), `created_at`, `read_at`. Índice por conversación y fecha; índice parcial de no leídos. |
| `notifications` | `user_id`, `actor_id`, `type`, `post_id`, `preview`, `read_at`. |

Tipos de notificación: `friend_request`, `friend_accepted`, `post_like`, `post_reply`. Los mensajes
nuevos no se guardan como notificación: el desplegable los muestra a partir de los no leídos de cada chat.

## Conexión Socket.IO
```js
const socket = io(API_URL, { auth: { token } });   // el JWT va en el handshake, no en la URL
```
Sin token válido el servidor emite `chat:error` y cierra. Los orígenes permitidos son los de
`FRONTEND_ORIGIN` (incluye `https://localhost` de la app Android). Cada usuario entra a su sala
privada `user:<id>`, por lo que varias pestañas o dispositivos reciben lo mismo.

### Cliente → servidor (con acuse)
| Evento | Datos | Respuesta |
| --- | --- | --- |
| `chat:send` | `{ to, body }` | `{ ok: true, message }` o `{ ok: false, error }` |
| `chat:read` | `{ with }` | `{ ok: true, updated }` o `{ ok: false, error }` |

### Servidor → cliente
| Evento | Datos |
| --- | --- |
| `chat:message` | `{ id, conversationWith, senderId, body, createdAt, readAt }` (también a las otras pestañas del emisor) |
| `chat:read` | `{ by, readAt }`: tu amigo leyó tus mensajes |
| `chat:read-own` | `{ with }`: leíste desde otra pestaña |
| `presence` | `{ userId, online }`, solo a los amigos |
| `notification:new` | la notificación recién creada |
| `chat:error` | `{ message }` |

## API HTTP (documentada en `/docs`)
- `GET /chat/conversations`: mis amigos con último mensaje, no leídos y `online`.
- `GET /chat/conversations/:friendId/messages?limit&cursor`: historial, más recientes primero.
- `POST /chat/conversations/:friendId/read`
- `GET /notifications?limit&cursor` (incluye `unreadCount`), `POST /notifications/read-all`, `POST /notifications/:id/read`

## Frontend
`components/chat/ChatProvider.jsx` mantiene la conexión, la lista de amigos, las notificaciones y el chat
abierto; al reconectar recarga lo que pudo perderse. La campana (`NotificationsPanel`) y el panel de
amigos (`FriendsPanel`) se abren desde la barra superior; `ChatWindow` es la ventana flotante
minimizable (en móvil ocupa el ancho y queda sobre la barra inferior). El botón **Mensaje** de
"Encontrar amigos" abre el chat con un amigo.

## Pruebas
- `backend/test/chat.int-spec.ts` (PostgreSQL real y `socket.io-client`): autenticación del socket,
  entrega en vivo, solo amigos, validación, límite de frecuencia, amistad eliminada, no leídos,
  paginación, presencia, notificaciones y restricciones de la base.
- `frontend/components/chat/Chat.test.jsx` y `frontend/lib/chat.test.js`.
- Verificación real con dos navegadores (escritorio y móvil de 390 px): mensajes en vivo en ambos
  sentidos, "Leído", historial tras recargar y presencia.

## Perfil de otra persona
`GET /users/:id` devuelve el perfil público (sin correo ni rol) con `friendsCount`, `postsCount` y
`relation` (`null` o `{ id, status, direction }`). Un perfil con visibilidad desactivada lo ven solo su
dueño, sus amigos y quien tenga con él una solicitud pendiente; para el resto responde 404. Las solicitudes
rechazadas no cuentan como relación.

En la web la página es `/estudiante?id=<id>` (por query string porque la app móvil se exporta estática) y se
abre desde las tarjetas de "Encontrar amigos", los autores del foro y sus respuestas, el ícono 👤 de cada
notificación y el encabezado de la ventana de chat. Desde ahí se puede agregar, aceptar o rechazar, quitar
y enviar mensaje.
