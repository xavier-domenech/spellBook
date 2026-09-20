# Análisis: CRUD de formatos en administración

> Estado: implementado en `feat/admin-format-crud` · 20 de septiembre de 2026

La implementación conserva temporalmente `profiles.favorite_formats` y `organizations.formats` por compatibilidad, pero los sincroniza mediante triggers con `profile_formats` y `organization_formats`. Estas relaciones son las que aportan integridad referencial y bloquean el borrado de formatos utilizados. Los arrays podrán retirarse en una migración posterior sin bloquear el CRUD actual.

## Resumen ejecutivo

Añadir un CRUD de formatos no consiste únicamente en crear una pantalla de administración. Actualmente los formatos (`commander`, `standard`, `modern` y `pioneer`) están codificados como una lista fija en la aplicación, en restricciones SQL y en funciones de validación. También se guardan como texto en mazos y arquetipos, y como arrays en perfiles y organizaciones.

La solución recomendada es convertir los formatos en un catálogo central administrado desde la base de datos. El panel podrá crear, consultar, editar, ordenar, archivar y reactivar formatos. La eliminación física solo debe permitirse cuando el formato no tenga ninguna referencia. Para formatos utilizados, la operación equivalente a «eliminar» será archivarlos: dejan de estar disponibles para contenido nuevo, pero los mazos, arquetipos, perfiles, organizaciones y URLs existentes siguen funcionando.

La implementación debe hacerse por fases para que nunca exista un formato visible en administración que el resto de la aplicación no sepa validar.

## Estado actual

### Catálogo duplicado

Los cuatro formatos están repetidos en varios puntos:

- `src/features/decks/validation.ts`: unión TypeScript, tamaño de mazo y tratamiento especial de Commander.
- `src/features/decks/formats.ts`: nombre, descripción y texto sobre el tamaño.
- `src/features/social/schemas.ts`: validación de formatos favoritos.
- `src/app/api/decks/route.ts`: validación del formato al guardar un mazo.
- `src/components/deck-editor.tsx`: opciones del selector.
- Ajustes de perfil y formularios de organizaciones: listas de checkboxes fijas.
- `decks.format` y `archetypes.format`: columnas de texto con restricciones cerradas.
- `profiles.favorite_formats` y `organizations.formats`: arrays de texto.
- `create_deck`: reglas SQL fijas para Commander y formatos construidos.
- Consultas de arquetipos: lógica especial para la zona de comandante.

Esto implica que añadir un formato solamente desde el panel produciría datos que algunas pantallas rechazarían y que la función SQL no sabría validar.

### Administración existente

El área `/admin` ya dispone de una base adecuada:

- El layout ejecuta `requireAdminAccess()`.
- El rol `admin` se almacena separado del perfil público.
- La autorización real se verifica también en Supabase mediante `is_admin()` y RLS.
- El módulo de arquetipos proporciona el patrón de Server Components, Server Actions, Zod, mensajes de resultado y revalidación.

El nuevo módulo debe reutilizar este sistema, no introducir una segunda clase de administrador.

## Alcance funcional propuesto

### Listado `/admin/formats`

La página mostrará todos los formatos, incluidos los archivados, con:

- Nombre y slug.
- Estado: activo o archivado.
- Orden de aparición.
- Resumen de las reglas de construcción.
- Número de mazos, arquetipos, perfiles y organizaciones relacionados.
- Acciones para editar, archivar/reactivar y eliminar cuando sea seguro.

Los filtros mínimos serán estado y búsqueda por nombre o slug. El resumen de `/admin` y la navegación del layout incluirán el módulo «Formatos».

### Crear

Un administrador podrá definir:

- Nombre público.
- Slug estable para URLs y relaciones.
- Descripción del directorio.
- Texto corto de las reglas.
- Orden de presentación.
- Límites de mazo principal, comandantes y total de cartas.
- Estado inicial, activo o archivado.

El slug debe usar minúsculas, números y guiones, y ser único. No debería poder modificarse después de crear el formato, porque forma parte de URLs públicas y puede estar referenciado por contenido histórico.

### Consultar y editar

Podrán cambiarse el nombre, las descripciones, las reglas cuantitativas, el orden y el estado. La edición deberá registrar `updated_at` y `updated_by`.

Cambiar una regla no debe invalidar ni eliminar mazos existentes. La regla nueva se aplicará al crear nuevas listas o nuevas versiones; los contenidos históricos seguirán siendo legibles.

### Archivar y reactivar

Archivar será la operación habitual para retirar un formato:

- No aparecerá en selectores de nuevos mazos, perfiles u organizaciones.
- No permitirá crear mazos ni arquetipos nuevos.
- Mantendrá accesibles sus mazos, arquetipos y rutas existentes.
- Seguirá mostrando su nombre correcto donde haya contenido histórico.
- Podrá reactivarse sin pérdida de datos.

La interfaz debe pedir confirmación e indicar cuántos registros dependen del formato.

### Eliminar

La eliminación física solo estará disponible si no existen referencias. La comprobación y la eliminación deben ser atómicas en la base de datos. Si otro proceso crea una referencia entre la comprobación visual y la confirmación, la FK debe impedir la eliminación.

Para un formato utilizado, el botón será «Archivar», no «Eliminar». No se recomienda ofrecer eliminación en cascada desde este CRUD.

## Modelo de datos recomendado

### Tabla `formats`

```sql
create table public.formats (
  slug text primary key,
  name text not null,
  description text not null default '',
  rules_summary text not null default '',
  mainboard_min smallint not null,
  mainboard_max smallint,
  commander_min smallint not null default 0,
  commander_max smallint not null default 0,
  total_min smallint not null,
  total_max smallint,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
```

Las restricciones comprobarán que los mínimos no sean negativos, que cada máximo sea mayor o igual que su mínimo y que los límites sean razonables. Un límite máximo nulo significa «sin máximo».

Ejemplos:

| Formato | Principal | Comandantes | Total |
| --- | --- | --- | --- |
| Commander | 98–99 | 1–2 | exactamente 100 |
| Standard | mínimo 60 | 0 | mínimo 60 |
| Modern | mínimo 60 | 0 | mínimo 60 |
| Pioneer | mínimo 60 | 0 | mínimo 60 |

Este modelo cubre las reglas que la aplicación valida hoy. Reglas de legalidad más avanzadas —cartas prohibidas, rotaciones, límites distintos a cuatro copias o identidad de color— quedan fuera de este CRUD y requerirán un subsistema propio.

### Relaciones

- `decks.format` debe convertirse en FK a `formats.slug` con `ON UPDATE RESTRICT` y `ON DELETE RESTRICT`.
- `archetypes.format` debe usar la misma FK.
- `profiles.favorite_formats` debería migrarse a `profile_formats(profile_id, format_slug)`.
- `organizations.formats` debería migrarse a `organization_formats(organization_id, format_slug)`.

Normalizar los dos arrays permite aplicar integridad referencial, contar usos y evitar slugs inexistentes. Mantener arrays obligaría a añadir triggers de validación y complicaría tanto las consultas como la eliminación.

### Auditoría

Además de `created_by` y `updated_by`, es recomendable una tabla `format_audit_log` con formato, administrador, acción y una instantánea JSON de los valores anteriores y nuevos. Como mínimo deben auditarse creación, cambio de reglas, archivo, reactivación y eliminación.

## Reglas de autorización y RLS

- Usuarios anónimos y autenticados podrán leer el catálogo necesario para la interfaz pública.
- Los listados públicos cargarán por defecto solo formatos activos.
- Los formatos archivados podrán leerse cuando sea necesario resolver contenido histórico.
- Solo `is_admin()` podrá insertar o actualizar.
- La eliminación se realizará mediante una función RPC `delete_unused_format`, no mediante un `DELETE` abierto al cliente.
- Las funciones administrativas validarán de nuevo el rol, aunque la página ya esté protegida.
- Se revocarán los privilegios de escritura generales y se concederán únicamente las columnas necesarias o la ejecución de RPC concretas.

Las reglas críticas —formato activo, límites del mazo y ausencia de referencias antes de eliminar— deben residir también en PostgreSQL. La validación del navegador solo mejora la experiencia y nunca será el control definitivo.

## Cambios en la aplicación

### Fuente única de formatos

Se añadirá un cargador server-only, por ejemplo `src/features/formats/data.ts`, con operaciones para:

- Obtener formatos activos ordenados.
- Obtener todos los formatos para administración.
- Resolver un formato por slug, incluido si está archivado.
- Obtener contadores de uso.

Los componentes recibirán el catálogo como datos. Ya no se utilizará un `z.enum` estático para validar formatos dinámicos: se validará primero la forma del slug con Zod y después su existencia y estado contra Supabase.

El tipo de dominio puede ser `string` o un tipo marcado `FormatSlug`; no debe prometer en compilación que el conjunto de filas de la base de datos es una unión fija conocida al construir la aplicación.

### Validación de mazos

`validateDeckSize` pasará a recibir las reglas del formato:

```ts
validateDeckSize(rules, cards)
```

La API obtendrá el formato activo y sus reglas antes de aceptar el mazo. `create_deck` volverá a consultar la misma fila dentro de la transacción para evitar carreras o peticiones manipuladas. Si el formato se archiva entre la carga del formulario y el guardado, la base de datos rechazará la creación con un mensaje controlado.

### Consumidores que deben migrarse

- Directorio y rutas `/decks/[format]`.
- Editor de mazos y API de creación.
- Validación y catálogo de arquetipos.
- Filtros del administrador de arquetipos.
- Preferencias y búsqueda de usuarios.
- Creación y ajustes de organizaciones.
- Seeds, tests SQL, unitarios y E2E.
- Clases visuales específicas por slug; los formatos nuevos necesitan un estilo neutro por defecto.

Los formatos archivados no aparecerán en formularios nuevos, pero las vistas de detalle deberán resolverlos para representar datos existentes.

## Interfaz administrativa

Se propone una pantalla de lista con formulario separado para crear y editar:

- `/admin/formats`: listado, filtros y acciones de estado.
- `/admin/formats/new`: alta.
- `/admin/formats/[slug]`: edición y contadores de impacto.

En la edición, el slug se mostrará como solo lectura. Las acciones destructivas estarán en una zona separada. Antes de archivar o eliminar se mostrará el impacto y se solicitará escribir el slug como confirmación si existen muchas referencias.

Las Server Actions previstas son:

- `createFormat`
- `updateFormat`
- `archiveFormat`
- `reactivateFormat`
- `deleteUnusedFormat`

Todas usarán esquemas Zod, `requireAdminAccess()`, operaciones protegidas por RLS/RPC y revalidación de `/admin`, `/admin/formats`, `/decks` y las rutas afectadas.

## Estrategia de migración

### Fase 1: catálogo aditivo

1. Crear `formats` y sembrar las cuatro filas existentes.
2. Añadir FKs de `decks` y `archetypes` después de comprobar los valores actuales.
3. Cambiar `create_deck` para leer reglas del catálogo.
4. Mantener temporalmente la interfaz fija; las cuatro filas existentes son compatibles.

### Fase 2: consumidores dinámicos

1. Crear el módulo de dominio de formatos.
2. Migrar directorio, editor, perfiles, organizaciones y administración de arquetipos.
3. Sustituir las uniones y enums estáticos por validación contra el catálogo.
4. Añadir un estilo visual genérico para slugs nuevos.

### Fase 3: normalización

1. Crear `profile_formats` y `organization_formats`.
2. Copiar y validar los arrays existentes.
3. Cambiar lecturas y escrituras de la aplicación.
4. Eliminar los arrays y sus restricciones cerradas cuando ya no tengan consumidores.

### Fase 4: habilitar el CRUD

El módulo de administración debe activarse únicamente cuando todos los consumidores sean dinámicos. Así se evita que un administrador cree un formato válido en la base de datos que una versión anterior de la aplicación rechace.

## Tratamiento de despliegues y compatibilidad

La migración inicial es compatible hacia atrás porque conserva los slugs actuales. En producción conviene desplegar en este orden:

1. Migración aditiva y seed del catálogo.
2. Aplicación capaz de leer formatos dinámicos.
3. Migración de arrays a relaciones.
4. Activación de las acciones de creación y borrado en administración.

No debe eliminarse ninguna restricción antes de que exista su sustitución mediante FK, RLS o validación transaccional.

## Pruebas necesarias

### SQL

- Un usuario normal puede leer formatos, pero no crearlos ni modificarlos.
- Un administrador puede crear, editar, archivar y reactivar.
- No se puede crear un mazo con formato inexistente o archivado.
- Las reglas cuantitativas se aplican dentro de `create_deck`.
- No puede eliminarse un formato referenciado.
- Puede eliminarse uno sin referencias.
- Las relaciones de perfiles y organizaciones no admiten slugs inexistentes.
- El registro de auditoría identifica al administrador y la acción.

### Unitarias

- Esquemas de creación y edición.
- Combinaciones válidas e inválidas de límites.
- Validación genérica de tamaños de mazo.
- Transformación de errores de integridad a mensajes comprensibles.

### E2E

- El administrador crea un formato y aparece en los selectores públicos.
- Edita el nombre y las reglas sin cambiar el slug.
- Archiva el formato: desaparece de altas nuevas, pero sus URLs históricas funcionan.
- Reactiva el formato.
- La eliminación queda bloqueada cuando tiene contenido.
- Un usuario sin rol recibe `404` al acceder al módulo, igual que en el resto de `/admin`.

## Criterios de aceptación

1. El catálogo de formatos tiene una única fuente de verdad en Supabase.
2. Todos los selectores y filtros consumen formatos activos desde el catálogo.
3. Los formatos archivados conservan íntegro el contenido histórico.
4. Ninguna operación administrativa depende solo de ocultar botones en la interfaz.
5. La creación de mazos valida las reglas en aplicación y en base de datos.
6. No puede eliminarse un formato con referencias.
7. Los cambios quedan auditados.
8. Un formato nuevo funciona sin modificar y recompilar una lista fija de slugs.
9. Un reset limpio reproduce catálogo, relaciones y permisos.
10. Lint, tipos, tests unitarios, SQL, build y E2E pasan.

## Riesgos y decisiones pendientes

- **Borrado:** se recomienda archivo como operación normal y borrado físico solo sin referencias.
- **Slug:** se recomienda inmutable; permitir cambiarlo exige redirecciones permanentes y actualización coordinada de relaciones y URLs.
- **Reglas oficiales:** este CRUD administra reglas básicas de tamaño, no la legalidad completa de Magic.
- **Rotaciones:** Standard puede necesitar en el futuro vigencia o versiones de reglas. No debe añadirse al primer alcance sin una necesidad funcional concreta.
- **Caché:** el catálogo es pequeño y cacheable, pero cualquier mutación administrativa debe invalidar sus consumidores.
- **Despliegue:** habilitar el alta antes de migrar todos los consumidores rompería los nuevos formatos.

## Recomendación final

Implementar primero el catálogo y la lectura dinámica; después exponer el CRUD. Para la primera versión administrativa, «eliminar» debe significar archivar salvo que el formato no tenga ningún uso. Esta decisión mantiene la integridad histórica y reduce el riesgo técnico sin limitar la gestión diaria.
