/**
 * MDI（Material Design Icons）のパスデータから、その場でインライン `<svg>` を組む
 * （TASKS 7-15）。
 *
 * `@mdi/js` は各アイコンを `<path d="...">` の文字列定数として export しているだけの
 * パッケージで、SVG ファイル自体は配らない。ビューは常にこの関数を通して自前で
 * `<svg>` を組み立てる——`@mdi/js` から import した文字列定数だけを使うぶんには
 * バンドラの tree-shaking が効き、実際に使うアイコンの分しかビルド成果物に含まれない。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** MDI のアイコンは 24×24 のビューポートを前提に描かれている。 */
const MDI_VIEWBOX_SIZE = 24;

/**
 * MDI のパスデータから `<svg>` 要素を組む。
 *
 * 色は自前で塗らない（`fill="currentColor"`）。周囲の文字色（アクセントカラー・
 * ボタンの文字色など）にそのまま追従させるためで、アイコンごとに個別の色指定を
 * 増やさずに済む。
 *
 * @param pathData `@mdi/js` から import したパス文字列（例 `mdiTarget`）
 * @param sizePx 表示サイズ [px]（正方形）
 * @returns 装飾用の `<svg>`。読み上げには乗せない（`aria-hidden="true"`）
 */
export function createMdiIcon(pathData: string, sizePx = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');

  svg.setAttribute('viewBox', `0 0 ${MDI_VIEWBOX_SIZE} ${MDI_VIEWBOX_SIZE}`);
  svg.setAttribute('width', String(sizePx));
  svg.setAttribute('height', String(sizePx));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('mdi-icon');

  const path = document.createElementNS(SVG_NS, 'path');

  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);

  return svg;
}
