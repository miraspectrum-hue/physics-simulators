/**
 * ラスタ化の直前に、外部 CSS 由来の見た目を SVG の中へ焼き込む（PNG-2）。
 *
 * 直列化した SVG を `Image` に読ませると、その文書は**外側のスタイルシートを一切
 * 参照できない孤立した文書**になる。段階0 のスパイクで実測したところ、断面図で
 * 落ちるのは 3 つだけだった——背景（`rgba(5, 7, 13, 0.72)`）・枠線 1px と角丸 4px・
 * `body` から継承していた書体。焼き込まないと画面との差が 92.82%、焼き込むと 11.70%
 * まで落ちる（残りは扇の AA と 1px の端で説明が付く）。
 *
 * **やり過ぎないことも同じくらい重要**である。既に属性を持つ要素には触らない。
 * ラベルの色とハローは可読性パスで属性として入っており、ここで塗り替えると
 * あの成果がラスタ化のときだけ消える。
 *
 * この関数は与えられた要素を破壊的に書き換える。**ライブの DOM を渡してはならない**
 * （呼び出し側が `cloneNode(true)` した複製に対して使う）。
 */

/** SVG の名前空間。 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** 焼き込む見た目。呼び出し側が `getComputedStyle` から組み立てる。 */
export interface RasterStyle {
  /** 背景色。`rgb(r, g, b)` 形式（不透明度は別に持つ） */
  readonly bgFill: string;
  /** 背景の不透明度（0〜1） */
  readonly bgAlpha: number;
  /** 枠線の色 */
  readonly borderColor: string;
  /** 枠線の太さ [px] */
  readonly borderWidth: number;
  /** 角丸の半径 [px] */
  readonly radius: number;
  /** 書体 */
  readonly fontFamily: string;
  /** 文字の大きさ（単位付き） */
  readonly fontSize: string;
  /** 文字の太さ */
  readonly fontWeight: string;
}

/**
 * 「この要素は自前で書体を決めている」ことの目印にする属性。
 *
 * 直列化した SVG で実際に失われるのは**書体だけ**である。`font-size` と
 * `font-weight` は属性として書いてあれば当然そのまま残る。よって
 * `font-family` を持たない要素だけが「外部 CSS に頼っていた」要素であり、
 * 手を入れる対象になる。
 */
const FONT_OWNER_MARKER = 'font-family';

/**
 * ラスタ化用に SVG を補完する。
 *
 * 背景の矩形は `100%` で置く。viewBox の原点が `0 0` であることを前提にしており
 * （断面図の viewBox は `0 0 320 320` 固定）、こうしておくと viewBox の寸法を
 * 読み取って数値へ写す経路が要らない。枠線は viewport の縁に乗るので外半分が
 * 切り取られるが、これは CSS の `border` が要素の内側に描かれるのと同じ見え方になる。
 *
 * @param svg 補完する SVG（**複製であること**。破壊的に書き換える）
 * @param style 焼き込む見た目
 * @returns 引数と同じ要素
 */
export function augmentSvgForRaster(svg: SVGSVGElement, style: RasterStyle): SVGSVGElement {
  const background = svg.ownerDocument.createElementNS(SVG_NS, 'rect');

  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', '100%');
  background.setAttribute('height', '100%');
  background.setAttribute('fill', style.bgFill);
  background.setAttribute('fill-opacity', String(style.bgAlpha));
  background.setAttribute('stroke', style.borderColor);
  background.setAttribute('stroke-width', String(style.borderWidth));
  background.setAttribute('rx', String(style.radius));

  // **先頭でなければならない。** 後ろに足すと既存の図形の上に背景が乗って全部隠れる
  svg.insertBefore(background, svg.firstChild);

  for (const text of svg.querySelectorAll('text')) {
    // 自前で書体を決めている要素には触れない。`style` は代表 1 つから読んだ
    // 計算済みスタイルなので、書体の違う要素へ押し付けると見た目を壊す
    if (text.hasAttribute(FONT_OWNER_MARKER)) {
      continue;
    }

    // 継承していた要素には 3 つまとめて入れる。`style` はこの要素と同じ書体を
    // 継承していた代表の計算済み値なので、大きさと太さは書き戻しても同値になる
    text.setAttribute('font-family', style.fontFamily);
    text.setAttribute('font-size', style.fontSize);
    text.setAttribute('font-weight', style.fontWeight);
  }

  return svg;
}
