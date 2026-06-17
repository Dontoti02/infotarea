"use client";

import React from "react";
import { 
  ChevronRight, 
  Download, 
  Search, 
  FileText, 
  CheckCircle2, 
  Eye, 
  ChevronLeft, 
  FileCode 
} from "lucide-react";

export function SubmissionManagement() {
  const submissions = [
    { 
      id: 1, 
      student: "Martín Ramírez", 
      initials: "MR", 
      date: "12 Oct, 14:30", 
      file: "Ensayo_Final_MR.pdf", 
      status: "Pendiente", 
      statusColor: "bg-surface-variant text-on-surface-variant",
      dotColor: "bg-outline",
      action: "Revisar" 
    },
    { 
      id: 2, 
      student: "Lucía Gómez", 
      initials: "LG", 
      date: "12 Oct, 16:15", 
      file: "Gomez_RevInd.docx", 
      status: "En revisión", 
      statusColor: "bg-primary-container text-on-primary-container",
      dotColor: "bg-primary animate-pulse",
      action: "Continuar" 
    },
    { 
      id: 3, 
      student: "Carlos Silva", 
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDJ3lWAl3O7VN_8nuywZ6ese0bDaZm3tQC4p0zyDe_nX7PZ79JsnIumF8NYsMT5F7YgIkzv74TLTEQ3km-MdwkzI9hfLPTZD0crdR_YdnfIDELLtRDqneVa6RwRMcN_Iyz-AE-YPg_EOCk85BZ-1SUGOp76zLOGJZIs56Bu7IY5ocpYCmc7THBSMNMZqoFr8DfxIt2-6TSKXudqUpkvwoqP2RSRyb6xRVu8aOjRz7TvZtD8FKXxCkosKGcK1tuyAqHexhjA-BMc74O8",
      date: "11 Oct, 09:00", 
      file: "CSilva_Ensayo.pdf", 
      status: "Revisado", 
      statusColor: "bg-secondary-container text-on-secondary-container",
      score: "18/20",
      action: "visibility" 
    },
    { 
      id: 4, 
      student: "Ana Pérez", 
      initials: "AP", 
      date: "12 Oct, 18:45", 
      file: "Perez_Ana_Industrial.docx", 
      status: "Pendiente", 
      statusColor: "bg-surface-variant text-on-surface-variant",
      dotColor: "bg-outline",
      action: "Revisar" 
    }
  ];

  return (
    <div className="space-y-lg">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md">
        <div>
          <div className="flex items-center gap-xs text-on-surface-variant mb-xs">
            <span className="text-label-md font-bold">Historia Contemporánea</span>
            <ChevronRight size={14} />
            <span className="text-label-md font-bold">Unidad 2</span>
          </div>
          <h2 className="text-headline-md font-bold text-on-surface">Revisiones: Ensayo sobre la Revolución Industrial</h2>
        </div>
        <button className="flex items-center gap-xs px-md py-sm bg-surface-container-low text-primary border border-outline-variant rounded-lg hover:bg-surface-container transition-colors font-bold text-label-md">
          <Download size={18} />
          Exportar Notas
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row justify-between gap-md items-start lg:items-center bg-surface-container-lowest p-md rounded-xl shadow-sm border border-outline-variant">
        <div className="flex flex-wrap gap-xs">
          {["Todos (32)", "Pendientes (12)", "En revisión (5)", "Revisados (15)"].map((filter, i) => (
            <button 
              key={filter}
              className={`px-md py-sm rounded-full font-bold text-label-md transition-colors ${i === 0 ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface-variant border border-outline-variant hover:bg-surface-container-low'}`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input 
            className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all" 
            placeholder="Buscar estudiante..." 
            type="text"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-lg py-md text-label-md font-bold text-on-surface-variant uppercase">Estudiante</th>
                <th className="px-lg py-md text-label-md font-bold text-on-surface-variant uppercase">Fecha de entrega</th>
                <th className="px-lg py-md text-label-md font-bold text-on-surface-variant uppercase">Archivo adjunto</th>
                <th className="px-lg py-md text-label-md font-bold text-on-surface-variant uppercase">Estado</th>
                <th className="px-lg py-md text-label-md font-bold text-on-surface-variant uppercase text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="text-body-md text-on-surface">
              {submissions.map((sub) => (
                <tr key={sub.id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors group last:border-0">
                  <td className="px-lg py-md">
                    <div className="flex items-center gap-sm">
                      {sub.avatar ? (
                        <img src={sub.avatar} alt={sub.student} className="w-8 h-8 rounded-full object-cover border border-outline-variant" />
                      ) : (
                        <div className={`w-8 h-8 rounded-full ${sub.id % 2 === 0 ? 'bg-primary-container text-on-primary-container' : 'bg-tertiary-container text-on-tertiary-container'} flex items-center justify-center font-bold text-label-md`}>
                          {sub.initials}
                        </div>
                      )}
                      <span className="font-bold text-on-surface">{sub.student}</span>
                    </div>
                  </td>
                  <td className="px-lg py-md text-on-surface-variant font-medium">{sub.date}</td>
                  <td className="px-lg py-md">
                    <div className="flex items-center gap-xs text-primary hover:underline cursor-pointer w-fit font-medium">
                      <FileText size={18} />
                      <span>{sub.file}</span>
                    </div>
                  </td>
                  <td className="px-lg py-md">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-bold text-label-sm ${sub.statusColor}`}>
                      {sub.dotColor ? <span className={`w-1.5 h-1.5 rounded-full mr-2 ${sub.dotColor}`}></span> : <CheckCircle2 size={14} className="mr-1.5" />}
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-lg py-md text-right">
                    {sub.score ? (
                      <div className="flex items-center justify-end gap-sm">
                        <span className="text-label-md font-bold text-on-surface">{sub.score}</span>
                        <button className="p-1 rounded-md text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors">
                          <Eye size={20} />
                        </button>
                      </div>
                    ) : (
                      <button className="px-md py-1.5 rounded-md border border-primary text-primary hover:bg-primary hover:text-on-primary font-bold text-label-md transition-colors">
                        {sub.action}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-surface-container-low border-t border-outline-variant px-lg py-sm flex items-center justify-between">
          <span className="text-body-md font-medium text-on-surface-variant">Mostrando 1 a 4 de 32 entregas</span>
          <div className="flex items-center gap-sm">
            <button className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container disabled:opacity-50 transition-colors" disabled>
              <ChevronLeft size={20} />
            </button>
            <button className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
