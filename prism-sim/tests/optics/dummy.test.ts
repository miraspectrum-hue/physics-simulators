import { describe, expect, it } from 'vitest';

import { addForToolchainCheck } from '../../src/optics/dummy';

// ツールチェーン疎通確認用。Phase 1 で本物の光学テストに置き換える。
describe('toolchain smoke test', () => {
  it('1 + 1 = 2', () => {
    expect(addForToolchainCheck(1, 1)).toBe(2);
  });
});
