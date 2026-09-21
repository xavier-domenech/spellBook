# Análisis: CRUD de decklists en administración

> Estado: alcance inicial implementado en `feat/admin-decklists-crud` · 20 de septiembre de 2026

## Implementación realizada

La primera entrega concentra el flujo en `/admin/decklists`: listado y filtros paginados, creación en nombre de un usuario, edición de metadatos, publicación de versiones inmutables, transferencia de propietario, moderación independiente de la visibilidad, archivo/restauración y borrado físico protegido. La previsualización reutiliza el parser de Scryfall y la validación dinámica del formato.

La migración añade RLS diferenciada para público, propietario y administrador; excluye mazos ocultos o archivados de biblioteca y clasificación; y registra todas las acciones privilegiadas. El detalle avanzado con historial y auditoría navegable queda como ampliación posterior, sin bloquear el ciclo CRUD inicial.

## Resumen ejecutivo

Una decklist no es una sola fila editable. `decks` contiene identidad y metadatos, `deck_versions` conserva revisiones, `deck_cards` contiene la lista de cada revisión, `post_decks` fija versiones concretas en publicaciones y el sistema de arquetipos clasifica la versión vigente. Un CRUD administrativo que modifique cartas directamente rompería el historial, los adjuntos y la clasificación.

La propuesta añade `/admin/decklists` para consultar cualquier mazo, crear uno en nombre de un usuario, corregir metadatos, publicar una nueva versión, moderar su visibilidad, archivar/restaurar y eliminar físicamente solo cuando no existan referencias incompatibles. Las cartas de una versión publicada serán inmutables; una edición de lista siempre crea otra versión.

La visibilidad elegida por el propietario (`public`, `unlisted` o `private`) debe separarse del estado de moderación. Si un administrador oculta un mazo sobrescribiendo `visibility`, al restaurarlo no sabría cuál era la preferencia original del propietario.

## Estado actual

- `decks` guarda propietario, título, formato, descripción, visibilidad y número de versión actual.
- `deck_versions` almacena revisiones numeradas y una nota.
- `deck_cards` almacena cartas por zona y versión.
- `post_decks` enlaza una publicación con una versión exacta mediante `ON DELETE RESTRICT` para la versión.
- `create_deck()` crea mazo, primera versión y cartas en una transacción y valida las reglas dinámicas del formato.
- Las RLS actuales permiten al propietario escribir y a otros leer mazos públicos o no listados.
- `deck_library`, clasificación y arquetipos trabajan con `current_version` y mazos públicos.
- La API dispone de creación, previsualización y lectura, pero no de un CRUD administrativo.
- No existe archivo, estado de moderación ni auditoría específica de mazos.

## Principios del módulo

1. **Versiones inmutables.** Nunca se actualizan o reemplazan cartas de una versión publicada.
2. **Preferencia y moderación separadas.** La privacidad del propietario no se destruye al moderar.
3. **Integridad transaccional.** Crear, versionar, cambiar propietario o borrar se realiza mediante RPC.
4. **Historial estable.** Una publicación sigue mostrando la versión que se adjuntó, aunque el mazo tenga una versión más reciente.
5. **Formato coherente.** Una versión nueva debe cumplir las reglas activas del formato.
6. **Acceso mínimo.** Las lecturas administrativas privadas requieren `is_admin()` y no una consulta abierta con `service_role`.

## Alcance funcional

### Listado `/admin/decklists`

La tabla mostrará:

- Título, propietario, formato y visibilidad del propietario.
- Estado de moderación y archivo.
- Versión vigente y número total de versiones.
- Número de cartas y publicaciones que enlazan alguna versión.
- Arquetipo actual, si existe.
- Fecha de creación y última actualización.

Filtros mínimos: texto, propietario, formato, visibilidad, moderación, archivado y existencia de adjuntos. Debe usar paginación de servidor y no cargar cartas completas para el listado.

### Crear

El administrador podrá crear una lista en nombre de un usuario seleccionando:

- Propietario.
- Título, descripción, formato y visibilidad.
- Cartas y zonas, usando el mismo parser y previsualización existentes.
- Nota de la versión inicial.

La función actual `create_deck()` usa `auth.uid()` como propietario, por lo que no sirve para este caso. Se propone `admin_create_deck(p_owner_id, ...)`, que comprobará `is_admin()`, validará propietario y formato, aplicará las mismas reglas cuantitativas, creará versión y cartas y registrará auditoría.

Para evitar dos implementaciones divergentes, la validación e inserción compartidas deberían extraerse a una función SQL interna invocada tanto por `create_deck()` como por `admin_create_deck()`.

### Consultar

La ficha `/admin/decklists/[id]` incluirá:

- Metadatos, propietario y estado.
- Vista de la versión vigente.
- Historial de versiones con nota, fecha, recuento y enlaces de publicaciones.
- Arquetipo y similitud de clasificación.
- Auditoría administrativa.
- Zona de moderación y acciones destructivas.

El administrador podrá consultar también listas privadas y archivadas, pero este permiso no debe ampliar su visibilidad en las rutas públicas.

### Editar metadatos

Título y descripción pueden corregirse sobre `decks`. Visibilidad y formato merecen reglas adicionales:

- La visibilidad es preferencia del propietario. Un administrador solo debería cambiarla por soporte y con motivo; moderación usará otro campo.
- Cambiar formato debe revalidar la versión vigente contra las reglas del nuevo formato y volver a calcular la clasificación.
- Si el formato nuevo no admite la lista actual, la operación debe fallar sin cambios.
- Transferir propietario será una acción separada y auditada, no un campo libre del formulario.
- `current_version` solo puede apuntar a una versión existente del mismo mazo.

Se recomienda que la primera iteración no permita cambiar formato ni propietario desde la edición general. Ambas capacidades pueden añadirse después mediante RPC dedicadas.

### Editar cartas y versionar

Guardar cambios de cartas creará una versión nueva:

1. Bloquear la fila del mazo.
2. Calcular el siguiente número de versión.
3. Validar todas las cartas y cantidades.
4. Insertar `deck_versions` y `deck_cards`.
5. Cambiar `decks.current_version`.
6. Refrescar la asignación de arquetipo.
7. Registrar la acción administrativa.

No se debe borrar la versión anterior. Las publicaciones que apuntan a ella permanecen estables. Volver a una versión anterior puede implementarse creando una nueva copia de esa versión o cambiando el puntero; crear una copia mantiene una secuencia histórica más clara.

### Moderar, archivar y restaurar

Se proponen estados independientes:

```sql
create type public.deck_moderation_status as enum ('visible', 'hidden');

alter table public.decks
  add column moderation_status public.deck_moderation_status not null default 'visible',
  add column moderation_reason text not null default '',
  add column moderated_at timestamptz,
  add column moderated_by uuid references auth.users(id) on delete set null,
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null;
```

Un mazo oculto por moderación no aparecerá en biblioteca, perfil, feed ni API pública, aunque el propietario lo hubiera marcado público. Un mazo archivado se conserva pero queda fuera de listados y no acepta nuevas versiones ordinarias.

Las vistas `deck_library`, `deck_classification_candidates` y cualquier consulta de adjuntos deberán filtrar estos estados. El propietario puede seguir viendo un mazo oculto con un aviso, salvo que la política de seguridad determine lo contrario.

### Eliminar

Eliminar `decks` borra versiones y cartas en cascada. Sin embargo, una versión adjunta a `post_decks` está protegida por `ON DELETE RESTRICT`, por lo que el borrado puede fallar. Esa restricción es correcta: una acción administrativa no debe destruir silenciosamente el contenido histórico de publicaciones.

La estrategia será:

- **Archivar** como acción habitual y reversible.
- **Ocultar** para moderación.
- **Eliminar físicamente** solo si ninguna versión está enlazada desde `post_decks` ni es representante o referencia necesaria de un arquetipo.

La RPC `delete_unreferenced_deck(p_id)` comprobará y eliminará dentro de la misma transacción. Si hay referencias, devolverá contadores para explicar por qué solo puede archivarse. No se ofrecerá eliminación en cascada de publicaciones desde este módulo.

## Modelo de auditoría

```sql
create table public.deck_admin_audit_log (
  id bigint generated by default as identity primary key,
  deck_id uuid references public.decks(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text not null default '',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

`deck_id` usa `ON DELETE SET NULL` para conservar la evidencia de un borrado. La metadata podrá guardar ID del propietario, valores anteriores y nuevos y versión creada, pero no la lista completa de cartas salvo necesidad expresa.

Acciones mínimas: creación administrativa, actualización de metadatos, nueva versión, cambio de formato, transferencia, ocultación, restauración, archivo y borrado.

## Consultas, RPC y RLS

Funciones propuestas:

- `get_admin_decks`: listado paginado y agregado.
- `get_admin_deck`: detalle, versiones y contadores.
- `admin_create_deck`: alta en nombre de un propietario.
- `admin_update_deck_metadata`: corrección controlada.
- `admin_create_deck_version`: nueva versión inmutable.
- `admin_transfer_deck`: cambio explícito de propietario.
- `moderate_deck`: ocultar o restaurar con motivo.
- `archive_deck` y `restore_deck`.
- `delete_unreferenced_deck`: borrado físico seguro.

Todas comprobarán `is_admin()`, usarán `search_path = ''`, revocarán acceso a `anon` y tendrán ejecución limitada a `authenticated`. Las funciones destructivas bloquearán la fila con `FOR UPDATE`.

Las RLS administrativas no deben convertir mazos privados en públicos. Puede añadirse una política de lectura `admins view every deck` y políticas equivalentes sobre versiones y cartas. Las escrituras seguirán pasando por RPC para preservar reglas, versión y auditoría.

## Cambios previstos en la aplicación

- `src/app/admin/decklists/page.tsx`: listado y filtros.
- `src/app/admin/decklists/new/page.tsx`: creación para un usuario.
- `src/app/admin/decklists/[id]/page.tsx`: detalle e historial.
- `src/app/admin/decklists/[id]/edit/page.tsx`: metadatos o nueva versión.
- `src/app/admin/decklists/actions.ts`: Server Actions.
- `src/features/admin/decklists.ts`: consultas y tipos.
- `src/features/admin/decklists-schema.ts`: validación Zod.
- Reutilización de `deck-editor`, parser, preview y validación de formatos.
- Navegación y tarjeta de resumen en `/admin`.
- Migración para estados, auditoría, vistas, políticas y RPC.

La ruta administrativa debería llamarse `decklists` para el usuario, aunque las tablas mantengan el nombre técnico `decks`.

## Impacto en consumidores existentes

El nuevo estado debe aplicarse de forma coherente en:

- Biblioteca y páginas por formato.
- Perfil público del propietario.
- Feed y adjuntos de publicaciones.
- Detalle `/deck/[id]` y API `/api/decks/[id]`.
- Catálogo y refresco de arquetipos.
- Selector de mazo al crear una publicación.
- Exportaciones.

Debe definirse qué ocurre con una publicación pública que adjunta una versión después ocultada. La recomendación es conservar la publicación pero sustituir el adjunto por un aviso «Decklist no disponible», sin filtrar título, cartas ni motivo privado de moderación.

## Pruebas necesarias

### SQL

- Un usuario normal no puede leer una decklist privada ajena.
- Un administrador puede leerla mediante las políticas previstas.
- Crear como administrador asigna el propietario solicitado.
- Cada edición de cartas crea una versión nueva y no muta la anterior.
- Las publicaciones continúan apuntando a la versión original.
- Ocultar o archivar retira la lista de vistas y clasificaciones públicas.
- No se puede borrar un mazo con versiones referenciadas.
- Las operaciones administrativas quedan auditadas.

### Unitarias

- Esquemas de filtros, metadatos, moderación y transferencia.
- Parser y normalización reutilizados por la creación administrativa.
- Validación dinámica contra reglas del formato.
- Traducción de conflictos y referencias a mensajes claros.

### E2E

- El administrador lista mazos públicos, no listados y privados.
- Crea una decklist para otro usuario.
- Corrige título y descripción.
- Publica una segunda versión y puede consultar ambas.
- Oculta la lista y desaparece del directorio sin alterar la preferencia del propietario.
- Archiva y restaura.
- El borrado queda bloqueado cuando una publicación enlaza una versión.

## Orden de implementación

1. Añadir estados y auditoría; adaptar vistas y RLS.
2. Implementar listado y detalle de solo lectura.
3. Añadir edición de metadatos y moderación.
4. Extraer lógica SQL común e implementar creación administrativa.
5. Implementar nueva versión inmutable y refresco de arquetipos.
6. Añadir archivo, restauración, transferencia y borrado seguro.
7. Completar pruebas SQL, unitarias y E2E.

## Fuera de alcance inicial

- Alterar cartas de una versión ya publicada.
- Eliminar automáticamente publicaciones que adjuntan el mazo.
- Reasignar masivamente mazos entre usuarios.
- Validación completa de legalidad de Magic más allá de las reglas disponibles en `formats`.
- Importación masiva o sincronización con servicios externos.
