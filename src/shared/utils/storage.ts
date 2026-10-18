/**
 * Utilidades de Supabase Storage compartidas por la plataforma.
 *
 * La biblioteca de materiales guarda los archivos en el bucket público
 * `contenidos` y registra en `resources.file_url` la URL pública completa.
 * Para poder borrar el archivo (además del registro) hay que reconstruir su
 * ruta interna —la clave del objeto— a partir de esa URL.
 */

export const CONTENT_BUCKET = "contenidos";

/** Bucket público donde se guardan las fotos de perfil. */
export const PROFILE_BUCKET = "img_perfiles";

/**
 * Ruta interna para una nueva foto de perfil dentro de `img_perfiles`.
 *
 * Cada persona guarda sus fotos en su propia carpeta (`<userId>/avatar-<marca>.<ext>`);
 * así la foto anterior se puede borrar sin tocar las de los demás roles.
 * Devuelve `null` si no hay un identificador de usuario válido.
 */
export function buildAvatarPath(userId: unknown, fileName: unknown, timestamp: number = Date.now()): string | null {
  if (typeof userId !== "string" || userId.trim().length === 0) return null;

  const name = typeof fileName === "string" ? fileName.trim() : "";
  const dotIndex = name.lastIndexOf(".");
  const rawExt = dotIndex > -1 ? name.slice(dotIndex + 1) : "";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeExt = ext.length > 0 && ext.length <= 5 ? ext : "jpg";

  return `${userId.trim()}/avatar-${timestamp}.${safeExt}`;
}

/**
 * Extrae la ruta interna de un objeto a partir de su URL pública
 * (`.../storage/v1/object/public/<bucket>/<ruta>`).
 *
 * Devuelve `null` cuando la URL no pertenece al bucket indicado (por ejemplo,
 * enlaces externos o valores vacíos), para no intentar borrar objetos ajenos
 * al almacenamiento de la plataforma.
 */
export function storagePathFromPublicUrl(fileUrl: unknown, bucket: string = CONTENT_BUCKET): string | null {
  if (typeof fileUrl !== "string" || fileUrl.length === 0 || !bucket) return null;

  const marker = `/storage/v1/object/public/${bucket}/`;
  const start = fileUrl.indexOf(marker);
  if (start === -1) return null;

  const rawPath = fileUrl.slice(start + marker.length).split("#")[0].split("?")[0];
  if (!rawPath) return null;

  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

/**
 * URL de descarga directa para un objeto del bucket.
 *
 * Supabase Storage responde con `Content-Disposition: attachment` cuando la
 * URL pública incluye `download=`, así el botón «Descargar» guarda el archivo
 * en lugar de abrirlo. Las URLs externas se devuelven sin cambios.
 */
export function storageDownloadUrl(fileUrl: unknown, bucket: string = CONTENT_BUCKET): string {
  const url = typeof fileUrl === "string" ? fileUrl : "";
  if (!storagePathFromPublicUrl(fileUrl, bucket)) return url;
  if (/[?&]download(=|&|$)/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}download=`;
}
