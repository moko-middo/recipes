/** 写真を縮小してJPEGのdata URLにする */
export async function resizeImage(file: Blob, maxSize: number, quality = 0.8): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.toDataURL('image/jpeg', quality);
}

/** 一覧用の正方形サムネイル */
export async function squareThumb(dataUrl: string, size = 240): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const s = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.75);
}

export function base64Of(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}
