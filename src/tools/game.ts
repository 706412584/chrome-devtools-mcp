/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Game development tools: real-time performance stats and overlay injection.
 */

import {zod} from '../third_party/index.js';

import {ToolCategory} from './categories.js';
import {definePageTool} from './ToolDefinition.js';

// ─── game_stats ─────────────────────────────────────────────────────────────
// Injects a requestAnimationFrame sampling loop into the page and returns
// FPS, frame time percentiles, and memory stats after a short collection window.

const GAME_STATS_SCRIPT = (durationMs: number, sampleCount: number) => `
(() => {
  return new Promise((resolve) => {
    const frames = [];
    let rafId;
    let lastTime = performance.now();

    function tick(now) {
      const delta = now - lastTime;
      lastTime = now;
      frames.push(delta);

      if (frames.length >= ${sampleCount} ||
          performance.now() - frames[0] >= ${durationMs}) {
        cancelAnimationFrame(rafId);

        // Compute stats
        const sorted = [...frames].sort((a, b) => a - b);
        const avg = frames.reduce((s, v) => s + v, 0) / frames.length;
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const p50 = sorted[Math.floor(sorted.length * 0.5)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        const fps = avg > 0 ? 1000 / avg : 0;

        const result = {
          fps: Math.round(fps * 10) / 10,
          frameTime: {
            avg: Math.round(avg * 100) / 100,
            min: Math.round(min * 100) / 100,
            max: Math.round(max * 100) / 100,
            p50: Math.round(p50 * 100) / 100,
            p95: Math.round(p95 * 100) / 100,
            p99: Math.round(p99 * 100) / 100,
          },
          samples: frames.length,
        };

        // Memory (Chrome-only)
        if (performance.memory) {
          result.memory = {
            usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576),
            totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576),
            jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576),
          };
        }

        resolve(result);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
  });
})()
`;

export const gameStats = definePageTool({
  name: 'game_stats',
  description:
    'Measure real-time game performance: FPS, frame time percentiles (avg/min/max/p50/p95/p99), and JS memory usage. ' +
    'Collects data via requestAnimationFrame sampling for the specified duration. ' +
    'Returns JSON with performance metrics.',
  annotations: {
    category: ToolCategory.PERFORMANCE,
    readOnlyHint: true,
  },
  schema: {
    durationMs: zod
      .number()
      .int()
      .min(100)
      .max(5000)
      .default(1000)
      .describe(
        'Duration in milliseconds to collect frame samples. Default 1000ms. Range 100-5000.',
      ),
    maxSamples: zod
      .number()
      .int()
      .min(10)
      .max(300)
      .default(120)
      .describe('Maximum number of frame samples to collect. Default 120.'),
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const page = request.page.pptrPage;
    const {durationMs, maxSamples} = request.params;

    const result = await page.evaluate(
      GAME_STATS_SCRIPT(durationMs, maxSamples),
    );

    if (typeof result === 'string') {
      response.appendResponseLine(result);
    } else {
      const stats = result as Record<string, unknown>;
      const fps = (stats.fps as number) ?? 0;
      const ft = (stats.frameTime as Record<string, number>) ?? {};
      const mem = stats.memory as Record<string, number> | undefined;

      response.appendResponseLine(`FPS: ${fps}`);
      response.appendResponseLine(
        `Frame Time (ms) — avg: ${ft.avg}, min: ${ft.min}, max: ${ft.max}, p50: ${ft.p50}, p95: ${ft.p95}, p99: ${ft.p99}`,
      );
      response.appendResponseLine(`Samples: ${stats.samples}`);

      if (mem) {
        response.appendResponseLine(
          `Memory (MB) — used: ${mem.usedJSHeapSize}, total: ${mem.totalJSHeapSize}, limit: ${mem.jsHeapSizeLimit}`,
        );
      }

      response.appendResponseLine('```json');
      response.appendResponseLine(JSON.stringify(stats, null, 2));
      response.appendResponseLine('```');
    }
  },
});

// ─── inject_game_overlay ────────────────────────────────────────────────────
// Injects a semi-transparent performance overlay (FPS + frame time + memory)
// directly into the page. Can be started and stopped.

const OVERLAY_START_SCRIPT = `
(() => {
  // Remove existing overlay if present
  const existing = document.getElementById('__mcp_game_overlay__');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = '__mcp_game_overlay__';
  el.style.cssText = [
    'position:fixed',
    'top:8px',
    'right:8px',
    'z-index:2147483647',
    'background:rgba(0,0,0,0.75)',
    'color:#0f0',
    'font-family:monospace',
    'font-size:13px',
    'line-height:1.5',
    'padding:8px 12px',
    'border-radius:4px',
    'pointer-events:none',
    'min-width:200px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
  ].join(';');

  document.body.appendChild(el);

  let frames = [];
  let lastTime = performance.now();
  let rafId;

  function tick(now) {
    const delta = now - lastTime;
    lastTime = now;
    frames.push(delta);

    // Keep last 60 frames for rolling average
    if (frames.length > 60) frames.shift();

    const avg = frames.reduce((s, v) => s + v, 0) / frames.length;
    const fps = avg > 0 ? (1000 / avg).toFixed(1) : '0.0';
    const p95 = [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)] || 0;

    let memText = '';
    if (performance.memory) {
      const used = (performance.memory.usedJSHeapSize / 1048576).toFixed(0);
      const total = (performance.memory.totalJSHeapSize / 1048576).toFixed(0);
      memText = ' | Mem: ' + used + '/' + total + ' MB';
    }

    el.textContent = 'FPS: ' + fps + ' | Frame: ' + avg.toFixed(1) + 'ms (p95: ' + p95.toFixed(1) + ')' + memText;
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
  return 'Overlay started';
})()
`;

const OVERLAY_STOP_SCRIPT = `
(() => {
  const el = document.getElementById('__mcp_game_overlay__');
  if (el) {
    el.remove();
    return 'Overlay removed';
  }
  return 'No overlay found';
})()
`;

export const injectGameOverlay = definePageTool({
  name: 'inject_game_overlay',
  description:
    'Inject or remove a real-time FPS/frame-time/memory overlay on the page. ' +
    'The overlay is a semi-transparent HUD in the top-right corner showing live performance metrics.',
  annotations: {
    category: ToolCategory.PERFORMANCE,
    readOnlyHint: false,
  },
  schema: {
    action: zod
      .enum(['start', 'stop'])
      .describe(
        '"start" to inject the overlay, "stop" to remove it.',
      ),
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const page = request.page.pptrPage;
    const script =
      request.params.action === 'start'
        ? OVERLAY_START_SCRIPT
        : OVERLAY_STOP_SCRIPT;

    const result = await page.evaluate(script);
    response.appendResponseLine(String(result));
  },
});
