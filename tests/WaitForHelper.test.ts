/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import {describe, it} from 'node:test';

import {getNetworkMultiplierFromString} from '../src/WaitForHelper.js';

describe('getNetworkMultiplierFromString', () => {
  it('should return 1 for "Fast 4G"', () => {
    assert.strictEqual(getNetworkMultiplierFromString('Fast 4G'), 1);
  });

  it('should return 2.5 for "Slow 4G"', () => {
    assert.strictEqual(getNetworkMultiplierFromString('Slow 4G'), 2.5);
  });

  it('should return 5 for "Fast 3G"', () => {
    assert.strictEqual(getNetworkMultiplierFromString('Fast 3G'), 5);
  });

  it('should return 10 for "Slow 3G"', () => {
    assert.strictEqual(getNetworkMultiplierFromString('Slow 3G'), 10);
  });

  it('should return 1 for null', () => {
    assert.strictEqual(getNetworkMultiplierFromString(null), 1);
  });

  it('should return 1 for unknown condition', () => {
    assert.strictEqual(getNetworkMultiplierFromString('Unknown'), 1);
  });

  it('should return 1 for empty string', () => {
    assert.strictEqual(getNetworkMultiplierFromString(''), 1);
  });
});
