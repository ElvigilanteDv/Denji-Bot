# Xhost

Plataforma multiusuario para hosting de bots de WhatsApp en Node.js.
Cada usuario se registra, pega la URL de su repo (github/gitlab
publico) y su numero, y la plataforma clona, instala y corre el bot
como proceso hijo, con logs y control de inicio/parada desde la web.

## ADVERTENCIA REAL (leer antes de poner esto en produccion)

Esto NO es Pterodactyl/Docker. No hay aislamiento real entre bots:

- Todos los bots corren como procesos hijos del mismo servidor Node,
  con el mismo usuario del sistema. Un bot con codigo malicioso
  podria en teoria leer archivos de otros bots si encuentra la forma.
- Solo se limita la memoria por proceso (`--max-old-space-size`), no
  el CPU. Muchos bots pesados al mismo tiempo pueden tumbar el server.
- Se restringe clonar solo desde github.com/gitlab.com como primer
  filtro, pero no se audita el contenido del codigo que la gente sube.
- Revisa los terminos de tu proveedor de hosting: algunos prohiben
  correr procesos en segundo plano "para terceros" en planes
  compartidos. Si tu server es tuyo (VPS/dedicado), no hay problema.

Para produccion seria con aislamiento real, la version con
Pelican/Docker que armamos antes es la opcion correcta. Esta version
es para arrancar rapido con lo que ya tienes.

## Deploy

1. Sube esta carpeta a tu server (subdominio apuntando aca).
2. `cp .env.example .env` y ajusta `SESSION_SECRET`, `PORT` (por
   defecto `24680`), `MAX_BOTS_PER_USER`, `MAX_TOTAL_BOTS`,
   `BOT_MEMORY_LIMIT_MB` y `TOTAL_RAM_MB`.
3. `npm install`
4. Asegurate que el server tenga `git` instalado (`git --version`).
   Si no esta disponible en tu hosting, el clonado de repos falla.
5. `npm start` (o configuralo como Node.js App en cPanel apuntando a
   `index.js`, igual que hicimos con los otros bots).
6. Conecta el subdominio al puerto/app segun la config de tu panel.

## Flujo de uso

1. El usuario se registra -> ve un codigo de verificacion en pantalla
   (sin correo, igual que Rin-Tohsaka API) -> lo ingresa -> queda
   logueado.
2. En `/dashboard` agrega un bot: nombre, URL del repo, numero.
3. La plataforma clona el repo y corre `npm install` automaticamente.
4. Dale "Iniciar" -> el bot corre como proceso hijo, sus logs
   (incluyendo el codigo de emparejamiento si usa el bot base que
   armamos antes) aparecen en la pantalla de Logs.
5. La sesion de cada bot vive en su propia carpeta
   `bots-data/user_X/bot_Y/session/`, separada de los demas.
6. Desde "Archivos" en el dashboard, cada usuario puede navegar,
   editar y borrar los archivos de texto de su propio bot (nunca la
   carpeta `session/`, que queda oculta desde ahi). Es un file manager
   simple sobre el filesystem, no un editor tipo VS Code.

## Limites por defecto (pensados para un server chico, ~800MB de RAM)

- Maximo de bots por usuario: `MAX_BOTS_PER_USER` (por defecto **1**).
- Maximo de bots en todo el servidor: `MAX_TOTAL_BOTS` (por defecto
  **5**). Al llegar al tope, nadie puede crear un bot nuevo hasta que
  se libere un cupo (se borre o quede otro usuario sin bots).
- Memoria por bot: `BOT_MEMORY_LIMIT_MB` (por defecto 150MB), con
  `TOTAL_RAM_MB` (por defecto 800) como referencia para calcular
  cuanto puede aguantar tu server. El dashboard muestra un resumen
  de cuantos bots hay y cuanta RAM estimada estan usando.
- Ojo: la RAM mostrada es una estimacion segun `--max-old-space-size`
  de los bots corriendo, no una medicion real del proceso — Node no
  expone eso sin librerias nativas adicionales. Sirve como referencia
  para no pasarte, no como monitoreo exacto tipo Pelican/Docker.
- Ajusta todo en `.env` segun la RAM real de tu server.

## Xcoins y planes

- Cada cuenta nueva arranca con **150 Xcoins** de regalo.
- Al crear un bot se elige un plan (definidos en `wacoins.js`):
  - **Basico**: 800 MB RAM, gratis de comprar, cobra 1 Xcoin/hora corriendo.
  - **Plus**: 1 GB RAM / 500 MB de almacenamiento, requiere minimo 500
    Xcoins de saldo para poder comprarlo, cobra 3 Xcoins/hora corriendo.
- El cobro corre solo (cada minuto se descuenta la parte proporcional)
  mientras el bot esta "running". Si a un usuario se le acaban los
  Xcoins, todos sus bots corriendo se detienen automaticamente.
- La cuenta admin (`cololacalempira5@gmail.com`, plan `ultra`) tiene
  Xcoins ilimitadas y nunca se le cobra ni se le detiene nada. Se crea
  sola la primera vez que arranca el server (`seed.js`); la contrasena
  inicial es el mismo correo.
- (el campo interno en `db.json` se sigue llamando `wacoins` por
  compatibilidad con cuentas viejas, pero en toda la interfaz se
  muestra como "Xcoins".)

## Tienda (`/tienda`)

- No hay pasarela de pago conectada: es 100% manual. El usuario ve los
  paquetes con precio en dolares, aprieta "Comprar por WhatsApp" y se
  le abre un chat con el numero configurado en `ADMIN_WHATSAPP`
  (`wacoins.js`) con el mensaje ya armado.
- Paquetes actuales: 100+25 bono ($0.50), 200+50 bono ($1.25), 300
  ($1.75), 400 ($2.00), 500 ($3.00).
- Despues de recibir el comprobante por WhatsApp, el admin entra a
  `/admin` y le agrega los Xcoins a mano a esa cuenta.

## Panel de administrador

- Solo la cuenta admin ve el link "Panel de usuarios" en el menu, y
  solo ella puede entrar a `/admin`.
- Desde ahi se puede: agregar wacoins a cualquier cuenta, restablecer
  su contrasena (genera una temporal, se muestra una sola vez) y
  borrar una cuenta junto con todos sus bots.
- Las contrasenas se guardan con hash (bcrypt) y no se pueden mostrar
  en texto plano ni siquiera desde el panel admin — es una limitacion
  de seguridad intencional, no un bug. Por eso el panel ofrece
  "Restablecer" en vez de "Ver contrasena".
