# AGENTS.md

## Qué es este proyecto

593games es una plataforma de juegos digitales de marketing/fidelización para negocios locales. Un cliente
recibe un código de parte de un negocio, lo canjea en la página principal y el navegador ejecuta directamente
el archivo del juego (HTML autocontenido) o abre un PDF. No hay apuestas, dinero real ni mecánicas de azar —
cualquier cambio debe preservar ese encuadre (copys, disclaimers, UI).

## Arquitectura

- **Sitio estático** en `public/` — sin build step, servido tal cual por Netlify.
- **Funciones serverless** en `netlify/functions/*.mts` (Netlify Functions v2, formato de exportación con
  `export default` + `export const config`).
- **Base de datos**: Netlify Database (Postgres) vía Drizzle ORM. El esquema vive en `db/schema.ts`; el cliente
  en `db/index.ts`. Cualquier cambio de esquema requiere generar una migración nueva con
  `npx drizzle-kit generate --name <nombre_descriptivo>` — nunca escribir SQL de migración a mano ni editar una
  migración ya aplicada.
- **Almacenamiento de archivos**: Netlify Blobs, store `"archivos-juegos"`. Cada archivo se guarda con la clave
  `"<codigo>-<nombreArchivo>"`.

## Flujo de datos clave

1. `GET /api/juegos` — lee la tabla `juegos` y devuelve id/nombre/demoUrl/etiqueta para la galería. No expone
   `archivoKey` (evita adivinar rutas de Blobs desde el cliente).
2. `POST /api/descargar` — recibe `{ codigo }`, busca el juego por código exacto. Si existe, devuelve
   `{ nombre, tipo, url }` donde `url` es `/api/archivo?codigo=...`. Si no existe, 404 con el mensaje de error
   que se muestra en el formulario.
3. `GET /api/archivo?codigo=...` — vuelve a validar el código contra la base de datos (no confía en el cliente),
   lee el blob correspondiente y lo devuelve con el `Content-Type` correcto (`text/html` o `application/pdf`).
   Esto es lo que permite que `window.location.href = url` ejecute el HTML en vez de mostrar su código fuente.
4. `POST /api/admin/juegos` — crea juegos nuevos. Protegido por el header `x-admin-secret`, comparado contra la
   variable de entorno `ADMIN_SECRET`. Usado por `public/admin.html`.

## Convenciones de código

- Funciones en TypeScript con extensión `.mts`, siguiendo el formato `export default async (req) => ...` +
  `export const config: Config = { path: "...", method: "..." }`.
- Nombres de columnas de base de datos en snake_case (`archivo_key`, `demo_url`), nombres de variables Drizzle en
  camelCase (`archivoKey`, `demoUrl`) — es el patrón estándar de Drizzle/Postgres.
- El frontend es JS vanilla sin framework ni bundler: todo el DOM se maneja a mano en `public/js/main.js`, sin
  dependencias externas.
- El HTML escapa cualquier valor dinámico (nombre del juego, etiqueta) antes de insertarlo en el DOM
  (`escapeHtml` en `main.js`) para evitar XSS, dado que esos valores vienen de la base de datos.

## Cosas a tener en cuenta

- No se usa Supabase pese a que el pedido original lo mencionaba: se optó por Netlify Database + Netlify Blobs
  porque son primitivos nativos de la plataforma, sin credenciales externas que gestionar. Si en el futuro se
  necesita migrar a Supabase, el punto de cambio son `db/index.ts` (cliente de base de datos) y las funciones
  `archivo.mts`/`admin-juegos.mts` (storage).
- Los archivos de juego solo se sirven después de validar el código contra la base de datos — nunca se expone
  una URL pública y predecible al blob. Si se cambia esa lógica, mantener esa validación para no permitir
  acceso a archivos sin código válido.
- El disclaimer legal (sin apuestas, sin dinero real, premios gestionados por cada negocio) aparece en el
  footer de `index.html` y en `terminos.html`. Cualquier copy nuevo relacionado con premios o incentivos debe
  mantener esa misma línea.
