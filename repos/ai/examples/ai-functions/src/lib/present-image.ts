import type { Experimental_GeneratedImage as GeneratedImage } from 'ai';
import fs from 'node:fs';
import imageType from 'image-type';
import path from 'node:path';
import sharp from 'sharp';
import terminalImage from 'terminal-image';

const OUTPUT_DIR = 'output';

/**
 * Displays images in the terminal using a downsampled preview and saves the
 * original, full-resolution files to the output directory with unique
 * timestamps.
 * @param images - An array of generated images to process and display.
 */
export async function presentImages(images: GeneratedImage[]) {
  const timestamp = Date.now();
  for (const [index, image] of images.entries()) {
    const srcBuffer = image.uint8Array;

    // Determine the format of the image. `image-type` only detects raster
    // formats from magic bytes, so SVG is detected separately.
    const format = await imageType(srcBuffer);
    const extension = format?.ext ?? (isSvg(srcBuffer) ? 'svg' : undefined);
    if (!extension) {
      throw new Error('Unknown image format');
    }

    // `terminal-image` only renders raster formats, so rasterize SVG and WebP
    // to PNG for the terminal preview.
    const renderBuffer =
      extension === 'svg' || extension === 'webp'
        ? await sharp(srcBuffer).png().toBuffer()
        : srcBuffer;

    // Render the image to the terminal.
    console.log(await terminalImage.buffer(Buffer.from(renderBuffer)));

    // Save the original image to a file.
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const filePath = path.join(
      OUTPUT_DIR,
      `image-${timestamp}-${index}.${extension}`,
    );
    await fs.promises.writeFile(filePath, srcBuffer);
    console.log(`Saved image to ${filePath}`);
  }

  console.log(`Processed ${images.length} images`);
}

function isSvg(data: Uint8Array): boolean {
  // Look at the first few hundred bytes to find an `<svg` tag, allowing for
  // leading whitespace, BOM, or an `<?xml ... ?>` / DOCTYPE prologue.
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(data.subarray(0, 512))
    .trimStart();
  return /^(?:<\?xml[^>]*\?>\s*)?(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head);
}
