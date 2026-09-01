/**
 * ラベルの縁取り色（可読性パス 段階2）。DOM にも Three にも触らない純粋関数。
 *
 * 段階0 の実測で、断面図の δ ラベルが背後を通る光線に負けていた
 * （δ紫 1.135:1、δ赤 1.357:1。θ₁ は背後が暗いままなので 7.58:1）。
 *
 * ラベルはパラメータで動く光線をいつでも避けられない。だから**再配置ではなく
 * 縁取りで下限を作る**（correct-by-construction）。縁取りが glyph を囲めば、
 * 文字の隣にあるのは常に縁取りの色であり、背景が何であっても比が決まる。
 */

/** 暗い側の縁取り。純黒にするのは下限の証明を最良にするため（下の DARKEST 参照）。 */
const DARK_HALO = '#000000';

/** 明るい側の縁取り。 */
const LIGHT_HALO = '#ffffff';

/** 純黒の相対輝度。 */
const DARK_LUMINANCE = 0;

/** 純白の相対輝度。 */
const LIGHT_LUMINANCE = 1;

/**
 * 文字色の相対輝度を求める（WCAG 2.x）。
 *
 * @param css `rgb(r, g, b)` または `#rrggbb`
 * @returns 相対輝度（0〜1）。解釈できなければ null
 */
function relativeLuminance(css: string): number | null {
  const rgb = /^rgb\((\d+), ?(\d+), ?(\d+)\)$/.exec(css);
  const hex = /^#([0-9a-fA-F]{6})$/.exec(css);

  let channels: number[];

  if (rgb !== null) {
    channels = rgb.slice(1).map(Number);
  } else if (hex !== null) {
    const value = hex[1] as string;
    channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  } else {
    return null;
  }

  if (channels.some((component) => !Number.isFinite(component) || component > 255)) {
    return null;
  }

  const linear = channels.map((component) => {
    const c = component / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return (
    0.2126 * (linear[0] as number) +
    0.7152 * (linear[1] as number) +
    0.0722 * (linear[2] as number)
  );
}

/** WCAG のコントラスト比。 */
function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * 文字色に合う縁取り色を返す。
 *
 * 黒と白のうち**コントラストが高い方**を選ぶ。two 択にしておくと下限が解析的に決まる。
 * 両者が釣り合うのは `(L+0.05)/0.05 = 1.05/(L+0.05)` すなわち L = 0.179129… のときで、
 * そこでの比は 4.583… になる。**どんな文字色でも 4.5:1 を割らない**のはこのためである。
 * 純黒・純白から少しでも内側へ寄せると（例: 背景色 `#05070d` と `#f5f8ff`）
 * この下限が 4.5 を割るので、両端は動かさない。
 *
 * @param fillCss 文字の色。`rgb(r, g, b)` または `#rrggbb`
 * @returns 縁取りの色。解釈できない入力は暗い側（安全側）
 */
export function haloColorFor(fillCss: string): string {
  const fill = relativeLuminance(fillCss);

  if (fill === null) {
    return DARK_HALO;
  }

  return contrastRatio(fill, DARK_LUMINANCE) >= contrastRatio(fill, LIGHT_LUMINANCE)
    ? DARK_HALO
    : LIGHT_HALO;
}
