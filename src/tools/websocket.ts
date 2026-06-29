/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * WebSocket monitoring tools using Chrome DevTools Protocol.
 * Captures WebSocket lifecycle events and message payloads.
 */

import {zod} from '../third_party/index.js';

import {ToolCategory} from './categories.js';
import {definePageTool} from './ToolDefinition.js';

// In-memory storage for WebSocket events (per-page, keyed by page target ID)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsEvents = new Map<string, any[]>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsHandlers = new Map<string, any[]>();

function addEvent(pageId: string, event: Record<string, unknown>) {
  const arr = wsEvents.get(pageId) ?? [];
  arr.push({...event, timestamp: Date.now()});
  // Keep last 500 events
  if (arr.length > 500) arr.splice(0, arr.length - 500);
  wsEvents.set(pageId, arr);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCdpClient(page: any) {
  return page.pptrPage._client();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPageId(page: any) {
  const target = page.pptrPage.target();
  return String(target._targetId ?? target.id());
}

// ─── websocket_monitor_start ────────────────────────────────────────────────
export const websocketMonitorStart = definePageTool({
  name: 'websocket_monitor_start',
  description:
    'Start monitoring WebSocket activity on the page via CDP Network domain. ' +
    'Captures: connection creation, handshake, frames sent/received, and closures. ' +
    'Call websocket_monitor_stop to detach. Events are stored in memory and can be queried with websocket_monitor_get.',
  annotations: {
    category: ToolCategory.NETWORK,
    readOnlyHint: false,
  },
  schema: {},
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const client = getCdpClient(request.page);
    const pageId = getPageId(request.page);

    // Clear old events for this page
    wsEvents.set(pageId, []);
    wsHandlers.set(pageId, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const on = (event: string, handler: any) => {
      client.on(event, handler);
      wsHandlers.get(pageId)!.push({event, handler});
    };

    // WebSocket lifecycle events
    on('Network.webSocketCreated', (params: Record<string, unknown>) => {
      addEvent(pageId, {
        type: 'created',
        requestId: params.requestId as string,
        url: params.url as string,
      });
    });

    on('Network.webSocketWillSendHandshakeRequest', (params: Record<string, unknown>) => {
      addEvent(pageId, {
        type: 'handshake_sent',
        requestId: params.requestId as string,
      });
    });

    on('Network.webSocketHandshakeResponseReceived', (params: Record<string, unknown>) => {
      addEvent(pageId, {
        type: 'handshake_received',
        requestId: params.requestId as string,
      });
    });

    on('Network.webSocketFrameSent', (params: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = (params as any).response?.response;
      addEvent(pageId, {
        type: 'frame_sent',
        requestId: params.requestId as string,
        data: response?.payloadData?.substring(0, 500),
        length: response?.payloadData?.length,
        opcode: response?.opcode,
      });
    });

    on('Network.webSocketFrameReceived', (params: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = (params as any).response?.response;
      addEvent(pageId, {
        type: 'frame_received',
        requestId: params.requestId as string,
        data: response?.payloadData?.substring(0, 500),
        length: response?.payloadData?.length,
        opcode: response?.opcode,
      });
    });

    on('Network.webSocketClosed', (params: Record<string, unknown>) => {
      addEvent(pageId, {
        type: 'closed',
        requestId: params.requestId as string,
      });
    });

    on('Network.webSocketFrameError', (params: Record<string, unknown>) => {
      addEvent(pageId, {
        type: 'error',
        requestId: params.requestId as string,
        error: params.errorMessage as string,
      });
    });

    // Enable Network domain
    await client.send('Network.enable');

    response.appendResponseLine(
      'WebSocket monitoring started. Use websocket_monitor_get to view captured events.',
    );
  },
});

// ─── websocket_monitor_get ──────────────────────────────────────────────────
export const websocketMonitorGet = definePageTool({
  name: 'websocket_monitor_get',
  description:
    'Get captured WebSocket events. Returns lifecycle events (created, handshake, closed) and message frames.',
  annotations: {
    category: ToolCategory.NETWORK,
    readOnlyHint: true,
  },
  schema: {
    types: zod
      .array(
        zod.enum([
          'created',
          'handshake_sent',
          'handshake_received',
          'frame_sent',
          'frame_received',
          'closed',
          'error',
        ]),
      )
      .optional()
      .describe(
        'Filter by event types. When omitted, returns all events.',
      ),
    maxEvents: zod
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50)
      .describe('Maximum number of events to return. Default 50.'),
  },
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const pageId = getPageId(request.page);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allEvents: any[] = wsEvents.get(pageId) ?? [];
    const {types, maxEvents} = request.params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filtered: any[] = allEvents;
    if (types && types.length > 0) {
      const typeSet = new Set(types);
      filtered = allEvents.filter(e => typeSet.has(e.type));
    }

    const events = filtered.slice(-maxEvents);

    response.appendResponseLine(
      `WebSocket events: ${filtered.length} total, showing ${events.length}:`,
    );

    for (const evt of events) {
      const time = new Date(evt.timestamp as number).toISOString().substring(11, 23);
      let detail = '';
      if (evt.url) detail += ` → ${evt.url}`;
      if (evt.data) detail += ` [${evt.length}B]: ${evt.data}`;
      if (evt.error) detail += ` ERROR: ${evt.error}`;
      if (evt.requestId) detail += ` (req: ${String(evt.requestId).substring(0, 8)})`;
      response.appendResponseLine(`[${time}] ${evt.type}${detail}`);
    }
  },
});

// ─── websocket_monitor_stop ─────────────────────────────────────────────────
export const websocketMonitorStop = definePageTool({
  name: 'websocket_monitor_stop',
  description: 'Stop WebSocket monitoring and detach CDP Network listeners.',
  annotations: {
    category: ToolCategory.NETWORK,
    readOnlyHint: false,
  },
  schema: {},
  blockedByDialog: false,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const pageId = getPageId(request.page);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers: any[] = wsHandlers.get(pageId) ?? [];

    if (handlers.length > 0) {
      const client = getCdpClient(request.page);
      for (const {event, handler} of handlers) {
        client.off(event, handler);
      }
      wsHandlers.delete(pageId);
    }

    const eventCount = (wsEvents.get(pageId) ?? []).length;
    wsEvents.delete(pageId);

    response.appendResponseLine(
      `WebSocket monitoring stopped. Captured ${eventCount} events.`,
    );
  },
});
