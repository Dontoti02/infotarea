# Lógica de Importación de Excel

## Dependencias necesarias

```bash
npm install xlsx
# o
yarn add xlsx
```

## Importaciones

```typescript
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase'; // Ajustar según tu configuración de Supabase
```

## Helper para mensajes de error de Supabase

```typescript
// Helper to extract a readable message from Supabase error objects
const getSupabaseErrorMessage = (err: any): string => {
  if (!err) return 'Error desconocido.';
  // Supabase errors have these fields
  const code    = err.code    || '';
  const message = err.message || '';
  const details = err.details || '';
  const hint    = err.hint    || '';
  if (message) {
    let full = message;
    if (details) full += ` — ${details}`;
    if (hint)    full += ` (${hint})`;
    if (code)    full += ` [${code}]`;
    return full;
  }
  // Fallback: stringify the whole object
  try { return JSON.stringify(err); } catch { return String(err); }
};
```

## Función principal de importación de Excel

```typescript
const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  e.target.value = '';
  setLoading(true);

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<any>(worksheet);

    if (rows.length === 0) {
      alert('El archivo de Excel está vacío.');
      setLoading(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errorsList: string[] = [];

    // Check headers from first row
    const sampleRow = rows[0];
    const foundHeaders = Object.keys(sampleRow);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let rawNombre = '';
      let rawGrado = '';
      let rawSeccion = '';

      for (const key of Object.keys(row)) {
        const normKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normKey.includes('nombre') || normKey.includes('alumno') || normKey.includes('estudiante')) {
          rawNombre = String(row[key]);
        } else if (normKey.includes('grado') && normKey.includes('seccion')) {
          // Merged column e.g., "grado y seccion"
          rawGrado = String(row[key]);
          rawSeccion = ''; // will split below
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
        const letterMatch = cleanGradoSeccion.match(/[A-Z]/);
        if (digitMatch) {
          rawGrado = `${digitMatch[0]}°`;
        }
        if (letterMatch) {
          rawSeccion = letterMatch[0];
        }
      }

      if (!rawNombre || !rawGrado || !rawSeccion) {
        const missingCols = [];
        if (!rawNombre) missingCols.push('Nombre');
        if (!rawGrado) missingCols.push('Grado');
        if (!rawSeccion) missingCols.push('Sección');
        const errorMsg = `Fila ${i + 1} omitida: Faltan columnas [${missingCols.join(', ')}]. Columnas en Excel: [${Object.keys(row).join(', ')}]`;
        console.warn(errorMsg);
        if (errorsList.length < 5) errorsList.push(errorMsg);
        errorCount++;
        continue;
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

      const seccionVal = rawSeccion.trim().toUpperCase().charAt(0);
      const studentId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      // Autogenerate email in format "nombre.apellido@iemc.edu.pe" from "APELLIDOS, NOMBRES"
      const nameParts = nombreVal.split(',');
      let firstNames = '';
      let lastNames = '';
      if (nameParts.length >= 2) {
        lastNames = nameParts[0].trim();
        firstNames = nameParts[1].trim();
      } else {
        lastNames = nombreVal.trim();
      }

      const cleanFirst = firstNames.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "").split(/\s+/).filter(Boolean)[0] || 'estudiante';
      const cleanLast = lastNames.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "").split(/\s+/).filter(Boolean)[0] || 'estudiante';

      let emailVal = `${cleanFirst}.${cleanLast}@iemc.edu.pe`;

      const initials = nombreVal.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'ES';
      const colors = [
        'bg-primary-fixed text-primary',
        'bg-secondary-fixed text-secondary',
        'bg-tertiary-fixed text-tertiary',
        'bg-surface-container-high text-on-surface-variant'
      ];
      const hash = nombreVal.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const colorVal = colors[hash % colors.length];
      const contrasenaVal = Math.floor(100000 + Math.random() * 900000).toString();

      const payload: Record<string, any> = {
        id: studentId,
        nombre: nombreVal,
        email: emailVal,
        grado: gradoVal,
        seccion: seccionVal,
        estado: 'Activo',
        iniciales: initials,
        color: colorVal,
        contrasena: contrasenaVal
      };

      let { error: insertErr } = await supabase
        .from('estudiantes')
        .insert([payload]);

      if (insertErr) {
        let errMsg = getSupabaseErrorMessage(insertErr);
        console.error(`Error al insertar fila ${i + 1}:`, insertErr);

        // Retry for unique email violation (code 23505) by appending random digits
        if (insertErr.code === '23505' && errMsg.toLowerCase().includes('email')) {
          const randomSuffix = Math.floor(10 + Math.random() * 90);
          const alternateEmail = `${cleanFirst}.${cleanLast}${randomSuffix}@iemc.edu.pe`;
          payload.email = alternateEmail;
          
          const { error: retryEmailErr } = await supabase
            .from('estudiantes')
            .insert([payload]);

          if (retryEmailErr) {
            const retryMsg = getSupabaseErrorMessage(retryEmailErr);
            if (errorsList.length < 5) errorsList.push(`Fila ${i + 1} (${nombreVal}): ${retryMsg}`);
            errorCount++;
          } else {
            successCount++;
          }
          continue;
        }

        // Check for contrasena missing column retry
        if (
          insertErr.code === '42703' ||
          (errMsg.toLowerCase().includes('contrasena') && errMsg.toLowerCase().includes('column'))
        ) {
          const { contrasena: _removed, ...payloadWithoutPwd } = payload;
          const { error: retryErr } = await supabase
            .from('estudiantes')
            .insert([payloadWithoutPwd]);
          if (retryErr) {
            const retryMsg = getSupabaseErrorMessage(retryErr);
            if (errorsList.length < 5) errorsList.push(`Fila ${i + 1} (${nombreVal}): ${retryMsg}`);
            errorCount++;
          } else {
            successCount++;
          }
          continue;
        }

        if (errorsList.length < 5) errorsList.push(`Fila ${i + 1} (${nombreVal}): ${errMsg}`);
        errorCount++;
      } else {
        successCount++;
      }
    }

    await loadStudents();
    
    let summaryAlert = `Importación completada:\n- ${successCount} estudiantes importados con éxito.\n- ${errorCount} filas omitidas o con errores.`;
    if (errorsList.length > 0) {
      summaryAlert += `\n\nErrores encontrados (primeros 5):\n${errorsList.join('\n')}`;
    }
    summaryAlert += `\n\nColumnas identificadas en Excel: [${foundHeaders.join(', ')}]`;
    
    alert(summaryAlert);
  } catch (err: any) {
    console.error('Error al procesar el archivo Excel:', err);
    alert(`Error al procesar el archivo de Excel: ${err.message || err}`);
  } finally {
    setLoading(false);
  }
};
```

## Componente de input para el archivo Excel

```typescript
<label className="flex items-center gap-2 px-4 py-2 border border-outline-variant rounded-lg text-on-surface hover:bg-surface-container-low transition-colors text-label-md font-label-md cursor-pointer">
  <span className="material-symbols-outlined text-[18px]">upload_file</span>
  <span>Importar Excel</span>
  <input
    type="file"
    accept=".xlsx, .xls"
    onChange={handleExcelImport}
    className="hidden"
  />
</label>
```

## Notas importantes

1. **Formato del Excel**: El Excel debe tener columnas que contengan "nombre", "grado" y "sección". Los nombres de las columnas pueden variar (ej: "alumno", "estudiante", "grado y seccion", etc.) y el sistema las detectará automáticamente.

2. **Formato del nombre**: El sistema espera el nombre en formato "APELLIDOS, NOMBRES" para generar el email automáticamente como "nombre.apellido@dominio.com".

3. **Grado y Sección**: Pueden estar en columnas separadas o combinadas (ej: "1A", "1°A"). El sistema las separará automáticamente.

4. **Manejo de errores**: 
   - Si el email ya existe (error 23505), se agregará un número aleatorio al final
   - Si la columna "contrasena" no existe en la base de datos (error 42703), se insertará sin ese campo

5. **Base de datos**: Ajusta el nombre de la tabla ('estudiantes') y los campos según tu estructura de base de datos.

6. **Email domain**: Cambia "@iemc.edu.pe" por tu dominio de email deseado.

7. **Estados**: Ajusta el estado por defecto ('Activo') según tus necesidades.
