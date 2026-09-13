# LiveClothesShopWeb

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.23.

## Seguridad y Accesos — CU01 / CU02

Angular 21 standalone organizado en `src/app/modules/seguridad-accesos/`.
`src/app/core/` contiene configuración e interceptor HTTP reutilizables.

Rutas:

- `/registro`: registro público de Cliente; no inicia sesión automáticamente.
- `/login`: inicio de sesión y restauración de acceso existente.
- `/acceso`: confirmación temporal; verifica `/api/auth/me` antes de mostrar datos.
- `/`: redirección a `/login`.

No se implementan cierre de sesión, recuperación, administración ni otros CU.

### FastAPI + Angular en desarrollo local

Requisitos: Node compatible con Angular 21 (validado con Node 20.20.2 y npm 10.8.2),
Python y el backend ya configurado con una base local autorizada y su rol Cliente.
Estos comandos no crean ni migran la base de datos.

Terminal 1, desde `C:\SI2_Parcial1\LiveClothesShop-api`, con `DATABASE_URL` y
`CLIENTE_ROL_ID` configurados privadamente según el README del backend:

```powershell
$env:ENVIRONMENT = 'development'
$env:COOKIE_SECURE = 'false'
$env:ALLOWED_ORIGINS = '["http://localhost:4200"]'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-proxy-headers
```

Terminal 2, desde `C:\SI2_Parcial1\LiveClothesShop-web`:

```powershell
npm ci
npm start -- --host localhost --port 4200
```

Abrir `http://localhost:4200`. `proxy.conf.json` reenvía `/api/**` hacia
`http://127.0.0.1:8000` sin sustituir el origen. El navegador envía `Origin`;
Angular no intenta fijar esa cabecera prohibida para JavaScript.

Contrato exacto: `POST /api/auth/registro`, `POST /api/auth/login`, `GET /api/auth/me`.
El interceptor configura `withCredentials: true` y `X-CSRF-Protection: 1` en métodos
mutables dirigidos a la API. No añade esas opciones a servicios ajenos.

La cookie HttpOnly es gestionada exclusivamente por el navegador. No se lee,
construye ni almacena manualmente. No se utiliza localStorage/sessionStorage.
Solo se mantiene la respuesta pública en memoria y se consulta `/me` al restaurar.
La contraseña se limpia del formulario al terminar cada envío.

El registro envía únicamente ci, nombres, apellidoPat, apellidoMat, sexo, correo,
telefono, direccion, fechaNac y contrasena. Las validaciones UX no reemplazan a FastAPI.

### SSR y despliegue

Se conserva SSR y la hidratación. Las rutas utilizan `RenderMode.Server`, no
prerender de datos privados. La restauración se inicia con `afterNextRender` y
`AuthService.restore()` evita peticiones en el servidor. El interceptor excluye
las respuestas de API de la caché de transferencia de Angular.

`angular.json` permite expresamente los hosts SSR locales `localhost` y `127.0.0.1`.
Antes del despliegue, añadir el dominio real a esa lista, configurar HTTPS,
cookie Secure y el origen autorizado en FastAPI. No utilizar comodines de hosts.

La URL base predeterminada es `/api` (`core/config/api.config.ts`). En producción,
un reverse proxy debe dirigir `/api` a FastAPI y el resto a Angular SSR. El proxy
del dev server no se incluye en `server.mjs`. El servidor Express de Angular
no implementa lógica de negocio ni autenticación.

### Validaciones

```powershell
npm test -- --watch=false
npm run build
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
node scripts/smoke-ssr.mjs
npm ls --depth=0
git diff --check
```

El build genera bundles de navegador y servidor. `smoke-ssr.mjs` levanta
temporalmente el servidor compilado y comprueba HTML de login, registro y acceso,
sin FastAPI ni conexiones a bases de datos. Las pruebas HTTP unitarias utilizan
`HttpTestingController`; no prueban una base PostgreSQL desplegada.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
