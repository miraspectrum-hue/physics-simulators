// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { augmentSvgForRaster, type RasterStyle } from '../../src/scene/svgRaster';

/**
 * src/scene/svgRaster.ts の受け入れ条件（ラスタ化用の SVG 補完。PNG-2 段階1）。
 *
 * 対象:
 *   augmentSvgForRaster(svg, style) — 直列化して `Image` へ渡す前に、
 *   **外部 CSS 由来で落ちる見た目**を SVG の中へ焼き込む
 *
 * 何を守るためのテストか:
 *   段階0 のスパイクで、直列化した SVG を `Image` にすると失われるものを実測した。
 *   `foreignObject` も Web フォントも `url(...)` 参照も 0 件で、落ちるのは 3 つだけ:
 *     - 背景 `rgba(5, 7, 13, 0.72)`（`.section-view` の CSS）
 *     - 枠線 1px と角丸 4px（同上）
 *     - フォント（`body` から継承。`text` に属性が無い）
 *   焼き込まないと画面との差が 92.82%、焼き込むと 11.70% まで落ちた（実測）。
 *
 *   同時に**やり過ぎない**ことも縛る。既にその属性を持つ要素は触らない
 *   （ラベルの色やハローは既に属性で入っており、上書きすると可読性パスの成果が消える）。
 *   要素を増やすのも背景 1 枚だけに限る。
 *
 * 環境についての注記:
 *   **このファイルだけ `jsdom` で走らせる**（先頭の `@vitest-environment`）。オラクルを
 *   手書きの代役ではなく実 DOM の意味論に置くためで、`insertBefore` や
 *   `querySelectorAll` の振る舞いは jsdom の実装がそのまま基準になる。
 *   他のテストは `vite.config.ts` の `environment: 'node'` のまま影響を受けない。
 *
 * 期待値の出典:
 *   下の STYLE に入れた値そのもの。SUT の出力からは作らない。
 */

/** SVG の名前空間。 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** 段階0 で実測した計算済みスタイル。 */
const STYLE: RasterStyle = {
  bgFill: 'rgb(5, 7, 13)',
  bgAlpha: 0.72,
  borderColor: 'rgb(30, 42, 61)',
  borderWidth: 1,
  radius: 4,
  fontFamily: '"Noto Sans JP", "Yu Gothic", sans-serif',
  fontSize: '10px',
  fontWeight: '400',
};

/**
 * 実物と同じ骨格の `<svg>` を組む。
 *
 * @param children `[タグ名, 属性]` の並び
 * @returns 子を持つ SVG 要素
 */
function buildSvg(children: ReadonlyArray<[string, Record<string, string>]>): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 320 320');

  for (const [tag, attributes] of children) {
    const child = document.createElementNS(SVG_NS, tag);

    for (const [name, value] of Object.entries(attributes)) {
      child.setAttribute(name, value);
    }

    svg.appendChild(child);
  }

  return svg;
}

describe('PNG-2: augmentSvgForRaster の CSS 由来の見た目の焼き込み', () => {
  it('背景の rect を最初の子として挿入し、塗りと不透明度を持たせる', () => {
    // Arrange
    const svg = buildSvg([['polygon', {}]]);
    const polygon = svg.firstElementChild;

    // Act
    augmentSvgForRaster(svg, STYLE);

    // Assert: 先頭に入っていないと、既存の図形の上に背景が乗って全部隠れる
    const first = svg.firstElementChild;

    expect(first?.tagName).toBe('rect');
    expect(first?.namespaceURI).toBe(SVG_NS);
    expect(first?.getAttribute('fill')).toBe('rgb(5, 7, 13)');
    expect(first?.getAttribute('fill-opacity')).toBe('0.72');
    expect(svg.children[1]).toBe(polygon);
  });

  it('背景の rect が枠線と角丸を持つ', () => {
    // Arrange
    const svg = buildSvg([['polygon', {}]]);

    // Act
    augmentSvgForRaster(svg, STYLE);

    // Assert
    const rect = svg.firstElementChild;

    expect(rect?.getAttribute('stroke')).toBe('rgb(30, 42, 61)');
    expect(rect?.getAttribute('stroke-width')).toBe('1');
    expect(rect?.getAttribute('rx')).toBe('4');
  });

  it('font 属性の無い text にフォントを与える', () => {
    // Arrange: 実物の text は font-size しか持たず、書体は body から継承している
    const svg = buildSvg([['text', { 'font-size': '10' }]]);

    // Act
    augmentSvgForRaster(svg, STYLE);

    // Assert
    const text = svg.querySelector('text');

    expect(text?.getAttribute('font-family')).toBe('"Noto Sans JP", "Yu Gothic", sans-serif');
    expect(text?.getAttribute('font-size')).toBe('10px');
    expect(text?.getAttribute('font-weight')).toBe('400');
  });

  it('既に属性を持つ要素は上書きしない', () => {
    // Arrange: ラベルの色・ハロー・書体は可読性パスで属性として入っている。
    //          ここで塗り替えると、あの成果がラスタ化のときだけ消える
    const svg = buildSvg([
      [
        'text',
        {
          'font-family': 'monospace',
          'font-size': '18px',
          'font-weight': '700',
          fill: 'rgb(255, 0, 0)',
          stroke: 'rgb(0, 0, 0)',
        },
      ],
    ]);

    // Act
    augmentSvgForRaster(svg, STYLE);

    // Assert
    const text = svg.querySelector('text');

    expect(text?.getAttribute('font-family')).toBe('monospace');
    expect(text?.getAttribute('font-size')).toBe('18px');
    expect(text?.getAttribute('font-weight')).toBe('700');
    expect(text?.getAttribute('fill')).toBe('rgb(255, 0, 0)');
    expect(text?.getAttribute('stroke')).toBe('rgb(0, 0, 0)');
  });

  it('増える要素は背景の rect ただ 1 つで、他は増やさない', () => {
    // Arrange
    const svg = buildSvg([
      ['polygon', {}],
      ['polyline', {}],
      ['polyline', {}],
      ['text', { 'font-size': '10' }],
    ]);
    const originals = [...svg.children];

    // Act
    augmentSvgForRaster(svg, STYLE);

    // Assert
    expect(svg.children).toHaveLength(originals.length + 1);
    expect(svg.querySelectorAll('rect')).toHaveLength(1);

    for (const [index, original] of originals.entries()) {
      expect(svg.children[index + 1]).toBe(original);
    }
  });
});
