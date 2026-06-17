import Link from "next/link";
import { LayoutDashboard, School } from "lucide-react";

export default function NotFound() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col antialiased">
      <main className="flex-grow flex items-center justify-center p-md md:p-xl">
        <div className="max-w-2xl w-full flex flex-col items-center text-center">
          {/* Illustration */}
          <div className="relative w-64 h-64 md:w-96 md:h-96 mb-lg">
            <img 
              alt="Error 404 Illustration" 
              className="w-full h-full object-cover rounded-full shadow-lg border border-outline-variant" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAamk5TMbMLRiHndeWVH5cbJhtRY51ZLhaemvYiystENFdW_TytEFA1mRKRTa18eu_gJTqAnN50XWZ6u7yBc0sfXWsxW8Tb_kpUustQO8OptOWe2iW-OnfrFXj-FpCj4ZYarUV1oN14Qhzp_i1sKyhqXre_06ZbkytrG4d7GjPw9oShb_vuwyHSiKP4g5AVFWbso_xwdmw4JcOsidD25Jh84kS8TWqrTSCjflndERDLufbF7_xVGHY3ls3EEHLgl1JmFzYyfTbPm4B8"
            />
            {/* Decorative element */}
            <div className="absolute -top-4 -right-4 bg-error-container text-on-error-container text-headline-lg font-bold rounded-full w-24 h-24 flex items-center justify-center shadow-xl transform rotate-12">
              404
            </div>
          </div>

          {/* Content */}
          <div className="bg-surface-container-lowest p-xl rounded-xl shadow-sm border border-outline-variant w-full max-w-lg">
            <h1 className="text-display-lg font-bold text-primary mb-sm leading-tight">
              ¡Uy! Página no encontrada
            </h1>
            <p className="text-body-lg text-on-surface-variant mb-xl">
              Lo sentimos, el enlace que buscas no existe o fue movido.
            </p>
            {/* Action Button */}
            <Link 
              href="/"
              className="inline-flex items-center justify-center gap-sm bg-primary-container text-on-primary-container font-bold text-label-md px-xl py-md rounded-full shadow-md hover:bg-primary hover:text-on-primary transition-all duration-200"
            >
              <LayoutDashboard size={20} />
              Volver al Inicio
            </Link>
          </div>

          {/* Brand Footer */}
          <div className="mt-xl flex items-center gap-sm">
            <img src="/assets/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
            <span className="text-title-lg font-bold text-on-surface-variant">InfoTarea</span>
          </div>
        </div>
      </main>
    </div>
  );
}
