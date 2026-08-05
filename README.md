# 593games

Plataforma de juegos digitales para negocios locales. Los negocios entregan un **código único** a sus clientes,
quienes lo canjean en el sitio para descargar/ejecutar un juego interactivo (bingo, trivia, ruleta, memorama, etc.).

**Uso exclusivo de marketing, entretenimiento y fidelización de clientes. No es una plataforma de apuestas, no
involucra dinero real ni juegos de azar.**

## Stack técnico

- **Frontend**: HTML, CSS y JavaScript vanilla, servidos como sitio estático desde `public/`.
- **Backend**: Netlify Functions (TypeScript, `netlify/functions/*.mts`).
- **Base de datos**: Netlify Database (Postgres administrado) con Drizzle ORM — tabla `juegos`.
- **Almacenamiento de archivos**: Netlify Blobs (bucket `archivos-juegos`) para los `.html`/`.pdf` de cada juego.

> Nota: el pedido original mencionaba Supabase para base de datos y storage. Este proyecto usa los primitivos
> nativos de Netlify (Netlify Database + Netlify Blobs) en su lugar, que ofrecen la misma funcionalidad
> (tabla relacional + almacenamiento de archivos públicos) sin depender de un servicio externo ni de claves
> adicionales que configurar.

## Cómo correr el proyecto localmente

```bash
npm install
netlify dev
```

`netlify dev` levanta el sitio estático y las funciones juntas, y provisiona automáticamente una base de datos
de desarrollo/preview la primera vez que se conecta.

## Estructura del proyecto

```
public/                 sitio estático (HTML, CSS, JS)
  index.html            página principal
  admin.html            panel interno para subir juegos y generar códigos
  terminos.html         términos de uso
  css/styles.css
  js/main.js            carga de galería + lógica de descarga por código
db/
  schema.ts             definición de la tabla "juegos" (Drizzle)
  index.ts              cliente de Drizzle
netlify/
  functions/
    juegos.mts           GET  /api/juegos            lista el catálogo para la galería
    descargar.mts         POST /api/descargar          valida un código y devuelve la URL de descarga
    archivo.mts           GET  /api/archivo?codigo=... entrega el archivo del juego con el content-type correcto
    admin-juegos.mts       POST /api/admin/juegos       crea un juego (código + archivo), protegido por ADMIN_SECRET
  database/migrations/     migraciones SQL generadas por drizzle-kit
```

## Base de datos: tabla "juegos"

La tabla se crea automáticamente vía migración (`netlify/database/migrations/`) al desplegar. Columnas:

| Columna       | Tipo      | Descripción                                  |
|---------------|-----------|-----------------------------------------------|
| id            | uuid      | primary key, generado automáticamente         |
| codigo        | text      | único, código que ingresa el cliente          |
| nombre        | text      | nombre del juego (ej. "Bingo Clásico")        |
| archivo_key   | text      | clave del archivo en Netlify Blobs            |
| demo_url      | text      | URL de imagen/video para la galería (opcional)|
| etiqueta      | text      | "Para negocios" o "Entretenimiento"           |
| created_at    | timestamp | fecha de creación                             |

No es necesario crear la tabla manualmente: Netlify aplica las migraciones automáticamente en cada deploy.

## Almacenamiento de archivos

Los archivos de cada juego (`.html` autocontenido o `.pdf`) se guardan en un store de Netlify Blobs llamado
`archivos-juegos`. No requieren configuración de políticas de acceso público manuales: la función
`GET /api/archivo?codigo=...` sirve el archivo directamente con el `Content-Type` correcto
(`text/html` o `application/pdf`), después de validar el código contra la base de datos. Esto asegura que:

- Un archivo `.html` se **ejecuta** en el navegador (no se descarga como texto plano).
- Un archivo `.pdf` se abre en una nueva pestaña.
- Solo se puede acceder a un archivo conociendo un código válido.

## Cómo agregar un nuevo juego

1. Ve a `/admin.html` en el sitio desplegado.
2. Ingresa la clave de administrador (el valor configurado en la variable de entorno `ADMIN_SECRET`).
3. Completa el código único, nombre, etiqueta, URL de demo opcional y sube el archivo `.html` o `.pdf`.
4. El formulario sube el archivo a Netlify Blobs y crea el registro en la tabla `juegos` en un solo paso.

También puedes crear juegos llamando directamente a la función:

```bash
curl -X POST https://TU-SITIO.netlify.app/api/admin/juegos \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_CLAVE_ADMIN" \
  -d '{
    "codigo": "BINGO2026",
    "nombre": "Bingo Clásico",
    "etiqueta": "Para negocios",
    "demoUrl": "https://ejemplo.com/demo-bingo.jpg",
    "nombreArchivo": "bingo.html",
    "archivoBase64": "'"$(base64 -w0 bingo.html)"'"
  }'
```

## Variables de entorno necesarias en Netlify

Configura en **Site settings → Environment variables** en Netlify:

| Variable       | Descripción                                                    |
|----------------|------------------------------------------------------------------|
| `ADMIN_SECRET` | Clave secreta para autorizar la creación de juegos desde `/admin.html` o vía API. Elige un valor largo y aleatorio. |

La conexión a Netlify Database y Netlify Blobs se configura automáticamente — no requiere variables de entorno
adicionales ni claves de Supabase.

## Desplegar en Netlify

1. Conecta este repositorio a un nuevo sitio de Netlify (o usa el sitio ya provisionado).
2. Configura la variable de entorno `ADMIN_SECRET` descrita arriba.
3. Haz deploy. Netlify instalará las dependencias, aplicará las migraciones de base de datos automáticamente y
   publicará el sitio estático junto con las funciones.
4. Entra a `/admin.html` con tu `ADMIN_SECRET` para cargar tus primeros juegos y generar códigos para tus clientes.

## Disclaimer

593games ofrece juegos exclusivamente para fines de entretenimiento, marketing y fidelización de clientes.
Ninguno de nuestros juegos involucra apuestas, dinero real o juegos de azar. Los premios o incentivos son
gestionados directamente por cada negocio como parte de sus estrategias comerciales.
