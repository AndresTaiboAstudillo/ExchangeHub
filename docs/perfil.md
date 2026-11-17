# Perfil: foto y lista de amigos

## Foto de perfil

- En **Perfil → Cambiar foto** la persona elige una imagen JPG, PNG o WebP (hasta 15 MB). El navegador la **recorta al
  centro en un cuadrado, la reduce a 256 × 256 y la convierte a JPEG** (`frontend/lib/avatarImage.js`): la foto original
  no sale del dispositivo, se pierden los datos EXIF (ubicación, cámara) y lo que se sube pesa unos pocos KB.
- API: `PUT /users/me/avatar` (`{ image: "data:image/jpeg;base64,…" }`) y `DELETE /users/me/avatar`; ambas devuelven el
  perfil propio actualizado. El servidor **no confía en el tipo que declara el cliente**: lo deduce de los primeros bytes
  (JPEG, PNG o WebP), rechaza SVG y cualquier otra cosa, y limita la imagen a **64 KB** (también con una restricción en la
  base).
- `GET /avatars/:id` sirve la imagen **sin sesión**, porque un `<img>` no puede enviar el token. El enlace lleva el id de
  la persona (un UUID) y solo aparece en respuestas a usuarios autenticados. Cuando alguien tiene el **perfil oculto**, su
  foto no se entrega en las reseñas (donde aparece como «Estudiante»). Lleva `Cache-Control: immutable` porque el enlace
  cambia con cada foto (`?v=`), `nosniff` y `Cross-Origin-Resource-Policy: cross-origin` (la app Android la pide desde otro
  origen).
- Base de datos: los bytes viven en `user_avatars` (aparte, para no cargarlos en cada consulta de usuarios) y
  `users.avatar_updated_at` es la versión del enlace (`null` = sin foto). Se elimina junto con la cuenta
  (`ON DELETE CASCADE`), también cuando un administrador elimina un usuario.
- En pantalla: el componente `Avatar` muestra la foto y, si no hay o no carga, la inicial sobre un color propio. Se usa en el
  foro, las reseñas, las tarjetas de estudiantes, el perfil de otras personas, el chat y la barra superior.

## Lista de amigos

- **Perfil → Mis amigos** muestra las amistades aceptadas, ordenadas por nombre, con carrera, país y foto. Cada una abre
  su perfil o el chat. El contador «Amigos» del perfil lleva a esta lista.
- Usa `GET /friendships?status=accepted`, que ahora incluye carrera, país y foto de cada amigo.
- Para quitar a alguien de los amigos sigue sirviendo su tarjeta en Comunidad → Encontrar amigos.

## Limitaciones

- Una foto no se revisa: no hay moderación de contenido. Un administrador puede eliminar la cuenta (y con ella la foto).
- Cualquiera que conozca el id de una persona puede pedir su foto aunque no tenga sesión (los ids no son adivinables y la
  API no los entrega para perfiles ocultos en las reseñas, pero sí en el foro y los listados).
