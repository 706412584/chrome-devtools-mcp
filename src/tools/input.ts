/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {logger} from '../logger.js';
import type {McpContext} from '../McpContext.js';
import {zod} from '../third_party/index.js';
import type {ElementHandle, KeyInput} from '../third_party/index.js';
import type {TextSnapshotNode} from '../types.js';
import {parseKey} from '../utils/keyboard.js';
import type {WaitForEventsResult} from '../WaitForHelper.js';

import {ToolCategory} from './categories.js';
import type {ContextPage} from './ToolDefinition.js';
import {definePageTool} from './ToolDefinition.js';

const dblClickSchema = zod
  .boolean()
  .optional()
  .describe('Set to true for double clicks. Default is false.');

const includeSnapshotSchema = zod
  .boolean()
  .optional()
  .describe('Whether to include a snapshot in the response. Default is false.');

const submitKeySchema = zod
  .string()
  .optional()
  .describe(
    'Optional key to press after typing. E.g., "Enter", "Tab", "Escape"',
  );

function handleActionError(error: unknown, uid: string) {
  logger?.('failed to act using a locator', error);
  throw new Error(
    `Failed to interact with the element with uid ${uid}. The element did not become interactive within the configured timeout.`,
    {
      cause: error,
    },
  );
}

async function selectNativeSelectOption(handle: ElementHandle<Element>) {
  const selectHandle = await handle.evaluateHandle(node => {
    if (!(node instanceof HTMLOptionElement)) {
      return null;
    }

    const select = node.closest('select');
    if (!select || select.multiple || select.disabled || node.disabled) {
      return null;
    }

    const parentElement = node.parentElement;
    if (
      parentElement instanceof HTMLOptGroupElement &&
      parentElement.disabled
    ) {
      return null;
    }

    return select;
  });
  try {
    const select = selectHandle.asElement() as ElementHandle<Element> | null;
    if (!select) {
      return false;
    }

    const valueHandle = await handle.getProperty('value');
    try {
      const value = await valueHandle.jsonValue();
      if (typeof value !== 'string') {
        return false;
      }
      await select.asLocator().fill(value);
    } finally {
      void valueHandle.dispose();
    }
    return true;
  } finally {
    void selectHandle.dispose();
  }
}

export const click = definePageTool({
  name: 'click',
  description:
    `Clicks on the provided element. For cross-origin iframes (e.g., game canvases), ` +
    `automatically falls back to CDP Input.dispatchMouseEvent which penetrates iframe boundaries. ` +
    `Use offsetX/offsetY to click at a specific position within the element (e.g., a button inside a canvas). ` +
    `Coordinates are relative to the element's top-left corner.`,
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  schema: {
    uid: zod
      .string()
      .describe(
        'The uid of an element on the page from the page content snapshot',
      ),
    offsetX: zod
      .number()
      .optional()
      .describe(
        'Horizontal offset from the element\'s top-left corner in CSS pixels. ' +
          'When provided with offsetY, clicks at this position instead of center. ' +
          'Useful for clicking buttons inside canvas elements.',
      ),
    offsetY: zod
      .number()
      .optional()
      .describe(
        'Vertical offset from the element\'s top-left corner in CSS pixels. ' +
          'When provided with offsetX, clicks at this position instead of center. ' +
          'Useful for clicking buttons inside canvas elements.',
      ),
    dblClick: dblClickSchema,
    includeSnapshot: includeSnapshotSchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const uid = request.params.uid;
    const {offsetX, offsetY} = request.params;
    const hasOffset = offsetX !== undefined && offsetY !== undefined;
    const handle = await request.page.getElementByUid(uid);
    const aXNode = request.page.getAXNodeByUid(uid);
    const shouldSelectNativeOption =
      !request.params.dblClick && aXNode?.role === 'option';
    try {
      const result = await request.page.waitForEventsAfterAction(async () => {
        if (
          shouldSelectNativeOption &&
          (await selectNativeSelectOption(handle))
        ) {
          return;
        }

        // If offsets are specified, skip DOM click and go straight to CDP
        // to support clicking inside cross-origin iframes/canvases.
        if (hasOffset) {
          const box = await handle.boundingBox();
          if (box) {
            const x = box.x + offsetX;
            const y = box.y + offsetY;
            await request.page.pptrPage.mouse.click(x, y, {
              count: request.params.dblClick ? 2 : 1,
            });
          } else {
            throw new Error(
              `Could not determine bounding box for element ${uid}`,
            );
          }
          return;
        }

        try {
          await handle.asLocator().click({
            count: request.params.dblClick ? 2 : 1,
          });
        } catch (clickError) {
          // Cross-origin iframes block DOM-level events from Playwright.
          // Fall back to CDP Input.dispatchMouseEvent which works at the
          // compositor level and can penetrate cross-origin boundaries.
          const box = await handle.boundingBox();
          if (box) {
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await request.page.pptrPage.mouse.click(x, y, {
              count: request.params.dblClick ? 2 : 1,
            });
          } else {
            throw clickError;
          }
        }
      });
      const posStr = hasOffset
        ? ` at offset (${offsetX}, ${offsetY})`
        : '';
      response.appendResponseLine(
        request.params.dblClick
          ? `Successfully double clicked on the element${posStr}`
          : `Successfully clicked on the element${posStr}`,
      );
      response.attachWaitForResult(result);
      if (request.params.includeSnapshot) {
        response.includeSnapshot();
      }
    } catch (error) {
      handleActionError(error, uid);
    } finally {
      void handle.dispose();
    }
  },
});

export const clickAt = definePageTool({
  name: 'click_at',
  description: `Clicks at the provided coordinates`,
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
    conditions: ['experimentalVision'],
  },
  schema: {
    x: zod.number().describe('The x coordinate'),
    y: zod.number().describe('The y coordinate'),
    dblClick: dblClickSchema,
    includeSnapshot: includeSnapshotSchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const page = request.page;
    const result = await page.waitForEventsAfterAction(async () => {
      await page.pptrPage.mouse.click(request.params.x, request.params.y, {
        count: request.params.dblClick ? 2 : 1,
      });
    });
    response.appendResponseLine(
      request.params.dblClick
        ? `Successfully double clicked at the coordinates`
        : `Successfully clicked at the coordinates`,
    );
    response.attachWaitForResult(result);
    if (request.params.includeSnapshot) {
      response.includeSnapshot();
    }
  },
});

export const hover = definePageTool({
  name: 'hover',
  description: `Hover over the provided element`,
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  schema: {
    uid: zod
      .string()
      .describe(
        'The uid of an element on the page from the page content snapshot',
      ),
    includeSnapshot: includeSnapshotSchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const uid = request.params.uid;
    const handle = await request.page.getElementByUid(uid);
    try {
      const result = await request.page.waitForEventsAfterAction(async () => {
        await handle.asLocator().hover();
      });
      response.appendResponseLine(`Successfully hovered over the element`);
      response.attachWaitForResult(result);
      if (request.params.includeSnapshot) {
        response.includeSnapshot();
      }
    } catch (error) {
      handleActionError(error, uid);
    } finally {
      void handle.dispose();
    }
  },
});

// The AXNode for an option doesn't contain its `value`. We set text content of the option as value.
// If the form is a combobox, we need to find the correct option by its text value.
// To do that, loop through the children while checking which child's text matches the requested value (requested value is actually the text content).
// When the correct option is found, use the element handle to get the real value.
async function selectOption(
  handle: ElementHandle,
  aXNode: TextSnapshotNode,
  value: string,
) {
  let optionFound = false;
  for (const child of aXNode.children) {
    if (child.role === 'option' && child.name === value && child.value) {
      optionFound = true;
      const childHandle = await child.elementHandle();
      if (childHandle) {
        try {
          const childValueHandle = await childHandle.getProperty('value');
          try {
            const childValue = await childValueHandle.jsonValue();
            if (childValue) {
              await handle.asLocator().fill(childValue.toString());
            }
          } finally {
            void childValueHandle.dispose();
          }
          break;
        } finally {
          void childHandle.dispose();
        }
      }
    }
  }
  if (!optionFound) {
    throw new Error(`Could not find option with text "${value}"`);
  }
}

function hasOptionChildren(aXNode: TextSnapshotNode) {
  return aXNode.children.some(child => child.role === 'option');
}

async function fillFormElement(
  uid: string,
  value: string,
  context: McpContext,
  page: ContextPage,
) {
  const handle = await page.getElementByUid(uid);
  try {
    const aXNode = context.getAXNodeByUid(uid);
    // We assume that combobox needs to be handled as select if it has
    // role='combobox' and option children.
    if (aXNode && aXNode.role === 'combobox' && hasOptionChildren(aXNode)) {
      await selectOption(handle, aXNode, value);
    } else {
      const isToggle = await handle.evaluate(el => {
        if (el instanceof HTMLInputElement) {
          return el.type === 'checkbox' || el.type === 'radio';
        }
        const role = el.getAttribute('role');
        return role === 'checkbox' || role === 'radio' || role === 'switch';
      });

      if (isToggle) {
        if (['true', 'false'].includes(value)) {
          await handle.asLocator().fill(value === 'true');
        } else {
          throw new Error(
            `Checkboxes, radio boxes and toggles require "true" or "false" value, but ${value} was used`,
          );
        }
      } else {
        // Increase timeout for longer input values.
        const timeoutPerChar = 10; // ms
        const fillTimeout =
          page.pptrPage.getDefaultTimeout() + value.length * timeoutPerChar;
        await handle.asLocator().setTimeout(fillTimeout).fill(value);
      }
    }
  } catch (error) {
    handleActionError(error, uid);
  } finally {
    void handle.dispose();
  }
}

export const fill = definePageTool({
  name: 'fill',
  description: `Type text into an input, text area or select an option from a <select> element.`,
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  schema: {
    uid: zod
      .string()
      .describe(
        'The uid of an element on the page from the page content snapshot',
      ),
    value: zod
      .string()
      .describe(
        'The value to fill in. "true" or "false" for checkboxes and toggles, "true" for radio buttons.',
      ),
    includeSnapshot: includeSnapshotSchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response, context) => {
    const page = request.page;
    const result = await page.waitForEventsAfterAction(async () => {
      await fillFormElement(
        request.params.uid,
        request.params.value,
        context as McpContext,
        page,
      );
    });
    response.appendResponseLine(`Successfully filled out the element`);
    response.attachWaitForResult(result);
    if (request.params.includeSnapshot) {
      response.includeSnapshot();
    }
  },
});

export const typeText = definePageTool({
  name: 'type_text',
  description: `Type text using keyboard into a previously focused input`,
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  schema: {
    text: zod.string().describe('The text to type'),
    submitKey: submitKeySchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const page = request.page;
    const result = await page.waitForEventsAfterAction(async () => {
      await page.pptrPage.keyboard.type(request.params.text);
      if (request.params.submitKey) {
        await page.pptrPage.keyboard.press(
          request.params.submitKey as KeyInput,
        );
      }
    });
    response.appendResponseLine(
      `Typed text "${request.params.text}${request.params.submitKey ? ` + ${request.params.submitKey}` : ''}"`,
    );
    response.attachWaitForResult(result);
  },
});

export const drag = definePageTool({
  name: 'drag',
  description: `Drag an element onto another element`,
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  schema: {
    from_uid: zod.string().describe('The uid of the element to drag'),
    to_uid: zod.string().describe('The uid of the element to drop into'),
    includeSnapshot: includeSnapshotSchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const fromHandle = await request.page.getElementByUid(
      request.params.from_uid,
    );
    const toHandle = await request.page.getElementByUid(request.params.to_uid);
    try {
      const result = await request.page.waitForEventsAfterAction(async () => {
        await fromHandle.drag(toHandle);
        await new Promise(resolve => setTimeout(resolve, 50));
        await toHandle.drop(fromHandle);
      });
      response.appendResponseLine(`Successfully dragged an element`);
      response.attachWaitForResult(result);
      if (request.params.includeSnapshot) {
        response.includeSnapshot();
      }
    } finally {
      void fromHandle.dispose();
      void toHandle.dispose();
    }
  },
});

export const fillForm = definePageTool({
  name: 'fill_form',
  description: `Fill out multiple form elements (inputs, selects, checkboxes, radios) at once. ALWAYS prefer this tool over multiple individual 'fill' or 'click' calls when interacting with forms. It is significantly faster, more reliable, and reduces turn count. Example: Fill username, password, and check "Remember Me" in one call.`,
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  schema: {
    elements: zod
      .array(
        // eslint-disable-next-line @local/enforce-zod-schema
        zod.object({
          uid: zod.string().describe('The uid of the element to fill out'),
          value: zod
            .string()
            .describe(
              'Value for the element. "true" or "false" for checkboxes and toggles, "true" for radio buttons.',
            ),
        }),
      )
      .describe('Elements from snapshot to fill out.'),
    includeSnapshot: includeSnapshotSchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response, context) => {
    const page = request.page;
    let lastResult: WaitForEventsResult = {};
    for (const element of request.params.elements) {
      lastResult = await page.waitForEventsAfterAction(async () => {
        await fillFormElement(
          element.uid,
          element.value,
          context as McpContext,
          page,
        );
      });
    }
    response.appendResponseLine(`Successfully filled out the form`);
    response.attachWaitForResult(lastResult);
    if (request.params.includeSnapshot) {
      response.includeSnapshot();
    }
  },
});

export const uploadFile = definePageTool({
  name: 'upload_file',
  description: 'Upload a file through a provided element.',
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  schema: {
    uid: zod
      .string()
      .describe(
        'The uid of the file input element or an element that will open file chooser on the page from the page content snapshot',
      ),
    filePath: zod.string().describe('The local path of the file to upload'),
    includeSnapshot: includeSnapshotSchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: ['filePath'],
  handler: async (request, response, _context) => {
    const {uid, filePath} = request.params;
    const handle = (await request.page.getElementByUid(
      uid,
    )) as ElementHandle<HTMLInputElement>;
    try {
      try {
        await handle.uploadFile(filePath);
      } catch {
        // Some sites use a proxy element to trigger file upload instead of
        // a type=file element. In this case, we want to default to
        // Page.waitForFileChooser() and upload the file this way.
        try {
          const [fileChooser] = await Promise.all([
            request.page.pptrPage.waitForFileChooser({timeout: 3000}),
            handle.asLocator().click(),
          ]);
          await fileChooser.accept([filePath]);
        } catch {
          throw new Error(
            `Failed to upload file. The element could not accept the file directly, and clicking it did not trigger a file chooser.`,
          );
        }
      }
      if (request.params.includeSnapshot) {
        response.includeSnapshot();
      }
      response.appendResponseLine(`File uploaded from ${filePath}.`);
    } finally {
      void handle.dispose();
    }
  },
});

export const pressKey = definePageTool({
  name: 'press_key',
  description: `Press a key or key combination. Use this when other input methods like fill() cannot be used (e.g., keyboard shortcuts, navigation keys, or special key combinations).`,
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  schema: {
    key: zod
      .string()
      .describe(
        'A key or a combination (e.g., "Enter", "Control+A", "Control++", "Control+Shift+R"). Modifiers: Control, Shift, Alt, Meta',
      ),
    includeSnapshot: includeSnapshotSchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const page = request.page;
    const tokens = parseKey(request.params.key);
    const [key, ...modifiers] = tokens;

    const result = await page.waitForEventsAfterAction(async () => {
      for (const modifier of modifiers) {
        await page.pptrPage.keyboard.down(modifier);
      }
      await page.pptrPage.keyboard.press(key);
      for (const modifier of modifiers.toReversed()) {
        await page.pptrPage.keyboard.up(modifier);
      }
    });

    response.appendResponseLine(
      `Successfully pressed key: ${request.params.key}`,
    );
    response.attachWaitForResult(result);
    if (request.params.includeSnapshot) {
      response.includeSnapshot();
    }
  },
});

export const mouseMove = definePageTool({
  name: 'mouse_move',
  description: `Move the mouse cursor without clicking. Useful for triggering hover states.`,
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  schema: {
    x: zod.number().describe('The x coordinate'),
    y: zod.number().describe('The y coordinate'),
    includeSnapshot: includeSnapshotSchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const page = request.page;
    await page.pptrPage.mouse.move(request.params.x, request.params.y);
    response.appendResponseLine(
      `Moved mouse to (${request.params.x}, ${request.params.y})`,
    );
    if (request.params.includeSnapshot) {
      response.includeSnapshot();
    }
  },
});

export const keyboardSequence = definePageTool({
  name: 'keyboard_sequence',
  description: `Press a sequence of keys or key combinations. Each entry can be a single key or a combo like "Control+S". Useful for testing keyboard shortcuts and multi-key game controls.`,
  annotations: {
    category: ToolCategory.INPUT,
    readOnlyHint: false,
  },
  schema: {
    keys: zod
      .array(zod.string())
      .describe(
        'Array of keys or key combos to press in order, e.g. ["Tab", "Tab", "Enter"] or ["Control+S", "Control+Z"]',
      ),
    delayMs: zod
      .number()
      .min(0)
      .optional()
      .describe('Delay between each key press in milliseconds. Default is 0.'),
    includeSnapshot: includeSnapshotSchema,
  },
  blockedByDialog: true,
  verifyFilesSchema: [],
  handler: async (request, response) => {
    const page = request.page;
    const {keys, delayMs} = request.params;

    const result = await page.waitForEventsAfterAction(async () => {
      for (let i = 0; i < keys.length; i++) {
        const tokens = parseKey(keys[i]);
        const [key, ...modifiers] = tokens;

        for (const modifier of modifiers) {
          await page.pptrPage.keyboard.down(modifier);
        }
        await page.pptrPage.keyboard.press(key);
        for (const modifier of modifiers.toReversed()) {
          await page.pptrPage.keyboard.up(modifier);
        }

        if (delayMs && delayMs > 0 && i < keys.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    });

    response.appendResponseLine(
      `Pressed ${keys.length} keys: ${keys.join(' → ')}`,
    );
    response.attachWaitForResult(result);
    if (request.params.includeSnapshot) {
      response.includeSnapshot();
    }
  },
});
