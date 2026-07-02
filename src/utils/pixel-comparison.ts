/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared pixel-level image comparison utilities.
 * Used by screenshotDiff and gameTest tools.
 */

export interface PixelDiffResult {
  totalPixels: number;
  diffPixels: number;
  diffPercent: number;
  maxDiff: number;
}

/**
 * Compare two RGBA pixel buffers pixel-by-pixel using Euclidean distance in RGB space.
 * Returns diff statistics.
 */
export function comparePixelBuffers(
  baseline: Buffer,
  current: Buffer,
  width: number,
  height: number,
  tolerance: number,
): PixelDiffResult {
  const totalPixels = width * height;
  let diffPixels = 0;
  let maxDiff = 0;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const dr = baseline[offset] - current[offset];
    const dg = baseline[offset + 1] - current[offset + 1];
    const db = baseline[offset + 2] - current[offset + 2];
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist > tolerance) {
      diffPixels++;
      maxDiff = Math.max(maxDiff, dist);
    }
  }

  return {
    totalPixels,
    diffPixels,
    diffPercent: Math.round((diffPixels / totalPixels) * 10000) / 100,
    maxDiff: Math.round(maxDiff * 100) / 100,
  };
}

export interface ExtendedPixelDiffResult extends PixelDiffResult {
  diffImage: Buffer;
  diffRegions: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    severity: string;
  }>;
}

/**
 * Compare two RGBA pixel buffers with alpha tolerance, diff image generation,
 * and connected-region detection. Extended version used by screenshotDiff.
 */
export function comparePixelBuffersExtended(
  baseline: Buffer,
  current: Buffer,
  width: number,
  height: number,
  tolerance: number,
  alphaTolerance: number,
): ExtendedPixelDiffResult {
  const totalPixels = width * height;
  const diffImage = Buffer.alloc(width * height * 4);
  let diffPixels = 0;
  let maxDiff = 0;

  const diffMask = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const r1 = baseline[offset];
    const g1 = baseline[offset + 1];
    const b1 = baseline[offset + 2];
    const a1 = baseline[offset + 3];

    const r2 = current[offset];
    const g2 = current[offset + 1];
    const b2 = current[offset + 2];
    const a2 = current[offset + 3];

    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    const da = a1 - a2;
    const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
    const alphaDist = Math.abs(da);

    if (colorDist > tolerance || alphaDist > alphaTolerance) {
      diffPixels++;
      diffMask[i] = 1;
      maxDiff = Math.max(maxDiff, colorDist);

      const intensity = Math.min(255, Math.round(colorDist * 3));
      diffImage[offset] = 255; // R
      diffImage[offset + 1] = 0; // G
      diffImage[offset + 2] = 0; // B
      diffImage[offset + 3] = Math.min(255, intensity + 100); // A
    } else {
      const gray = Math.round(((r1 + g1 + b1) / 3) * 0.3);
      diffImage[offset] = gray;
      diffImage[offset + 1] = gray;
      diffImage[offset + 2] = gray;
      diffImage[offset + 3] = 80;
    }
  }

  const diffRegions = findDiffRegions(diffMask, width, height);

  return {
    totalPixels,
    diffPixels,
    diffPercent: Math.round((diffPixels / totalPixels) * 10000) / 100,
    maxDiff: Math.round(maxDiff * 100) / 100,
    diffImage,
    diffRegions,
  };
}

/**
 * Find bounding boxes of diff regions using BFS flood-fill.
 */
function findDiffRegions(
  mask: Uint8Array,
  width: number,
  height: number,
): Array<{x: number; y: number; w: number; h: number; severity: string}> {
  const visited = new Uint8Array(mask.length);
  const regions: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    severity: string;
  }> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] && !visited[idx]) {
        const queue = [idx];
        visited[idx] = 1;
        let minX = x,
          maxX = x,
          minY = y,
          maxY = y;

        while (queue.length > 0) {
          const cur = queue.shift();
          if (cur === undefined) {
            break;
          }
          const cx = cur % width;
          const cy = Math.floor(cur / width);
          minX = Math.min(minX, cx);
          maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy);
          maxY = Math.max(maxY, cy);

          for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const ni = ny * width + nx;
              if (mask[ni] && !visited[ni]) {
                visited[ni] = 1;
                queue.push(ni);
              }
            }
          }
        }

        const regionW = maxX - minX + 1;
        const regionH = maxY - minY + 1;
        const area = regionW * regionH;
        let severity = 'minor';
        if (area > 10000) {
          severity = 'major';
        } else if (area > 1000) {
          severity = 'moderate';
        }

        regions.push({x: minX, y: minY, w: regionW, h: regionH, severity});
      }
    }
  }

  return regions;
}
