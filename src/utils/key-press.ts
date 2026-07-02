/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared keyboard press utility.
 * Handles pressing a key with modifier keys (Ctrl, Shift, Alt, Meta).
 */

import type {KeyInput, Page} from '../third_party/index.js';

import {parseKey} from './keyboard.js';

/**
 * Press a single key combo string (e.g. "Control+S") on the given page,
 * holding modifiers down then releasing in reverse order.
 */
export async function pressKeyCombo(
  page: Page,
  keyInput: string,
): Promise<void> {
  const tokens = parseKey(keyInput);
  const [key, ...modifiers] = tokens;

  for (const modifier of modifiers) {
    await page.keyboard.down(modifier as KeyInput);
  }
  await page.keyboard.press(key);
  for (const modifier of modifiers.toReversed()) {
    await page.keyboard.up(modifier as KeyInput);
  }
}
