# Análisis y propuesta: organizaciones

> Estado: propuesta funcional y técnica · 19 de septiembre de 2026

## Resumen ejecutivo

La sección de organizaciones permitirá agrupar comunidades que hoy quedarían fuera de una relación simple entre usuarios: ligas, equipos, asociaciones, tiendas, clubes y otros colectivos de *Magic: The Gathering*. Cada organización tendrá una identidad propia, miembros con roles, un foro general y un tablón de anuncios.

El modelo de acceso propuesto es:

- **Organización pública:** cualquier usuario autenticado puede unirse de forma inmediata.
- **Organización privada:** el usuario envía una solicitud y un administrador debe aprobarla antes de que obtenga acceso.

Crear una organización convierte al usuario en su **propietario**. El propietario puede nombrar administradores; los administradores gestionan solicitudes, miembros, foro y anuncios. Los miembros pueden participar en el foro, pero no publicar en el tablón.

La recomendación es implementar las organizaciones como un dominio separado de las publicaciones sociales actuales. Reutilizar la tabla `posts` para el foro mezclaría permisos, visibilidad, moderación y ciclos de vida distintos. Las tablas específicas permiten expresar las reglas mediante RLS sin debilitar la seguridad del feed general.

## Objetivo de producto

La sección debe resolver cuatro necesidades:

1. Dar una presencia estable a una comunidad dentro de Spellbook.
2. Permitir que los usuarios descubran organizaciones y se incorporen a ellas.
3. Ofrecer un espacio de conversación persistente para los miembros.
4. Separar las comunicaciones oficiales de la conversación general.

Una liga como la [LLiga Catalana d'Old School](https://oldschool.cat/) sirve como referencia del tipo de comunidad que debe caber en el sistema. Su web reúne identidad, reglas, ubicación, torneos, historias y reconocimiento a miembros. El primer MVP de Spellbook no necesita replicar todas esas áreas, pero el modelo no debe impedir añadir posteriormente reglas, eventos, clasificaciones o páginas propias.

## Terminología y decisiones de alcance

### Pública y privada

En esta propuesta, “pública” y “privada” describen principalmente la **política de incorporación**:

| Tipo | Descubrimiento | Incorporación | Contenido interno |
| --- | --- | --- | --- |
| Pública | Aparece en el directorio | Inmediata al pulsar `Unirse` | Los miembros publican en el foro |
| Privada | Aparece en el directorio con información básica | Requiere solicitud y aprobación | Solo los miembros activos acceden al foro y al tablón |

Para una organización pública, la portada y el tablón pueden ser legibles sin ser miembro, lo que resulta útil para ligas que quieren difundir normas y novedades. Escribir en el foro seguirá requiriendo membresía; “todo el mundo puede publicar” se interpreta como **todo miembro activo**, no cualquier visitante ni usuario anónimo.

Si en el futuro se necesitan organizaciones secretas que no aparezcan en búsquedas, conviene añadir una propiedad independiente de descubrimiento (`listed`/`unlisted`). No debe sobrecargarse la política de incorporación con ese segundo significado.

### Tipos de organización

El tipo ayuda a presentar y filtrar el directorio, pero no cambia los permisos:

- `league`: liga o circuito recurrente.
- `team`: equipo de jugadores.
- `club`: asociación, club o comunidad local.
- `store`: comunidad vinculada a una tienda.
- `community`: colectivo general, grupo online u otra comunidad.

La interfaz mostrará etiquetas traducidas. El valor persistido debe ser estable y no depender del idioma.

### Roles internos

Los roles de organización son distintos del rol global `admin` de Spellbook:

| Rol | Capacidades principales |
| --- | --- |
| `owner` | Todo lo de un administrador, transferir propiedad, archivar la organización y gestionar administradores |
| `admin` | Editar información, revisar solicitudes, gestionar miembros, moderar el foro y publicar anuncios |
| `member` | Leer las áreas internas, crear temas, responder y abandonar la organización |

El creador recibe `owner` en la misma transacción que crea la organización. Siempre debe existir al menos un propietario. Un propietario no puede salir ni ser eliminado hasta transferir la propiedad o nombrar otro propietario.

Un administrador de una organización no obtiene permisos globales sobre Spellbook. Los administradores globales sí deben conservar capacidad de intervención ante abuso, mediante acciones auditadas.

## Experiencia de usuario

### Directorio

La ruta `/organizations` mostrará un directorio con:

- búsqueda por nombre;
- filtros por tipo y política de acceso;
- nombre, avatar, descripción breve y número de miembros;
- estado del usuario: no miembro, solicitud pendiente, miembro o administrador;
- paginación por cursor para evitar límites de listas grandes.

Una primera versión puede ordenar por actividad reciente y, como desempate, por nombre. Un ranking de popularidad deberá esperar a disponer de métricas reales.

### Creación

Un usuario autenticado podrá crear una organización desde `/organizations/new` indicando:

- nombre;
- identificador URL (`slug`), sugerido a partir del nombre y editable;
- tipo;
- descripción;
- pública o privada;
- ubicación opcional;
- web externa opcional;
- formatos de Magic relacionados, opcionales.

El servidor validará todos los campos con Zod. La creación de la organización y de la membresía `owner` debe realizarse en una única función transaccional de PostgreSQL para impedir organizaciones sin propietario.

Para reducir spam, el MVP puede limitar el número de organizaciones creadas por una cuenta y aplicar un intervalo mínimo entre creaciones. Más adelante se puede exigir correo verificado, antigüedad mínima o aprobación global cuando el uso real lo justifique.

### Incorporación pública

1. El usuario visita la organización.
2. Pulsa `Unirse`.
3. Una función de base de datos comprueba que la organización está activa, es pública y el usuario no pertenece ya a ella.
4. Se crea una membresía `member` de forma idempotente.
5. El usuario obtiene acceso inmediato al foro.

La interfaz debe soportar dobles pulsaciones sin crear duplicados.

### Solicitud privada

1. El usuario visita la portada pública limitada.
2. Pulsa `Solicitar acceso` y puede añadir un mensaje breve opcional.
3. La solicitud queda `pending` y el usuario puede cancelarla.
4. Propietarios y administradores ven la cola de solicitudes.
5. Al aprobar, una transacción crea la membresía y marca la solicitud como `approved`.
6. Al rechazar, se registra quién tomó la decisión y cuándo.

Solo puede existir una solicitud pendiente por usuario y organización. Tras un rechazo conviene aplicar un periodo de espera antes de permitir otra solicitud, para evitar spam. El valor inicial recomendado es de siete días, configurable posteriormente.

### Gestión de miembros

Los administradores podrán:

- aprobar o rechazar solicitudes;
- retirar a un miembro;
- promover miembros a `admin`;
- degradar administradores a `member`;
- consultar el historial básico de incorporación.

Solo un propietario podrá otorgar o retirar el rol `owner`. La transferencia y los cambios de rol sensibles deben pedir confirmación explícita. El propietario no debe poder degradarse si eso deja la organización sin propietarios.

Un miembro podrá abandonar voluntariamente la organización. Expulsar o abandonar elimina la membresía, pero no debe borrar el contenido histórico: los mensajes permanecen atribuidos al perfil salvo que sean moderados o que la política de eliminación de cuenta exija anonimización.

## Foro general

El foro tendrá temas y respuestas, en lugar de una única conversación interminable:

- cualquier miembro activo puede crear un tema;
- cualquier miembro activo puede responder a temas abiertos;
- el autor puede editar o eliminar su contenido dentro de las reglas del producto;
- administradores pueden fijar, cerrar, ocultar o retirar temas y respuestas;
- los temas se ordenan por fijados y actividad más reciente;
- las respuestas se ordenan cronológicamente y se paginan.

El MVP no necesita canales, categorías, chat en tiempo real ni respuestas anidadas ilimitadas. Un nivel de cita o `reply_to` opcional es suficiente para conservar contexto sin complicar la lectura.

El contenido debe validar longitud, normalizar espacios y mostrarse como texto seguro. Markdown, adjuntos e imágenes pueden añadirse después con reglas específicas de sanitización y almacenamiento.

## Tablón de anuncios

El tablón representa la comunicación oficial:

- solo `owner` y `admin` pueden crear, editar, fijar o retirar anuncios;
- cada anuncio guarda autor y fechas de creación y actualización;
- los anuncios pueden incluir título y cuerpo;
- los miembros no pueden responder en el propio tablón durante el MVP;
- un administrador puede crear un tema de foro relacionado y enlazarlo si desea conversación.

En organizaciones públicas, el tablón será legible por cualquier visitante. En organizaciones privadas, solo los miembros activos podrán leerlo. Esta regla permite que una liga pública use Spellbook como escaparate informativo sin abrir su foro a usuarios que no se hayan incorporado.

## Modelo de datos propuesto

### Enumeraciones

```sql
organization_kind        = league | team | club | store | community
organization_access      = public | private
organization_member_role = owner | admin | member
join_request_status      = pending | approved | rejected | cancelled
forum_content_status     = published | hidden
```

Los nombres definitivos pueden ajustarse antes de crear la migración. Deben evitarse valores traducidos en la base de datos.

### `organizations`

```text
id                uuid primary key
slug              citext unique
name              text
kind              organization_kind
access            organization_access
description       text
avatar_url        text nullable
banner_url        text nullable
website_url       text nullable
location          text nullable
formats           text[]
created_by        uuid -> profiles.id
created_at        timestamptz
updated_at        timestamptz
archived_at       timestamptz nullable
```

`slug` debe aceptar únicamente caracteres URL seguros y tener una longitud limitada. `created_by` conserva auditoría, pero la autorización real procede de `organization_members`; no debe tratarse como sustituto del rol `owner`.

### `organization_members`

```text
organization_id   uuid -> organizations.id
user_id            uuid -> profiles.id
role               organization_member_role
joined_at          timestamptz
invited_by         uuid nullable -> profiles.id
primary key (organization_id, user_id)
```

La tabla contiene solo membresías activas. Separarla de las solicitudes simplifica consultas y evita que un registro `rejected` sea confundido con un miembro.

### `organization_join_requests`

```text
id                uuid primary key
organization_id   uuid -> organizations.id
requester_id      uuid -> profiles.id
message           text
status            join_request_status
reviewed_by       uuid nullable -> profiles.id
reviewed_at       timestamptz nullable
created_at        timestamptz
updated_at        timestamptz
```

Debe existir un índice único parcial para impedir más de una solicitud `pending` por usuario y organización. El historial de solicitudes rechazadas se conserva para moderación y control de abuso.

### `organization_forum_topics`

```text
id                uuid primary key
organization_id   uuid -> organizations.id
author_id         uuid -> profiles.id
title             text
status            forum_content_status
is_pinned         boolean
is_locked         boolean
last_activity_at  timestamptz
created_at        timestamptz
updated_at        timestamptz
```

### `organization_forum_messages`

```text
id                uuid primary key
topic_id          uuid -> organization_forum_topics.id
author_id         uuid -> profiles.id
reply_to_id       uuid nullable -> organization_forum_messages.id
body              text
status            forum_content_status
created_at        timestamptz
updated_at        timestamptz
```

Separar temas y mensajes facilita fijar y cerrar conversaciones, calcular actividad y paginar respuestas. `reply_to_id` solo podrá señalar un mensaje del mismo tema; conviene garantizarlo en una función o trigger, no confiar únicamente en el formulario.

### `organization_announcements`

```text
id                uuid primary key
organization_id   uuid -> organizations.id
author_id         uuid -> profiles.id
title             text
body              text
is_pinned         boolean
published_at      timestamptz
created_at        timestamptz
updated_at        timestamptz
```

### Auditoría recomendada

Una tabla `organization_audit_log` debería registrar al menos:

- cambios de rol;
- aprobaciones y rechazos;
- expulsiones;
- cambios de acceso público/privado;
- acciones de moderación;
- transferencia de propiedad y archivo.

El historial será visible para propietarios y administradores de la organización y para administradores globales. No se expondrá a miembros ordinarios.

## Funciones transaccionales

Las operaciones sensibles no deben componerse desde el navegador con varios `insert` o `update`. Se proponen funciones RPC con `security definer`, `search_path = ''`, validación interna y permisos mínimos:

- `create_organization(...)`: crea organización y propietario.
- `join_public_organization(organization_id)`: crea una membresía abierta.
- `request_organization_access(organization_id, message)`: crea una solicitud privada.
- `review_organization_request(request_id, decision)`: aprueba o rechaza; la aprobación crea la membresía.
- `change_organization_member_role(organization_id, user_id, role)`: protege al último propietario.
- `remove_organization_member(organization_id, user_id)`: distingue abandono y expulsión.
- `transfer_organization_ownership(organization_id, user_id)`: transfiere de forma atómica.

Las funciones deben ser idempotentes cuando sea razonable y bloquear las filas relevantes durante aprobaciones o transferencias para evitar condiciones de carrera.

## Autorización y RLS

Todas las tablas tendrán RLS activado. La autorización debe aplicarse en la aplicación y repetirse en PostgreSQL.

Funciones auxiliares sugeridas:

```text
is_organization_member(organization_id, user_id default auth.uid())
has_organization_role(organization_id, roles[], user_id default auth.uid())
can_view_organization_content(organization_id, user_id default auth.uid())
```

Estas funciones deben evitar recursión sobre las políticas de `organization_members`; el patrón apropiado es `security definer`, `set search_path = ''`, permisos revocados a `anon` y ejecución concedida solo cuando corresponda.

Reglas principales:

- La información básica de organizaciones activas es legible públicamente.
- El foro privado solo es legible por miembros activos.
- El foro público puede ser legible públicamente, pero solo miembros activos pueden escribir.
- Los anuncios públicos son legibles por todos; los privados, solo por miembros.
- Solo el autor puede editar su mensaje ordinario; administradores pueden ocultarlo mediante una acción moderada.
- Solo propietarios y administradores pueden mutar anuncios.
- Las solicitudes son visibles para su solicitante y administradores de esa organización.
- La lista completa de miembros privados solo es visible para miembros; el recuento agregado puede ser público.
- Nadie puede insertar directamente una membresía con rol elevado desde el cliente.
- El rol global `admin` puede intervenir mediante rutas y funciones separadas y auditadas.

Cambiar una organización de pública a privada no expulsa miembros actuales. Cambiarla de privada a pública no aprueba automáticamente solicitudes pendientes; los administradores podrán aprobarlas o cancelarlas de forma explícita.

## Rutas y organización del código

Rutas propuestas:

```text
/organizations
/organizations/new
/organizations/[slug]
/organizations/[slug]/forum
/organizations/[slug]/forum/[topicId]
/organizations/[slug]/announcements
/organizations/[slug]/members
/organizations/[slug]/requests
/organizations/[slug]/settings
```

La URL técnica se mantiene en inglés, como las rutas actuales `users`, `decks` y `settings`; la interfaz visible puede mostrar “Organizaciones”.

Estructura de dominio:

```text
src/features/organizations/
  access.ts
  actions.ts
  queries.ts
  schemas.ts
  types.ts
  *.test.ts

src/app/organizations/
  page.tsx
  new/page.tsx
  [slug]/...
```

Los Server Components cargarán datos con la sesión del usuario. Las Server Actions validarán entradas con Zod y comprobarán permisos antes de llamar a las funciones de base de datos. La clave `service_role` no participará en acciones ordinarias de organizaciones.

## Navegación y estados de interfaz

La portada debe adaptar sus acciones al estado del visitante:

| Estado | Acción principal |
| --- | --- |
| Anónimo | `Inicia sesión para unirte` |
| No miembro, pública | `Unirse` |
| No miembro, privada | `Solicitar acceso` |
| Solicitud pendiente | `Solicitud pendiente` y opción de cancelar |
| Miembro | `Ir al foro` |
| Administrador | `Administrar organización` |

El encabezado mostrará nombre, tipo, acceso, ubicación, formatos, web y recuento de miembros. Las pestañas visibles dependerán de RLS y del rol, pero ocultar una pestaña nunca sustituye la autorización del servidor.

## Notificaciones

El dominio necesita notificaciones internas para que el flujo privado sea usable:

- nueva solicitud para propietarios y administradores;
- solicitud aprobada o rechazada para el solicitante;
- promoción o degradación de rol;
- expulsión;
- nuevo anuncio para miembros, opcionalmente.

Como el esquema actual todavía no incluye una tabla general de notificaciones, hay dos alternativas:

1. Añadir `notifications` como infraestructura compartida para toda la red social.
2. Empezar con indicadores dentro de la organización y añadir notificaciones globales en una fase posterior.

La primera opción es más coherente a medio plazo, pero no debe bloquear el MVP si se prioriza el flujo esencial. Los correos por cada actividad quedan fuera de la primera versión y requerirían preferencias, colas y un SMTP de producción.

## Moderación, seguridad y abuso

- Limitar creación de organizaciones, solicitudes, temas y mensajes por usuario e IP.
- Validar URLs externas y no renderizar HTML aportado por usuarios.
- Aplicar límites de longitud en Zod y en restricciones SQL.
- Usar archivo lógico para organizaciones y contenido moderado; el borrado físico puede romper auditorías.
- Registrar actor, acción, objetivo, motivo y fecha en moderación.
- Permitir denunciar una organización, un tema o un mensaje al equipo global de Spellbook.
- Impedir que un administrador expulsado conserve acceso mediante comprobaciones basadas en membresía actual, no en datos cacheados de larga duración.
- Evitar que una organización use nombres o imágenes que suplanten a otra comunidad; el `slug` único no es suficiente como verificación de identidad.

Los bloqueos personales existentes requieren una decisión específica. La recomendación inicial es ocultar o atenuar mensajes de usuarios bloqueados dentro del foro, pero no permitir que un bloqueo individual impida recibir anuncios oficiales o gestionar solicitudes. Esta interacción debe cubrirse con pruebas antes del lanzamiento.

## Rendimiento e índices

Índices mínimos:

```text
organizations (slug)
organizations (kind, access, created_at desc)
organization_members (user_id, joined_at desc)
organization_members (organization_id, role)
organization_join_requests (organization_id, status, created_at)
organization_forum_topics (organization_id, is_pinned desc, last_activity_at desc)
organization_forum_messages (topic_id, created_at, id)
organization_announcements (organization_id, is_pinned desc, published_at desc)
```

El recuento de miembros puede calcularse al principio con un índice adecuado. Solo debe desnormalizarse cuando las métricas demuestren que la agregación es un cuello de botella. Temas, mensajes, miembros y organizaciones se paginarán; no se cargarán listas completas.

## Pruebas necesarias

### Base de datos y RLS

- un anónimo ve la portada pública pero no escribe;
- un no miembro no lee contenido de una organización privada;
- un usuario se une de inmediato a una organización pública;
- una organización privada crea una solicitud, no una membresía;
- un miembro no puede aprobar su propia solicitud ni ascenderse;
- un administrador aprueba una solicitud y se crea una única membresía;
- dos aprobaciones concurrentes no duplican miembros;
- el último propietario no puede abandonar ni degradarse;
- un miembro expulsado pierde acceso inmediatamente;
- solo administradores crean anuncios;
- cambiar el identificador de una petición no permite actuar sobre otra organización.

### Unitarias

- validación de nombre, slug, descripción, mensaje y URLs;
- traducción de rol a capacidades;
- construcción de rutas y estados de botones;
- reglas de cambio de acceso y propiedad.

### E2E

1. Crear organización pública → otro usuario se une → crea tema → responde.
2. Crear organización privada → solicitar acceso → aprobar → acceder al foro.
3. Promover administrador → publicar anuncio → verificar lectura según acceso.
4. Expulsar miembro → comprobar que foro y acciones dejan de estar disponibles.
5. Transferir propiedad → antiguo propietario conserva únicamente el rol elegido.

## MVP recomendado

### Incluido

- directorio y búsqueda básica;
- creación y edición de organizaciones;
- tipos de organización;
- acceso público o privado;
- propietario, administradores y miembros;
- solicitudes, aprobación, rechazo, cancelación y abandono;
- foro con temas y respuestas;
- fijado y cierre de temas por administradores;
- tablón de anuncios;
- RLS, auditoría mínima y pruebas críticas;
- diseño responsive.

### Pospuesto

- invitaciones directas;
- organizaciones ocultas o por enlace;
- canales y categorías de foro;
- chat en tiempo real;
- eventos, torneos, emparejamientos y clasificaciones;
- cuotas, pagos y suscripciones;
- páginas personalizadas de reglas o historia;
- calendario y asistencia;
- archivos adjuntos y galería;
- insignias de organizaciones verificadas;
- dominio personalizado;
- API pública y federación.

## Evolución para ligas y equipos

El caso de `oldschool.cat` sugiere extensiones naturales:

- `organization_events` para torneos y reuniones;
- `organization_pages` para reglas, historia y secciones editoriales;
- temporadas, jornadas, resultados y clasificación para ligas;
- roster, capitanes y resultados colectivos para equipos;
- ubicaciones habituales y enlaces a inscripción;
- insignia de organización verificada para comunidades oficiales.

Estas funciones deben construirse sobre la membresía y los roles comunes. No conviene añadir columnas específicas de torneos a `organizations`, porque equipos, tiendas y comunidades no compartirán esas necesidades.

## Plan de implementación

| Fase | Resultado |
| --- | --- |
| 1. Dominio y seguridad | migración, enumeraciones, tablas, funciones, índices y pruebas RLS |
| 2. Directorio y creación | navegación, listado, portada, alta y edición básica |
| 3. Membresías | unión pública, solicitudes privadas, administración y roles |
| 4. Comunicación | foro general, moderación y tablón de anuncios |
| 5. Integración | notificaciones, denuncias, E2E, accesibilidad y rendimiento |

La migración y las pruebas RLS deben preceder a la interfaz. Los permisos son el núcleo de la función y corregirlos después de construir las pantallas aumenta el riesgo de filtraciones entre organizaciones.

## Decisiones pendientes antes de implementar

1. ¿El foro de una organización pública puede leerse sin ser miembro, o debe ser interno en todos los casos?
2. ¿Los anuncios de una organización pública deben mostrarse también en el feed social general?
3. ¿Un usuario puede crear organizaciones sin límite o se establece un máximo inicial?
4. ¿Los administradores pueden eliminar contenido o solo ocultarlo conservando auditoría?
5. ¿Se necesitan invitaciones privadas en el MVP, además de solicitudes iniciadas por usuarios?
6. ¿Qué tipos iniciales se mostrarán: liga, equipo, club, tienda y comunidad?
7. ¿Las organizaciones podrán tener logo desde el primer lanzamiento o se utilizarán iniciales hasta incorporar Supabase Storage?

Si no se toman otras decisiones, la implementación debería asumir: foro público legible pero escritura reservada a miembros, anuncios públicos fuera del feed general, máximo de tres organizaciones creadas por usuario, moderación mediante ocultación, invitaciones pospuestas, los cinco tipos indicados y avatares basados en iniciales durante el MVP.
