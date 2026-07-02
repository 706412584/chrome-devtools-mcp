/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Game inspection tools: state reader, asset monitor, canvas/WebGL info.
 * Designed for UrhoX/WASM game development workflows.
 */

import {zod} from '../third_party/index.js';
import {appendJsonBlock} from '../utils/format.js';

import {ToolCategory} from './categories.js';
import {definePageTool} from './ToolDefinition.js';

// ─── game_state ─────────────────────────────────────────────────────────────
// Reads game internal variables by evaluating JS in the page context.
// Pre-configured queries for common game frameworks, plus custom eval.

const PRESET_QUERIES: Record<string, string> = {
  screen: `() => {
    // Try to read screen router state from common game patterns
    const body = document.body?.innerText?.substring(0, 500) || '';
    return {
      url: location.href,
      title: document.title,
      bodyPreview: body,
    };
  }`,
  dom: `() => {
    const elements = document.querySelectorAll('*');
    const tags = {};
    elements.forEach(el => {
      tags[el.tagName] = (tags[el.tagName] || 0) + 1;
    });
    return {
      totalElements: elements.length,
      tags: tags,
      canvases: document.querySelectorAll('canvas').length,
      iframes: document.querySelectorAll('iframe').length,
    };
  }`,
  console: `() => {
    // Check if there are any game-specific globals
    const gameGlobals = [];
    for (const key of Object.keys(window)) {
      if (typeof window[key] === 'object' && window[key] !== null) {
        const val = window[key];
        // Check for common game framework patterns
        if (val && (val.scene || val.game || val.state || val.store || val.__game)) {
          gameGlobals.push(key);
        }
      }
    }
    return { gameGlobals };
  }`,
  performance: `() => {
    const perf = performance.getEntriesByType('resource');
    const byType = {};
    let totalTransferSize = 0;
    perf.forEach(r => {
      const ext = r.name.split('?')[0].split('.').pop()?.toLowerCase() || 'other';
      if (!byType[ext]) byType[ext] = { count: 0, totalDuration: 0, totalSize: 0 };
      byType[ext].count++;
      byType[ext].totalDuration += Math.round(r.duration);
      byType[ext].totalSize += r.transferSize || 0;
      totalTransferSize += r.transferSize || 0;
    });
    return {
      resourceCount: perf.length,
      totalTransferSize: Math.round(totalTransferSize / 1024),
      byType,
    };
  }`,
};

export const gameState = definePageTool({
  name: 'game_state',
  description:
    'Inspect game internal state. Supports presets: "screen" (current page/screen), "dom" (DOM element counts), "console" (game framework globals), "performance" (resource stats). ' +
    'Or provide a custom JavaScript function to read any game variable.',
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    preset: zod
      .enum(['screen', 'dom', 'console', 'performance'])
      .optional()
      .describe('Built-in query preset. If provided, "function" is ignored.'),
    function: zod
      .string()
      .optional()
      .describe(
        'Custom JavaScript function to evaluate. Must return a JSON-serializable value. Example: "() => window.__gameState"',
      ),
    pretty: zod
      .boolean()
      .default(true)
      .describe('Pretty-print the JSON output. Default true.'),
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const {preset, function: fn, pretty} = request.params;

    if (!preset && !fn) {
      throw new Error('Either "preset" or "function" must be provided.');
    }

    const script = preset ? PRESET_QUERIES[preset] : `(${fn})`;

    const result = await request.page.pptrPage.evaluate(script);

    if (typeof result === 'string') {
      response.appendResponseLine(result);
      return;
    }

    const formatted = pretty
      ? JSON.stringify(result, null, 2)
      : JSON.stringify(result);

    response.appendResponseLine(`Query: ${preset ?? 'custom'}`);
    appendJsonBlock(response, formatted);
  },
});

// ─── asset_monitor ──────────────────────────────────────────────────────────
// Intercepts network requests to track asset loading (textures, audio, scripts).

const ASSET_MONITOR_INSTALL = `
(() => {
  if (window.__mcp_asset_monitor__) return 'Already installed';

  const MAX_ENTRIES = 1000;
  const entries = [];
  window.__mcp_asset_monitor__ = entries;

  // Intercept fetch
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const start = performance.now();
    return origFetch.apply(this, args).then(resp => {
      const duration = performance.now() - start;
      entries.push({
        type: 'fetch',
        url: url.substring(0, 300),
        status: resp.status,
        duration: Math.round(duration),
        size: parseInt(resp.headers.get('content-length') || '0', 10),
        timestamp: Date.now(),
      });
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
      return resp;
    }).catch(err => {
      const duration = performance.now() - start;
      entries.push({
        type: 'fetch',
        url: url.substring(0, 300),
        status: 0,
        duration: Math.round(duration),
        error: String(err),
        timestamp: Date.now(),
      });
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
      throw err;
    });
  };

  // Intercept XHR
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__monitorUrl = String(url).substring(0, 300);
    this.__monitorMethod = method;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    const start = performance.now();
    const url = this.__monitorUrl;
    this.addEventListener('load', () => {
      const duration = performance.now() - start;
      entries.push({
        type: 'xhr',
        url,
        method: this.__monitorMethod,
        status: this.status,
        duration: Math.round(duration),
        size: this.responseText?.length || 0,
        timestamp: Date.now(),
      });
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    });
    this.addEventListener('error', () => {
      const duration = performance.now() - start;
      entries.push({
        type: 'xhr',
        url,
        method: this.__monitorMethod,
        status: 0,
        duration: Math.round(duration),
        error: 'network error',
        timestamp: Date.now(),
      });
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    });
    return origSend.call(this, ...args);
  };

  // Also observe PerformanceObserver for resource timing
  if (window.PerformanceObserver) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const r = entry;
            const ext = r.name.split('?')[0].split('.').pop()?.toLowerCase() || '';
            // Only track asset types relevant to games
            if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'mp3', 'ogg', 'wav',
                 'mp4', 'webm', 'glb', 'gltf', 'fbx', 'obj', 'ttf', 'woff', 'woff2',
                 'lua', 'js', 'wasm', 'json'].includes(ext)) {
              entries.push({
                type: 'resource',
                url: r.name.substring(0, 300),
                duration: Math.round(r.duration),
                size: r.transferSize || 0,
                ext,
                timestamp: Date.now(),
              });
              if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
            }
          }
        }
      });
      observer.observe({type: 'resource', buffered: false});
    } catch { /* observer not supported */ }
  }

  return 'Asset monitor installed. Intercepts fetch, XHR, and PerformanceObserver.';
})()
`;

const ASSET_MONITOR_QUERY = (
  filter: string | null,
  maxResults: number,
  _sinceMs: number | null,
) => `
(() => {
  const entries = window.__mcp_asset_monitor__ || [];
  const now = Date.now();
  let filtered = entries;

  if (${_sinceMs} && ${_sinceMs} > 0) {
    filtered = filtered.filter(e => e.timestamp >= now - ${_sinceMs});
  }

  if (${JSON.stringify(filter)}) {
    const f = ${JSON.stringify(filter)}.toLowerCase();
    filtered = filtered.filter(e => e.url.toLowerCase().includes(f));
  }

  // Summary
  const byExt = {};
  let totalSize = 0;
  let totalDuration = 0;
  let failCount = 0;
  for (const e of filtered) {
    const ext = e.ext || e.url.split('?')[0].split('.').pop()?.toLowerCase() || 'other';
    if (!byExt[ext]) byExt[ext] = { count: 0, totalSize: 0, totalDuration: 0, failed: 0 };
    byExt[ext].count++;
    byExt[ext].totalSize += e.size || 0;
    byExt[ext].totalDuration += e.duration || 0;
    if (e.status === 0 || e.status >= 400) byExt[ext].failed++;
    totalSize += e.size || 0;
    totalDuration += e.duration || 0;
    if (e.status === 0 || e.status >= 400) failCount++;
  }

  const recent = filtered.slice(-${maxResults});

  return {
    total: filtered.length,
    totalSizeKB: Math.round(totalSize / 1024),
    totalDurationMs: Math.round(totalDuration),
    failCount,
    byExt,
    recent: recent.map(e => ({
      url: e.url.split('/').pop()?.substring(0, 80) || e.url.substring(0, 80),
      ext: e.ext || '?',
      status: e.status,
      duration: e.duration,
      sizeKB: Math.round((e.size || 0) / 1024),
    })),
  };
})()
`;

export const assetMonitorStart = definePageTool({
  name: 'asset_monitor_start',
  description:
    'Install an asset loading interceptor that tracks fetch, XHR, and PerformanceObserver resource timing. ' +
    'Use asset_monitor_get to query captured data. Covers textures, audio, scripts, 3D models, fonts, WASM.',
  annotations: {
    category: ToolCategory.NETWORK,
    readOnlyHint: false,
  },
  schema: {},
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const result = await request.page.pptrPage.evaluate(ASSET_MONITOR_INSTALL);
    response.appendResponseLine(String(result));
  },
});

export const assetMonitorGet = definePageTool({
  name: 'asset_monitor_get',
  description:
    'Query captured asset loading data. Returns summary by file extension (count, size, duration, failures) and recent entries.',
  annotations: {
    category: ToolCategory.NETWORK,
    readOnlyHint: true,
  },
  schema: {
    filter: zod
      .string()
      .optional()
      .describe('Filter by URL substring (case-insensitive).'),
    sinceMs: zod
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Only return entries from the last N milliseconds.'),
    maxResults: zod
      .number()
      .int()
      .min(1)
      .max(200)
      .default(30)
      .describe('Maximum recent entries to return. Default 30.'),
  },
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const {filter, sinceMs, maxResults} = request.params;
    const script = ASSET_MONITOR_QUERY(
      filter || null,
      maxResults,
      sinceMs || null,
    );
    const result = await request.page.pptrPage.evaluate(script);

    if (typeof result === 'string') {
      response.appendResponseLine(result);
      return;
    }

    const data = result as {
      total: number;
      totalSizeKB: number;
      totalDurationMs: number;
      failCount: number;
      byExt: Record<
        string,
        {
          count: number;
          totalSize: number;
          totalDuration: number;
          failed: number;
        }
      >;
      recent: Array<{
        url: string;
        ext: string;
        status: number;
        duration: number;
        sizeKB: number;
      }>;
    };

    response.appendResponseLine(
      `Assets: ${data.total} loaded, ${data.totalSizeKB}KB total, ${data.totalDurationMs}ms total`,
    );
    if (data.failCount > 0) {
      response.appendResponseLine(`⚠ Failed: ${data.failCount}`);
    }
    response.appendResponseLine('');

    // Summary by extension
    response.appendResponseLine('By type:');
    const sorted = Object.entries(data.byExt).sort(
      (a, b) => b[1].totalSize - a[1].totalSize,
    );
    for (const [ext, stats] of sorted) {
      const sizeKB = Math.round(stats.totalSize / 1024);
      const avgMs = Math.round(stats.totalDuration / stats.count);
      const failStr = stats.failed > 0 ? ` ❌${stats.failed}` : '';
      response.appendResponseLine(
        `  .${ext}: ${stats.count} files, ${sizeKB}KB, avg ${avgMs}ms${failStr}`,
      );
    }

    if (data.recent.length > 0) {
      response.appendResponseLine('');
      response.appendResponseLine('Recent:');
      for (const entry of data.recent) {
        const statusIcon =
          entry.status >= 200 && entry.status < 400 ? '✓' : '✗';
        response.appendResponseLine(
          `  ${statusIcon} [${entry.ext}] ${entry.url} — ${entry.duration}ms, ${entry.sizeKB}KB`,
        );
      }
    }
  },
});

// ─── canvas_info ────────────────────────────────────────────────────────────

export const canvasInfo = definePageTool({
  name: 'canvas_info',
  description:
    'Get information about all canvas elements on the page: dimensions, DPR, WebGL context details, GPU renderer. ' +
    'Useful for debugging game rendering across different devices.',
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {},
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const result = await request.page.pptrPage.evaluate(`
(() => {
  const canvases = document.querySelectorAll('canvas');
  const results = [];

  canvases.forEach((canvas, i) => {
    const info = {
      index: i,
      id: canvas.id || '(no id)',
      className: canvas.className || '(no class)',
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      style: {
        width: canvas.style.width || '(auto)',
        height: canvas.style.height || '(auto)',
      },
    };

    // Try WebGL context
    for (const ctxType of ['webgl2', 'webgl', 'experimental-webgl']) {
      try {
        const gl = canvas.getContext(ctxType);
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          info.webgl = {
            version: ctxType,
            glVersion: gl.getParameter(gl.VERSION),
            glRenderer: gl.getParameter(gl.RENDERER),
            glVendor: gl.getParameter(gl.VENDOR),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxViewportDims: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS)),
            antialias: gl.getContextAttributes().antialias,
            alpha: gl.getContextAttributes().alpha,
            preserveDrawingBuffer: gl.getContextAttributes().preserveDrawingBuffer,
          };
          if (debugInfo) {
            info.webgl.gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            info.webgl.gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          }
          break;
        }
      } catch { /* not available */ }
    }

    // Try 2D context
    try {
      const ctx = canvas.getContext('2d');
      if (ctx && !info.webgl) {
        info.canvas2d = {
          imageSmoothingEnabled: ctx.imageSmoothingEnabled,
          imageSmoothingQuality: ctx.imageSmoothingQuality || '(default)',
        };
      }
    } catch { /* not available */ }

    results.push(info);
  });

  return {
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    canvasCount: canvases.length,
    canvases: results,
  };
})()
    `);

    if (typeof result === 'string') {
      response.appendResponseLine(result);
      return;
    }

    const data = result as {
      devicePixelRatio: number;
      screenWidth: number;
      screenHeight: number;
      viewportWidth: number;
      viewportHeight: number;
      canvasCount: number;
      canvases: Array<Record<string, unknown>>;
    };

    response.appendResponseLine(`Device Pixel Ratio: ${data.devicePixelRatio}`);
    response.appendResponseLine(
      `Screen: ${data.screenWidth}×${data.screenHeight}`,
    );
    response.appendResponseLine(
      `Viewport: ${data.viewportWidth}×${data.viewportHeight}`,
    );
    response.appendResponseLine(`Canvas elements: ${data.canvasCount}`);
    response.appendResponseLine('');

    for (const canvas of data.canvases) {
      response.appendResponseLine(
        `Canvas #${canvas.index} [${canvas.id}] ${canvas.width}×${canvas.height} (client: ${canvas.clientWidth}×${canvas.clientHeight})`,
      );

      if (
        canvas.style &&
        (canvas.style as Record<string, string>).width !== '(auto)'
      ) {
        response.appendResponseLine(`  Style: ${JSON.stringify(canvas.style)}`);
      }

      if (canvas.webgl) {
        const gl = canvas.webgl as Record<string, unknown>;
        response.appendResponseLine(`  WebGL: ${gl.version} — ${gl.glVersion}`);
        if (gl.gpuRenderer) {
          response.appendResponseLine(`  GPU: ${gl.gpuRenderer}`);
        }
        response.appendResponseLine(`  Max Texture: ${gl.maxTextureSize}px`);
        response.appendResponseLine(
          `  AA: ${gl.antialias}, Alpha: ${gl.alpha}`,
        );
      }

      if (canvas.canvas2d) {
        const c2d = canvas.canvas2d as Record<string, unknown>;
        response.appendResponseLine(
          `  Canvas2D: smoothing=${c2d.imageSmoothingEnabled}, quality=${c2d.imageSmoothingQuality}`,
        );
      }
    }
  },
});
