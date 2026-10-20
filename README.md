# Nuestro Rincón — versión en vivo (HTML/CSS/JS + Supabase)

Proyecto sin frameworks ni proceso de compilación. **No hace falta instalar Node.js.**

## Incluye

- Dos perfiles separados **sin correo, contraseña ni verificación**, vinculados por **código de invitación** (máximo dos miembros por rincón).
- Contenido **compartido**: Por hacer, Por ver, Sueños & Metas, Vision Board, música, playlist, caja fuerte y Buzón de Cartas.
- Supabase Realtime: las pestañas abiertas reciben los cambios del otro perfil sin recargar (requiere conexión).
- Datos **individuales**: progreso de Wordle/Conexiones, ajustes de pestaña, nombre, puntos, insignias y partidas.
- Tops de los seis juegos, victorias por jugador y mejores marcas (menos intentos/movimientos/errores es mejor).
- RLS para impedir que perfiles ajenos lean los datos del rincón. El código de invitación permite vincular un máximo de dos perfiles; guardalo en privado.
- Opción **Importar datos** para recuperar listas y notas del antiguo `localStorage`, desde el mismo navegador y mismo dominio.

## Preparación segura de Supabase

**Importante:** `schema.sql` está diseñado para un proyecto de Supabase NUEVO, sin las tablas `profiles`, `game_results` o `earned_badges` anteriores. Si ya ejecutaste el `schema.sql` del ZIP anterior, **no ejecutes este encima**: el esquema ya existe y se necesita una migración específica. No borres datos del proyecto anterior.

Si el proyecto ya tiene `profiles`, `app_entries`, `game_results` y `earned_badges` de la versión individual, ejecutá **`migrate-existing-project.sql` una sola vez** en su SQL Editor. La migración conserva `app_entries`, archiva la tabla anterior como `game_results_legacy`, copia los resultados y reúne los dos perfiles existentes en un rincón. No ejecutes después `schema.sql` en ese mismo proyecto. La migración se aplicó al proyecto `vpnwtoucbxvxvfhyhepp` el 19 de octubre de 2026; no la repitas allí.

1. Entrá a https://supabase.com/dashboard y creá un proyecto nuevo de Supabase.
2. Abrí **SQL Editor** y ejecutá **una sola vez** el contenido completo de `schema.sql`.
3. En **Authentication → Providers / Sign In**, activá **Allow anonymous sign-ins** (a veces figura como *Anonymous Sign-Ins*). Sin esto, el botón «Crear mi perfil» va a dar error. **No necesitás habilitar ni configurar el correo**, ni desactivar las protecciones del proveedor Email.
4. Este flujo no usa enlaces de redirección, porque no solicita correos ni verificaciones.
5. Copiá **Project URL** y una clave pública **publishable** (`sb_publishable_...`) o `anon` en `config.js`:

   ```js
   export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
   export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
   ```

   Una clave *publishable/anon* está destinada al navegador. **Nunca subas a GitHub una clave `service_role`, secreta (`sb_secret_...`) ni contraseña de base de datos.** La privacidad depende de las políticas RLS del SQL.

6. Desde el primer navegador, escribí un **nombre** y tocá **Crear mi perfil**. Elegí **Crear nuestro rincón** y abrí **Invitar**. La segunda persona, en su navegador habitual, crea su perfil con su nombre y elige **Unirme al rincón** con el código. No compartan ese código públicamente.

## Actualización del GitHub / Vercel actual

En `https://github.com/franLorenzo28/Nuestro-Rincon` poné estos archivos **en la raíz** del repositorio:

- `index.html`
- `style.css`
- `script.js`
- `auth.js`
- `config.js`
- `schema.sql` (solo como guía para instalar la base; Vercel no lo ejecuta)
- `README.md`

**No elimines `fotopuzzle.jpg` ni las demás imágenes que ya subiste.** Se usan desde el HTML original. Si usás una rama de pruebas / preview de Vercel antes de sustituir `main`, podés comprobar todo sin afectar la web actual. Vercel lo sirve como página estática; Framework Preset: **Other** y sin comando de build.

## Cómo comprobarlo entre dos teléfonos o navegadores

1. Abrí la nueva versión desde dos navegadores separados, uno con cada perfil (sin correo, contraseña ni confirmación).
2. Vinculá ambas cuentas al mismo rincón con el código de invitación.
3. En el primer navegador: Mural → **Vision Board** → Boda → agregá una idea.
4. En el segundo, tené abierto Mural → Vision Board → Boda: la idea debería aparecer **sin recargar**.
5. Repetí con **Por hacer** y con **Buzón de Cartas**. Verificá el estado «Sincronizado».
6. Ganá un juego en una cuenta, luego abrí **Tops** y **Perfiles** desde cualquiera de las dos.
7. Probá recargar. Los datos deben conservarse en Supabase.

## Limitaciones / detalles técnicos

- **MUY IMPORTANTE — acceso sin correo:** Supabase crea una identidad anónima con una sesión en este navegador. Si abrís el sitio en otro navegador/dispositivo, cerrás la sesión o borrás los datos del sitio, **no podés recuperar el mismo perfil**. Tus datos compartidos pueden permanecer en Supabase, pero tu historial personal (puntos/logros/rankings) quedaría ligado a la sesión anterior. Por eso esta versión no muestra «Cerrar sesión». Para acceso recuperable en varios dispositivos se necesita añadir un método de autenticación o recuperación seguro, por ejemplo passkeys o un backend que gestione credenciales, sin guardar contraseñas en código público. No usen modo incógnito.
- El modo Realtime usa **Postgres Changes** (apropiado para dos usuarios; para tráfico grande Supabase recomienda Broadcast).
- Las listas y el Vision Board actuales se guardan como arreglos JSON por sección. Si los dos editan **el mismo apartado exactamente al mismo tiempo**, puede prevalecer la última escritura: en una versión futura conviene migrar a una fila SQL por elemento para evitar conflictos.
- Las puntuaciones del ranking son una **competencia amistosa**: el cliente envía sus resultados; no hay un sistema antifraude del lado del servidor.
- Se guarda como máximo un resultado por juego y jugador **por día**. Una mejor marca del mismo día reemplaza la anterior sin duplicar puntos.
- Los puntos y logros se asignan en la base de datos. Los premios son insignias virtuales, no transacciones monetarias.
- El juego Wordle y Conexiones siguen siendo individuales, para que cada persona pueda completarlos por separado.
- Los datos que estaban en el `localStorage` original **no aparecen automáticamente**. Tras ingresar, tocá **Importar datos** desde el **mismo navegador y mismo dominio** de la web original. No se sobrescriben secciones que ya tengan contenido en Supabase. Las listas anteriores se conservan en el navegador.
- Las fotografías almacenadas en un **repositorio GitHub público** también son públicas. Si quieren fotos privadas, usar un repositorio privado más almacenamiento privado con acceso controlado sería una mejora relevante.
- No se ha probado contra un proyecto Supabase real en este entorno: falta configurar tus credenciales públicas y realizar la prueba entre dos cuentas.
