"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, ChevronDown, Search, Eye, Edit, UserMinus, 
  UserPlus, ChevronLeft, ChevronRight, ShieldCheck,
  X, AlertCircle, Loader2, CheckCircle2, UserPlus2,
  Upload, Download, Copy, Check
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";

function CreateUserModal({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [grade, setGrade] = useState("1");
  const [section, setSection] = useState("A");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          section: role === 'student' ? `${grade}${section}` : undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear usuario');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[32rem] relative overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary to-secondary" />
        
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <UserPlus2 size={18} />
            </div>
            <div>
              <h3 className="text-title-lg font-bold text-on-surface">Crear Nuevo Usuario</h3>
              <p className="text-label-sm text-on-surface-variant">Añadir una nueva cuenta al sistema</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error p-3 rounded-xl flex items-center gap-2 text-label-md">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Nombre Completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@instituto.edu"
              required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Contraseña Temporal</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Rol de la Cuenta</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
            >
              <option value="student">Estudiante</option>
              <option value="teacher">Docente</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {role === 'student' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-label-md font-bold text-on-surface">Grado</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                >
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g.toString()}>
                      {g}° Grado
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-label-md font-bold text-on-surface">Sección</label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                >
                  {["A", "B", "C", "D", "E", "F", "G"].map((s) => (
                    <option key={s} value={s}>
                      Sección {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-label-md hover:bg-surface-container transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !email || !password || !fullName} className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus2 size={16} />}
              {loading ? "Creando..." : "Crear Usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function EditUserModal({ 
  user, 
  onClose, 
  onSuccess 
}: { 
  user: any; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState(user.full_name || "");
  const [role, setRole] = useState(user.role || "student");
  
  // Determine initial grade and section if user is a student
  const initialSectionStr = user.courseSection || "";
  const initialGrade = ['1', '2', '3', '4', '5'].includes(initialSectionStr.charAt(0))
    ? initialSectionStr.charAt(0)
    : "1";
  const initialSec = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(initialSectionStr.charAt(1))
    ? initialSectionStr.charAt(1)
    : "A";

  const [grade, setGrade] = useState(initialGrade);
  const [section, setSection] = useState(initialSec);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    
    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        role: role
      })
      .eq('id', user.id);

    if (updateError) {
      setError("Error al actualizar usuario: " + updateError.message);
      setLoading(false);
      return;
    }

    // Handle course memberships (grade/section) changes
    const newSection = role === 'student' ? `${grade}${section}` : null;
    const oldSection = user.role === 'student' ? user.courseSection : null;
    const roleChanged = user.role !== role;
    const sectionChanged = role === 'student' && oldSection !== newSection;

    if (roleChanged || sectionChanged) {
      // Deleting all existing course memberships for this user
      const { error: deleteError } = await supabase
        .from('course_members')
        .delete()
        .eq('profile_id', user.id);

      if (deleteError) {
        console.error("Error deleting old memberships:", deleteError);
      }

      // If user is a student, enroll them in courses of the new section
      if (role === 'student' && newSection) {
        const { data: courses, error: coursesError } = await supabase
          .from('courses')
          .select('id')
          .eq('section', newSection);

        if (coursesError) {
          console.error("Error fetching courses for section:", coursesError);
        }

        if (courses && courses.length > 0) {
          const inserts = courses.map(c => ({
            course_id: c.id,
            profile_id: user.id
          }));
          const { error: insertError } = await supabase
            .from('course_members')
            .insert(inserts);

          if (insertError) {
            console.error("Error enrolling student in section courses:", insertError);
          }
        } else {
          // If no course exists for the section, auto-create a default one
          const { data: newCourse, error: courseError } = await supabase
            .from('courses')
            .insert({
              name: `Aula ${newSection}`,
              section: newSection
            })
            .select('id')
            .single();

          if (!courseError && newCourse) {
            const { error: insertError } = await supabase
              .from('course_members')
              .insert({
                course_id: newCourse.id,
                profile_id: user.id
              });

            if (insertError) {
              console.error("Error enrolling student in new auto-created course:", insertError);
            }
          } else {
            console.error("Error auto-creating course for section:", courseError);
          }
        }
      }
    }

    onSuccess();
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[32rem] relative overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant">
          <h3 className="text-title-lg font-bold text-on-surface">Editar Usuario</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error p-3 rounded-xl flex items-center gap-2 text-label-md">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Nombre Completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-label-md font-bold text-on-surface">Rol del Usuario</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
            >
              <option value="student">Estudiante</option>
              <option value="teacher">Docente</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {role === 'student' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-label-md font-bold text-on-surface">Grado</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                >
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g.toString()}>
                      {g}° Grado
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-label-md font-bold text-on-surface">Sección</label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                >
                  {["A", "B", "C", "D", "E", "F", "G"].map((s) => (
                    <option key={s} value={s}>
                      Sección {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold text-label-md hover:bg-surface-container transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function ViewUserModal({ 
  user, 
  onClose 
}: { 
  user: any; 
  onClose: () => void; 
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const email = user.temp_credentials?.email || "No disponible";
  const tempPassword = user.temp_credentials?.temp_password || null;

  const copyToClipboard = async (text: string, type: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'teacher': return 'Docente';
      default: return 'Estudiante';
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[28rem] relative overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary to-secondary" />
        
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Eye size={18} />
            </div>
            <div>
              <h3 className="text-title-lg font-bold text-on-surface">Detalles del Usuario</h3>
              <p className="text-label-sm text-on-surface-variant">Información de cuenta y acceso</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Avatar and Main Info */}
          <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/60">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="text-title-lg font-bold text-primary">
                  {user.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h4 className="text-body-lg font-bold text-on-surface">{user.full_name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface border border-outline-variant font-medium">
                  {getRoleLabel(user.role)}
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  Reg: {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Credentials Section */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-label-sm font-bold text-on-surface">Correo Electrónico</span>
                {user.temp_credentials?.email && (
                  <button 
                    onClick={() => copyToClipboard(email, 'email')}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-bold"
                  >
                    {copiedEmail ? <Check size={12} /> : <Copy size={12} />}
                    {copiedEmail ? "Copiado" : "Copiar"}
                  </button>
                )}
              </div>
              <div className="px-4 py-3 bg-surface border border-outline-variant rounded-xl flex justify-between items-center group/item hover:border-primary/50 transition-colors">
                <span className="text-body-md text-on-surface break-all select-all font-mono">{email}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-label-sm font-bold text-on-surface">Contraseña Temporal</span>
                {tempPassword && (
                  <button 
                    onClick={() => copyToClipboard(tempPassword, 'password')}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-bold"
                  >
                    {copiedPassword ? <Check size={12} /> : <Copy size={12} />}
                    {copiedPassword ? "Copiado" : "Copiar"}
                  </button>
                )}
              </div>
              <div className="px-4 py-3 bg-surface border border-outline-variant rounded-xl flex justify-between items-center group/item hover:border-primary/50 transition-colors">
                {tempPassword ? (
                  <span className="text-body-md text-on-surface font-mono select-all font-bold tracking-wider">{tempPassword}</span>
                ) : (
                  <span className="text-body-sm text-on-surface-variant italic">Contraseña oculta (solo visible en cuentas recién importadas)</span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-surface-container text-on-surface font-bold text-label-md hover:bg-surface-container-high transition-colors border border-outline-variant">
              Cerrar Detalles
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ImportUsersModal({
  onClose,
  onSuccess
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);

        if (rawRows.length === 0) {
          throw new Error("El archivo de Excel está vacío.");
        }

        const normalized = [];

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          let rawNombre = '';
          let rawGrado = '';
          let rawSeccion = '';

          for (const key of Object.keys(row)) {
            const normKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (normKey.includes('nombre') || normKey.includes('alumno') || normKey.includes('estudiante')) {
              rawNombre = String(row[key]);
            } else if (normKey.includes('grado') && normKey.includes('seccion')) {
              rawGrado = String(row[key]);
              rawSeccion = '';
            } else if (normKey.includes('grado')) {
              rawGrado = String(row[key]);
            } else if (normKey.includes('seccion')) {
              rawSeccion = String(row[key]);
            }
          }

          // If seccion is missing, check if rawGrado contains both grade and section (e.g. "1A", "1°A")
          if (rawGrado && (!rawSeccion || rawGrado === rawSeccion)) {
            const cleanGradoSeccion = rawGrado.trim().toUpperCase().replace(/\s+/g, '');
            const digitMatch = cleanGradoSeccion.match(/[1-5]/);
            const letterMatch = cleanGradoSeccion.match(/[A-G]/);
            if (digitMatch) {
              rawGrado = `${digitMatch[0]}°`;
            }
            if (letterMatch) {
              rawSeccion = letterMatch[0];
            }
          }

          if (!rawNombre) {
            continue; // Skip rows without name
          }

          const nombreVal = rawNombre.trim();
          let gradoVal = rawGrado.trim();
          if (!gradoVal.includes('°')) {
            const firstChar = gradoVal.charAt(0);
            if (['1','2','3','4','5'].includes(firstChar)) {
              gradoVal = `${firstChar}°`;
            } else if (gradoVal.toLowerCase().includes('prim')) {
              gradoVal = '1°';
            } else if (gradoVal.toLowerCase().includes('seg')) {
              gradoVal = '2°';
            } else if (gradoVal.toLowerCase().includes('ter')) {
              gradoVal = '3°';
            } else if (gradoVal.toLowerCase().includes('cua')) {
              gradoVal = '4°';
            } else if (gradoVal.toLowerCase().includes('qui')) {
              gradoVal = '5°';
            } else {
              gradoVal = '1°';
            }
          }

          let seccionVal = rawSeccion.trim().toUpperCase().charAt(0);
          if (!['A','B','C','D','E','F','G'].includes(seccionVal)) {
            seccionVal = 'A';
          }

          const gradeDigit = gradoVal.replace(/[^1-5]/g, '') || '1';
          const cleanSection = `${gradeDigit}${seccionVal}`;

          // Autogenerate email
          const nameParts = nombreVal.split(',');
          let firstNames = '';
          let lastNames = '';
          if (nameParts.length >= 2) {
            lastNames = nameParts[0].trim();
            firstNames = nameParts[1].trim();
          } else {
            const spaceParts = nombreVal.trim().split(/\s+/);
            if (spaceParts.length >= 2) {
              firstNames = spaceParts.slice(0, Math.floor(spaceParts.length/2)).join(' ');
              lastNames = spaceParts.slice(Math.floor(spaceParts.length/2)).join(' ');
            } else {
              lastNames = nombreVal.trim();
              firstNames = 'estudiante';
            }
          }

          const cleanFirst = firstNames.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "").split(/\s+/).filter(Boolean)[0] || 'estudiante';
          const cleanLast = lastNames.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "").split(/\s+/).filter(Boolean)[0] || 'estudiante';

          const baseEmail = `${cleanFirst}.${cleanLast}@infotarea.com`;
          const password = Math.floor(100000 + Math.random() * 900000).toString();

          normalized.push({
            originalName: nombreVal,
            fullName: nombreVal,
            firstName: firstNames,
            firstSurname: lastNames,
            email: baseEmail,
            password,
            section: cleanSection,
          });
        }

        if (normalized.length === 0) {
          throw new Error("No se encontraron estudiantes válidos con nombre en el archivo Excel.");
        }

        // Resolve local email collisions in parsed batch
        const emailCounts: Record<string, number> = {};
        const finalRows = normalized.map(row => {
          let email = row.email;
          if (emailCounts[email]) {
            emailCounts[email]++;
            email = email.replace('@infotarea.com', `${emailCounts[email]}@infotarea.com`);
          } else {
            emailCounts[email] = 1;
          }
          return { ...row, email };
        });

        setParsedData(finalRows);
      } catch (err: any) {
        setError(err.message || "Error al procesar el archivo Excel.");
        setParsedData([]);
        setFile(null);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      // Send ALL students in a single request — processed in parallel on the server
      const response = await fetch('/api/admin/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: parsedData }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al importar estudiantes');
        setImporting(false);
        return;
      }

      setResults(data.results ?? []);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setImporting(false);
    }
  };

   const downloadCSV = () => {
     const headers = "Nombre Original,Nombre Completo,Correo,Contrasena,Grado y Seccion,Estado,Detalle\n";
     const rows = results.map(r => 
       `"${r.originalName}","${r.fullName}","${r.email}","${r.password}","${r.section}","${r.status === 'success' ? 'Éxito' : r.status === 'duplicate' ? 'Duplicado' : 'Error'}","${r.errorMessage || ''}"`
     ).join("\n");

     const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.setAttribute("href", url);
     link.setAttribute("download", `Credenciales_Importadas_${new Date().toISOString().substring(0, 10)}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
   };

  const copyResultsText = () => {
    const text = results
      .filter(r => r.status === 'success')
      .map((r, i) => `${i + 1}. ${r.fullName} | Sección: ${r.section}\n   Correo: ${r.email}\n   Contraseña: ${r.password}`)
      .join("\n\n");
    
    navigator.clipboard.writeText(text);
    alert("Lista de credenciales copiada al portapapeles!");
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-[44rem] max-h-[85vh] relative overflow-hidden flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary to-secondary shrink-0" />
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Upload size={18} />
            </div>
            <div>
              <h3 className="text-title-lg font-bold text-on-surface">Importación Masiva de Estudiantes</h3>
              <p className="text-label-sm text-on-surface-variant">Registra estudiantes desde un archivo XLSX y genera credenciales</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={importing}
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error p-3 rounded-xl flex items-center gap-2 text-label-md shrink-0">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Step 1: Upload File */}
          {parsedData.length === 0 && results.length === 0 && (
            <div className="border-2 border-dashed border-outline-variant hover:border-primary/50 transition-colors rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4 bg-surface-container-low group">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant group-hover:scale-105 transition-transform">
                <Upload size={32} className="text-primary" />
              </div>
              <div>
                <h4 className="text-body-lg font-bold text-on-surface">Selecciona tu archivo de Excel</h4>
                <p className="text-label-md text-on-surface-variant mt-1">Soporta formatos .xlsx con las columnas &quot;Nombres&quot; y &quot;grado y seccion&quot;</p>
              </div>
              
              <label className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-label-md cursor-pointer hover:bg-primary-container transition-colors inline-block">
                Buscar Archivo
                <input 
                  type="file" 
                  accept=".xlsx" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </label>
            </div>
          )}

          {/* Step 2: Import Progress */}
          {importing && (
            <div className="p-10 text-center space-y-6 bg-surface-container-low rounded-2xl border border-outline-variant">
              <div className="relative mx-auto w-16 h-16">
                <Loader2 className="animate-spin text-primary w-full h-full" />
              </div>
              <div className="space-y-1">
                <h4 className="text-body-lg font-bold text-on-surface">Importación en curso…</h4>
                <p className="text-label-md text-on-surface-variant">
                  Procesando <span className="font-bold text-primary">{parsedData.length}</span> estudiantes en paralelo, esto tomará solo unos segundos.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Preview Parsed Rows (Before Import) */}
          {parsedData.length > 0 && !importing && results.length === 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10">
                <div>
                  <h4 className="text-body-md font-bold text-primary">Previsualización de Estudiantes</h4>
                  <p className="text-label-sm text-on-surface-variant">Se detectaron {parsedData.length} registros listos para importar</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setParsedData([]); setFile(null); }} 
                    className="px-4 py-2 border border-outline-variant rounded-xl text-on-surface-variant font-bold text-label-sm hover:bg-surface-container transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleImport} 
                    className="px-5 py-2 bg-primary text-on-primary rounded-xl font-bold text-label-sm hover:bg-primary-container transition-colors shadow-sm"
                  >
                    Iniciar Importación
                  </button>
                </div>
              </div>

              <div className="border border-outline-variant rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-surface-variant text-on-surface-variant border-b border-outline-variant sticky top-0">
                      <th className="p-3 font-bold">#</th>
                      <th className="p-3 font-bold">Nombre Completo</th>
                      <th className="p-3 font-bold">Correo Propuesto</th>
                      <th className="p-3 font-bold">Contraseña</th>
                      <th className="p-3 font-bold">Sección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row, idx) => (
                      <tr key={idx} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                        <td className="p-3 text-on-surface-variant">{idx + 1}</td>
                        <td className="p-3 font-bold text-on-surface">{row.fullName}</td>
                        <td className="p-3 text-on-surface-variant font-mono">{row.email}</td>
                        <td className="p-3 text-on-surface-variant font-mono font-bold">{row.password}</td>
                        <td className="p-3 text-on-surface-variant font-mono">{row.section}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Summary Results (After Import) */}
          {results.length > 0 && !importing && (
            <div className="space-y-4">
               <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                 <div>
                   <h4 className="text-body-md font-bold text-green-700">¡Importación Finalizada!</h4>
                   <p className="text-label-sm text-on-surface-variant">
                     {results.filter(r => r.status === 'success').length} exitosos, 
                     {results.filter(r => r.status === 'duplicate').length} duplicados, 
                     {results.filter(r => r.status === 'error').length} errores de {results.length} registros procesados.
                   </p>
                 </div>
                 <div className="flex gap-2 shrink-0">
                   <button 
                     onClick={copyResultsText} 
                     className="px-4 py-2 border border-green-600/30 text-green-700 bg-white hover:bg-green-500/5 rounded-xl font-bold text-label-sm flex items-center gap-1.5 transition-colors"
                   >
                     <Copy size={14} /> Copiar Lista
                   </button>
                   <button 
                     onClick={downloadCSV} 
                     className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-label-sm flex items-center gap-1.5 transition-colors shadow-sm"
                   >
                     <Download size={14} /> Descargar CSV
                   </button>
                 </div>
               </div>

              <div className="border border-outline-variant rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-surface-variant text-on-surface-variant border-b border-outline-variant sticky top-0">
                      <th className="p-3 font-bold">Estudiante</th>
                      <th className="p-3 font-bold">Correo Registrado</th>
                      <th className="p-3 font-bold">Contraseña</th>
                      <th className="p-3 font-bold">Sección</th>
                      <th className="p-3 font-bold">Estado</th>
                    </tr>
                  </thead>
               <tbody>
                     {results.map((row, idx) => (
                       <tr key={idx} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                         <td className="p-3 font-bold text-on-surface">{row.fullName}</td>
                         <td className="p-3 text-on-surface-variant font-mono">{row.email}</td>
                         <td className="p-3 text-on-surface-variant font-mono font-bold">{row.password}</td>
                         <td className="p-3 text-on-surface-variant font-mono">{row.section}</td>
                         <td className="p-3">
                           {row.status === 'success' ? (
                             <span className="inline-flex px-2 py-0.5 text-xs font-bold text-green-700 bg-green-100 rounded-full">Éxito</span>
                           ) : row.status === 'duplicate' ? (
                             <span className="inline-flex px-2 py-0.5 text-xs font-bold text-yellow-700 bg-yellow-100 rounded-full">Duplicado</span>
                           ) : (
                             <span className="inline-flex px-2 py-0.5 text-xs font-bold text-red-700 bg-red-100 rounded-full" title={row.errorMessage}>Error</span>
                           )}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                </table>
              </div>

              <div className="pt-2 text-center shrink-0">
                <button 
                  onClick={onClose} 
                  className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-label-md hover:bg-primary-container transition-colors shadow-sm"
                >
                  Finalizar y Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [viewingUser, setViewingUser] = useState<any | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
   const [sectionFilter, setSectionFilter] = useState("");
   
   const supabase = createClient();

   const fetchUsers = async () => {
     setLoading(true);

     // Step 1: fetch profiles + credentials + course_members
     const { data, error } = await supabase
       .from('profiles')
       .select(`
         *,
         temp_credentials(email, temp_password),
         course_members (
           courses (
             id,
             section,
             created_at
           )
         )
       `)
       .order('created_at', { ascending: false });

     // Step 2: fetch courses for teacher section display
     const { data: coursesData } = await supabase
       .from('courses')
       .select('teacher_id, section');

     const teacherSectionMap: Record<string, string[]> = {};
     (coursesData ?? []).forEach((c: any) => {
       if (c.teacher_id && c.section) {
         if (!teacherSectionMap[c.teacher_id]) teacherSectionMap[c.teacher_id] = [];
         if (!teacherSectionMap[c.teacher_id].includes(c.section)) {
           teacherSectionMap[c.teacher_id].push(c.section);
         }
       }
     });

     if (data && !error) {
       const usersWithCourseSection = data.map(user => {
         let courseSection = null;
         if (user.role === 'student') {
           // Collect all courses this student is enrolled in
           const allMemberCourses: any[] = (user.course_members ?? [])
             .map((cm: any) => cm.courses)
             .filter(Boolean);

           if (allMemberCourses.length > 0) {
             // Deduplicate sections (all courses for a student share the same section)
             const sections = [...new Set(allMemberCourses.map((c: any) => c.section).filter(Boolean))];
             courseSection = sections[0] || null;
           }
         } else if (user.role === 'teacher') {
           const sections = teacherSectionMap[user.id] || [];
           courseSection = sections.join(', ') || null;
         }
         return { ...user, courseSection };
       });
       setUsers(usersWithCourseSection);
       setLoading(false);
       return;
     }

     // Fallback: load profiles alone, then load course_members and courses separately
     console.warn('fetchUsers join failed, trying separate queries. Error:', error?.message);

     const { data: profilesData } = await supabase
       .from('profiles')
       .select('*, temp_credentials(email, temp_password)')
       .order('created_at', { ascending: false });

     if (!profilesData) { setLoading(false); return; }

     // Get all course_members with their course section, ordered by creation time
     const { data: membersData, error: membersError } = await supabase
       .from('course_members')
       .select('profile_id, courses(id, section, created_at)');

     if (membersError) {
       console.warn('Cannot read course_members - RLS policies may be missing. Run migration: 20260531010000_fix_course_members_rls.sql in Supabase SQL Editor.', membersError.message);
     }

     // Build a map of profile_id → section for students.
     // A student may appear in multiple courses with the same section (e.g. "Aula 1B" + "Matemática 1B").
     // Collect all sections per student and deduplicate.
     const sectionListMap: Record<string, Set<string>> = {};
     (membersData ?? []).forEach((m: any) => {
       if (m.profile_id && m.courses?.section) {
         if (!sectionListMap[m.profile_id]) {
           sectionListMap[m.profile_id] = new Set();
         }
         sectionListMap[m.profile_id].add(m.courses.section);
       }
     });

     // Convert to a single section string per student (they should all be the same section)
     const sectionMap: Record<string, string> = {};
     for (const [profileId, sections] of Object.entries(sectionListMap)) {
       const arr = Array.from(sections);
       sectionMap[profileId] = arr[0]; // All sections should be the same (e.g. "1B")
     }

     // Try to get all courses taught by teachers (fallback)
     const { data: fallbackCoursesData } = await supabase
       .from('courses')
       .select('teacher_id, section');

     const fallbackTeacherSectionMap: Record<string, string[]> = {};
     (fallbackCoursesData ?? []).forEach((c: any) => {
       if (c.teacher_id && c.section) {
         if (!fallbackTeacherSectionMap[c.teacher_id]) {
           fallbackTeacherSectionMap[c.teacher_id] = [];
         }
         if (!fallbackTeacherSectionMap[c.teacher_id].includes(c.section)) {
           fallbackTeacherSectionMap[c.teacher_id].push(c.section);
         }
       }
     });

     setUsers(profilesData.map(user => {
       let courseSection = null;
       if (user.role === 'student') {
         courseSection = sectionMap[user.id] || null;
       } else if (user.role === 'teacher') {
         courseSection = fallbackTeacherSectionMap[user.id]?.join(', ') || null;
       }
       return {
         ...user,
         courseSection
       };
     }));
     setLoading(false);
   };

  const handleDeleteUser = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar al usuario "${name}"?`)) {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Error al eliminar usuario: ' + (data.error || 'Error desconocido'));
      } else {
        const next = new Set(selectedUserIds);
        next.delete(id);
        setSelectedUserIds(next);
        fetchUsers();
      }
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const ids = filteredUsers.map(u => u.id);
      setSelectedUserIds(new Set(ids));
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const handleToggleSelectUser = (id: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedUserIds(next);
  };

  const handleBulkDeleteUsers = async () => {
    const selectedCount = selectedUserIds.size;
    if (selectedCount === 0) return;

    const confirmMessage = selectedCount === 1
      ? '¿Estás seguro de que deseas eliminar al usuario seleccionado?'
      : `¿Estás seguro de que deseas eliminar a los ${selectedCount} usuarios seleccionados? Esta acción es irreversible.`;

    if (confirm(confirmMessage)) {
      setLoading(true);
      const idsArray = Array.from(selectedUserIds);
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsArray }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Error al eliminar usuarios: ' + (data.error || 'Error desconocido'));
      } else {
        setSelectedUserIds(new Set());
        fetchUsers();
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleDisplay = (role: string) => {
    switch(role) {
      case 'admin': return { label: 'Administrador', classes: 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]' };
      case 'teacher': return { label: 'Docente', classes: 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]' };
      default: return { label: 'Estudiante', classes: 'bg-surface-container text-on-surface border-outline-variant' };
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

   const filteredUsers = users.filter(user => {
     if (roleFilter && user.role !== roleFilter) return false;
     
     // Grade filter
     if (gradeFilter) {
       // Only students have a courseSection, so if not student, exclude
       if (user.role !== 'student') return false;
       const courseSection = user.courseSection;
       if (!courseSection) return false;
       const userGrade = courseSection.charAt(0); // first character
       if (userGrade !== gradeFilter) return false;
     }
     
     // Section filter
     if (sectionFilter) {
       if (user.role !== 'student') return false;
       const courseSection = user.courseSection;
       if (!courseSection) return false;
       const userSection = courseSection.charAt(1); // second character
       if (userSection !== sectionFilter) return false;
     }

     // Search query filter
     if (searchQuery) {
       const q = searchQuery.toLowerCase().trim();
       const name = (user.full_name || "").toLowerCase();
       const email = (user.email || user.temp_credentials?.email || "").toLowerCase();
       const id = (user.id || "").toLowerCase();
       const sec = (user.courseSection || "").toLowerCase();
       
       const matchesName = name.includes(q);
       const matchesEmail = email.includes(q);
       const matchesId = id.includes(q);
       const matchesSec = sec.includes(q);
       
       if (!matchesName && !matchesEmail && !matchesId && !matchesSec) {
         return false;
       }
     }
     
     return true;
   });

  return (
    <div className="space-y-lg">
      {editingUser && (
        <EditUserModal 
          user={editingUser} 
          onClose={() => setEditingUser(null)} 
          onSuccess={fetchUsers} 
        />
      )}

      {showCreateModal && (
        <CreateUserModal 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={fetchUsers} 
        />
      )}

      {viewingUser && (
        <ViewUserModal 
          user={viewingUser} 
          onClose={() => setViewingUser(null)} 
        />
      )}

      {showImportModal && (
        <ImportUsersModal 
          onClose={() => setShowImportModal(false)} 
          onSuccess={fetchUsers} 
        />
      )}

       {/* Toolbar Area */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md mb-lg">
         <div className="flex flex-col sm:flex-row gap-sm w-full md:w-auto">
           {/* Search Input */}
           <div className="relative min-w-[200px] md:min-w-[260px]">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4.5 h-4.5" />
             <input
               type="text"
               placeholder="Buscar por nombre, correo, sección o ID..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary"
             />
           </div>

            <div className="flex gap-sm">
              {/* Grade Filter */}
              {(roleFilter === "" || roleFilter === "student") && (
                <div className="relative transition-all duration-300">
                  <select 
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="appearance-none bg-surface border border-outline-variant rounded-lg px-4 py-2 pr-10 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Todos los Grados</option>
                    {[1,2,3,4,5].map(g => (
                      <option key={g} value={g.toString()}>{g}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant w-5 h-5" />
                </div>
              )}
              {/* Section Filter */}
              {(roleFilter === "" || roleFilter === "student") && (
                <div className="relative transition-all duration-300">
                  <select 
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                    className="appearance-none bg-surface border border-outline-variant rounded-lg px-4 py-2 pr-10 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Todas las Secciones</option>
                    {['A','B','C','D','E','F','G'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant w-5 h-5" />
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-sm w-full md:w-auto shrink-0 justify-end">
            <button 
              onClick={() => setShowImportModal(true)}
              className="bg-surface border border-outline-variant text-on-surface hover:bg-surface-container font-bold text-label-md px-lg py-3 rounded-lg flex items-center gap-xs transition-all shadow-sm"
            >
              <Upload size={18} /> Importar Estudiantes (Excel)
            </button>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-bold text-label-md px-lg py-3 rounded-lg flex items-center gap-xs transition-all shadow-sm"
            >
              <Plus size={20} /> Crear Usuario
            </button>
          </div>
        </div>

        {/* Roles Tabs */}
        <div className="flex border-b border-outline-variant overflow-x-auto scrollbar-none mb-4">
          {[
            { id: "", label: "Todos los Usuarios", count: users.length, activeColor: "text-primary border-primary", badgeColor: "bg-primary/10 text-primary", borderBg: "bg-primary" },
            { id: "admin", label: "Administradores", count: users.filter(u => u.role === "admin").length, activeColor: "text-indigo-600 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400", badgeColor: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300", borderBg: "bg-indigo-600 dark:bg-indigo-400" },
            { id: "teacher", label: "Docentes", count: users.filter(u => u.role === "teacher").length, activeColor: "text-teal-600 border-teal-600 dark:text-teal-400 dark:border-teal-400", badgeColor: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300", borderBg: "bg-teal-600 dark:bg-teal-400" },
            { id: "student", label: "Estudiantes", count: users.filter(u => u.role === "student").length, activeColor: "text-sky-600 border-sky-600 dark:text-sky-400 dark:border-sky-400", badgeColor: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300", borderBg: "bg-sky-600 dark:bg-sky-400" },
          ].map((tab) => {
            const active = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setRoleFilter(tab.id);
                  setSelectedUserIds(new Set()); // Reset selections on tab change
                }}
                className={`px-6 pb-3 pt-2 font-bold text-label-md transition-all relative flex items-center gap-2 outline-none whitespace-nowrap cursor-pointer ${
                  active
                    ? `${tab.activeColor} font-black`
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  active 
                    ? tab.badgeColor 
                    : "bg-surface-container-high text-on-surface-variant"
                }`}>
                  {tab.count}
                </span>
                {active && (
                  <span className={`absolute bottom-0 left-0 w-full h-0.5 ${tab.borderBg} rounded-t-full`} />
                )}
              </button>
            );
          })}
        </div>
 
       {/* Advanced Data Table */}
       <div className="bg-surface rounded-xl shadow-sm border border-outline-variant overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
             <tr className="bg-surface-variant text-on-surface-variant text-label-md border-b border-outline-variant">
                 <th className="p-lg py-4 font-bold w-12 text-center select-none">
                   <input 
                     type="checkbox" 
                     className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer accent-primary"
                     checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                     onChange={(e) => handleSelectAll(e.target.checked)}
                   />
                 </th>
                 <th className="p-lg py-4 font-bold">Nombre</th>
                 <th className="p-lg py-4 font-bold">Grado y Sección</th>
                 <th className="p-lg py-4 font-bold">ID / Email</th>
                 <th className="p-lg py-4 font-bold">Rol</th>
                 <th className="p-lg py-4 font-bold">Fecha de Registro</th>
                 <th className="p-lg py-4 font-bold text-right">Acciones</th>
               </tr>
            </thead>
            <tbody className="text-body-md text-on-surface">
              {loading ? (
                <tr>
                 <td colSpan={7} className="p-10 text-center">
                   <Loader2 className="animate-spin text-primary mx-auto mb-2" size={32} />
                   <p className="text-on-surface-variant">Cargando usuarios...</p>
                 </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                 <td colSpan={7} className="p-10 text-center text-on-surface-variant">
                   No se encontraron usuarios.
                 </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleUI = getRoleDisplay(user.role);
                  return (
                    <tr key={user.id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors group">
                      <td className="p-lg py-4 text-center select-none">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer accent-primary"
                          checked={selectedUserIds.has(user.id)}
                          onChange={() => handleToggleSelectUser(user.id)}
                        />
                      </td>
                 <td className="p-lg py-4">
                   <div className="flex items-center gap-md">
                     <div className="h-10 w-10 rounded-full bg-surface-container-highest overflow-hidden flex items-center justify-center shrink-0">
                       {user.avatar_url ? (
                         <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                       ) : (
                         <span className="font-bold text-on-surface-variant">{getInitials(user.full_name)}</span>
                       )}
                     </div>
                     <div>
                       <div className="font-bold flex items-center gap-1">
                         {user.full_name} 
                         {user.role === 'admin' && <ShieldCheck size={16} className="text-primary" />}
                       </div>
                     </div>
                   </div>
                 </td>
                 <td className="p-lg py-4 text-on-surface-variant">
                    {user.role === 'student' 
                      ? (user.courseSection || '-') 
                      : user.role === 'teacher' 
                        ? (user.courseSection || '') 
                        : '-'}
                  </td>
                  <td className="p-lg py-4 text-on-surface-variant text-label-sm">
                    {user.email ? (
                      <span className="font-mono text-xs text-on-surface font-semibold select-all">{user.email}</span>
                    ) : user.temp_credentials?.email ? (
                      <span className="font-mono text-xs text-on-surface font-semibold select-all">{user.temp_credentials.email}</span>
                    ) : (
                      <>
                        {user.id.substring(0, 8)}...<br/>
                        <span className="text-xs opacity-70">Email protegido</span>
                      </>
                    )}
                  </td>
                 <td className="p-lg py-4">
                   <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-label-sm font-bold border ${roleUI.classes}`}>
                     {roleUI.label}
                   </span>
                 </td>
                      <td className="p-lg py-4 text-on-surface-variant text-label-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-lg py-4 text-right">
                        <div className="flex items-center justify-end gap-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setViewingUser(user)}
                            className="text-on-surface-variant hover:text-primary transition-colors p-1" 
                            title="Ver Credenciales / Detalles"
                          >
                            <Eye size={20} />
                          </button>
                          <button 
                            onClick={() => setEditingUser(user)}
                            className="text-on-surface-variant hover:text-primary transition-colors p-1" 
                            title="Editar Rol / Nombre"
                          >
                            <Edit size={20} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id, user.full_name)}
                            className="text-on-surface-variant hover:text-error transition-colors p-1" 
                            title="Eliminar Usuario"
                          >
                            <UserMinus size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {!loading && (
          <div className="bg-surface-variant/50 border-t border-outline-variant p-md flex items-center justify-between text-body-md text-on-surface-variant">
            <div>Mostrando {filteredUsers.length} usuarios</div>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedUserIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-surface-container-lowest/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl border border-outline-variant flex items-center gap-6 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[12px] font-bold text-on-primary shadow-sm font-mono">
              {selectedUserIds.size}
            </div>
            <span className="text-body-md font-bold text-on-surface">usuarios seleccionados</span>
          </div>
          
          <div className="w-[1px] h-6 bg-outline-variant" />
          
          <div className="flex gap-2">
            <button 
              onClick={() => setSelectedUserIds(new Set())}
              className="px-4 py-2 hover:bg-surface-container border border-outline-variant text-on-surface font-bold text-label-sm rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              onClick={handleBulkDeleteUsers}
              className="px-4 py-2 bg-error text-on-error hover:bg-error/95 font-bold text-label-sm rounded-xl flex items-center gap-1.5 transition-colors shadow-md cursor-pointer"
            >
              <UserMinus size={16} /> Eliminar Seleccionados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
