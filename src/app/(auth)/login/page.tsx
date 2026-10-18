import { LoginForm } from "@/modules/auth/components/LoginForm";
import { GraduationCap } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ actualizada?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary to-primary-container">
      {/* Halos decorativos: matizan el verde con luz suave */}
      <div className="pointer-events-none absolute -top-28 -left-28 h-80 w-80 rounded-full bg-white/10 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[26rem] w-[26rem] rounded-full bg-on-primary-container/15 blur-3xl"></div>
      <div className="pointer-events-none absolute top-1/4 right-1/3 h-72 w-72 rounded-full bg-white/5 blur-3xl"></div>

      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        {/* Banner institucional — lado izquierdo (escritorio) */}
        <aside className="relative hidden lg:flex">
          <div className="relative z-10 mx-auto flex w-full max-w-[640px] flex-col justify-center gap-5 p-8 xl:p-10">
            {/* Marca */}
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-label-md text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur-sm">
              <GraduationCap size={18} className="text-on-primary-container" />
              InfoTarea
            </span>

            <div className="overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/banner-institucion.jpg"
                alt="Fachada de la IE Teniente Miguel Cortés del Castillo"
                className="h-auto w-full object-cover"
              />
            </div>
            <div className="space-y-3">
              <p className="font-label-md text-xs font-bold uppercase tracking-[0.25em] text-on-primary-container">
                Institución Educativa
              </p>
              <h1 className="font-display text-3xl leading-tight text-white xl:text-4xl">
                Teniente Miguel Cortés del Castillo
              </h1>
              <p className="max-w-md font-body-md text-sm leading-relaxed text-white/80 xl:text-base">
                Comunidad educativa conectada: tareas, avisos y seguimiento académico en un solo lugar. Piura, Perú.
              </p>
            </div>
          </div>
        </aside>

        {/* Formulario de acceso (sobre fondo verde) */}
        <section className="relative z-10 flex items-center justify-center p-md lg:px-10 lg:py-4">
          <LoginForm passwordUpdated={params.actualizada === "1"} />
        </section>
      </div>
    </main>
  );
}
