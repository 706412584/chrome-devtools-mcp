/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Console search/intercept tools for game development.
 * Provides text-based search, pattern matching, and real-time console capture.
 */

import {zod} from '../third_party/index.js';

import {ToolCategory} from './categories.js';
import {definePageTool} from './ToolDefinition.js';

// ─── Interceptor: captures console messages into a global array ─────────────
const INTERCEPTOR_INSTALL_SCRIPT = `
(() => {
  // Avoid double-install
  if (window.__mcp_console_capture__) return 'Already installed';

  const MAX_MESSAGES = 2000;
  const messages = [];
  window.__mcp_console_capture__ = messages;

  const methods = ['log', 'info', 'warn', 'error', 'debug', 'dir', 'table', 'trace'];
  const originals = {};

  for (const method of methods) {
    originals[method] = console[method];
    console[method] = function(...args) {
      originals[method].apply(console, args);

      const text = args.map(a => {
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch { return String(a); }
        }
        return String(a);
      }).join(' ');

      messages.push({
        type: method,
        text: text,
        time: Date.now(),
      });

      // Trim oldest if over limit
      if (messages.length > MAX_MESSAGES) {
        messages.splice(0, messages.length - MAX_MESSAGES);
      }
    };
  }

  return 'Interceptor installed. Capturing console messages.';
})()
`;

const INTERCEPTOR_UNINSTALL_SCRIPT = `
(() => {
  // Restore is complex since we can't get originals back reliably.
  // Just clear the capture buffer.
  if (window.__mcp_console_capture__) {
    window.__mcp_console_capture__ = [];
    return 'Capture buffer cleared.';
  }
  return 'No interceptor found.';
})()
`;

const SEARCH_SCRIPT = (query: string, typeFilter: string | null, maxResults: number, sinceMs: number | null) => `
(() => {
  const messages = window.__mcp_console_capture__ || [];
  const now = Date.now();
  const query = ${JSON.stringify(query)};
  const typeFilter = ${JSON.stringify(typeFilter)};
  const sinceMs = ${JSON.stringify(sinceMs)};
  const maxResults = ${maxResults};

  let filtered = messages;

  // Time filter
  if (sinceMs !== null && sinceMs > 0) {
    const cutoff = now - sinceMs;
    filtered = filtered.filter(m => m.time >= cutoff);
  }

  // Type filter
  if (typeFilter && typeFilter !== 'all') {
    const types = typeFilter.split(',').map(t => t.trim());
    filtered = filtered.filter(m => types.includes(m.type));
  }

  // Text search
  if (query && query.length > 0) {
    const lower = query.toLowerCase();
    filtered = filtered.filter(m => m.text.toLowerCase().includes(lower));
  }

  // Limit results
  const results = filtered.slice(-maxResults);

  return {
    total: filtered.length,
    returned: results.length,
    messages: results.map(m => ({
      type: m.type,
      text: m.text.substring(0, 500),
      time: m.time,
    })),
  };
})()
`;

const STATS_SCRIPT = `
(() => {
  const messages = window.__mcp_console_capture__ || [];
  const byType = {};
  for (const m of messages) {
    byType[m.type] = (byType[m.type] || 0) + 1;
  }
  return {
    total: messages.length,
    byType: byType,
    oldest: messages.length > 0 ? messages[0].time : null,
    newest: messages.length > 0 ? messages[messages.length - 1].time : null,
    installed: !!window.__mcp_console_capture__,
  };
})()
`;

// ─── console_intercept_start ────────────────────────────────────────────────
export const consoleInterceptStart = definePageTool({
  name: 'console_intercept_start',
  description:
    'Install a console interceptor that captures all console.log/info/warn/error/debug calls into a buffer. ' +
    'Use console_search to query captured messages. Messages persist until page navigation or console_intercept_stop.',
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: false,
  },
  schema: {},
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const result = await request.page.pptrPage.evaluate(INTERCEPTOR_INSTALL_SCRIPT);
    response.appendResponseLine(String(result));
  },
});

// ─── console_intercept_stop ─────────────────────────────────────────────────
export const consoleInterceptStop = definePageTool({
  name: 'console_intercept_stop',
  description: 'Clear the console capture buffer. Does not uninstall the interceptor (messages will continue to be captured).',
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: false,
  },
  schema: {},
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const result = await request.page.pptrPage.evaluate(INTERCEPTOR_UNINSTALL_SCRIPT);
    response.appendResponseLine(String(result));
  },
});

// ─── console_search ─────────────────────────────────────────────────────────
export const consoleSearch = definePageTool({
  name: 'console_search',
  description:
    'Search captured console messages by text content and/or type. ' +
    'Requires console_intercept_start to be called first to install the interceptor. ' +
    'Returns matching messages with timestamps.',
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    query: zod
      .string()
      .optional()
      .describe('Text to search for (case-insensitive substring match).'),
    types: zod
      .string()
      .optional()
      .describe(
        'Comma-separated list of message types to filter: log,info,warn,error,debug,dir,table,trace. Default: all types.',
      ),
    sinceMs: zod
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Only return messages from the last N milliseconds. Default: all messages.',
      ),
    maxResults: zod
      .number()
      .int()
      .min(1)
      .max(500)
      .default(50)
      .describe('Maximum number of messages to return. Default 50.'),
  },
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const {query, types, sinceMs, maxResults} = request.params;
    const script = SEARCH_SCRIPT(query || '', types || null, maxResults, sinceMs || null);
    const result = await request.page.pptrPage.evaluate(script);

    if (typeof result === 'string') {
      response.appendResponseLine(result);
      return;
    }

    const data = result as {total: number; returned: number; messages: Array<{type: string; text: string; time: number}>};

    response.appendResponseLine(
      `Found ${data.total} matching messages, showing ${data.returned}:`,
    );

    for (const msg of data.messages) {
      const time = new Date(msg.time).toISOString().substring(11, 23);
      response.appendResponseLine(`[${time}] [${msg.type}] ${msg.text}`);
    }
  },
});

// ─── console_stats ──────────────────────────────────────────────────────────
export const consoleStats = definePageTool({
  name: 'console_stats',
  description: 'Show statistics about captured console messages: total count, breakdown by type, time range.',
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {},
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const result = await request.page.pptrPage.evaluate(STATS_SCRIPT);

    if (typeof result === 'string') {
      response.appendResponseLine(result);
      return;
    }

    const data = result as {total: number; byType: Record<string, number>; oldest: number | null; newest: number | null; installed: boolean};

    response.appendResponseLine(`Interceptor installed: ${data.installed}`);
    response.appendResponseLine(`Total captured: ${data.total}`);
    response.appendResponseLine('Breakdown by type:');
    for (const [type, count] of Object.entries(data.byType)) {
      response.appendResponseLine(`  ${type}: ${count}`);
    }
    if (data.oldest && data.newest) {
      const duration = ((data.newest - data.oldest) / 1000).toFixed(1);
      response.appendResponseLine(
        `Time span: ${duration}s (${new Date(data.oldest).toISOString().substring(11, 23)} → ${new Date(data.newest).toISOString().substring(11, 23)})`,
      );
    }
  },
});
