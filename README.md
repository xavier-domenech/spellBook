# Spellbook

Spellbook es una red social para jugadores de *Magic: The Gathering*. Combina perfiles, publicaciones y seguimiento de usuarios con decklists nativas, exploración por formatos y arquetipos, e integración con Scryfall para consultar cartas e imágenes.

> [!NOTE]
> El proyecto se encuentra en desarrollo activo. Las APIs, el esquema de datos y la experiencia de usuario pueden cambiar.

## Qué incluye

- Registro e inicio de sesión mediante Supabase Auth.
- Feed general y feed de cuentas seguidas.
- Perfiles públicos, seguimiento de usuarios, favoritos y reposts.
- Directorio de jugadores con búsqueda y filtros por formato favorito.
- Importación de decklists en formato Magic Arena.
- Soporte para `Commander`, `Deck`, `Sideboard` y `Maybeboard`.
- Versiones inmutables de mazos y decklists adjuntas a publicaciones.
- Directorios por formato, arquetipos y estado de clasificación.
- Visor lateral de mazos y exportación a Magic Arena.
- Integración con Scryfall para resolver cartas, legalidades e imágenes.
- Canales verificados de creadores e integraciones opcionales con YouTube y Twitch.
- Administración protegida por roles y políticas Row Level Security (RLS).

## Tecnologías

- Next.js 16 con App Router
- React 19 y TypeScript
- Tailwind CSS 4
- Supabase (PostgreSQL, Auth y RLS)
- Zod
- Vitest y Playwright
- Scryfall API

## Requisitos

- Node.js 20 o posterior
- npm
- Docker

## Puesta en marcha

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Inicia Supabase local:

   ```bash
   npm run supabase:start
   ```

3. Copia la plantilla de configuración:

   ```bash
   cp .env.example .env.local
   ```

4. Sustituye en `.env.local` la URL y la clave pública de Supabase por los valores mostrados por:

   ```bash
   npx supabase status
   ```

5. Inicia la aplicación:

   ```bash
   npm run dev
   ```

La web estará disponible en <http://localhost:3000> y Supabase Studio en <http://127.0.0.1:54323>.

Las credenciales de YouTube y Twitch son opcionales para el desarrollo básico. `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` solo deben estar disponibles en el servidor; nunca deben exponerse en el cliente ni incluirse en Git.

## Comandos útiles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo. |
| `npm run build` | Genera el build de producción. |
| `npm run lint` | Ejecuta ESLint. |
| `npm run typecheck` | Comprueba los tipos de TypeScript. |
| `npm test` | Ejecuta las pruebas unitarias. |
| `npm run test:e2e` | Ejecuta las pruebas E2E con Playwright. |
| `npm run supabase:start` | Inicia Supabase local. |
| `npm run supabase:stop` | Detiene Supabase local. |
| `npm run supabase:reset` | Recrea la base de datos y elimina los datos locales. |

## Estructura del proyecto

```text
src/app/                 Rutas, páginas, Server Actions y endpoints
src/components/          Componentes reutilizables de interfaz
src/features/            Lógica de dominio y pruebas unitarias
src/lib/                 Configuración y clientes de infraestructura
supabase/migrations/     Esquema, funciones y políticas RLS
supabase/tests/          Pruebas de integración SQL
tests/e2e/               Recorridos de navegador con Playwright
```

Las decisiones iniciales de producto y arquitectura están recogidas en [ANALISIS_MAGIC_SOCIAL.md](./docs/ANALISIS_MAGIC_SOCIAL.md). El diseño de las integraciones de creadores está documentado en [ANALISIS_CREADORES.md](./docs/ANALISIS_CREADORES.md).

## Calidad y seguridad

Antes de proponer cambios, ejecuta:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx supabase db lint --local
```

Todo input externo se valida con Zod. El acceso a datos se comprueba tanto en la aplicación como mediante RLS. Las peticiones a Scryfall se identifican, se almacenan en caché cuando corresponde y respetan sus límites de uso.

## Contribuciones

Las contribuciones son bienvenidas. Abre primero un issue para cambios de alcance significativo y acompaña cada pull request con una explicación del comportamiento, las comprobaciones realizadas y capturas cuando modifique la interfaz.

Usa mensajes de commit siguiendo [Conventional Commits](https://www.conventionalcommits.org/), por ejemplo `feat: add deck versioning` o `fix: enforce post ownership`.

## Aviso legal

Spellbook es un proyecto comunitario no oficial y no está afiliado ni respaldado por Wizards of the Coast. *Magic: The Gathering* y sus marcas relacionadas pertenecen a sus respectivos titulares. Los datos e imágenes de cartas se obtienen de [Scryfall](https://scryfall.com/docs/api).
