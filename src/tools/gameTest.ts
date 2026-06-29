/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Automated game testing framework.
 * Orchestrates screenshot → compare → assert flows for regression testing.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import {zod} from '../third_party/index.js';

import {ToolCategory} from './categories.js';
import {definePageTool} from './ToolDefinition.js';

// ─── Pixel comparison (inline, no external deps) ────────────────────────────

interface DiffResult {
  totalPixels: number;
  diffPixels: number;
  diffPercent: number;
  maxDiff: number;
}

function comparePixels(
  baseline: Buffer,
  current: Buffer,
  width: number,
  height: number,
  tolerance: number,
): DiffResult {
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

// ─── Step runners ───────────────────────────────────────────────────────────

interface TestStep {
  action: string;
  [key: string]: unknown;
}

interface StepResult {
  step: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  durationMs: number;
}

async function runStep(
  step: TestStep,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  baselineDir: string,
): Promise<StepResult> {
  const start = Date.now();
  const {action, ...params} = step;

  try {
    switch (action) {
      case 'navigate': {
        const url = params.url as string;
        if (!url) {
          throw new Error('navigate requires url');
        }
        await page.goto(url, {waitUntil: 'networkidle2', timeout: 15000});
        return {
          step: action,
          status: 'pass',
          message: `Navigated to ${url}`,
          durationMs: Date.now() - start,
        };
      }

      case 'wait': {
        const timeMs = (params.timeMs as number) ?? 1000;
        await new Promise(r => setTimeout(r, timeMs));
        return {
          step: action,
          status: 'pass',
          message: `Waited ${timeMs}ms`,
          durationMs: Date.now() - start,
        };
      }

      case 'wait_for': {
        const text = params.text as string;
        if (!text) {
          throw new Error('wait_for requires text');
        }
        await page.waitForFunction(
          (t: string) => document.body?.innerText.includes(t),
          {timeout: (params.timeout as number) ?? 10000},
          text,
        );
        return {
          step: action,
          status: 'pass',
          message: `Found text "${text}"`,
          durationMs: Date.now() - start,
        };
      }

      case 'wait_for_canvas': {
        const timeout = (params.timeout as number) ?? 10000;
        await page.waitForFunction(
          () => {
            const canvases = document.querySelectorAll('canvas');
            return canvases.length > 0;
          },
          {timeout},
        );
        return {
          step: action,
          status: 'pass',
          message: 'Canvas element found',
          durationMs: Date.now() - start,
        };
      }

      case 'click': {
        const x = params.x as number | undefined;
        const y = params.y as number | undefined;
        if (x !== undefined && y !== undefined) {
          await page.mouse.click(x, y);
          return {
            step: action,
            status: 'pass',
            message: `Clicked at (${x}, ${y})`,
            durationMs: Date.now() - start,
          };
        }
        // uid-based click — find element and click via CDP fallback
        throw new Error('click in test requires x,y coordinates (uid-based not supported in test runner)');
      }

      case 'screenshot': {
        const name = (params.name as string) ?? `step-${Date.now()}`;
        const format = (params.format as 'png' | 'jpeg' | 'webp') ?? 'png';
        const quality = params.quality as number | undefined;
        const baseline = params.baseline as string | undefined;

        const screenshotData = await page.screenshot({
          type: format,
          quality: format !== 'png' ? quality : undefined,
          optimizeForSpeed: true,
        });

        // Save current screenshot
        const currentPath = path.join(baselineDir, `current-${name}.${format === 'jpeg' ? 'jpg' : format}`);
        await fs.writeFile(currentPath, screenshotData);

        // Compare against baseline if provided
        if (baseline) {
          const baselinePath = path.join(baselineDir, baseline);
          let baselineData: Buffer;
          try {
            baselineData = await fs.readFile(baselinePath);
          } catch {
            // No baseline yet — save current as baseline
            await fs.writeFile(baselinePath, screenshotData);
            return {
              step: action,
              status: 'pass',
              message: `Baseline saved: ${baseline} (first run)`,
              durationMs: Date.now() - start,
            };
          }

          // Decode and compare using Canvas API
          const comparison = await page.evaluate(
            `(b64Current, b64Baseline) => {
              return new Promise((resolve) => {
                const loadImg = (b64) => new Promise((res) => {
                  const img = new Image();
                  img.onload = () => {
                    const c = document.createElement('canvas');
                    c.width = img.width;
                    c.height = img.height;
                    const ctx = c.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    res({data: Array.from(ctx.getImageData(0, 0, img.width, img.height).data), w: img.width, h: img.height});
                  };
                  img.src = 'data:image/png;base64,' + b64;
                });
                Promise.all([loadImg(b64Current), loadImg(b64Baseline)]).then(([cur, base]) => {
                  resolve({curData: cur.data, baseData: base.data, w: cur.w, h: cur.h});
                });
              });
            }`,
            Buffer.from(screenshotData).toString('base64'),
            Buffer.from(baselineData).toString('base64'),
          );

          if (typeof comparison === 'string') {
            throw new Error(`Comparison failed: ${comparison}`);
          }

          const {curData, baseData, w, h} = comparison as {curData: number[]; baseData: number[]; w: number; h: number};
          const tolerance = (params.tolerance as number) ?? 30;
          const result = comparePixels(Buffer.from(baseData), Buffer.from(curData), w, h, tolerance);

          const threshold = (params.threshold as number) ?? 5;
          const passed = result.diffPercent <= threshold;

          return {
            step: action,
            status: passed ? 'pass' : 'fail',
            message: passed
              ? `Screenshot matches baseline (${result.diffPercent}% diff, threshold ${threshold}%)`
              : `Screenshot DIFFERS (${result.diffPercent}% diff, threshold ${threshold}%) — max distance: ${result.maxDiff}`,
            durationMs: Date.now() - start,
          };
        }

        return {
          step: action,
          status: 'pass',
          message: `Screenshot saved: ${currentPath}`,
          durationMs: Date.now() - start,
        };
      }

      case 'eval': {
        const fn = params.function as string;
        if (!fn) {
          throw new Error('eval requires function');
        }
        const result = await page.evaluate(`(${fn})`);
        return {
          step: action,
          status: 'pass',
          message: `Eval result: ${JSON.stringify(result).substring(0, 200)}`,
          durationMs: Date.now() - start,
        };
      }

      case 'assert_text': {
        const text = params.text as string;
        const present = params.present as boolean ?? true;
        const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
        const found = bodyText.includes(text);
        const passed = present ? found : !found;
        return {
          step: action,
          status: passed ? 'pass' : 'fail',
          message: passed
            ? `Text "${text}" ${present ? 'found' : 'not found'} as expected`
            : `Text "${text}" ${present ? 'not found' : 'found'} unexpectedly`,
          durationMs: Date.now() - start,
        };
      }

      case 'assert_no_errors': {
        const errors = await page.evaluate(() => {
          const logs: string[] = [];
          // Check for error indicators in the page
          const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
          errorElements.forEach(el => logs.push(el.textContent?.substring(0, 100) ?? ''));
          return logs;
        });
        const passed = errors.length === 0;
        return {
          step: action,
          status: passed ? 'pass' : 'fail',
          message: passed ? 'No error elements found' : `Found ${errors.length} error elements: ${errors.join(', ')}`,
          durationMs: Date.now() - start,
        };
      }

      default:
        return {
          step: action,
          status: 'skip',
          message: `Unknown action: ${action}`,
          durationMs: Date.now() - start,
        };
    }
  } catch (error) {
    return {
      step: action,
      status: 'fail',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      durationMs: Date.now() - start,
    };
  }
}

// ─── game_test ──────────────────────────────────────────────────────────────

export const gameTest = definePageTool({
  name: 'game_test',
  description:
    'Run an automated game test with multiple steps. Supports: navigate, wait, wait_for, wait_for_canvas, click, screenshot (with baseline comparison), eval (run JS), assert_text, assert_no_errors. ' +
    'Steps execute sequentially. Screenshots can compare against baselines with pixel tolerance for animated content.',
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: false,
  },
  schema: {
    steps: zod
      .string()
      .describe(
        'JSON array of test steps. Each step: {action, url?, name?, text?, function?, present?, x?, y?, timeMs?, timeout?, format?, quality?, baseline?, tolerance?, threshold?}. ' +
        'Actions: navigate, wait, wait_for, wait_for_canvas, click, screenshot, eval, assert_text, assert_no_errors.',
      ),
    baselineDir: zod
      .string()
      .optional()
      .describe(
        'Directory to store baseline screenshots for comparison. Defaults to ./test-baselines/',
      ),
  },
  blockedByDialog: true,
  verifyFilesSchema: ['baselineDir'],
  handler: async (request, response) => {
    const {steps: stepsJson, baselineDir: rawBaselineDir} = request.params;
    const baselineDir = rawBaselineDir ?? path.join(process.cwd(), 'test-baselines');

    let steps: TestStep[];
    try {
      steps = JSON.parse(stepsJson as string);
    } catch {
      throw new Error('Invalid JSON in steps parameter');
    }

    // Ensure baseline directory exists
    await fs.mkdir(baselineDir, {recursive: true});

    const results: StepResult[] = [];
    const page = request.page.pptrPage;

    response.appendResponseLine(`Running ${steps.length} test steps...`);
    response.appendResponseLine('');

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const result = await runStep(step, page, baselineDir);
      results.push(result);

      const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '○';
      response.appendResponseLine(
        `  ${icon} Step ${i + 1}/${steps.length} [${result.step}] ${result.message} (${result.durationMs}ms)`,
      );

      // Stop on first failure
      if (result.status === 'fail') {
        response.appendResponseLine('');
        response.appendResponseLine(`TEST FAILED at step ${i + 1}`);
        break;
      }
    }

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const skipped = results.filter(r => r.status === 'skip').length;
    const totalMs = results.reduce((s, r) => s + r.durationMs, 0);

    response.appendResponseLine('');
    response.appendResponseLine(
      `Result: ${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed, ${skipped} skipped (${totalMs}ms total)`,
    );
  },
});
