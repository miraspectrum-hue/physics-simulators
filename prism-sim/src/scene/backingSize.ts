/**
 * レイアウト箱 → canvas のバッキングストア寸法（アスペクト是正）。
 *
 * Three.js にも DOM にも触らない純粋関数だけを置く。
 *
 * **なぜ切り出すか。** Phase 2 以来、バッキング寸法とカメラのアスペクトは
 * `SceneManager` の構築時に一度だけ測った箱から作られていた。その時点では
 * 操作パネル（320px）がまだ DOM に入っておらず、バッキング 1522 に対して
 * 表示は 1202 という不整合が固定され、絵が横に 79% 潰れて出ていた。
 *
 * 原因は計算式ではなく**測る瞬間**にあった。瞬間の問題は `ResizeObserver` が
 * 消す（観測された箱からしか寸法を作らない）。ここが引き受けるのは残りの半分、
 * 「**箱を渡されたら、そこから一意に寸法とアスペクトが決まる**」という写像である。
 * アスペクトを丸めた後の `canvas.width / canvas.height` から作ると、DPR が
 * 小数のときに表示の箱と食い違う余地が残る。箱から作れば構成上その余地が消える。
 */

/**
 * デバイスピクセル比の上限。高 DPI 環境での過剰な描画負荷を抑える。
 */
export const MAX_PIXEL_RATIO = 2;

/** 箱が壊れているときに返す寸法。0 幅のバッキングは WebGL が受け付けない。 */
const DEGENERATE: BackingSize = { width: 1, height: 1, aspect: 1 };

/** バッキングストアの寸法と、カメラへ渡すアスペクト。 */
export interface BackingSize {
  /** canvas.width [px] */
  readonly width: number;
  /** canvas.height [px] */
  readonly height: number;
  /**
   * カメラのアスペクト（無次元）。
   *
   * **真実は箱の比であって、丸めた `width / height` ではない。** 画面に見えているのは
   * 箱の側なので、投影の縦横比は箱に合わせなければ絵が歪む。
   *
   * したがって耐荷重の関係は `camera.aspect === 箱の比` の一本だけである。
   * `camera.aspect === canvas.width / canvas.height` は DPR=1 でたまたま成り立つ
   * 情報にすぎず、DPR が小数のときは floor のぶんだけ食い違う（それで正しい）。
   */
  readonly aspect: number;
}

/**
 * レイアウト箱から canvas のバッキング寸法を導く。
 *
 * 丸めは three の `WebGLRenderer.setSize`（`Math.floor(size * pixelRatio)`）に
 * 合わせる。ここだけ別の丸めを使うと、`canvas.width` の実測とずれる。
 *
 * @param boxWidth 箱の幅 [CSS px]
 * @param boxHeight 箱の高さ [CSS px]
 * @param devicePixelRatio デバイスピクセル比。0 以下・非有限なら 1 として扱う
 * @returns バッキング寸法 [px] とアスペクト。箱が正の有限値でなければ 1x1・アスペクト 1
 */
export function computeBackingSize(
  boxWidth: number,
  boxHeight: number,
  devicePixelRatio: number
): BackingSize {
  if (
    !Number.isFinite(boxWidth) ||
    !Number.isFinite(boxHeight) ||
    boxWidth <= 0 ||
    boxHeight <= 0
  ) {
    return DEGENERATE;
  }

  // 箱が正しいのに DPR だけが壊れている場合、絵を捨てる理由は無い
  const ratio =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? Math.min(devicePixelRatio, MAX_PIXEL_RATIO)
      : 1;

  return {
    width: Math.max(1, Math.floor(boxWidth * ratio)),
    height: Math.max(1, Math.floor(boxHeight * ratio)),
    aspect: boxWidth / boxHeight,
  };
}
