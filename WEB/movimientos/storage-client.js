export const DISCARD_PHOTO_BUCKET = "tire-discard-photos";
export const MAX_DISCARD_PHOTO_BYTES = 5 * 1024 * 1024;
export const DISCARD_PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_EXTENSION = Object.freeze({
  "image/jpeg": "jpg",
  "image/webp": "webp",
});

export class DiscardPhotoError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "DiscardPhotoError";
    this.code = code;
    this.path = options.path ?? null;
    this.orphanPath = options.orphanPath ?? null;
    this.cleanupError = options.cleanupError ?? null;
  }
}

function requireUuid(value, field) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new DiscardPhotoError(
      "invalid_path_scope",
      `${field} debe ser un UUID válido para construir la ruta de la evidencia.`,
    );
  }
  return value.toLowerCase();
}

function requireSequence(value) {
  const sequence = Number(value);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new DiscardPhotoError(
      "invalid_sequence",
      "La secuencia de la evidencia debe ser un entero positivo.",
    );
  }
  return sequence;
}

function extensionFor(file) {
  const extension = MIME_EXTENSION[file?.type];
  if (!extension) {
    throw new DiscardPhotoError(
      "unsupported_format",
      "La evidencia debe quedar en formato JPEG o WebP.",
    );
  }
  return extension;
}

/** Construye <company_id>/<batch_id>/<seq>.<ext> sin aceptar segmentos arbitrarios. */
export function buildDiscardPhotoPath({ companyScope, batchId, seq, file } = {}) {
  const companyId = requireUuid(companyScope, "companyScope");
  const scopedBatchId = requireUuid(batchId, "batchId");
  const sequence = requireSequence(seq);
  return `${companyId}/${scopedBatchId}/${sequence}.${extensionFor(file)}`;
}

/**
 * Recupera la ruta canónica desde una ruta cruda o desde una URL firmada de
 * Supabase. Esto permite borrar una evidencia sin guardar credenciales ni
 * depender del token efímero de la URL.
 */
export function discardPhotoPathFromUrl(pathOrUrl) {
  if (typeof pathOrUrl !== "string" || !pathOrUrl.trim()) {
    throw new DiscardPhotoError(
      "invalid_photo_reference",
      "La referencia de la evidencia está vacía.",
    );
  }

  let candidate = pathOrUrl.trim();
  try {
    const url = new URL(candidate);
    candidate = url.pathname;
  } catch {
    candidate = candidate.split(/[?#]/, 1)[0];
  }

  const bucketMarkers = [
    `/object/sign/${DISCARD_PHOTO_BUCKET}/`,
    `/object/authenticated/${DISCARD_PHOTO_BUCKET}/`,
    `/object/public/${DISCARD_PHOTO_BUCKET}/`,
    `/${DISCARD_PHOTO_BUCKET}/`,
  ];
  for (const marker of bucketMarkers) {
    const markerIndex = candidate.indexOf(marker);
    if (markerIndex >= 0) {
      candidate = candidate.slice(markerIndex + marker.length);
      break;
    }
  }
  if (candidate.startsWith(`${DISCARD_PHOTO_BUCKET}/`)) {
    candidate = candidate.slice(DISCARD_PHOTO_BUCKET.length + 1);
  }

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    throw new DiscardPhotoError(
      "invalid_photo_reference",
      "La URL firmada de la evidencia no contiene una ruta válida.",
    );
  }
  candidate = candidate.replace(/^\/+/, "");

  const match = candidate.match(
    /^([0-9a-f-]{36})\/([0-9a-f-]{36})\/([1-9]\d*)\.(jpg|webp)$/i,
  );
  if (!match || !UUID_PATTERN.test(match[1]) || !UUID_PATTERN.test(match[2])) {
    throw new DiscardPhotoError(
      "invalid_photo_reference",
      "La evidencia no pertenece a una ruta válida del bucket de descartes.",
    );
  }

  return `${match[1].toLowerCase()}/${match[2].toLowerCase()}/${match[3]}.${match[4].toLowerCase()}`;
}

function requireImage(file) {
  if (!file || typeof file.size !== "number" || typeof file.type !== "string") {
    throw new DiscardPhotoError(
      "invalid_file",
      "Seleccioná una foto válida para el descarte.",
    );
  }
  if (file.size < 1) {
    throw new DiscardPhotoError(
      "invalid_file",
      "La foto seleccionada está vacía.",
    );
  }
  if (!file.type.startsWith("image/")) {
    throw new DiscardPhotoError(
      "unsupported_format",
      "El archivo seleccionado no es una imagen.",
    );
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("El navegador no pudo codificar la imagen."));
    }, type, quality);
  });
}

/**
 * Conserva JPEG/WebP que ya respetan el límite. El resto se decodifica,
 * redimensiona y comprime en el navegador a un formato admitido por el bucket.
 */
export async function prepareDiscardPhoto(file, {
  maxBytes = MAX_DISCARD_PHOTO_BYTES,
  maxDimension = 2560,
  documentObject = globalThis.document,
  createImageBitmapFn = globalThis.createImageBitmap,
} = {}) {
  requireImage(file);
  if (MIME_EXTENSION[file.type] && file.size <= maxBytes) return file;

  if (
    typeof createImageBitmapFn !== "function" ||
    typeof documentObject?.createElement !== "function"
  ) {
    throw new DiscardPhotoError(
      "compression_unavailable",
      "Este navegador no puede comprimir la foto seleccionada.",
    );
  }

  let bitmap;
  try {
    bitmap = await createImageBitmapFn(file);
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDimension / longestSide);
    const canvas = documentObject.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D no disponible.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const outputType = file.type === "image/webp" ? "image/webp" : "image/jpeg";
    for (const quality of [0.86, 0.74, 0.62, 0.5, 0.4]) {
      const compressed = await canvasToBlob(canvas, outputType, quality);
      if (compressed.size <= maxBytes) return compressed;
    }
  } catch (error) {
    if (error instanceof DiscardPhotoError) throw error;
    throw new DiscardPhotoError(
      "compression_failed",
      "No se pudo procesar la foto. Probá con otra imagen JPEG o WebP.",
      { cause: error },
    );
  } finally {
    bitmap?.close?.();
  }

  throw new DiscardPhotoError(
    "file_too_large",
    "La foto supera el límite de 5 MB incluso después de comprimirla.",
  );
}

function storageBucket(client) {
  const resolvedClient = client ?? globalThis.RenovaSupabase?.supabase;
  if (typeof resolvedClient?.storage?.from !== "function") {
    throw new DiscardPhotoError(
      "storage_unavailable",
      "Storage no está disponible para la sesión actual.",
    );
  }
  return resolvedClient.storage.from(DISCARD_PHOTO_BUCKET);
}

function storageFailure(code, message, error, path) {
  return new DiscardPhotoError(code, message, { cause: error, path });
}

/** Sube la evidencia con upsert desactivado y devuelve su URL firmada. */
export async function uploadDiscardPhoto(
  { file, companyScope, batchId, seq } = {},
  {
    client,
    prepareFile = prepareDiscardPhoto,
    expiresIn = DISCARD_PHOTO_SIGNED_URL_TTL_SECONDS,
  } = {},
) {
  const preparedFile = await prepareFile(file);
  requireImage(preparedFile);
  if (preparedFile.size > MAX_DISCARD_PHOTO_BYTES) {
    throw new DiscardPhotoError("file_too_large", "La foto supera el límite de 5 MB.");
  }

  const path = buildDiscardPhotoPath({
    companyScope,
    batchId,
    seq,
    file: preparedFile,
  });
  const bucket = storageBucket(client);

  let uploadResult;
  try {
    uploadResult = await bucket.upload(path, preparedFile, {
      cacheControl: "3600",
      contentType: preparedFile.type,
      upsert: false,
    });
  } catch (error) {
    throw storageFailure(
      "upload_failed",
      "No se pudo subir la evidencia. Revisá la conexión y reintentá.",
      error,
      path,
    );
  }
  if (uploadResult?.error) {
    throw storageFailure(
      "upload_failed",
      "No se pudo subir la evidencia. Revisá la conexión y reintentá.",
      uploadResult.error,
      path,
    );
  }

  let signedResult;
  try {
    signedResult = await bucket.createSignedUrl(path, expiresIn);
    if (signedResult?.error || !signedResult?.data?.signedUrl) {
      throw signedResult?.error ?? new Error("Storage no devolvió una URL firmada.");
    }
    return signedResult.data.signedUrl;
  } catch (error) {
    let cleanupError = null;
    try {
      const cleanup = await bucket.remove([path]);
      cleanupError = cleanup?.error ?? null;
    } catch (removeError) {
      cleanupError = removeError;
    }
    throw new DiscardPhotoError(
      "signed_url_failed",
      cleanupError
        ? "La foto se subió, pero no pudo firmarse ni limpiarse. Reintentá la limpieza."
        : "La foto se subió, pero no pudo generarse su URL firmada. Volvé a intentarlo.",
      {
        cause: error,
        path,
        orphanPath: cleanupError ? path : null,
        cleanupError,
      },
    );
  }
}

/** Borra una evidencia mediante Storage API; nunca toca storage.objects por SQL. */
export async function deleteDiscardPhoto(pathOrUrl, { client } = {}) {
  const path = discardPhotoPathFromUrl(pathOrUrl);
  const bucket = storageBucket(client);
  let result;
  try {
    result = await bucket.remove([path]);
  } catch (error) {
    throw storageFailure(
      "delete_failed",
      "No se pudo borrar la evidencia pendiente. Reintentá antes de salir.",
      error,
      path,
    );
  }
  if (result?.error) {
    throw storageFailure(
      "delete_failed",
      "No se pudo borrar la evidencia pendiente. Reintentá antes de salir.",
      result.error,
      path,
    );
  }
  return { path, data: result?.data ?? null };
}
