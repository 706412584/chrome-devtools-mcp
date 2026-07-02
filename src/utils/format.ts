/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared formatting helpers for tool response output.
 */

import type {Response} from '../tools/ToolDefinition.js';

/**
 * Format a timestamp (epoch ms) as a time-only string "HH:mm:ss.SSS".
 */
export function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString().substring(11, 23);
}

/**
 * Append a fenced JSON code block to the response.
 */
export function appendJsonBlock(response: Response, value: unknown): void {
  response.appendResponseLine('```json');
  response.appendResponseLine(
    typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  );
  response.appendResponseLine('```');
}
