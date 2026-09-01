/**
 * 角度のアニメーション遷移を「経過時間の純粋関数」として表す（TASKS 6-2 段階4）。
 *
 * requestAnimationFrame にも DOM にも Three にも触れない。時刻を引数で受け取り、
 * その時刻での値を返すだけなので、Vitest でそのまま検証できる。
 * RAF ラッパは「経過時間を測ってこれを呼び、結果を store へ流す」以上のことをしない。
 *
 * **アニメーションは化粧である。** 6-2 段階3 が実測で確かめた「着地する値」を
 * 1 ビットも変えてはならない。そのため終端では補間を経由せず `to` をそのまま返す
 * （`from + 1 * (to - from)` は丸めで `to` と一致しない場合がある）。
 */

/** 1 サンプルぶんの結果。 */
export interface AngleAnimationSample {
  /** その時刻での角度 [deg]。 */
  readonly value: number;
  /** 遷移が終わっているなら true。 */
  readonly done: boolean;
}

/**
 * 遷移の途中経過を求める。
 *
 * 補間は easeInOutCubic（p < 0.5 で 4p³、それ以降は 1 − (2 − 2p)³/2）。
 * 出だしと終わりが緩やかで、中点 p = 0.5 でちょうど半分に来る対称な曲線である。
 *
 * 経過時間は両端でクランプする。`nowMs <= 0` なら `from`、`nowMs >= durationMs` なら
 * `to` を**厳密に**返す。したがって返り値は常に `from` と `to` が張る閉区間に収まり、
 * 行き過ぎ（オーバーシュート）は起こらない。
 *
 * @param from 開始角 [deg]。有限数
 * @param to 終了角 [deg]。有限数
 * @param durationMs 遷移にかける時間 [ms]。正の有限数
 * @param nowMs 遷移開始からの経過時間 [ms]。有限数（負なら開始前として扱う）
 * @returns その時刻の角度と、遷移が終わったかどうか
 * @throws {RangeError} from / to / nowMs が有限数でない、または durationMs が正の有限数でない場合
 */
export function animateAngle(
  from: number,
  to: number,
  durationMs: number,
  nowMs: number
): AngleAnimationSample {
  assertFinite(from, 'from');
  assertFinite(to, 'to');
  assertFinite(nowMs, 'nowMs');

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError(
      `遷移時間は正の有限数である必要があります（受け取った値: ${durationMs}）`
    );
  }

  // 両端はクランプし、**補間を経由せずに引数をそのまま返す**。
  // from + 1 * (to - from) は丸めで to と一致しないことがあり、それでは
  // 6-2 段階3 が確かめた着地の値が変わってしまう
  if (nowMs <= 0) {
    return { value: from, done: false };
  }

  if (nowMs >= durationMs) {
    return { value: to, done: true };
  }

  const progress = nowMs / durationMs;

  return { value: from + easeInOutCubic(progress) * (to - from), done: false };
}

/**
 * 値が有限数であることを検証する。
 *
 * @param value 検証する値
 * @param label エラーメッセージ用の引数名
 * @throws {RangeError} 有限数でない場合
 */
function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} は有限数である必要があります（受け取った値: ${value}）`);
  }
}

/**
 * easeInOutCubic。前半は 4p³、後半は 1 − (2 − 2p)³/2。
 *
 * p = 0.5 でどちらの式も 0.5 を返すので、中点で滑らかに繋がる対称な曲線になる。
 * 単調増加なので、これを掛けた補間値も進行方向へ単調になる。
 *
 * @param progress 進捗 p。0 < p < 1
 * @returns 緩急を付けた進捗。0 < 返り値 < 1
 */
function easeInOutCubic(progress: number): number {
  if (progress < 0.5) {
    return 4 * progress * progress * progress;
  }

  const remaining = 2 - 2 * progress;

  return 1 - (remaining * remaining * remaining) / 2;
}
