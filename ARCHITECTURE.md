# Arquitectura Monolito Modular (Next.js + Supabase)

Este proyecto ha sido inicializado siguiendo los principios de la **Arquitectura Monolito Modular**. Esta estructura permite escalar el proyecto dividiéndolo en dominios de negocio claramente separados, manteniendo la simplicidad de un único despliegue.

## 📁 Estructura de Carpetas

```text
src/
├── app/               # Capa de Enrutamiento (Next.js App Router)
├── lib/               # Infraestructura y Configuración (Supabase)
├── modules/           # Capa de Dominio (Modular Monolith)
│   ├── [modulo]/      # Cada módulo representa un dominio (e.g., auth, products)
│   │   ├── components/ # Componentes específicos del módulo
│   │   ├── services/   # Lógica de negocio y llamadas a Supabase
│   │   ├── hooks/      # Hooks personalizados del módulo
│   │   ├── types.ts    # Modelos y tipos del dominio
│   │   └── index.ts    # API Pública del módulo (Encapsulamiento)
├── shared/            # Componentes y utilidades compartidas
└── middleware.ts      # Manejo de sesiones de Supabase
```

## 🛠️ Configuración de Supabase

Se han configurado tres utilidades clave en `src/lib/supabase/`:

1.  **`client.ts`**: Cliente para componentes que se ejecutan en el navegador.
2.  **`server.ts`**: Cliente para Server Components, Server Actions y API Routes.
3.  **`middleware.ts`**: Lógica para refrescar la sesión del usuario automáticamente.

> **Importante:** No olvides configurar tus credenciales en el archivo `.env.local` antes de iniciar el desarrollo.

## 🚀 Cómo crear un nuevo módulo

Para añadir funcionalidad (ejemplo: `inventario`):

1.  Crea la carpeta en `src/modules/inventario`.
2.  Define tus tipos en `types.ts`.
3.  Crea los servicios para interactuar con la DB en `services/`.
4.  Expón solo lo necesario a través de `index.ts`.
5.  Importa el módulo en `src/app/` para crear las rutas.

## 💎 Estética y UI

- **Tailwind CSS**: Configurado para un diseño oscuro premium.
- **Lucide React**: Iconografía moderna incluida.
- **Tipografía**: Inter y Outfit (Google Fonts).
- **Glassmorphism**: Estilos base configurados en `globals.css`.
