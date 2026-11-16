# Administración

Sección **⚙️ Administración** (`/administracion`), visible solo para personas con `users.role = 'admin'`. Por ahora
tiene una única acción: **eliminar a una persona por su correo**.

## Cómo se usa
1. Escribe el correo y pulsa **Eliminar usuario**. No elimina todavía: muestra a quién corresponde y cuánto contenido
   se perdería (publicaciones, comentarios, reseñas, arriendos y mensajes).
2. Confirma con **Sí, eliminar definitivamente** o cancela. No se puede deshacer.

## Qué se elimina
La cuenta y todo lo que dejó, en una sola transacción (la base lo hace en cascada):
publicaciones (con sus comentarios y "me gusta"), comentarios y "me gusta" en publicaciones ajenas, reseñas,
amistades y solicitudes, notificaciones, y las **conversaciones de chat completas** (también desaparecen los
mensajes que la otra persona escribió en ellas). Si publicó arriendos, se eliminan junto con las reseñas que otras
personas les dejaron (esa referencia no tiene clave foránea, así que se borra explícitamente).

## Reglas de seguridad
- Solo administradores: `GET` y `DELETE /admin/users?email=` responden 401 sin sesión y 403 a quien no lo sea. El rol se
  lee de la base en cada llamada.
- No se puede eliminar **la propia cuenta** ni la de **otro administrador** (409): hay que quitarle antes el rol
  (ver `docs/mapa.md`, "Cómo hacer administrador a un usuario").
- El correo se compara sin importar mayúsculas ni espacios.
- Queda un registro `user_deleted` con el id del administrador y el de la cuenta eliminada (nunca el correo).

## Sesiones de la persona eliminada
Un token firmado sigue siendo válido hasta que expira, por eso `JwtAuthGuard` comprueba en cada llamada que la cuenta
todavía exista (una consulta por clave primaria): si no existe responde 401 "La cuenta ya no existe" y la app cierra
la sesión. El chat en tiempo real también lo comprueba al conectar, y al eliminar se cortan sus conexiones abiertas.
La persona no puede volver a iniciar sesión, pero sí podría **registrarse de nuevo con el mismo correo**: eliminar no
es un bloqueo. (Para impedirlo habría que desactivar la cuenta en lugar de borrarla; ver `docs/limitaciones.md`.)
