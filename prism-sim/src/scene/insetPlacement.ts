/**
 * 断面図インセットを書き出し画像のどこへ重ねるかを決める（PNG-2）。
 *
 * DOM にも Three にも触らない純粋関数。PNG-2 では **2 つの座標系が出会う**——
 * 3D の書き出しはバッキング画素（`canvas.width` × `canvas.height`）で、
 * インセットの位置は DOM を測った CSS 画素である。両者の橋渡しはここ 1 か所に閉じる。
 */

/** CSS 画素の矩形（DOM を測った値）。戻り値ではバッキング画素の矩形を表す。 */
export interface CssRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 書き出し先のバッキングストアの大きさ [px]。 */
export interface BackingSizePx {
  readonly width: number;
  readonly height: number;
}

/**
 * CSS 画素の矩形をバッキング画素の配置へ写す。
 *
 * **端数を丸めない。** `drawImage` は小数の矩形をそのまま受け取って補間するので、
 * ここで整数へ寄せると DPR が 1.5 のような環境で半画素ぶんずれる。丸めるかどうかは
 * 描画側の都合であって、写像の責務ではない。
 *
 * はみ出しは `RangeError` で止める。`drawImage` は枠外へ描いても黙って切り捨てるため、
 * 位置を取り違えると「絵が一部だけ欠ける」という気付きにくい壊れ方をする。
 *
 * @param cssRect インセットの位置と大きさ [CSS px]。原点は書き出す canvas の左上
 * @param devicePixelRatio CSS 画素あたりのバッキング画素数（実際の比 = `canvas.width / clientWidth`）
 * @param backing 書き出し先の大きさ [バッキング px]
 * @returns 重ねる位置と大きさ [バッキング px]
 * @throws {RangeError} 配置がバッキングの矩形からはみ出すとき
 */
export function computeInsetPlacement(
  cssRect: CssRect,
  devicePixelRatio: number,
  backing: BackingSizePx
): CssRect {
  const placement: CssRect = {
    x: cssRect.x * devicePixelRatio,
    y: cssRect.y * devicePixelRatio,
    width: cssRect.width * devicePixelRatio,
    height: cssRect.height * devicePixelRatio,
  };

  if (
    placement.x < 0 ||
    placement.y < 0 ||
    placement.x + placement.width > backing.width ||
    placement.y + placement.height > backing.height
  ) {
    throw new RangeError(
      `インセットの配置がバッキングをはみ出します: ` +
        `(${String(placement.x)}, ${String(placement.y)}, ` +
        `${String(placement.width)}, ${String(placement.height)}) / ` +
        `${String(backing.width)}x${String(backing.height)}`
    );
  }

  return placement;
}
