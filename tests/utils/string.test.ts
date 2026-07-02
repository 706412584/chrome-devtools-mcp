/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import {describe, it} from 'node:test';

import {toSnakeCase} from '../../src/utils/string.js';

describe('toSnakeCase', () => {
  it('should return empty string for empty input', () => {
    assert.strictEqual(toSnakeCase(''), '');
  });

  it('should convert camelCase', () => {
    assert.strictEqual(toSnakeCase('camelCase'), 'camel_case');
  });

  it('should convert PascalCase', () => {
    assert.strictEqual(toSnakeCase('PascalCase'), 'pascal_case');
  });

  it('should handle acronyms', () => {
    assert.strictEqual(toSnakeCase('APIFlags'), 'api_flags');
  });

  it('should handle letters followed by numbers', () => {
    assert.strictEqual(toSnakeCase('version2'), 'version_2');
  });

  it('should handle multiple words', () => {
    assert.strictEqual(toSnakeCase('lastName'), 'last_name');
  });

  it('should handle already snake_case', () => {
    assert.strictEqual(toSnakeCase('already_snake'), 'already_snake');
  });

  it('should handle single word lowercase', () => {
    assert.strictEqual(toSnakeCase('simple'), 'simple');
  });

  it('should handle all uppercase', () => {
    assert.strictEqual(toSnakeCase('ABC'), 'abc');
  });

  it('should handle mixed case with numbers', () => {
    assert.strictEqual(toSnakeCase('version2Update'), 'version_2_update');
  });

  it('should handle spaces and special characters', () => {
    assert.strictEqual(toSnakeCase('hello world'), 'hello_world');
  });

  it('should handle hyphens', () => {
    assert.strictEqual(toSnakeCase('kebab-case'), 'kebab_case');
  });

  it('should remove leading and trailing underscores', () => {
    assert.strictEqual(toSnakeCase('_leading'), 'leading');
    assert.strictEqual(toSnakeCase('trailing_'), 'trailing');
  });

  it('should collapse multiple separators', () => {
    assert.strictEqual(toSnakeCase('hello---world'), 'hello_world');
  });

  it('should handle complex acronym transitions', () => {
    assert.strictEqual(toSnakeCase('XMLParser'), 'xml_parser');
    assert.strictEqual(toSnakeCase('parseHTML'), 'parse_html');
  });

  it('should handle single character', () => {
    assert.strictEqual(toSnakeCase('A'), 'a');
    assert.strictEqual(toSnakeCase('a'), 'a');
  });
});
