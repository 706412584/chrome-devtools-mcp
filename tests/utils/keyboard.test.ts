/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import {describe, it} from 'node:test';

import {parseKey} from '../../src/utils/keyboard.js';

describe('parseKey', () => {
  it('should parse a single key', () => {
    const result = parseKey('Enter');
    assert.deepStrictEqual(result, ['Enter']);
  });

  it('should parse a single character key', () => {
    const result = parseKey('a');
    assert.deepStrictEqual(result, ['a']);
  });

  it('should parse modifier + key combination', () => {
    const result = parseKey('Control+a');
    // Returns [primary key, ...modifiers]
    assert.deepStrictEqual(result, ['a', 'Control']);
  });

  it('should parse multiple modifiers', () => {
    const result = parseKey('Control+Shift+a');
    // primary key is last, modifiers in original order
    assert.deepStrictEqual(result, ['a', 'Control', 'Shift']);
  });

  it('should handle Shift++ (plus key with modifier)', () => {
    const result = parseKey('Shift++');
    assert.deepStrictEqual(result, ['+', 'Shift']);
  });

  it('should handle single + key', () => {
    const result = parseKey('+');
    assert.deepStrictEqual(result, ['+']);
  });

  it('should throw for invalid key', () => {
    assert.throws(() => parseKey('InvalidKey123'), /is invalid/);
  });

  it('should throw for empty string', () => {
    assert.throws(() => parseKey(''), /could not be parsed/);
  });

  it('should throw for duplicate keys', () => {
    assert.throws(() => parseKey('a+a'), /contains duplicate keys/);
  });

  it('should parse function keys', () => {
    const result = parseKey('F1');
    assert.deepStrictEqual(result, ['F1']);
  });

  it('should parse arrow keys', () => {
    const result = parseKey('ArrowUp');
    assert.deepStrictEqual(result, ['ArrowUp']);
  });

  it('should parse modifier + arrow key', () => {
    const result = parseKey('Shift+ArrowDown');
    assert.deepStrictEqual(result, ['ArrowDown', 'Shift']);
  });

  it('should parse special characters', () => {
    assert.deepStrictEqual(parseKey('Space'), ['Space']);
    assert.deepStrictEqual(parseKey('Tab'), ['Tab']);
    assert.deepStrictEqual(parseKey('Escape'), ['Escape']);
    assert.deepStrictEqual(parseKey('Backspace'), ['Backspace']);
  });

  it('should parse Meta key combinations', () => {
    const result = parseKey('Meta+c');
    assert.deepStrictEqual(result, ['c', 'Meta']);
  });
});
