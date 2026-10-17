# Análisis: bot importador de decklists de torneos

> Estado: propuesta de diseño · 21 de septiembre de 2026

## Resumen ejecutivo

Spellbook puede incorporar un bot que consulte plataformas de torneos, normalice sus decklists y las publique bajo un usuario técnico. Cada decklist importada mostrará la fuente, torneo, URL del torneo, jugador y posición final sin confundir al jugador externo con el propietario interno del mazo.

La solución no debe ser un scraper universal configurable con cualquier URL. Cada plataforma tiene autenticación, paginación, formatos y modelos diferentes; por ello se propone una arquitectura de **adaptadores permitidos por código** y **fuentes configurables desde administración**. El administrador podrá crear varias instancias de un adaptador —por ejemplo, distintas organizaciones de Melee—, elegir el usuario bot, filtros, frecuencia y estado, pero no ejecutar código ni apuntar el servidor a hosts arbitrarios.

La importación será idempotente. Una misma decklist externa nunca creará duplicados; si la fuente corrige las cartas, Spellbook publicará una nueva versión inmutable del mismo mazo. Los cambios de posición o nombre del torneo actualizarán solo la procedencia.

## Hallazgo decisivo sobre Melee.gg

La interfaz Swagger indicada (`https://melee.gg/swagger/ui/index`) no es suficiente para empezar una integración pública y, desde una consulta sin credenciales, responde con acceso denegado. La documentación oficial de Melee especifica que:

- la API solo está disponible para organizaciones y personal autorizado;
- para datos de una organización ajena se necesita, como mínimo, permiso de **Coverage Staff** en cada torneo u organización;
- el propietario de la organización debe autorizar el acceso;
- Melee entrega un `client_id` y un `client_secret` después de aprobar la solicitud.

Referencia: [API use — Melee.gg Help](https://help.melee.gg/docs/api-use/).

Además, una decklist puede permanecer privada hasta que finalice el torneo o el organizador decida publicarla. El bot solo debe importar listas que la fuente marque como públicas y nunca usar su acceso para adelantar información privada. Referencia: [Decklists, A Help Guide for Organizers](https://help.melee.gg/docs/decklists-a-help-guide-for-organizers/).

Consecuencia: antes de implementar el adaptador real de Melee hay que solicitar acceso, identificar las organizaciones autorizadas y obtener su OpenAPI con credenciales. No recomiendo implementar scraping HTML como alternativa: sería frágil, difícil de probar y podría eludir el modelo de permisos de Melee.

## Estado actual de Spellbook

- `decks` contiene propietario, título, formato, descripción, visibilidad y versión vigente.
- `deck_versions` y `deck_cards` permiten conservar revisiones inmutables.
- Scryfall ya se usa para resolver nombres, IDs Oracle, impresiones e imágenes.
- Existe un cliente `service_role` exclusivamente de servidor.
- `/api/cron/creator-sync` ya ofrece un patrón de cron autenticado mediante `CRON_SECRET` e importación idempotente de eventos.
- El CRUD administrativo de usuarios permite crear la identidad que utilizará el bot.

### Prerrequisito detectado en Git

En la rama `main` actual están el CRUD de usuarios y el CI, pero no aparecen todavía los ficheros del CRUD administrativo de organizaciones y decklists. Las PR apiladas se fusionaron en sus ramas intermedias, no directamente en `main`. Antes de implementar el bot conviene integrar en `main` los commits de organizaciones y decklists, porque el importador debe reutilizar la validación y el versionado administrativo ya diseñados.

## Identidad del bot

El bot tendrá un usuario real de Spellbook, por ejemplo:

- nombre visible: `Spellbook Tournaments`;
- handle: `tournament_bot`;
- cuenta sin rol de administrador;
- cuenta no utilizable para inicio de sesión interactivo;
- indicador público `Bot` o `Cuenta automatizada`.

Recomiendo añadir a `profiles` un tipo de cuenta:

```sql
create type public.profile_account_type as enum ('person', 'bot');

alter table public.profiles
  add column account_type public.profile_account_type not null default 'person';
```

La identidad se creará una vez con la API administrativa de Supabase y un correo interno no entregable. El proceso de importación no iniciará sesión como el bot ni conservará su contraseña: escribirá mediante una RPC restringida a `service_role`, usando el ID del perfil configurado como propietario.

No se debe conceder el rol `admin` al bot. Ser propietario de las decklists y tener permisos de plataforma son responsabilidades distintas.

## Modelo de procedencia

Los datos de torneo no deben introducirse en `description` como texto libre. Necesitan columnas consultables y una relación explícita con la decklist.

### Fuentes

```sql
create table public.deck_import_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider text not null,
  enabled boolean not null default false,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  credential_key text,
  configuration jsonb not null default '{}',
  sync_interval_minutes integer not null default 360,
  next_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`provider` se validará contra una lista mantenida en código (`melee` inicialmente). `configuration` contendrá únicamente opciones no secretas y validadas con un esquema Zod específico para cada proveedor.

### Torneos

```sql
create table public.imported_tournaments (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.deck_import_sources(id) on delete cascade,
  external_id text not null,
  name text not null,
  url text not null,
  format text references public.formats(slug) on delete restrict,
  starts_at timestamptz,
  ends_at timestamptz,
  external_updated_at timestamptz,
  last_seen_at timestamptz not null default now(),
  unique (source_id, external_id)
);
```

### Participaciones y decklists

```sql
create table public.imported_deck_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.imported_tournaments(id) on delete cascade,
  external_entry_id text not null,
  external_deck_id text,
  external_player_id text,
  player_display_name text not null,
  placement integer check (placement is null or placement > 0),
  placement_label text,
  deck_id uuid references public.decks(id) on delete set null,
  imported_version_id uuid references public.deck_versions(id) on delete set null,
  content_hash text,
  status text not null,
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  last_error text,
  imported_at timestamptz,
  last_seen_at timestamptz not null default now(),
  unique (tournament_id, external_entry_id)
);
```

Esta separación permite mostrar en una decklist:

- `Fuente: Melee.gg`;
- `Torneo: Regional Championship Barcelona` con enlace;
- `Jugado por: Nombre público del jugador`;
- `Posición: 3.º` o una etiqueta como `Top 8`;
- fecha del torneo.

`placement` será nullable porque durante el torneo aún puede no existir una posición final. `placement_label` conserva empates, cortes o valores que la fuente no expresa como un ordinal exacto.

### Ejecuciones

`deck_import_runs` registrará inicio, fin, fuente, cursor, número de torneos descubiertos, mazos creados, actualizados, omitidos y fallidos. No guardará credenciales ni respuestas completas con datos personales.

## Jugador externo frente a usuario de Spellbook

El propietario de la decklist será el bot. El jugador se conservará como atribución del torneo en `player_display_name`.

No se debe asociar automáticamente un jugador externo a un perfil de Spellbook comparando nombres: puede haber homónimos o suplantaciones. En una fase posterior puede añadirse `claimed_by_profile_id`, pero solo mediante una vinculación verificada por el usuario o revisión administrativa.

## Arquitectura de conectores

Cada proveedor implementará un contrato común:

```ts
interface DeckSourceAdapter {
  testConnection(source: SourceConfig): Promise<ConnectionResult>;
  discoverTournaments(source: SourceConfig, cursor?: string): Promise<TournamentPage>;
  fetchEntries(source: SourceConfig, tournament: ExternalTournament): Promise<ExternalEntry[]>;
  fetchDeck(source: SourceConfig, entry: ExternalEntry): Promise<ExternalDeck>;
}
```

Todos devolverán un modelo normalizado independiente de la API externa:

- ID y URL del torneo;
- nombre y fechas;
- formato externo;
- ID de participación, jugador y posición;
- zonas y cantidades de cartas;
- marca de publicación y fecha de modificación.

La carpeta propuesta es:

```text
src/features/deck-imports/
  adapters/
    types.ts
    registry.ts
    melee.ts
  normalize.ts
  resolve-cards.ts
  sync.ts
  schemas.ts
```

Añadir un sitio nuevo exigirá implementar y probar su adaptador. El administrador podrá activar y configurar adaptadores disponibles, pero no definir un parser arbitrario desde la interfaz.

## Configuración administrativa

Se añadirá `/admin/import-sources` con:

- nombre interno y proveedor;
- activación o pausa;
- usuario bot propietario;
- estado de credenciales;
- organizaciones o torneos autorizados;
- formatos admitidos y mapeo al slug de Spellbook;
- importar solo torneos finalizados o también torneos en curso;
- límite de posición, por ejemplo Top 8, Top 16 o todos;
- fecha mínima para histórico;
- visibilidad de las decklists importadas;
- intervalo y máximo de elementos por ejecución;
- botones `Probar conexión`, `Ejecutar ahora` y `Reintentar fallidos`;
- último resultado y listado paginado de ejecuciones.

La URL base no será libre. Cada adaptador tendrá hosts HTTPS permitidos, límites de tamaño, timeout y política de redirecciones. Esto evita que un administrador comprometido convierta el importador en una vía SSRF hacia la red interna.

## Credenciales

Para la primera versión recomiendo guardar los secretos en Vercel/Supabase como variables de entorno y almacenar en la fuente solo un alias `credential_key`. Ejemplo:

```dotenv
DECK_IMPORT_CREDENTIALS_ENCRYPTION_KEY=
MELEE_CLIENT_ID=
MELEE_CLIENT_SECRET=
```

Si más adelante se necesita introducir credenciales desde el admin, se cifrarán en servidor con AES-GCM y una clave maestra que solo exista en el entorno. Nunca se almacenarán `client_secret`, tokens ni cabeceras en texto plano, JSON de configuración, auditorías o mensajes de error.

## Flujo de importación

1. Un cron autenticado llama a `/api/cron/deck-import`.
2. El coordinador obtiene fuentes activas cuyo `next_sync_at` haya vencido.
3. El adaptador descubre torneos nuevos o modificados desde su cursor.
4. Solo continúa con eventos y decklists que la fuente permita publicar.
5. Se actualizan torneo y participaciones mediante claves externas únicas.
6. Los nombres de formato se traducen con un mapeo validado; los desconocidos quedan en revisión.
7. Las cartas se resuelven por lotes con Scryfall, usando ID cuando exista y nombre como fallback.
8. Se valida el tamaño del mazo con las reglas dinámicas de Spellbook.
9. Una RPC de importación crea mazo, versión, cartas y procedencia en una sola transacción.
10. El elemento se marca como importado y la ejecución actualiza sus contadores.

El trabajo se procesará en lotes acotados para no depender de una ejecución larga. El cursor y los elementos pendientes permitirán continuar en la siguiente invocación.

## Creación y actualización de decklists

La clave de idempotencia principal será `(tournament_id, external_entry_id)`. Si la fuente proporciona un ID global de decklist también se conservará, pero no se asumirá que todos los proveedores lo hacen.

Se calculará un `content_hash` estable a partir de formato, zona, ID Oracle y cantidad, ordenado antes de aplicar SHA-256:

- entrada desconocida: crear deck y versión 1;
- misma entrada y mismo hash: no crear versión; actualizar posición y metadatos;
- misma entrada y hash distinto: crear una versión inmutable nueva;
- entrada desaparecida: marcar como no encontrada o retirada, sin borrar automáticamente el mazo;
- torneo renombrado o posición corregida: actualizar procedencia sin tocar las cartas.

El importador no podrá usar directamente `admin_create_deck`, porque un proceso con `service_role` no representa a un administrador autenticado y `auth.uid()` será nulo. Se añadirá una RPC específica, revocada de `anon` y `authenticated` y concedida solo a `service_role`. Esa RPC comprobará fuente activa, perfil bot, formato, cartas e idempotencia antes de escribir.

## Resolución con Scryfall

Las fuentes pueden devolver nombres, IDs propios o impresiones. El normalizador seguirá este orden:

1. usar un `scryfall_id` válido si la fuente lo incluye;
2. resolver `oracle_id` o nombre mediante la colección de Scryfall;
3. cachear resultados para evitar consultas repetidas;
4. conservar la impresión seleccionada cuando sea conocida;
5. poner la entrada en revisión si quedan cartas sin resolver.

No se publicará una decklist parcial. Las respuestas de Scryfall se simularán en pruebas y las llamadas reales respetarán identificación, lotes y límites ya aplicados por el proyecto.

## Formato y título

Cada fuente tendrá un mapeo explícito, por ejemplo `Modern -> modern`. Un formato desconocido nunca se creará automáticamente ni se convertirá por aproximación.

Título inicial recomendado:

```text
{nombre del jugador} — {nombre del torneo}
```

Cuando la clasificación de Spellbook identifique un arquetipo, este se mostrará aparte y no sustituirá la atribución original. El nombre público proporcionado por una fuente puede guardarse como metadata, pero no se confiará en él para decidir formato o arquetipo.

## Presentación pública

La página de decklist mostrará un bloque de procedencia antes de las cartas:

```text
Melee.gg · Regional Championship Barcelona
Jugado por Ada Example · 3.ª posición · 14/09/2026
Ver torneo original ↗
```

El perfil propietario mostrará la insignia `Bot`. La biblioteca podrá filtrar `Comunidad` e `Importadas`, pero ambas utilizarán las mismas tarjetas, formatos y clasificación.

Si la fuente se desactiva o pierde credenciales, las decklists ya importadas permanecen visibles. La procedencia histórica no depende de que el conector siga activo.

## Reintentos y observabilidad

- `401/403`: marcar fuente como `needs_attention` y no reintentar continuamente.
- `429`: respetar `Retry-After` y posponer la fuente.
- `5xx` o red: reintento exponencial con límite.
- formato desconocido o carta sin resolver: estado `review`, visible en admin.
- payload inválido: guardar un resumen sanitizado del error, no el cuerpo completo.
- un mazo fallido no aborta el resto del torneo.
- varias ejecuciones simultáneas usarán un bloqueo por fuente para no duplicar trabajo.

Las métricas mínimas serán duración, elementos descubiertos, creados, versionados, sin cambios, omitidos, en revisión y fallidos.

## Seguridad, privacidad y cumplimiento

1. Importar únicamente datos autorizados y públicamente visibles.
2. No almacenar email, teléfono, fecha de nacimiento ni otros datos de inscripción.
3. Guardar solo el nombre público necesario para atribución y los IDs externos imprescindibles.
4. No registrar secretos, tokens ni payloads completos.
5. Mantener `service_role` solo en servidor.
6. Validar todo dato externo con Zod y volver a validarlo en la RPC.
7. Permitir desactivar inmediatamente una fuente.
8. Mantener auditoría de altas, cambios, ejecuciones manuales y reintentos.
9. Respetar límites, condiciones y revocación de acceso de cada proveedor.

## Pruebas

### Unitarias

- normalización de cada adaptador con fixtures sanitizados;
- mapeo de formatos;
- hash estable independientemente del orden de cartas;
- posición y etiquetas de Top 8;
- clasificación de errores reintentables y permanentes;
- rechazo de URLs y configuraciones fuera de la allowlist.

### SQL

- solo `service_role` ejecuta la RPC de importación;
- una entrada repetida no duplica mazo ni versión;
- un cambio de cartas crea una nueva versión;
- un cambio de posición no crea versión;
- la fuente solo puede usar un perfil marcado como bot;
- desactivar la fuente bloquea nuevas escrituras;
- RLS no expone credenciales, errores internos o payloads.

### Integración y E2E

- adaptador falso que no depende de Internet;
- cron sin secreto devuelve `401`;
- creación, pausa, prueba de conexión y ejecución manual desde admin;
- visualización pública de fuente, jugador, torneo, URL y posición;
- reintento de una carta inicialmente no resuelta.

Las pruebas automatizadas no llamarán a Melee ni a Scryfall en vivo. El adaptador real tendrá pruebas de contrato manuales con una organización autorizada y respuestas sanitizadas.

## Plan de implementación

### Fase 0 — Acceso y contrato

1. Solicitar a Melee autorización para las organizaciones concretas.
2. Obtener credenciales de prueba y el OpenAPI accesible.
3. Confirmar endpoints, scopes, paginación, rate limits y campo de publicación.
4. Guardar fixtures sin PII para desarrollar el adaptador.

### Fase 1 — Núcleo independiente de Melee

1. Integrar el CRUD administrativo de decklists pendiente en `main`.
2. Crear y marcar la cuenta bot.
3. Añadir fuentes, torneos, participaciones, ejecuciones y RLS.
4. Implementar RPC idempotente restringida a `service_role`.
5. Mostrar procedencia en el detalle de la decklist.

### Fase 2 — Administración y motor

1. Crear `/admin/import-sources`.
2. Implementar registro de adaptadores y un adaptador fixture.
3. Añadir resolución Scryfall, lotes, cursor, bloqueo y reintentos.
4. Añadir cron y ejecución manual.

### Fase 3 — Melee

1. Generar tipos desde el OpenAPI autorizado.
2. Implementar OAuth/client credentials según el contrato real.
3. Mapear torneos, standings, jugadores, posiciones y decklists.
4. Activar una única organización en modo limitado.
5. Comparar resultados manualmente antes de habilitar publicación automática.

### Fase 4 — Segunda fuente

Implementar otro adaptador para verificar que la abstracción no depende accidentalmente de Melee. Solo entonces conviene generalizar filtros o credenciales compartidas.

## Decisiones recomendadas para la primera versión

- Un único usuario bot compartido, configurable por fuente.
- Solo torneos finalizados y decklists públicas.
- Importar inicialmente Top 8 o Top 16 para limitar volumen.
- Visibilidad pública, con opción de pausa antes de publicar.
- Credenciales en variables de entorno y alias en base de datos.
- Ejecución manual primero; cron después de validar una semana de resultados.
- No enlazar jugadores con usuarios de Spellbook automáticamente.
- No borrar mazos cuando desaparecen de la fuente.

## Preguntas pendientes

1. ¿De qué organizaciones de Melee tenemos autorización o podemos solicitarla?
2. ¿Importamos Top 8, Top 16, Top 32 o todas las listas?
3. ¿Solo torneos finalizados o también eventos en curso cuando las listas sean públicas?
4. ¿Un bot global o un bot distinto por proveedor?
5. ¿Qué formatos se habilitan primero?
6. ¿Las listas se publican automáticamente o pasan por una cola de revisión?
7. ¿Durante cuánto tiempo conservamos errores y metadata técnica de importación?

La recomendación inicial es Melee autorizado + formatos construidos + torneos finalizados + Top 8 + revisión manual durante el piloto.
