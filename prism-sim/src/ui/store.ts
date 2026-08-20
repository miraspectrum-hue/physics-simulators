import type { MaterialName } from '../types/optics';

/**
 * アプリ状態の単一の保持と変更通知（簡易 observable）。
 *
 * 保持するのは「操作 UI が決める値」だけである。**プリズムの姿勢は持たない** —
 * 姿勢の単一の真実は `PrismObject.object.matrixWorld` であり、ギズモと姿勢スライダーは
 * どちらもそれを読み書きする 2 つのビューにすぎない（CLAUDE.md「オイラー角で自前に
 * 二重保持することの禁止」）。
 *
 * DOM にも Three にも触れないので Vitest の対象になる（CLAUDE.md「使用言語・フレームワーク」）。
 */

/** 入射角スライダーの下限・上限 [deg]（SPEC.md「F-05」）。 */
export const SOURCE_ANGLE_MIN_DEG = -89;
export const SOURCE_ANGLE_MAX_DEG = 89;

/** 分散誇張倍率の下限・上限（SPEC.md「F-23」）。 */
export const EXAGGERATION_MIN = 1;
export const EXAGGERATION_MAX = 10;

/**
 * 既定の入射角 [deg]。BK7 が対称通過（最小偏角）となる角度。
 *
 * NOTE: 値の出所は main.ts の実績値。段階 2 で main.ts 側の定数をこちらへ寄せる。
 */
export const DEFAULT_SOURCE_ANGLE_DEG = 49.323347736;

/** 既定の分散誇張倍率。実機の絵を見て決めた値（6e67192）。 */
export const DEFAULT_EXAGGERATION = 6;

/**
 * スクリーン距離の下限・上限（TASKS 6-3）。
 *
 * 上限は実測の D_overflow（BK7・m=6・既定アンカーで最外波長が半幅 2.5 を超える距離 = 16.93）
 * の 1.3 倍。はみ出しを確実に体験でき、超えた先で脱落波長が増える様子まで見える。
 * 下限は実測から決めた。凍結アンカーの方向に沿ったプリズム最遠点は 0.7702 なので、
 * ここを超えていれば板の平面はプリズムを切らない。Z 軸回転の全域でも最遠点は 0.785 で、
 * 2.0 なら余裕 1.21 以上が常に残る。
 */
export const SCREEN_DISTANCE_MIN = 2;
export const SCREEN_DISTANCE_MAX = 22;

/** 既定のスクリーン距離。B-1 の固定配置と同じ値。 */
export const DEFAULT_SCREEN_DISTANCE = 4;

/** 既定の材質。SPEC.md の既定材質に合わせる。 */
export const DEFAULT_MATERIAL: MaterialName = 'BK7';

/** アプリ状態。 */
export interface AppState {
  /** 入射角 [deg]。主断面内の 1 自由度 */
  readonly sourceAngleDeg: number;
  /** 分散誇張倍率 m */
  readonly exaggeration: number;
  /** 材質。`MATERIALS` のキー */
  readonly material: MaterialName;
  /** 射出点からスクリーンまでの距離 */
  readonly screenDistance: number;
}

/** 状態の保持と通知。 */
export interface Store {
  /** 現在の状態。 */
  getState(): AppState;
  /** 与えたフィールドだけを更新する。値域は自動でクランプされる。 */
  update(patch: Partial<AppState>): void;
  /** 初期状態へ戻す。 */
  reset(): void;
  /** 状態が変わったときに呼ばれる購読者を登録する。 */
  subscribe(listener: (state: AppState) => void): void;
}

/**
 * ストアを作る。
 *
 * @returns 初期状態を持つストア
 */
export function createStore(): Store {
  let state: AppState = initialState();
  const listeners: Array<(state: AppState) => void> = [];

  /** 状態を差し替える。値が変わらなければ通知しない（無駄な再追跡を避ける）。 */
  const commit = (next: AppState): void => {
    if (
      next.sourceAngleDeg === state.sourceAngleDeg &&
      next.exaggeration === state.exaggeration &&
      next.material === state.material &&
      next.screenDistance === state.screenDistance
    ) {
      return;
    }

    state = next;

    for (const listener of listeners) {
      listener(state);
    }
  };

  return {
    getState: (): AppState => state,

    update: (patch: Partial<AppState>): void => {
      commit(clampState({ ...state, ...patch }));
    },

    reset: (): void => {
      commit(initialState());
    },

    subscribe: (listener: (state: AppState) => void): void => {
      listeners.push(listener);
    },
  };
}

/** 既定の状態。 */
function initialState(): AppState {
  return {
    sourceAngleDeg: DEFAULT_SOURCE_ANGLE_DEG,
    exaggeration: DEFAULT_EXAGGERATION,
    material: DEFAULT_MATERIAL,
    screenDistance: DEFAULT_SCREEN_DISTANCE,
  };
}

/**
 * 状態を値域へ収める。
 *
 * UI の min/max 属性だけに頼らないのは、キーボード入力や将来の URL 復元（F-30）で
 * 範囲外が入りうるためである。
 *
 * @param state 収める前の状態
 * @returns 各フィールドを値域へ丸めた状態
 */
function clampState(state: AppState): AppState {
  return {
    sourceAngleDeg: clamp(state.sourceAngleDeg, SOURCE_ANGLE_MIN_DEG, SOURCE_ANGLE_MAX_DEG),
    exaggeration: clamp(state.exaggeration, EXAGGERATION_MIN, EXAGGERATION_MAX),
    // 材質は連続量ではないので丸めない。型が値域そのものになっている
    material: state.material,
    screenDistance: clamp(state.screenDistance, SCREEN_DISTANCE_MIN, SCREEN_DISTANCE_MAX),
  };
}

/**
 * 値を下限・上限へ収める。
 *
 * @param value 収める値
 * @param min 下限
 * @param max 上限
 * @returns 値域内の値
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
