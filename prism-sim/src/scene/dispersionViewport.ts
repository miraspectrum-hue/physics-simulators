/**
 * 分散平面の uv を SVG のピクセル枠へ収めるビューポート変換（TASKS 6-1 段階3a）。
 *
 * DOM にも Three にも触れない純粋関数だけを置く（`beamPacker.ts` / `screenProjection.ts` と
 * 同じ立場で、scene 層に属しながら Vitest の対象になる）。SVG 要素の生成は段階3b の責務。
 *
 * **ここが持つのは「どこへ描くか」だけで、「何を描くか」は持たない。** uv は
 * `dispersionPlane.worldToDispersionUV()` が返す断面座標であり、物理はそこでも
 * ここでも再計算しない。
 *
 * 座標系の違いに注意すること。uv は **v が上向き**（数学の慣習）だが、SVG は
 * **y が下向き**である。この反転を `uvToSvg()` が引き受ける。
 */

import type { PlaneUV } from '../types/optics';

/**
 * 値がすべて有限数であることを検証する。
 *
 * **大小比較では代用できない。** `maxU <= minU` のような順序の検査は NaN では常に
 * false になるので、NaN は退化の検査を**素通りする**。`UvBounds` / `PixelSize` は素の
 * オブジェクトで、`vec3()` のような発生源のガードを持たないため、ここで見る必要がある。
 *
 * @param values 検証する値
 * @param label エラーメッセージ用の説明
 * @throws {RangeError} いずれかが有限数でない場合
 */
function assertAllFinite(values: readonly number[], label: string): void {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError(`${label}は有限数である必要があります（受け取った値: ${values.join(', ')}）`);
  }
}

/**
 * 余白を差し引いて実際に描ける領域を求める。
 *
 * **ガードが符号化するのは数学的前提だけである。** 必要なのは
 * 「usable = pixelSize − 2·margin が両軸で正」という一点で、これは
 * `pixelSize > 0`（margin >= 0 のとき含意される）も、余白が枠を食い潰す場合も、
 * まとめて 1 つの条件で弾く。
 *
 * **`margin = 0` は弾かない。** 余白 0 は枠ピッタリに収める正当な変換であり、
 * 「余白が欲しい」は呼び出し側の様式であってドメインの制約ではない。
 * 様式の願望をガードに混ぜると、幾何的に正しい入力まで使えなくなる。
 *
 * @param pixelSize 描画先のピクセル枠
 * @param marginPx 枠の内側に残す余白 [px]。0 以上
 * @returns 描ける領域の幅と高さ [px]
 * @throws {RangeError} 非有限、marginPx が負、または使える領域が残らない場合
 */
function usableArea(pixelSize: PixelSize, marginPx: number): { width: number; height: number } {
  assertAllFinite([pixelSize.width, pixelSize.height, marginPx], '枠の寸法と余白');

  if (marginPx < 0) {
    throw new RangeError(`余白は 0 以上である必要があります（受け取った値: ${marginPx}）`);
  }

  const width = pixelSize.width - 2 * marginPx;
  const height = pixelSize.height - 2 * marginPx;

  if (width <= 0 || height <= 0) {
    throw new RangeError(
      `枠 ${pixelSize.width}x${pixelSize.height} に余白 ${marginPx} を取ると描ける領域が` +
        `残りません（${width} x ${height}）`
    );
  }

  return { width, height };
}

/**
 * 収めたい uv の範囲（軸並行の矩形）。
 *
 * 幅・高さのいずれかが 0 の退化した範囲は、等方スケールが定まらないため受け付けない。
 */
export interface UvBounds {
  /** u の下限 */
  readonly minU: number;
  /** u の上限 */
  readonly maxU: number;
  /** v の下限 */
  readonly minV: number;
  /** v の上限 */
  readonly maxV: number;
}

/** 描画先のピクセル枠。 */
export interface PixelSize {
  /** 横幅 [px] */
  readonly width: number;
  /** 高さ [px] */
  readonly height: number;
}

/**
 * uv → SVG ピクセルのアフィン変換。
 *
 * x = offsetX + scale·u、y = offsetY − scale·v。**両軸で同じ `scale`** を使うので
 * 図が歪まない（プリズムの正三角形が正三角形のまま写る）。v の符号が負なのは
 * SVG の y が下向きだからである。
 */
export interface ViewportTransform {
  /** uv の 1 単位あたりのピクセル数。両軸に共通（等方） */
  readonly scale: number;
  /** u = 0 が写る x 座標 [px] */
  readonly offsetX: number;
  /** v = 0 が写る y 座標 [px] */
  readonly offsetY: number;
}

/** SVG の座標 [px]。 */
export interface SvgPoint {
  /** 右向きが正 */
  readonly x: number;
  /** **下向きが正**（uv の v とは逆） */
  readonly y: number;
}

/**
 * uv の範囲を、余白を残してピクセル枠へ中央寄せで収める変換を求める。
 *
 * **アスペクト比を保つ（等方スケール）。** 軸ごとに別々の倍率を掛ければ枠を隙間なく
 * 埋められるが、プリズムの正三角形が潰れて頂角 60° が読めなくなる。図として意味を
 * 持たせるには、余る方向に隙間ができても等方でなければならない。
 * そのため倍率は「両軸に必要な倍率のうち小さい方」になり、**制約された軸だけが
 * 余白ちょうどで枠に接し、もう一方の軸は枠の内側に余って収まる**。
 *
 * @param uvBounds 収めたい uv の範囲。幅・高さとも正であること
 * @param pixelSize 描画先のピクセル枠。幅・高さとも正の有限数であること
 * @param marginPx 枠の内側に残す余白 [px]。0 以上の有限数で、両側の合計が枠に収まること
 *                 （0 は枠ピッタリの exact fit として正当）
 * @returns uv → SVG の変換
 * @throws {RangeError} 非有限な成分がある、uvBounds が退化している、marginPx が負、
 *                      または使える領域 `pixelSize − 2·margin` が残らない場合
 */
export function fitViewport(
  uvBounds: UvBounds,
  pixelSize: PixelSize,
  marginPx: number
): ViewportTransform {
  assertAllFinite(
    [uvBounds.minU, uvBounds.maxU, uvBounds.minV, uvBounds.maxV],
    'uv の範囲'
  );

  const available = usableArea(pixelSize, marginPx);

  const spanU = uvBounds.maxU - uvBounds.minU;
  const spanV = uvBounds.maxV - uvBounds.minV;

  if (spanU <= 0 || spanV <= 0) {
    throw new RangeError(
      `uv の範囲は幅・高さとも正である必要があります（${spanU} x ${spanV}）`
    );
  }

  // 両軸に必要な倍率のうち**小さい方**を採る。これが「歪ませずに収める」ということで、
  // 大きい方を採ると（枠を埋める代わりに）はみ出す
  const scale = Math.min(available.width / spanU, available.height / spanV);
  const centerU = (uvBounds.minU + uvBounds.maxU) / 2;
  const centerV = (uvBounds.minV + uvBounds.maxV) / 2;

  // 中心を枠の中心へ持っていく。y は uvToSvg で反転するので、ここでの符号も逆になる
  return {
    scale,
    offsetX: pixelSize.width / 2 - scale * centerU,
    offsetY: pixelSize.height / 2 + scale * centerV,
  };
}

/**
 * 断面座標 uv を SVG の座標へ写す。
 *
 * x = offsetX + scale·u、y = offsetY − scale·v。
 *
 * **v の符号を反転する。** uv は分散平面の面内座標で v が上向き（`axisV` の向き）だが、
 * SVG の y は下向きである。反転を忘れると図が上下逆さまに描かれ、しかも
 * 「正三角形が正三角形のまま」なので一見すると気づけない。
 *
 * u は反転しない。左右まで入れ替えると鏡像になり、光が右へ抜ける絵が左へ抜ける絵になる。
 *
 * @param uv 断面座標
 * @param transform `fitViewport()` が返した変換
 * @returns SVG の座標 [px]
 */
export function uvToSvg(uv: PlaneUV, transform: ViewportTransform): SvgPoint {
  return {
    x: transform.offsetX + transform.scale * uv.u,
    y: transform.offsetY - transform.scale * uv.v,
  };
}
