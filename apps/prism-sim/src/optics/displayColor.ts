import { wavelengthToRgb } from './spectrum';

/**
 * 波長 → 表示色（可読性パス）。**波長から色を決める唯一の入口。**
 *
 * 段階0 の実測で、可視域の端が中央帯に対して極端に暗いことが分かった
 * （基準色の Rec.709 輝度で 380nm = 0.0343、ピーク 576.81nm = 0.9105 の **3.77%**）。
 * 端の光線は出ているのに見えない。これは物理ではなく**モニタ表示都合の
 * 知覚アーティファクト**なので、暗部だけを持ち上げる様式化は正当である。
 *
 * **区間強度（フレネル透過・全反射損失）には触らない。** そちらは物理そのもので、
 * 情報バーが「入射面反射 20.6%」「48 本中 6 本が全反射」と正直に語っている量である。
 * 強度を持ち上げると絵が数値に嘘をつく。線引きはここに引く——
 * **絵は強調（波長 → 色の表示都合）、数値は正直（強度 = 物理）。**
 *
 * ## 20% フロアが到達不能な理由と、採った道
 *
 * 当初の目標は「最暗でも中央帯ピークの 20%」だったが、**色相を厳密に保つ限り
 * 数学的に不能**である。Rec.709 で純青の相対輝度は 0.0722 が絶対の上限で、
 * 435.11nm の基準色 `[34,0,255]` は青成分が既に 1.0 に達しており、
 * 一様倍では 1 ルーメンも上げられない。48 波長すべてが色相を保ったまま
 * 満たせる最大のフロアは **0.075658（ピークの 8.31%）** になる。
 *
 * 白を混ぜれば 20% に届く（最大 11.5% の白混合で足りる）が、それは採らない。
 * 測光量 Y は飽和青の見えを構造的に過小評価する（Helmholtz-Kohlrausch 効果：
 * 等輝度なら彩度が高いほど明るく見える）ため、「青の Y ≥ 20%」は**間違った計器の
 * 読み**である。その読みを満たすために彩度という正しい対象を壊すのは本末転倒で、
 * 七色の純度＝虹そのものの identity を失う。**青は暗いまま純度を保つ。**
 */

/**
 * 持ち上げる前の中央帯ピーク（576.81nm）の相対輝度。
 *
 * `sampleWavelengths(48)` を `wavelengthToRgb` に通し、線形化して Rec.709 加重した
 * 実測値。ガンマの基準点であり、**この値は動かさない**（ピーク不動）。
 */
const PEAK_LUMINANCE = 0.9105065911786071;

/**
 * 暗部を持ち上げる単調ガンマの指数。
 *
 * 正規化輝度に対し `Y' = PEAK·(Y/PEAK)^γ` を掛ける。γ < 1 で暗部だけが持ち上がり、
 * ピーク（Y = PEAK）は指数によらず不動になる。単調なので谷の位置は増えず、
 * 既存の谷も相対的に浅くなる。
 *
 * 最小の 380nm（0.034286）を 20% フロア（0.182101）へ乗せるには
 * γ ≤ 0.4907938453020776 が要る。丸めの余地を残して 0.49 を採る
 * （このとき 380nm は 0.182576 になり、フロアをわずかに上回る）。
 */
const LIFT_GAMMA = 0.49;

/**
 * sRGB → 線形。three の `SRGBToLinear` と同じ閾値 0.04045 を使う。
 *
 * 描画層は `Color.setRGB(..., SRGBColorSpace)` で同じ変換を行っていた。
 * ここで先に済ませることで、**線形作業色空間の値を返す単一の入口**になる。
 *
 * @param component sRGB の 1 成分（0〜1）
 * @returns 線形値（0〜1）
 */
function srgbToLinear(component: number): number {
  return component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4;
}

/**
 * Rec.709 の相対輝度。**線形値に対して**適用する。
 *
 * @param r 線形の R
 * @param g 線形の G
 * @param b 線形の B
 * @returns 相対輝度（0〜1）
 */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 波長の表示色を返す。
 *
 * 手順は 4 つ。
 *   1. `wavelengthToRgb` の sRGB を線形へ直す（ここが基準色）
 *   2. 単調ガンマで目標輝度を作る（ピーク不動）
 *   3. **その波長の色相保持上限で目標を頭打ちにする**
 *      （最大成分を 1 まで伸ばした時の輝度。一様倍では Y も同率で動くので
 *      `Y / 最大成分` で求まる）
 *   4. 目標輝度へ RGB を**一様倍**する（比が変わらない＝色相・彩度が厳密に不変）
 *
 * @param wavelengthNm 波長 [nm]
 * @returns 線形作業色空間の [r, g, b]（各成分 0〜1）。可視域外は黒
 */
export function displayColorForWavelength(
  wavelengthNm: number
): readonly [number, number, number] {
  const srgb = wavelengthToRgb(wavelengthNm);
  const r = srgbToLinear(srgb.r);
  const g = srgbToLinear(srgb.g);
  const b = srgbToLinear(srgb.b);

  const base = luminance(r, g, b);

  // 可視域外は `wavelengthToRgb` が黒を返す。持ち上げる対象が無く、0 除算にもなる
  if (base <= 0) {
    return [0, 0, 0];
  }

  const ceiling = base / Math.max(r, g, b);
  const lifted = PEAK_LUMINANCE * (base / PEAK_LUMINANCE) ** LIFT_GAMMA;
  const scale = Math.min(lifted, ceiling) / base;

  return [r * scale, g * scale, b * scale];
}

/**
 * 波長の表示色を CSS の `rgb()` 文字列で返す（SVG・DOM 用）。
 *
 * `displayColorForWavelength` と**同じ色**を sRGB へ戻して書き出す。SVG 側が
 * 独自に `wavelengthToRgb` を呼ぶと、3D と断面図で違う色になる余地が残るため、
 * 波長 → 色の判断はこの 1 か所に集める。
 *
 * @param wavelengthNm 波長 [nm]
 * @returns 例 `rgb(255, 0, 0)`
 */
export function displayColorCss(wavelengthNm: number): string {
  const [r, g, b] = displayColorForWavelength(wavelengthNm);
  // 線形 → sRGB（`srgbToLinear` の逆関数）
  const toSrgb = (value: number): number =>
    value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  const channel = (value: number): number =>
    Math.round(Math.min(Math.max(toSrgb(value), 0), 1) * 255);

  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
}
