import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_EXAGGERATION,
  DEFAULT_MATERIAL,
  DEFAULT_SCREEN_DISTANCE,
  DEFAULT_SOURCE_ANGLE_DEG,
  SCREEN_DISTANCE_MAX,
  SCREEN_DISTANCE_MIN,
  EXAGGERATION_MAX,
  EXAGGERATION_MIN,
  SOURCE_ANGLE_MAX_DEG,
  SOURCE_ANGLE_MIN_DEG,
  createStore,
} from '../../src/ui/store';

/**
 * src/ui/store.ts の受け入れ条件。
 *
 * 対象:
 *   createStore() — アプリ状態の保持と変更通知
 *
 * 設計判断:
 *   - **プリズムの姿勢は保持しない**。姿勢の単一の真実は matrixWorld であり、
 *     ここに持つと二重保持になる（CLAUDE.md「やってはいけないこと」）。
 *   - 値域はストアが責任を持ってクランプする。UI 側の min/max 属性だけに頼ると、
 *     キーボード入力や将来の URL 復元（F-30）で範囲外が入りうるため。
 *   - 値が変わらない更新では通知しない。通知のたびに 48 波長の再追跡が走るので、
 *     無駄な dirty を立てないことがそのまま描画コストに効く。
 *
 * DOM にも Three にも触れないため Vitest の対象（CLAUDE.md「使用言語・フレームワーク」）。
 */

// ---------------------------------------------------------------------------
// U-1. 初期値
// ---------------------------------------------------------------------------

describe('U-1. createStore: 初期状態', () => {
  it('入射角と誇張倍率が既定値で始まる', () => {
    // Arrange & Act
    const store = createStore();

    // Assert
    expect(store.getState()).toEqual({
      sourceAngleDeg: DEFAULT_SOURCE_ANGLE_DEG,
      exaggeration: DEFAULT_EXAGGERATION,
      material: DEFAULT_MATERIAL,
      screenDistance: DEFAULT_SCREEN_DISTANCE,
    });
  });

  it('既定値が値域の内側にある', () => {
    // Arrange & Act & Assert: 既定値そのものがクランプされてしまう事故を防ぐ
    expect(DEFAULT_SOURCE_ANGLE_DEG).toBeGreaterThanOrEqual(SOURCE_ANGLE_MIN_DEG);
    expect(DEFAULT_SOURCE_ANGLE_DEG).toBeLessThanOrEqual(SOURCE_ANGLE_MAX_DEG);
    expect(DEFAULT_EXAGGERATION).toBeGreaterThanOrEqual(EXAGGERATION_MIN);
    expect(DEFAULT_EXAGGERATION).toBeLessThanOrEqual(EXAGGERATION_MAX);
  });
});

// ---------------------------------------------------------------------------
// U-2. 更新と通知
// ---------------------------------------------------------------------------

describe('U-2. createStore: 更新すると購読者が呼ばれる', () => {
  it('更新した値が読み出せる', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ sourceAngleDeg: 30 });

    // Assert
    expect(store.getState().sourceAngleDeg).toBe(30);
  });

  it('購読者が新しい状態を受け取る', () => {
    // Arrange
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.update({ exaggeration: 4 });

    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      sourceAngleDeg: DEFAULT_SOURCE_ANGLE_DEG,
      exaggeration: 4,
      material: DEFAULT_MATERIAL,
      screenDistance: DEFAULT_SCREEN_DISTANCE,
    });
  });

  it('指定しなかったフィールドは保たれる', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ sourceAngleDeg: -10 });

    // Assert
    expect(store.getState().exaggeration).toBe(DEFAULT_EXAGGERATION);
  });

  it('購読者が複数いればすべて呼ばれる', () => {
    // Arrange
    const store = createStore();
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(first);
    store.subscribe(second);

    // Act
    store.update({ sourceAngleDeg: 12 });

    // Assert
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// U-3. 値域のクランプ
// ---------------------------------------------------------------------------

describe('U-3. createStore: 値域外はクランプする', () => {
  it('入射角の上限を超えると 89 度に丸まる', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ sourceAngleDeg: 120 });

    // Assert
    expect(store.getState().sourceAngleDeg).toBe(SOURCE_ANGLE_MAX_DEG);
  });

  it('入射角の下限を下回ると -89 度に丸まる', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ sourceAngleDeg: -120 });

    // Assert
    expect(store.getState().sourceAngleDeg).toBe(SOURCE_ANGLE_MIN_DEG);
  });

  it('誇張倍率の下限を下回ると 1 に丸まる', () => {
    // Arrange: 誇張は「広げる」意味しか持たないので 1 未満にはしない
    const store = createStore();

    // Act
    store.update({ exaggeration: 0.2 });

    // Assert
    expect(store.getState().exaggeration).toBe(EXAGGERATION_MIN);
  });

  it('誇張倍率の上限を超えると 10 に丸まる', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ exaggeration: 50 });

    // Assert
    expect(store.getState().exaggeration).toBe(EXAGGERATION_MAX);
  });

  it('境界値そのものは丸められない', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ sourceAngleDeg: SOURCE_ANGLE_MAX_DEG, exaggeration: EXAGGERATION_MAX });

    // Assert
    expect(store.getState()).toEqual({
      sourceAngleDeg: SOURCE_ANGLE_MAX_DEG,
      exaggeration: EXAGGERATION_MAX,
      material: DEFAULT_MATERIAL,
      screenDistance: DEFAULT_SCREEN_DISTANCE,
    });
  });
});

// ---------------------------------------------------------------------------
// U-4. リセット
// ---------------------------------------------------------------------------

describe('U-4. createStore: reset で初期状態へ戻る', () => {
  it('変更したすべての値が既定へ復帰する', () => {
    // Arrange
    const store = createStore();
    store.update({ sourceAngleDeg: -60, exaggeration: 9 });

    // Act
    store.reset();

    // Assert
    expect(store.getState()).toEqual({
      sourceAngleDeg: DEFAULT_SOURCE_ANGLE_DEG,
      exaggeration: DEFAULT_EXAGGERATION,
      material: DEFAULT_MATERIAL,
      screenDistance: DEFAULT_SCREEN_DISTANCE,
    });
  });

  it('リセットでも購読者に通知される', () => {
    // Arrange
    const store = createStore();
    store.update({ sourceAngleDeg: -60 });
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.reset();

    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('既に初期状態なら reset では通知しない', () => {
    // Arrange
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.reset();

    // Assert
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// U-5. 変化がなければ通知しない
// ---------------------------------------------------------------------------

describe('U-5. createStore: 値が変わらなければ通知しない', () => {
  it('同じ値で更新しても購読者は呼ばれない', () => {
    // Arrange: 通知 1 回につき 48 波長の再追跡が走るため、無駄な dirty を立てない
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.update({ sourceAngleDeg: DEFAULT_SOURCE_ANGLE_DEG });

    // Assert
    expect(listener).not.toHaveBeenCalled();
  });

  it('空の更新では購読者は呼ばれない', () => {
    // Arrange
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.update({});

    // Assert
    expect(listener).not.toHaveBeenCalled();
  });

  it('クランプの結果が現在値と同じなら通知しない', () => {
    // Arrange: 上限に張り付いた状態で更に大きい値を入れても状態は変わらない
    const store = createStore();
    store.update({ exaggeration: EXAGGERATION_MAX });
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.update({ exaggeration: 99 });

    // Assert
    expect(listener).not.toHaveBeenCalled();
  });

  it('片方だけ変われば 1 回だけ通知する', () => {
    // Arrange
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.update({ sourceAngleDeg: 5, exaggeration: DEFAULT_EXAGGERATION });


    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// U-6. 材質（TASKS 4-2 / 2-8）
// ---------------------------------------------------------------------------

describe('U-6. createStore: 材質を保持する', () => {
  it('既定の材質は BK7 である', () => {
    // Arrange & Act
    const store = createStore();

    // Assert
    expect(store.getState().material).toBe('BK7');
    expect(DEFAULT_MATERIAL).toBe('BK7');
  });

  it('材質を更新すると読み出せる', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ material: 'SF10' });

    // Assert
    expect(store.getState().material).toBe('SF10');
  });

  it('材質の更新で購読者が呼ばれる', () => {
    // Arrange: 材質が変われば n(λ) が変わるので、光路の再計算が要る
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.update({ material: 'ダイヤモンド' });

    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      sourceAngleDeg: DEFAULT_SOURCE_ANGLE_DEG,
      exaggeration: DEFAULT_EXAGGERATION,
      material: 'ダイヤモンド',
      screenDistance: DEFAULT_SCREEN_DISTANCE,
    });
  });

  it('同じ材質で更新しても通知しない', () => {
    // Arrange
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.update({ material: DEFAULT_MATERIAL });

    // Assert
    expect(listener).not.toHaveBeenCalled();
  });

  it('reset で材質が既定へ戻る', () => {
    // Arrange
    const store = createStore();
    store.update({ material: '水' });

    // Act
    store.reset();

    // Assert
    expect(store.getState().material).toBe(DEFAULT_MATERIAL);
  });
});

// ---------------------------------------------------------------------------
// U-7. スクリーン距離（TASKS 6-3 B-2）
// ---------------------------------------------------------------------------
//
// 値域の根拠は実測。BK7・m=6・既定アンカーで最外波長の |u| が半幅 2.5 を超える距離
// （D_overflow）は 16.93 で、`screenProjection.projectPathsToScreen` を実際に呼んで
// 二分法で求めた値である。上限はその 1.3 倍を取り、はみ出しを確実に体験できるようにする。

describe('U-7. createStore: スクリーン距離を保持する', () => {
  it('既定の距離で始まる', () => {
    // Arrange & Act
    const store = createStore();

    // Assert
    expect(store.getState().screenDistance).toBe(DEFAULT_SCREEN_DISTANCE);
  });

  it('値域内の距離を更新すると読み出せる', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ screenDistance: 12 });

    // Assert
    expect(store.getState().screenDistance).toBe(12);
  });

  it('下限より小さい距離は下限へ丸める', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ screenDistance: SCREEN_DISTANCE_MIN - 5 });

    // Assert
    expect(store.getState().screenDistance).toBe(SCREEN_DISTANCE_MIN);
  });

  it('上限より大きい距離は上限へ丸める', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ screenDistance: SCREEN_DISTANCE_MAX + 100 });

    // Assert
    expect(store.getState().screenDistance).toBe(SCREEN_DISTANCE_MAX);
  });

  it('境界値そのものは丸められない', () => {
    // Arrange
    const store = createStore();

    // Act
    store.update({ screenDistance: SCREEN_DISTANCE_MIN });
    const atMin = store.getState().screenDistance;
    store.update({ screenDistance: SCREEN_DISTANCE_MAX });
    const atMax = store.getState().screenDistance;

    // Assert
    expect(atMin).toBe(SCREEN_DISTANCE_MIN);
    expect(atMax).toBe(SCREEN_DISTANCE_MAX);
  });

  it('距離の更新で購読者が呼ばれる', () => {
    // Arrange: 距離が変われば投影先が変わるので、帯の再計算が要る
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.update({ screenDistance: 10 });

    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      sourceAngleDeg: DEFAULT_SOURCE_ANGLE_DEG,
      exaggeration: DEFAULT_EXAGGERATION,
      material: DEFAULT_MATERIAL,
      screenDistance: 10,
    });
  });

  it('同じ距離で更新しても通知しない', () => {
    // Arrange
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // Act
    store.update({ screenDistance: DEFAULT_SCREEN_DISTANCE });

    // Assert
    expect(listener).not.toHaveBeenCalled();
  });

  it('reset で既定の距離へ戻る', () => {
    // Arrange
    const store = createStore();
    store.update({ screenDistance: SCREEN_DISTANCE_MAX });

    // Act
    store.reset();

    // Assert
    expect(store.getState().screenDistance).toBe(DEFAULT_SCREEN_DISTANCE);
  });

  it('上限が実測の D_overflow（16.93）を超えている', () => {
    // Arrange: 上限がここを下回ると、案 Q のはみ出しが一度も体験できなくなる
    const measuredOverflowDistance = 16.9284;

    // Act & Assert
    expect(SCREEN_DISTANCE_MAX).toBeGreaterThan(measuredOverflowDistance);
    expect(SCREEN_DISTANCE_MIN).toBeLessThan(DEFAULT_SCREEN_DISTANCE);
  });
});
