import type { MaterialName } from '../types/optics';

import { MATERIAL_CODES } from './shareUrl';

/**
 * 書き出す PNG のファイル名を状態から作る（TASKS 6-6 段階5, PNG-1）。
 *
 * キャプチャ本体は WebGL の描画バッファを読むので Vitest では触れないが、
 * **名前作りだけは状態 → 文字列の純粋関数**なので切り出してテストできる。
 *
 * 時刻を混ぜないので、同じ状態からは常に同じ名前が出る。連番はブラウザが
 * `(1)` を付けて解決する。**再現性のある名前**の方が、あとから並べたときに
 * どれがどの状態かを読めるので、一意性より優先する。
 *
 * 名前が持つのは材質と入射角だけで、誇張倍率も姿勢も入れない。
 * 状態の忠実な記録は共有 URL の役目であり（6-6 段階1〜4）、
 * ファイル名は**見分けが付けば足りる**。
 */

/** ファイル名の頭。 */
const PREFIX = 'prism';

/** 角度の小数桁。49.323347736250 のような着地をそのまま名前にしない。 */
const ANGLE_DECIMALS = 1;

/**
 * 角度をファイル名の断片にする。
 *
 * 負号に `-` を使うと `prism-bk7--12.5deg.png` と区切りのハイフンが連なって読めない。
 * `m`（minus）を前置する。`-0` は `m0` にせず `0` と書く。
 *
 * @param angleDeg 入射角 [deg]
 * @returns 例 `70`、`49.3`、`m12.5`。非有限なら null
 */
function formatAngle(angleDeg: number): string | null {
  if (!Number.isFinite(angleDeg)) {
    return null;
  }

  const factor = 10 ** ANGLE_DECIMALS;
  // `+ 0` を挟んで -0 を 0 にする。Math.round(-0.01 * 10) / 10 は -0 になる
  const rounded = Math.round(angleDeg * factor) / factor + 0;

  return rounded < 0 ? 'm' + String(-rounded) : String(rounded);
}

/**
 * 書き出しに使う状態。**キャプチャの実装と結び付けない**ため、
 * `AppState` ではなく必要な 2 項目だけを受ける。
 */
export interface CaptureNameSource {
  /** 材質名 */
  readonly material: MaterialName;
  /** 入射角 [deg] */
  readonly sourceAngleDeg: number;
}

/**
 * 状態から PNG のファイル名を作る。
 *
 * 材質名は `MATERIAL_CODES`（共有 URL と同じ表）で英字コードへ写す。日本語のまま
 * 名前に出すと、OS とブラウザをまたいだときに文字化けや percent-encoding で読めなくなる。
 * 材質を足したときに登録漏れが起きないのは、この表が `Record<MaterialName, string>` で
 * 型付いているためである。
 *
 * @param source 材質と入射角
 * @returns 例 `prism-sf10-70deg.png`。角度が非有限なら角度部分を省いた `prism-sf10.png`
 */
export function captureFileName(source: CaptureNameSource): string {
  const angle = formatAngle(source.sourceAngleDeg);
  const parts = [PREFIX, MATERIAL_CODES[source.material]];

  // 非有限は store の clampState を通れば来ないが、ここで投げると
  // 「保存」という無関係な操作が名前作りの巻き添えで死ぬ。角度を落として続ける
  if (angle !== null) {
    parts.push(angle + 'deg');
  }

  return parts.join('-') + '.png';
}
