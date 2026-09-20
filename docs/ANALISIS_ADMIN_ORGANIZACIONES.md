# Análisis: CRUD de organizaciones en administración

> Estado: alcance inicial implementado en `feat/admin-organizations-crud` · 20 de septiembre de 2026

## Resumen ejecutivo

El dominio de organizaciones ya está implementado con organizaciones públicas y privadas, propietarios, administradores, miembros, solicitudes, foro, anuncios y auditoría. El CRUD global no debe duplicar las pantallas de gestión de cada organización: debe proporcionar supervisión de plataforma, acceso a organizaciones archivadas y operaciones excepcionales que los administradores locales no pueden realizar.

La propuesta añade `/admin/organizations` con listado completo, creación asistida, consulta de impacto, edición, archivo y restauración. El borrado físico solo se ofrecerá para organizaciones vacías o a través de una acción destructiva explícita, porque las FKs actuales eliminarían en cascada miembros, solicitudes, foro, anuncios y la propia auditoría.

Archivar será la operación habitual. `organizations.archived_at` ya existe y las consultas públicas ya excluyen esas filas, pero faltan acciones administrativas, lectura global de archivadas y trazabilidad de los cambios hechos desde el panel.

## Estado actual

- `organizations` incluye slug, nombre, tipo, acceso, descripción, imágenes, web, ubicación, formatos, creador y `archived_at`.
- `organization_members` distingue `owner`, `admin` y `member`.
- Las solicitudes de acceso tienen estados `pending`, `approved`, `rejected` y `cancelled`.
- El foro admite temas, mensajes, bloqueo, fijado y ocultación.
- Los anuncios solo pueden gestionarlos administradores de la organización o de plataforma.
- `organization_audit_log` registra acciones de membresía y moderación.
- `create_organization()` limita a tres organizaciones activas por creador y convierte al creador en propietario.
- Varias funciones ya reconocen `is_admin()` para moderación y membresías.
- La política pública de `organizations` solo permite leer filas con `archived_at is null`; el administrador global no tiene todavía un listado adecuado de archivadas.
- La configuración ordinaria vive en `/organizations/[slug]/settings` y no debe reemplazarse.

## Separación de responsabilidades

### Administración local

Los propietarios y administradores de una organización seguirán gestionando:

- Información pública y privacidad.
- Solicitudes y miembros.
- Anuncios.
- Moderación cotidiana del foro.

### Administración de plataforma

El nuevo módulo cubrirá:

- Ver cualquier organización, incluso privada o archivada.
- Buscar por nombre, slug, propietario o creador.
- Corregir metadatos inválidos o problemáticos.
- Crear una organización en nombre de un propietario.
- Transferir o asegurar la propiedad.
- Archivar, restaurar y moderar por motivos de plataforma.
- Consultar impacto, actividad y auditoría.
- Borrar físicamente solo cuando sea seguro y deliberado.

Esta separación evita convertir el panel global en una segunda interfaz completa del foro.

## Alcance funcional

### Listado `/admin/organizations`

Cada fila mostrará:

- Nombre, slug, tipo, acceso y estado.
- Propietarios y creador original.
- Número de miembros, solicitudes pendientes, temas y anuncios.
- Fecha de creación y última actualización.
- Motivo y fecha de archivo, si corresponde.

Filtros mínimos: texto, activa/archivada, pública/privada, tipo, formato y existencia de solicitudes pendientes. La consulta debe ser paginada y devolver contadores agregados sin multiplicar filas por los joins.

### Crear

La creación desde administración permitirá seleccionar un propietario inicial. No debe reutilizarse directamente `create_organization()`, porque esa función:

- Hace propietario al usuario que ejecuta la acción.
- Aplica el límite de tres organizaciones al administrador en vez de al propietario objetivo.

Se añadirá una RPC `admin_create_organization` que compruebe `is_admin()`, valide que el propietario existe, cree organización y membresía en una transacción y registre actor y propietario. El límite ordinario podrá ignorarse solo si el formulario lo muestra y exige un motivo.

No se recomienda crear organizaciones sin propietario. Si se admite excepcionalmente, deberán quedar marcadas como «requiere propietario» y no publicarse hasta resolverlo.

### Consultar y editar

La ficha `/admin/organizations/[id]` mostrará:

- Datos generales y estado.
- Propietarios y administradores.
- Contadores y enlaces a miembros, solicitudes, foro y anuncios.
- Últimos eventos de auditoría.
- Zona de moderación de plataforma.

La edición abarcará nombre, tipo, acceso, descripción, imágenes, web, ubicación y formatos. El slug forma parte de URLs públicas; debe tratarse como estable. Si se permite cambiarlo, antes debe existir una tabla de aliases o redirecciones para que enlaces históricos no se rompan.

Se propone una RPC `admin_update_organization` para que validación, auditoría y cambio sean atómicos. La actualización directa actual puede mantenerse para administradores locales, pero los cambios de plataforma deben guardar el motivo y el actor.

### Propiedad y membresías

La ficha permitirá una acción específica de transferencia o incorporación de propietario. Debe conservar estas invariantes:

- Toda organización activa tiene al menos un `owner`.
- El último propietario no puede ser eliminado ni degradado sin asignar otro en la misma transacción.
- Un administrador global no pasa a ser miembro por el mero hecho de editar.
- Transferir propiedad no modifica `created_by`; ese campo representa procedencia histórica.

La gestión exhaustiva de miembros puede enlazar a la pantalla existente. En la primera fase solo hace falta resolver propietarios, expulsar una cuenta por moderación y cancelar solicitudes bloqueadas.

### Archivar y restaurar

Archivar establecerá `archived_at`, `archived_by` y un motivo. Una organización archivada:

- Desaparece del directorio y sus páginas públicas.
- No acepta nuevas membresías ni solicitudes.
- No permite publicar foro o anuncios.
- Conserva datos, membresías y auditoría.
- Sigue visible desde el panel global.

La base actual ya oculta organizaciones archivadas en muchas lecturas, pero las políticas de inserción de temas y anuncios deben comprobar también que la organización esté activa. No basta con ocultar las páginas: las escrituras deben quedar bloqueadas en PostgreSQL.

Restaurar elimina `archived_at` y reactiva la organización conservando sus datos. Si el slug ha sido ocupado —hoy la restricción única lo evita mientras la fila exista— la acción deberá fallar de forma controlada.

Columnas recomendadas:

```sql
alter table public.organizations
  add column archived_by uuid references auth.users(id) on delete set null,
  add column archive_reason text not null default '';
```

### Eliminar

`organizations` es la raíz de un agregado con borrado en cascada sobre membresías, solicitudes, temas, mensajes, anuncios y auditoría. Por eso el borrado físico no debe ser el comportamiento normal.

Se propone `delete_empty_organization(p_id)` como RPC administrativa que bloquee la fila y solo elimine cuando:

- Ya esté archivada.
- No tenga temas, mensajes ni anuncios.
- No tenga solicitudes que deban conservarse.
- Solo conserve, como máximo, la membresía del propietario creada con la organización.

Para organizaciones con contenido, la interfaz ofrecerá únicamente archivo. Si más adelante se requiere borrado completo por cumplimiento, deberá ser un flujo separado con retención o exportación previa y doble confirmación.

## Consultas y modelo de datos

Se propone una función `get_admin_organizations` con `SECURITY DEFINER` que:

- Compruebe `is_admin()` antes de devolver datos.
- Incluya activas y archivadas.
- Aplique paginación y filtros en PostgreSQL.
- Devuelva contadores mediante subconsultas agregadas.
- No exponga mensajes privados ni datos de miembros que el listado no necesita.

El detalle podrá usar `get_admin_organization(p_id)`. Ambas funciones tendrán `search_path = ''`, privilegios revocados por defecto y `EXECUTE` solo para `authenticated`.

La auditoría existente puede ampliarse con estas acciones:

- `organization_created_by_platform_admin`
- `organization_updated_by_platform_admin`
- `organization_archived`
- `organization_restored`
- `organization_owner_added`
- `organization_owner_transferred`
- `organization_deleted`

El evento de borrado no puede almacenarse únicamente en `organization_audit_log`, porque esa tabla se elimina junto con la organización. Los eventos de borrado deben copiarse además a una auditoría global o conservar la fila mediante soft delete.

## Autorización y RLS

- El layout y cada Server Action llamarán a `requireAdminAccess()`.
- Las RPC volverán a comprobar `public.is_admin()`.
- Se añadirá una política de lectura para que administradores consulten organizaciones archivadas.
- Las escrituras administrativas sensibles usarán RPC y no un cliente con `service_role`.
- Las políticas de creación de temas, mensajes y anuncios verificarán que la organización no esté archivada.
- Las operaciones de propiedad bloquearán las filas relevantes con `FOR UPDATE` para evitar dejar cero propietarios por una carrera.
- Los motivos administrativos se validarán con Zod y tendrán longitud limitada también en SQL.

## Cambios previstos en la aplicación

- `src/app/admin/organizations/page.tsx`: listado y filtros.
- `src/app/admin/organizations/new/page.tsx`: alta con propietario.
- `src/app/admin/organizations/[id]/page.tsx`: detalle y edición.
- `src/app/admin/organizations/actions.ts`: acciones administrativas.
- `src/features/admin/organizations.ts`: consultas y tipos.
- `src/features/admin/organizations-schema.ts`: validación Zod.
- Navegación y resumen en `/admin`.
- Migración con columnas de archivo, RPC, auditoría y políticas.

Acciones previstas:

- `createOrganizationAsAdmin`
- `updateOrganizationAsAdmin`
- `addOrganizationOwner`
- `archiveOrganization`
- `restoreOrganization`
- `deleteEmptyOrganization`

Las rutas públicas a revalidar serán `/organizations`, la ruta del slug, foro, anuncios, miembros y las páginas administrativas correspondientes.

## Pruebas necesarias

### SQL

- Un usuario normal no puede consultar organizaciones archivadas.
- Un administrador puede listarlas y restaurarlas.
- Crear como administrador asigna al propietario solicitado, no al actor.
- Una organización activa nunca queda sin propietario.
- Archivar bloquea uniones, solicitudes y contenido nuevo en la base de datos.
- El borrado físico falla cuando existe contenido.
- Toda acción genera auditoría con actor y motivo.

### Unitarias

- Filtros, paginación e identificadores.
- Validación de URLs, slug, formatos y motivo.
- Reglas de archivo, restauración y propietario.
- Traducción de errores de integridad a mensajes comprensibles.

### E2E

- El administrador ve activas y archivadas.
- Crea una organización para otro usuario.
- Edita metadatos y el detalle público se actualiza.
- Archiva y la organización deja de ser accesible públicamente.
- Restaura y conserva miembros y contenido.
- No puede borrar una organización con actividad.

## Orden de implementación

1. Añadir metadatos de archivo y reforzar políticas de escritura.
2. Implementar RPC de lectura administrativa y listado paginado.
3. Añadir detalle y edición auditada.
4. Implementar creación con propietario y operaciones de propiedad.
5. Añadir archivo, restauración y borrado seguro.
6. Completar pruebas SQL, unitarias y E2E.

## Fuera de alcance inicial

- Borrado en cascada de comunidades activas.
- Moderación masiva de todos los mensajes desde el listado.
- Facturación, suscripciones o verificación oficial de organizaciones.
- Fusiones entre organizaciones.
- Cambio de slug sin un sistema de redirecciones.
