/**
 * 計算済みスタイルの色文字列を、色と不透明度に割る（PNG-2）。
 * DOM にも Three にも触らない純粋関数。
 *
 * SVG の `fill` は `rgba(...)` も解釈できるが、`fill` + `fill-opacity` に割っておく方が
 * 直列化した文書をどの実装に読ませても同じに出る。割る対象は
 * `getComputedStyle().backgroundColor` の文字列で、その形は**ブラウザの
 * シリアライズ規則に握られている**ため、旧来の `rgba(r, g, b, a)` と
 * CSS Color 4 の `rgb(r g b / a)` の両方を受ける。
 */

/**
 * `rgb()` / `rgba()` の 3 成分と、あれば不透明度を拾う。
 *
 * 区切りはカンマでもスペースでもよく、不透明度の前にはスラッシュが入りうる。
 */
const RGB_PATTERN =
  /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/;

/** 割った結果。 */
export interface CssColorAlpha {
  /** 不透明な色。`rgb(r, g, b)` 形式（解釈できなければ入力のまま） */
  readonly color: string;
  /** 不透明度（0〜1） */
  readonly alpha: number;
}

/**
 * 色文字列を色と不透明度に割る。
 *
 * @param css `rgb(...)` / `rgba(...)`、またはそれ以外の任意の色表記
 * @returns 不透明な色と不透明度。解釈できない表記は入力をそのまま返し、不透明度 1 とする
 */
export function splitCssColorAlpha(css: string): CssColorAlpha {
  const matched = RGB_PATTERN.exec(css.trim());

  if (matched === null) {
    return { color: css, alpha: 1 };
  }

  const [red, green, blue] = matched.slice(1, 4) as [string, string, string];
  const alpha = matched[4];

  return {
    color: `rgb(${red}, ${green}, ${blue})`,
    alpha: alpha === undefined ? 1 : Number(alpha),
  };
}
