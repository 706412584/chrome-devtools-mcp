/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import {describe, it} from 'node:test';

import {Mutex} from '../src/Mutex.js';

describe('Mutex', () => {
  it('should acquire and release the lock', async () => {
    const mutex = new Mutex();
    const guard = await mutex.acquire();
    guard.dispose();
  });

  it('should enforce mutual exclusion', async () => {
    const mutex = new Mutex();
    const order: number[] = [];

    const guard1 = await mutex.acquire();

    const p2 = mutex.acquire().then(guard => {
      order.push(2);
      guard.dispose();
    });

    const p3 = mutex.acquire().then(guard => {
      order.push(3);
      guard.dispose();
    });

    // Give time for p2 and p3 to queue
    await new Promise(resolve => setTimeout(resolve, 10));

    order.push(1);
    guard1.dispose();

    await Promise.all([p2, p3]);

    assert.deepStrictEqual(order, [1, 2, 3]);
  });

  it('should be FIFO', async () => {
    const mutex = new Mutex();
    const order: string[] = [];

    const guard = await mutex.acquire();

    const promises: Array<Promise<void>> = [];
    for (const label of ['a', 'b', 'c', 'd']) {
      promises.push(
        mutex.acquire().then(g => {
          order.push(label);
          g.dispose();
        }),
      );
    }

    guard.dispose();
    await Promise.all(promises);

    assert.deepStrictEqual(order, ['a', 'b', 'c', 'd']);
  });

  it('should allow re-acquisition after release', async () => {
    const mutex = new Mutex();

    const guard1 = await mutex.acquire();
    guard1.dispose();

    const guard2 = await mutex.acquire();
    guard2.dispose();
  });

  it('should handle concurrent acquire calls correctly', async () => {
    const mutex = new Mutex();
    let counter = 0;

    const increment = async () => {
      const guard = await mutex.acquire();
      const current = counter;
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 5));
      counter = current + 1;
      guard.dispose();
    };

    await Promise.all([
      increment(),
      increment(),
      increment(),
      increment(),
      increment(),
    ]);

    assert.strictEqual(counter, 5);
  });
});
