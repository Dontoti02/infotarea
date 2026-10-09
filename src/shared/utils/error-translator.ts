/**
 * Traductor centralizado de errores técnicos y de Supabase a español amigable
 */
export function translateErrorMessage(error: any): string {
  if (!error) return "Ocurrió un error inesperado.";

  const raw = typeof error === "string" 
    ? error 
    : error.message || error.error_description || error.error || JSON.stringify(error);

  const lower = raw.toLowerCase();

  // Column / Schema cache errors
  if (lower.includes("could not find the") && lower.includes("column")) {
    return "Error de estructura: uno de los campos no coincide con la base de datos o la caché está desactualizada.";
  }
  if (lower.includes("relation") && lower.includes("does not exist")) {
    return "La tabla solicitada no existe en la base de datos.";
  }
  if (lower.includes("database error querying schema")) {
    return "Error de conexión con el esquema de la base de datos.";
  }

  // Authentication errors
  if (lower.includes("invalid login credentials") || lower.includes("invalid_grant") || lower.includes("invalid credentials")) {
    return "Correo electrónico o contraseña incorrectos.";
  }
  if (lower.includes("email not confirmed")) {
    return "Tu correo electrónico aún no ha sido confirmado.";
  }
  if (lower.includes("user already registered") || lower.includes("already registered") || lower.includes("user with this email already exists")) {
    return "Ya existe una cuenta registrada con este correo electrónico.";
  }
  if (lower.includes("signups not allowed")) {
    return "El autoregistro no está habilitado directamente en esta instancia.";
  }
  if (lower.includes("password should be at least") || lower.includes("weak_password")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (lower.includes("jwt expired") || lower.includes("token is expired")) {
    return "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.";
  }

  // Database constraints / RLS
  if (lower.includes("duplicate key") || lower.includes("unique constraint") || lower.includes("already exists")) {
    return "Ya existe un registro con estos datos en el sistema.";
  }
  if (lower.includes("row-level security") || lower.includes("rls") || lower.includes("permission denied")) {
    return "No tienes los permisos necesarios para realizar esta acción.";
  }
  if (lower.includes("violates foreign key constraint")) {
    return "La operación no se pudo completar porque está asociada a otros registros existentes.";
  }
  if (lower.includes("null value in column") || lower.includes("violates not-null constraint")) {
    return "Faltan campos obligatorios para completar la operación.";
  }

  // Network / Fetch
  if (lower.includes("failed to fetch") || lower.includes("network request failed") || lower.includes("networkerror")) {
    return "Error de conexión de red. Verifica tu conexión a internet.";
  }
  if (lower.includes("timeout")) {
    return "La solicitud tardó demasiado tiempo en responder. Inténtalo de nuevo.";
  }

  // Storage / Uploads
  if (lower.includes("the object was not found") || lower.includes("bucket not found")) {
    return "No se encontró el archivo o contenedor en el almacenamiento.";
  }
  if (lower.includes("payload too large") || lower.includes("file too large")) {
    return "El archivo seleccionado supera el tamaño máximo permitido.";
  }

  return raw;
}
