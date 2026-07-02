/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import {describe, it} from 'node:test';

import {paginate} from '../../src/utils/pagination.js';

describe('paginate', () => {
  const items = Array.from({length: 50}, (_, i) => `item-${i}`);

  describe('without options', () => {
    it('should return all items when no options provided', () => {
      const result = paginate(items);
      assert.strictEqual(result.items.length, 50);
      assert.strictEqual(result.currentPage, 0);
      assert.strictEqual(result.totalPages, 1);
      assert.strictEqual(result.hasNextPage, false);
      assert.strictEqual(result.hasPreviousPage, false);
      assert.strictEqual(result.startIndex, 0);
      assert.strictEqual(result.endIndex, 50);
      assert.strictEqual(result.invalidPage, false);
    });

    it('should return all items when options are undefined values', () => {
      const result = paginate(items, {
        pageSize: undefined,
        pageIdx: undefined,
      });
      assert.strictEqual(result.items.length, 50);
      assert.strictEqual(result.totalPages, 1);
    });
  });

  describe('with pageSize', () => {
    it('should paginate with default page size of 20', () => {
      const result = paginate(items, {pageIdx: 0});
      assert.strictEqual(result.items.length, 20);
      assert.strictEqual(result.currentPage, 0);
      assert.strictEqual(result.totalPages, 3);
      assert.strictEqual(result.hasNextPage, true);
      assert.strictEqual(result.hasPreviousPage, false);
      assert.strictEqual(result.startIndex, 0);
      assert.strictEqual(result.endIndex, 20);
    });

    it('should paginate with custom page size', () => {
      const result = paginate(items, {pageSize: 10, pageIdx: 0});
      assert.strictEqual(result.items.length, 10);
      assert.strictEqual(result.totalPages, 5);
      assert.strictEqual(result.hasNextPage, true);
    });

    it('should return correct items for middle page', () => {
      const result = paginate(items, {pageSize: 10, pageIdx: 2});
      assert.strictEqual(result.items.length, 10);
      assert.strictEqual(result.currentPage, 2);
      assert.strictEqual(result.hasNextPage, true);
      assert.strictEqual(result.hasPreviousPage, true);
      assert.strictEqual(result.startIndex, 20);
      assert.strictEqual(result.endIndex, 30);
      assert.strictEqual(result.items[0], 'item-20');
    });

    it('should return correct items for last page', () => {
      const result = paginate(items, {pageSize: 10, pageIdx: 4});
      assert.strictEqual(result.items.length, 10);
      assert.strictEqual(result.currentPage, 4);
      assert.strictEqual(result.hasNextPage, false);
      assert.strictEqual(result.hasPreviousPage, true);
      assert.strictEqual(result.startIndex, 40);
      assert.strictEqual(result.endIndex, 50);
    });

    it('should handle partial last page', () => {
      const shortItems = Array.from({length: 25}, (_, i) => `item-${i}`);
      const result = paginate(shortItems, {pageSize: 10, pageIdx: 2});
      assert.strictEqual(result.items.length, 5);
      assert.strictEqual(result.totalPages, 3);
      assert.strictEqual(result.hasNextPage, false);
      assert.strictEqual(result.endIndex, 25);
    });
  });

  describe('invalid page index', () => {
    it('should mark invalid and reset to page 0 for negative index', () => {
      const result = paginate(items, {pageSize: 10, pageIdx: -1});
      assert.strictEqual(result.currentPage, 0);
      assert.strictEqual(result.invalidPage, true);
    });

    it('should mark invalid and reset to page 0 for out-of-range index', () => {
      const result = paginate(items, {pageSize: 10, pageIdx: 100});
      assert.strictEqual(result.currentPage, 0);
      assert.strictEqual(result.invalidPage, true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const result = paginate([], {pageSize: 10, pageIdx: 0});
      assert.strictEqual(result.items.length, 0);
      assert.strictEqual(result.totalPages, 1);
      assert.strictEqual(result.hasNextPage, false);
      assert.strictEqual(result.hasPreviousPage, false);
    });

    it('should handle single item', () => {
      const result = paginate(['only'], {pageSize: 10, pageIdx: 0});
      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.totalPages, 1);
      assert.strictEqual(result.hasNextPage, false);
    });

    it('should handle pageSize larger than items', () => {
      const result = paginate(items, {pageSize: 100, pageIdx: 0});
      assert.strictEqual(result.items.length, 50);
      assert.strictEqual(result.totalPages, 1);
      assert.strictEqual(result.hasNextPage, false);
    });

    it('should default to page 0 when only pageSize is provided', () => {
      const result = paginate(items, {pageSize: 10});
      assert.strictEqual(result.currentPage, 0);
      assert.strictEqual(result.invalidPage, false);
      assert.strictEqual(result.items.length, 10);
    });
  });
});
