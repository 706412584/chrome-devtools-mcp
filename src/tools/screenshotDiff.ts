/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pixel-level screenshot comparison tool for game UI testing.
 * Supports tolerance thresholds for animated content and generates diff images.
 */

import fs from 'node:fs/promises';

import {zod} from '../third_party/index.js';
import {comparePixelBuffersExtended} from '../utils/pixel-comparison.js';

import {ToolCategory} from './categories.js';
import {definePageTool} from './ToolDefinition.js';

// ─── screenshot_diff ────────────────────────────────────────────────────────
export const screenshotDiff = definePageTool({
  name: 'screenshot_diff',
  description:
    'Compare the current viewport screenshot against a baseline image file. ' +
    'Returns pixel-level diff statistics including diff percentage, max color distance, ' +
    'and bounding boxes of changed regions. Optionally saves a diff visualization image. ' +
    'Useful for automated game UI regression testing and animation frame comparison.',
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: false,
  },
  schema: {
    baselinePath: zod
      .string()
      .describe(
        'Path to the baseline (reference) image file to compare against.',
      ),
    tolerance: zod
      .number()
      .min(0)
      .max(765)
      .default(30)
      .describe(
        'Per-pixel color distance tolerance (Euclidean in RGB space, 0-765). ' +
          '0 = exact match, 30 = slight anti-aliasing allowed, 100 = aggressive tolerance for animations. Default 30.',
      ),
    alphaTolerance: zod
      .number()
      .min(0)
      .max(255)
      .default(50)
      .describe(
        'Alpha channel tolerance (0-255). Useful when compositing causes alpha differences. Default 50.',
      ),
    saveDiffTo: zod
      .string()
      .optional()
      .describe(
        'Path to save the diff visualization image (PNG). Red pixels show differences, gray pixels show matches.',
      ),
    maxRegions: zod
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe('Maximum number of diff regions to report. Default 5.'),
  },
  blockedByDialog: true,
  verifyFilesSchema: ['baselinePath', 'saveDiffTo'],
  handler: async (request, response, context) => {
    const {baselinePath, tolerance, alphaTolerance, saveDiffTo, maxRegions} =
      request.params;

    // 1. Read baseline image
    let baselineData: Buffer;
    try {
      baselineData = await fs.readFile(baselinePath);
    } catch {
      throw new Error(`Baseline image not found: ${baselinePath}`);
    }

    // 2. Take current screenshot as PNG buffer
    const currentData = await request.page.pptrPage.screenshot({
      type: 'png',
      optimizeForSpeed: false,
    });

    // 3. Decode both images to RGBA using the page's Canvas API (browser-side)
    const page = request.page.pptrPage;
    const comparison = await page.evaluate(
      `
      (baselineB64, currentB64) => {
        return new Promise((resolve) => {
          const baselineBytes = Uint8Array.from(atob(baselineB64), c => c.charCodeAt(0));
          const currentBytes = Uint8Array.from(atob(currentB64), c => c.charCodeAt(0));

          const img1 = new Image();
          const img2 = new Image();
          let loaded = 0;

          function onLoad() {
            loaded++;
            if (loaded < 2) return;

            // Use dimensions from current screenshot
            const w = img2.width;
            const h = img2.height;

            const canvas1 = document.createElement('canvas');
            canvas1.width = w;
            canvas1.height = h;
            const ctx1 = canvas1.getContext('2d');
            ctx1.drawImage(img1, 0, 0, w, h);
            const data1 = ctx1.getImageData(0, 0, w, h).data;

            const canvas2 = document.createElement('canvas');
            canvas2.width = w;
            canvas2.height = h;
            const ctx2 = canvas2.getContext('2d');
            ctx2.drawImage(img2, 0, 0, w, h);
            const data2 = ctx2.getImageData(0, 0, w, h).data;

            resolve({
              width: w,
              height: h,
              baseline: Array.from(data1),
              current: Array.from(data2),
            });
          }

          img1.onload = onLoad;
          img2.onload = onLoad;
          img1.src = 'data:image/png;base64,' + b64decode(baselineBytes);
          img2.src = 'data:image/png;base64,' + b64decode(currentBytes);
        });
      }
      `.replace(
        'b64decode',
        (() => {
          // Inline base64 encoding helper
          return `(bytes) => {
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return binary;
        }`;
        })(),
      ),
      Buffer.from(baselineData).toString('base64'),
      Buffer.from(currentData).toString('base64'),
    );

    if (typeof comparison === 'string') {
      response.appendResponseLine(comparison);
      return;
    }

    const {
      width,
      height,
      baseline: bArr,
      current: cArr,
    } = comparison as {
      width: number;
      height: number;
      baseline: number[];
      current: number[];
    };

    // 4. Run pixel comparison in Node.js (faster for large images)
    const baselineBuf = Buffer.from(bArr);
    const currentBuf = Buffer.from(cArr);

    const result = comparePixelBuffersExtended(
      baselineBuf,
      currentBuf,
      width,
      height,
      tolerance,
      alphaTolerance,
    );

    // 5. Output results
    response.appendResponseLine(
      `Image size: ${width}×${height} (${result.totalPixels} pixels)`,
    );
    response.appendResponseLine(
      `Diff: ${result.diffPixels} pixels (${result.diffPercent}%)`,
    );
    response.appendResponseLine(`Max color distance: ${result.maxDiff}`);

    if (result.diffRegions.length > 0) {
      const regions = result.diffRegions.slice(0, maxRegions);
      response.appendResponseLine(
        `Diff regions (${regions.length}${result.diffRegions.length > maxRegions ? ` of ${result.diffRegions.length}` : ''}):`,
      );
      for (const r of regions) {
        response.appendResponseLine(
          `  [${r.severity}] (${r.x},${r.y}) ${r.w}×${r.h}`,
        );
      }
    } else {
      response.appendResponseLine('No diff regions found — images match!');
    }

    // 6. Save diff image if requested
    if (saveDiffTo) {
      // Encode diff image as PNG via the page's canvas
      const diffB64 = await page.evaluate(
        `
        (rgbaData, w, h) => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          const imageData = ctx.createImageData(w, h);
          imageData.data.set(new Uint8ClampedArray(rgbaData));
          ctx.putImageData(imageData, 0, 0);
          return canvas.toDataURL('image/png').split(',')[1];
        }
        `,
        Array.from(result.diffImage),
        width,
        height,
      );

      if (typeof diffB64 === 'string') {
        const diffBuf = Buffer.from(diffB64, 'base64');
        const {filename} = await context.saveFile(diffBuf, saveDiffTo, '.png');
        response.appendResponseLine(`Diff image saved to ${filename}`);
      }
    }
  },
});
