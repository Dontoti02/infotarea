"use client";

import React from "react";
import { 
  ChevronRight, 
  Search, 
  Save, 
  Image as ImageIcon, 
  X, 
  ChevronDown,
  UserPlus
} from "lucide-react";
import Link from "next/link";

export function CreateUserForm() {
  return (
    <div className="space-y-lg">
      {/* Breadcrumbs & Header */}
      <div>
        <nav className="flex items-center gap-sm text-label-md font-bold text-on-surface-variant mb-sm">
          <Link href="/admin/usuarios" className="hover:text-primary transition-colors">Usuarios</Link>
          <ChevronRight size={16} />
          <span className="text-on-surface">Crear nuevo</span>
        </nav>
        <h2 className="text-headline-md font-bold text-on-surface">Crear nuevo usuario</h2>
      </div>

      {/* Centralized Form Card */}
      <div className="bg-surface-container-lowest shadow-sm rounded-xl p-xl mx-auto max-w-4xl border border-outline-variant/30">
        <form className="flex flex-col gap-xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
            {/* Left Column: Personal Data & Account Config */}
            <div className="lg:col-span-2 flex flex-col gap-xl">
              {/* Sección: Datos Personales */}
              <section className="space-y-md">
                <h3 className="text-title-lg font-bold text-on-surface pb-xs border-b border-outline-variant">Datos Personales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                  <div className="md:col-span-2">
                    <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="fullName">Nombre completo</label>
                    <input 
                      className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-shadow" 
                      id="fullName" 
                      placeholder="Ej. Juan Pérez" 
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="email">Correo institucional</label>
                    <input 
                      className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-shadow" 
                      id="email" 
                      placeholder="usuario@institucion.edu" 
                      type="email"
                    />
                  </div>
                  <div>
                    <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="phone">Teléfono</label>
                    <input 
                      className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-shadow" 
                      id="phone" 
                      placeholder="+1 234 567 8900" 
                      type="tel"
                    />
                  </div>
                </div>
              </section>

              {/* Sección: Configuración de Cuenta */}
              <section className="space-y-md">
                <h3 className="text-title-lg font-bold text-on-surface pb-xs border-b border-outline-variant">Configuración de cuenta</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                  <div>
                    <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="role">Selección de Rol</label>
                    <div className="relative">
                      <select className="w-full appearance-none bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-shadow" id="role">
                        <option disabled selected value="">Seleccionar rol</option>
                        <option value="student">Estudiante</option>
                        <option value="teacher">Profesor</option>
                        <option value="admin">Administrador</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" size={18} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-label-md font-bold text-on-surface-variant mb-xs" htmlFor="course">Asignación de Curso/Sección</label>
                    <div className="relative">
                      <select className="w-full appearance-none bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-shadow" id="course">
                        <option disabled selected value="">Asignar curso</option>
                        <option value="mat101">Matemáticas 101 - Sec A</option>
                        <option value="lit202">Literatura 202 - Sec B</option>
                        <option value="sci303">Ciencias 303 - Sec A</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" size={18} />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Profile Picture */}
            <div className="flex flex-col gap-md">
              <h3 className="text-title-lg font-bold text-on-surface pb-xs border-b border-outline-variant">Foto de perfil</h3>
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer p-lg text-center h-full min-h-[200px] group">
                <ImageIcon className="text-outline mb-sm group-hover:text-primary transition-colors" size={48} />
                <p className="text-label-md font-bold text-on-surface mb-xs">Arrastra o haz clic para subir</p>
                <p className="text-label-sm font-bold text-on-surface-variant">JPG, PNG o GIF (Max 5MB)</p>
                <input accept="image/*" className="hidden" type="file"/>
              </div>
            </div>
          </div>

          <hr className="border-outline-variant" />

          {/* Actions Row */}
          <div className="flex justify-end gap-md items-center">
            <Link href="/admin/usuarios" className="px-lg py-sm rounded-lg font-bold text-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">
              Cancelar
            </Link>
            <button className="px-lg py-sm rounded-lg font-bold text-label-md bg-primary text-on-primary hover:bg-primary-container shadow-sm transition-all active:scale-95 flex items-center gap-sm">
              <Save size={18} />
              Guardar Usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
