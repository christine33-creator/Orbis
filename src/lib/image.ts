import { ApiError } from "../api/types";

/**
 * Resizes a photo and re-encodes it as JPEG before upload. Re-encoding through a canvas
 * drops all EXIF metadata, including the GPS location embedded by phone cameras.
 */
export async function preparePhoto(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new ApiError("photoType");
  }
  if (file.size > 25 * 1024 * 1024) throw new ApiError("photoTooLarge");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ApiError("photoRead");
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ApiError("photoRead"))), "image/jpeg", quality),
  );
}
