# Análisis: CRUD de usuarios en administración

> Estado: alcance inicial implementado en `feat/admin-users-crud` · 20 de septiembre de 2026

## Resumen ejecutivo

El usuario está dividido actualmente entre `auth.users`, que contiene la identidad y las credenciales gestionadas por Supabase Auth, y `public.profiles`, que contiene el perfil visible. Por ese motivo no es seguro implementar este módulo como un CRUD directo sobre una única tabla.

La propuesta es añadir `/admin/users` como consola de gestión de cuentas. Permitirá buscar y consultar usuarios, crear una cuenta por invitación, editar el perfil público, gestionar el rol de plataforma y suspender o reactivar el acceso. La eliminación física debe reservarse para cuentas sin dependencias o para un flujo explícito de anonimización, porque el borrado de un perfil puede eliminar publicaciones y mazos, afectar membresías y fallar si una versión de mazo está enlazada desde publicaciones.

La operación habitual equivalente a «eliminar» será suspender. La identidad seguirá existiendo, pero no podrá iniciar sesión ni generar contenido. Todas las acciones administrativas quedarán auditadas.

## Estado actual

- `auth.users` es la fuente de email, confirmación, último acceso y estado de autenticación.
- `public.profiles` referencia `auth.users(id)` con `ON DELETE CASCADE` y guarda `handle`, nombre, biografía, avatar y formatos favoritos.
- El trigger `handle_new_user()` crea automáticamente el perfil al registrar una identidad.
- Los roles de plataforma están en `public.user_roles`; actualmente solo existe `admin`.
- `requireAdminAccess()` protege el layout y las acciones del área administrativa.
- `src/lib/supabase/admin.ts` dispone de un cliente con `SUPABASE_SERVICE_ROLE_KEY`, que ya está documentada como variable exclusivamente de servidor.
- Los perfiles son legibles públicamente, pero el navegador no puede ni debe consultar emails ni metadatos privados de `auth.users`.
- No existe aún un estado público de cuenta, historial de moderación ni flujo de borrado administrativo.

## Decisiones funcionales

### Listado `/admin/users`

La vista mostrará una tabla paginada con:

- Avatar, nombre, handle y email.
- Estado: pendiente de confirmar, activo o suspendido.
- Roles de plataforma.
- Fecha de alta y último acceso.
- Contadores de mazos, publicaciones y organizaciones.
- Acciones rápidas para consultar, suspender o reactivar.

Los filtros mínimos serán búsqueda por email, handle o nombre; estado; rol; fecha de alta y existencia de contenido. La paginación debe ejecutarse en servidor. No se cargará toda la tabla de Auth para filtrar en memoria.

### Crear

La creación administrativa recomendada es una invitación por email:

1. El administrador introduce email, nombre visible y, opcionalmente, handle y rol.
2. El servidor usa la API administrativa de Supabase Auth para enviar la invitación o crear una identidad confirmada según una opción explícita.
3. El trigger crea `public.profiles`.
4. Una operación posterior actualiza el perfil y asigna los roles solicitados.

No se debe mostrar ni almacenar una contraseña generada. Para producción, «Invitar» debe ser la opción predeterminada. «Crear ya confirmada» puede quedar restringida a datos de prueba o soporte y debe obligar al usuario a establecer su contraseña mediante recuperación.

El proceso cruza Auth y PostgreSQL y no puede ser una única transacción. Si falla la configuración del perfil tras crear la identidad, la acción debe registrar el error y permitir reintentar la sincronización; no debe crear una segunda identidad.

### Consultar y editar

La ficha `/admin/users/[id]` separará claramente:

- Identidad: email, confirmación y último acceso, solo lectura salvo una acción específica de cambio de email.
- Perfil público: handle, nombre, biografía, avatar y formatos favoritos.
- Acceso: estado de suspensión y roles.
- Actividad: mazos, publicaciones, organizaciones y solicitudes recientes.
- Auditoría administrativa.

El administrador podrá corregir el perfil público. El cambio de email será una acción independiente que respete el comportamiento de confirmación configurado en Supabase. No se ofrecerá lectura de contraseñas —Supabase tampoco las expone— ni edición directa de hashes.

### Roles de plataforma

Asignar o retirar `admin` necesita una función transaccional, no un `insert` directo desde la interfaz. Debe impedir:

- Que se retire el último administrador.
- Que un administrador se retire a sí mismo si es el único que puede recuperar el sistema.
- Duplicados de rol.
- Que una cuenta suspendida conserve sesiones privilegiadas sin revocar.

La función registrará actor, usuario objetivo, rol, acción y fecha. Si en el futuro aparecen más roles, el formulario se alimentará del enum o catálogo vigente.

### Suspender y reactivar

Suspender una cuenta debe bloquear el inicio de sesión mediante la API administrativa de Auth y reflejar el estado en una tabla pública de administración. Mantener ambos datos permite filtrar y auditar sin consultar internamente `auth.users` desde SQL de aplicación.

Se propone `user_admin_state`:

```sql
create type public.user_account_status as enum ('active', 'suspended', 'anonymized');

create table public.user_admin_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status public.user_account_status not null default 'active',
  reason text not null default '',
  suspended_until timestamptz,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);
```

El bloqueo real seguirá perteneciendo a Supabase Auth. `user_admin_state` es una proyección operativa y de auditoría, no un sustituto del bloqueo. Las acciones deben revocar sesiones al suspender cuando la API lo permita.

### Eliminar o anonimizar

Un borrado directo de `auth.users` provoca el borrado en cascada del perfil y, a través de él, de publicaciones, relaciones sociales, mazos y membresías. Además, `post_decks.deck_version_id` usa `ON DELETE RESTRICT`: un mazo enlazado por una publicación ajena puede impedir el borrado de sus versiones.

Por ello se proponen dos niveles:

1. **Suspender**, reversible y apropiado para moderación.
2. **Anonimizar y cerrar**, irreversible, para una solicitud legítima de eliminación.

La anonimización debe ejecutarse mediante un flujo específico que:

- Capture un resumen previo en la auditoría, sin copiar secretos.
- Retire email, nombre, bio, avatar y conexiones externas.
- Cambie el handle a un identificador no reutilizable.
- Decida qué contenido se elimina y cuál se conserva con autor anónimo.
- Resuelva de forma explícita mazos adjuntos a publicaciones y organizaciones sin otro propietario.
- Elimine finalmente la identidad de Auth solo si todas las dependencias están resueltas.

No se recomienda un botón «Eliminar en cascada» en la primera versión del CRUD.

## Arquitectura y seguridad

El flujo para cualquier acción sensible será:

1. La Server Action valida la entrada con Zod.
2. `requireAdminAccess()` comprueba la sesión y el rol usando el cliente del usuario.
3. Solo entonces se crea el cliente administrativo para operaciones de Auth.
4. Las modificaciones de datos públicos se hacen mediante RPC que vuelve a comprobar `is_admin()` y registra la auditoría.
5. Se revalidan las rutas afectadas.

`SUPABASE_SERVICE_ROLE_KEY` nunca se importará desde un Client Component, nunca llevará prefijo `NEXT_PUBLIC_` y nunca se enviará al navegador. El hecho de tener una sesión de administrador no debe dar acceso genérico al cliente de servicio.

Para evitar que la clave de servicio suprima accidentalmente todas las protecciones RLS, el código que la utiliza se limitará a un módulo server-only dedicado a Auth. Las mutaciones ordinarias se harán con el cliente de sesión y RPC protegidas.

## Modelo de auditoría

Se propone una tabla independiente, ya que `organization_audit_log` solo cubre organizaciones:

```sql
create table public.admin_user_audit_log (
  id bigint generated by default as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text not null default '',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

No se guardarán contraseñas, tokens, hashes, claves ni una copia completa de `auth.users`. En `metadata` solo se incluirán los campos modificados y sus valores administrativos seguros.

## Cambios previstos en la aplicación

- `src/app/admin/users/page.tsx`: listado, filtros y paginación.
- `src/app/admin/users/new/page.tsx`: invitación o alta controlada.
- `src/app/admin/users/[id]/page.tsx`: detalle, edición, roles y estado.
- `src/app/admin/users/actions.ts`: Server Actions de orquestación.
- `src/features/admin/users-schema.ts`: esquemas Zod.
- `src/features/admin/users.ts`: consultas y modelos de vista.
- `src/lib/supabase/auth-admin.ts`: envoltorio server-only de las operaciones de Auth.
- Navegación y tarjeta de resumen en `/admin`.
- Nueva migración para estado, auditoría, RPC y políticas.

Acciones previstas:

- `inviteUser`
- `updateUserProfile`
- `requestUserEmailChange`
- `setUserRole`
- `suspendUser`
- `reactivateUser`
- `anonymizeUser` en una fase posterior

## Pruebas necesarias

### SQL

- Un usuario normal no puede listar estados ni auditoría administrativa.
- Un administrador puede editar un perfil y gestionar roles mediante RPC.
- No se puede retirar el último rol `admin`.
- Toda mutación genera una entrada de auditoría.
- La suspensión pública no puede ser alterada por el propio usuario.

### Unitarias

- Validación de búsqueda, paginación, email, handle y motivo.
- Traducción segura de errores de Auth.
- Cálculo de estados a partir de confirmación, bloqueo y estado administrativo.
- Reglas para cambios de rol y protección del último administrador.

### E2E

- Un no administrador no accede a `/admin/users`.
- Un administrador invita un usuario y encuentra la cuenta en el listado.
- Edita nombre y handle y el perfil público refleja el cambio.
- Suspende y reactiva la cuenta.
- No puede eliminar o degradar al último administrador.

## Orden de implementación

1. Crear estado y auditoría con sus políticas y pruebas SQL.
2. Implementar listado paginado y ficha de solo lectura.
3. Añadir edición de perfil y roles mediante RPC.
4. Integrar invitación y suspensión con la API administrativa de Auth.
5. Añadir contadores, filtros y pruebas E2E.
6. Diseñar e implementar la anonimización como flujo separado.

## Fuera de alcance inicial

- Leer o recuperar contraseñas existentes.
- Suplantar sesiones de usuarios.
- Borrado masivo.
- Exportaciones completas de datos personales.
- Moderar cada publicación o mazo desde la ficha; esos contenidos enlazarán a sus propios módulos administrativos.
