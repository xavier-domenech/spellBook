# Integración verificada de creadores

## Objetivo

Permitir que un usuario vincule sus canales de YouTube y Twitch a su perfil y, más adelante, publicar automáticamente en su nombre cuando suba un vídeo o empiece un directo. Un enlace escrito manualmente no se considera prueba de propiedad.

## Decisión de identidad

La vinculación requiere OAuth en cada plataforma. YouTube se valida leyendo el canal de la cuenta autenticada con `channels.list?mine=true` y el alcance mínimo `youtube.readonly`. Twitch se valida obteniendo la cuenta propietaria desde `GET /helix/users` con el token de la autorización. Los tokens OAuth se usan únicamente durante el callback y no se guardan en la base de datos.

La tabla `creator_channels` guarda el `external_id`, nombre, URL, plataforma, fecha de verificación y consentimiento `auto_publish`. Tiene una restricción única por plataforma y canal para impedir que un mismo canal quede asociado a dos perfiles.

## Flujo implementado

Desde `/settings/profile`, el usuario inicia `Conectar YouTube` o `Conectar Twitch`. Spellbook crea un estado aleatorio en una cookie HttpOnly, valida ese estado en el callback, consulta la identidad real del canal y guarda únicamente sus datos públicos verificados. El usuario puede desconectar el canal o activar/desactivar el permiso de publicación automática.

## Alertas automáticas implementadas

El endpoint `GET/POST /api/cron/creator-sync` está protegido por `CRON_SECRET`. Consulta el feed RSS público de YouTube y el estado actual de Twitch mediante un token de aplicación. Solo procesa canales con `auto_publish=true`.

Cada evento se guarda en `creator_events` con una clave única `(platform, external_event_id)`, por lo que repetir el cron no duplica mensajes. El post se crea con el `author_id` del perfil verificado y un enlace al vídeo/directo. Si falla, el evento queda pendiente y conserva el último error para reintentar en la siguiente ejecución.

El permiso se puede desactivar desde el perfil sin desconectar la identidad.

Los webhooks deberán validar firmas, responder rápido y ser idempotentes. El post debe mostrar que es automático para no confundir una alerta del sistema con una publicación escrita manualmente.

## Configuración necesaria

```env
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

Configura un cron externo (por ejemplo, cada 5 minutos) con `Authorization: Bearer <CRON_SECRET>` contra `/api/cron/creator-sync`. La clave de servicio de Supabase solo debe existir en el servidor.

Las aplicaciones de Google y Twitch deben declarar estos callbacks, sustituyendo el dominio:

```text
https://<dominio>/api/integrations/youtube/callback
https://<dominio>/api/integrations/twitch/callback
```

Los tokens, secretos de cliente y credenciales no se guardan en Git ni se exponen al navegador.
