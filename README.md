# Nuestro Rincón 💌

Página estática original, separada en HTML/CSS/JS, con Supabase para cuentas, datos en la nube y logros.

## Qué incluye

- **Diseño original** de `index.html`: mural, listas, vision board, música, puzzle, juegos, desafíos diarios y buzón.
- **Supabase Auth**: registro y acceso por correo y contraseña.
- **Perfil**: nombre editable, puntos e insignias.
- **Guardado en la nube**: listas, buzón, música, desafíos y demás datos de la página se almacenan en `app_entries` asociados a cada usuario, con un respaldo temporal por cuenta en el navegador si falla Internet.
- **Premios virtuales**: 10 insignias, puntos por juegos ganados y cuatro recompensas desbloqueables por puntos (no tienen valor monetario).
- **Seguridad**: políticas RLS en las tablas para que cada cuenta acceda solamente a sus datos.

**Importante**: esta versión guarda datos **por usuario**, incluso al usar distintos dispositivos. No implementa todavía un mural compartido en tiempo real entre dos cuentas. Dos cuentas distintas NO ven automáticamente las cartas de la otra.

## Instalación sin Node.js

1. Creá un **proyecto nuevo** en https://supabase.com/dashboard .
2. En **SQL Editor**, pegá y ejecutá completo `schema.sql` **una sola vez**. Este SQL está pensado para un esquema nuevo; no lo ejecutes sobre una base donde existan tablas con estos nombres.
3. En **Project Settings → API Keys** y **Project URL**, copiá el **Project URL** y la **publishable key** (o la clave pública **anon** si tu proyecto usa ese formato).
4. Abrí `config.js` y reemplazá las dos cadenas `TU-...`. **No uses `service_role`, claves secretas ni contraseñas.** La publishable/anon key está diseñada para usarse en el navegador, pero requiere RLS correctamente configurado.
5. En **Authentication → URL Configuration**, configurá `Site URL` como la dirección que te da Vercel (`https://tu-proyecto.vercel.app`) y agregá la dirección de Vercel a las **Redirect URLs**. Podés agregar `http://localhost:5500/**` si vas a probar localmente.
6. En **Authentication → Providers → Email**, mantené habilitado email/password. La confirmación de correo normalmente viene activada por defecto.
7. Poné `index.html`, `style.css`, `script.js`, `auth.js`, `config.js` y `schema.sql` juntos en la raíz del repositorio (también `fotopuzzle.jpg`, si existe). El SQL puede quedar fuera del sitio publicado, o en una carpeta de documentación.
8. Importá el repo de GitHub en https://vercel.com/new ; seleccioná **Other** como framework, sin build command ni output directory personalizada. Deploy.

### Cómo probar en tu PC

Un servidor local ayuda porque los módulos JS no funcionan correctamente abriendo directamente `file://`.

- En VS Code podés usar una extensión de servidor local como Live Server.
- Si ya tenés Python instalado, desde esta carpeta ejecutá `python -m http.server 5500` y abrí http://localhost:5500 .
- **No necesitás instalar Node.js, npm, React ni Vercel CLI**.

### La imagen del puzzle

Si tenés una foto, guardala con nombre `fotopuzzle.jpg` junto a `index.html`. La página original también acepta `.jpeg` o `.png`. Si falta, aparece la misma imagen temporal que tenía el HTML.

### ¿Qué se sincroniza?

Las llamadas originales `ld()/sv()` ahora leen un estado precargado y guardan en Supabase por clave. Al entrar a la cuenta en otro dispositivo aparecen sus datos. Si la conexión falla, los cambios recientes se guardan de forma pendiente **en ese navegador** para intentar sincronizar después.

**Límites actuales:** sincronización por cambios, no colaboración en vivo. Si editás **la misma lista** desde dos dispositivos a la vez, la última escritura puede reemplazar la anterior. Las partidas se puntúan al conseguir una victoria y los puntos se asignan mediante triggers; al ser un juego informal, los resultados enviados por el navegador no tienen validación antitrampas del lado servidor.

**Migración de datos viejos:** los datos del HTML anterior (`localStorage`, claves `nr-*`) **no se importan automáticamente**: para evitar mezclar contenidos de distintos usuarios y conservar el original. No borres el HTML antiguo ni su almacenamiento si querés recuperar esos datos.

### Archivos

| Archivo | Función |
|---|---|
| `index.html` | Estructura original de la web. |
| `style.css` | Estilos originales + interfaz mínima de cuentas. |
| `script.js` | Juegos y lógica original, con cambios puntuales para sincronizar. |
| `auth.js` | Login, registro, sincronización, perfiles y logros. |
| `config.js` | URL + clave pública de Supabase (completar). |
| `schema.sql` | Tablas, políticas RLS, triggers y puntos. |

## Créditos

Partimos del archivo HTML original que compartiste. Su aspecto se conserva; se agregaron únicamente el acceso y el panel de perfil.
