This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Publicar cambios en Vercel

Para los cambios de presencia, mensajes y ficha familiar, aplicar primero los pasos de [activación del módulo de comunicación](docs/communication-deployment.md). La publicación de código no actualiza las políticas ni las tablas de Supabase.

En Windows puedes hacer doble clic en `PUBLICAR-VERCEL.cmd` para iniciar sesion, vincular esta carpeta con tu proyecto existente (la primera vez) y publicar en produccion sin cache de compilacion. El archivo se detiene si un paso falla y mantiene la ventana abierta para leer el resultado.

Guardar archivos en tu PC no actualiza por sí solo la web publicada. Puedes publicar esta carpeta directamente con Vercel CLI, incluso si no tiene una carpeta `.git`.

Necesitas Node.js, npm, conexión a Internet y acceso al proyecto existente de Vercel. Los comandos usan la CLI oficial mediante `npx`; no necesitas instalarla globalmente ni instalar las dependencias de la aplicación para enviar el código. Vercel instala las dependencias y ejecuta la compilación en sus servidores.

### Configuración inicial (una vez por carpeta)

Desde PowerShell:

```powershell
Set-Location 'C:\xampp\htdocs\infotarea'
npm.cmd run vercel:login
npm.cmd run vercel:link
```

Completa el inicio de sesión. Al vincular, elige la cuenta o equipo que contiene tu web, responde **sí** a vincular con un proyecto existente y selecciona el proyecto de InfoTarea que tiene tu dominio actual. La vinculación queda guardada en `.vercel/project.json`, excluido de Git y del envío de código.

### Publicar los archivos locales

```powershell
npm.cmd run deploy
```

Para forzar una nueva compilación sin reutilizar la caché de compilación:

```powershell
npm.cmd run deploy:fresh
```

Estos comandos publican en **Production** del proyecto vinculado. Espera a que terminen correctamente; si la compilación falla, revisa el error y los Build Logs del despliegue en Vercel. Una compilación fallida no actualiza la versión que visitan los usuarios. `.vercelignore` excluye configuración local, credenciales, informes y archivos de referencia del envío.

Comprueba el resultado en el dominio de producción que aparece en Vercel → proyecto → **Domains**, usando una ventana privada o `Ctrl+F5`. Las URL de un despliegue concreto muestran esa versión; para comprobar futuras actualizaciones usa siempre el dominio de producción. Forzar la compilación no limpia la caché del navegador.

La publicación directa no guarda los cambios en GitHub: conserva también una copia versionada de tu trabajo.

### Si prefieres publicación automática desde GitHub

En Vercel verifica que el proyecto esté conectado a `Dontoti02/infotarea` y que la rama de producción sea la misma a la que subes tus cambios. Cada nuevo push a esa rama puede generar el despliegue de producción. Si esta carpeta se descargó como ZIP y no contiene `.git`, clona el repositorio en otra carpeta y traslada tus cambios allí antes de hacer commit y push.

Un **Redeploy** de un despliegue antiguo vuelve a publicar su código; no recoge archivos que solo existen en tu PC. Para esos archivos usa los comandos anteriores o súbelos primero a GitHub.

Referencias oficiales: [desplegar con la CLI](https://vercel.com/docs/cli/deploy), [vincular un proyecto](https://vercel.com/docs/cli/link), [integración con Git](https://vercel.com/docs/git).

## Imagen de referencia web infotarea

<img width="1777" height="850" alt="image" src="https://github.com/user-attachments/assets/03ff6306-b44e-4e58-b3f7-b458629c0845" />

