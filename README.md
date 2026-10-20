# Calendario IA

Calendario web donde escribes tu planning en lenguaje natural («mañana clase de
8 a 14, gimnasio a las 18») y la IA lo convierte en eventos colocados en el día,
la semana o el mes que corresponda.

**Demo:** https://calendario-ia-rb7k.netlify.app

## Cómo funciona

1. Escribes el planning en el panel lateral.
2. `POST /api/parse` (Netlify Function) pide al modelo que devuelva JSON con los
   eventos, interpretando fechas relativas («mañana», «el lunes») respecto a la
   hora actual y a tu zona horaria.
3. El frontend inserta esos eventos en Supabase y refresca la vista.

La función usa **Netlify AI Gateway**, que inyecta las credenciales del proveedor
de IA automáticamente: no hay ninguna API key en el código ni en el repo.

## Cuentas y privacidad

Cada persona crea su cuenta con email y contraseña (Supabase Auth) y ve
únicamente sus propios eventos. No hay cuentas compartidas ni un calendario
global.

- **Registro.** Abierto desde la pantalla de acceso («Crear cuenta»). Según la
  configuración del proyecto, Supabase puede pedir confirmar el correo antes del
  primer login; la app contempla los dos casos.
- **Aislamiento.** La tabla `events` tiene `user_id` y cuatro políticas RLS
  (`select`, `insert`, `update`, `delete`) que exigen `auth.uid() = user_id`.
  Sin sesión, la API de Supabase devuelve una lista vacía; no hay forma de leer
  eventos ajenos ni de insertar uno a nombre de otro (`with check` lo bloquea).
- **La función también valida.** `POST /api/parse` comprueba el token del
  usuario contra Supabase antes de llamar al modelo. Sin token responde `401`,
  así que nadie puede usar el AI Gateway desde fuera.
- **Cerrar sesión** está en la barra superior, junto al email.

La clave *publishable* sigue siendo pública: la seguridad no depende de
esconderla, sino de las políticas RLS.

## Tema claro y oscuro

La interfaz tiene dos temas conmutables desde el botón de la barra superior.
Al arrancar se respeta `prefers-color-scheme` del sistema; en cuanto eliges uno,
se guarda en `localStorage` y se mantiene entre visitas. El tema se aplica con
`data-theme` en `<html>` y un script inline en `index.html` antes del primer
pintado, para que no haya destello blanco al cargar en oscuro.

Todos los colores viven en variables CSS en `src/styles.css`: el bloque `:root`
define el tema claro y `html[data-theme='dark']` sobrescribe los tokens. Para
retocar un color hay que cambiarlo una sola vez.

## Eventos que se solapan

Cuando dos o más eventos coinciden en el tiempo, no se dibujan uno encima de
otro: la columna del día se reparte entre ellos, como en Google Calendar.

El cálculo está en `src/lib/layout.ts` y tiene dos pasos.

**1. Agrupar.** Los eventos se ordenan por hora de inicio y se agrupan por
contacto: si uno empieza antes de que haya terminado el más largo del grupo
anterior, entra en ese grupo. El contacto es transitivo, así que una cadena
`A 8-10 → B 9-11 → C 10-12` forma un solo grupo aunque A y C no se toquen.

**2. Repartir columnas.** Dentro de cada grupo, cada evento va a la primera
columna que ya esté libre (la que terminó antes de que este empiece). Si no hay
ninguna, se abre una columna nueva. Todos los eventos del grupo acaban con el
mismo ancho: `1 / nº de columnas`.

```
  08:00   09:00   10:00   11:00
  ┌───────┬───────┬───────┐
  │   A   │   B   │   C   │   3 columnas, 33,3 % cada uno
  └───────┴───────┴───────┘
  ┌───────────────┐
  │       D       │            D no coincide con nadie: 100 %
  └───────────────┘
```

Reutilizar columnas importa: si un evento largo convive con dos cortos que no
se pisan entre sí, los cortos comparten columna y el largo se queda con la otra,
en vez de abrir tres huecos.

El resultado se aplica como estilos en línea (`left` y `width` en `calc()`) en
`TimeGrid.tsx`; el CSS ya no fija la posición de `.event`.

## Editar eventos

Pulsar un evento (en la rejilla horaria o en la vista mensual) abre un diálogo
para cambiar el nombre, la fecha y la hora de inicio y fin, marcar «todo el
día», la categoría y las notas. Antes, pulsar un evento lo borraba directamente;
ahora el borrado vive dentro del diálogo y pide una segunda confirmación.

Detalles que se notan poco:

- Las fechas se manejan en hora local y se convierten a UTC al guardar, igual
  que hace el parser. Un evento de las 16:00 se guarda como 14:00Z en verano y
  se vuelve a ver a las 16:00.
- Con «todo el día» se guarda de 00:00:00 a 23:59:59.999 local, lo mismo que
  hace la IA cuando el texto no trae hora.
- Si el evento se mueve fuera del periodo visible, la vista salta a la nueva
  fecha en vez de dejar que desaparezca.
- El diálogo se cierra con `Escape` o pulsando fuera, y el foco arranca en el
  nombre.

## Stack

| Pieza | Tecnología |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite |
| Estilos | CSS propio (sin framework) |
| Fechas | date-fns |
| Datos | Supabase (Postgres) |
| IA | Netlify AI Gateway (`gpt-5-mini`) |
| Deploy | Netlify |

## Estructura

```
src/
  App.tsx                    estado, carga de eventos, navegación
  components/TimeGrid.tsx    rejilla horaria (vistas día y semana)
  components/MonthGrid.tsx   vista mensual
  components/PlanInput.tsx   panel de texto libre
  components/AuthScreen.tsx  acceso: entrar / crear cuenta
  components/EventDialog.tsx edición de un evento (nombre, fecha, hora…)
  lib/supabase.ts            cliente de Supabase
  lib/auth.ts                traducción de los errores de Supabase Auth
  lib/dates.ts               utilidades de rango y zona horaria
  lib/layout.ts              reparto de columnas entre eventos solapados
netlify/functions/
  parse-plan.ts              texto libre → eventos (JSON)
```

## Base de datos

Tabla `public.events`:

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | PK, `gen_random_uuid()` |
| `user_id` | uuid | dueño del evento; FK a `auth.users`, `on delete cascade` |
| `title` | text | obligatorio |
| `notes` | text | opcional |
| `starts_at` | timestamptz | obligatorio |
| `ends_at` | timestamptz | `>= starts_at` |
| `all_day` | boolean | por defecto `false` |
| `category` | text | trabajo, personal, estudio, salud, ocio, otro |
| `source_text` | text | el texto original del que salió el evento |
| `created_at` | timestamptz | por defecto `now()` |

## Desarrollo local

```bash
npm install
cp .env.example .env      # rellena las dos variables
npm run dev               # solo frontend (sin /api/parse)
npx netlify dev           # frontend + functions
```

Variables necesarias (`.env`):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La clave *publishable* es pública por diseño; la seguridad real la da RLS.

> **En producción las variables también tienen que estar en Netlify**, no solo
> en tu `.env`. `npm run build` las lee del `.env` local y las incrusta en el
> bundle, pero `parse-plan.ts` las lee en tiempo de ejecución para validar el
> token. Si faltan, `/api/parse` responde `503`:
>
> ```bash
> netlify env:set VITE_SUPABASE_URL "https://<ref>.supabase.co"
> netlify env:set VITE_SUPABASE_PUBLISHABLE_KEY "sb_publishable_..."
> ```
>
> Los cambios de variables no afectan a lo ya desplegado: hay que volver a
> desplegar.

> El AI Gateway solo funciona después de que el proyecto tenga al menos un deploy
> de producción. En local, `netlify dev` lo tiene disponible tras ese primer
> deploy.

## Deploy

```bash
npm run build
npx netlify deploy --prod
```

## Pendiente / ideas

- Recuperar contraseña y cambiar de email.
- Borrar la cuenta (hoy se puede vaciar el calendario, pero no eliminar el
  usuario desde la interfaz).
- Arrastrar eventos para moverlos, en vez de editar la fecha a mano.
- Sugerir recolocación cuando hay solapamiento (mover el evento en vez de
  solo repartir el ancho).
- Vista de agenda (lista).
- Recurrencia («todas las semanas»).
