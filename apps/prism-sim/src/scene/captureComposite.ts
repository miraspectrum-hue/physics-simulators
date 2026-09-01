import { splitCssColorAlpha } from './cssColorAlpha';
import { computeInsetPlacement, type CssRect } from './insetPlacement';
import { augmentSvgForRaster, type RasterStyle } from './svgRaster';

/**
 * 3D の書き出しへ断面図インセットを重ねて 1 枚の PNG にする（TASKS 6-6 段階5, PNG-2）。
 *
 * 保存ボタンは WYSIWYG に一本化する。**画面に見えているものがそのまま出る**のが
 * 唯一の約束で、断面図が消えていれば 3D だけ、出ていれば重なった絵が出る。
 *
 * 二段構えになっているのは、3D の書き出しが**同期でしか成立しない**からである
 * （`SceneManager.captureDataUrl` の説明を参照）。だから
 *
 *   1. 3D はクリックと同じ同期タスクで撮り切る（呼び出し側の責務）
 *   2. その文字列を持って、SVG のラスタ化という非同期の仕事へ移る
 *
 * という順序になる。撮り終えた文字列はもう描画バッファに依存しない。
 *
 * 断面図が非表示のときは**受け取った文字列をそのまま返す**。2D キャンバスを
 * 経由して詰め直すと、PNG のエンコードが 1 ビットでも変わる余地を作ってしまう。
 * 何も重ねないなら何もしない、が最も強い保証になる。
 */

/** SVG の名前空間。 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** 合成の材料。 */
export interface CaptureCompositeSource {
  /** 3D を同期で撮った PNG の data URL */
  readonly snapshotDataUrl: string;
  /** 書き出し元の canvas。バッキングの大きさと CSS 上の位置の基準になる */
  readonly canvas: HTMLCanvasElement;
  /** 重ねる断面図。**ライブの要素**を渡してよい（内部で複製する）。重ねないなら null */
  readonly inset: SVGSVGElement | null;
}

/**
 * 3D の書き出しへ断面図を重ねる。
 *
 * @param source 合成の材料
 * @returns 合成後の PNG の data URL。重ねるものが無ければ入力の文字列そのもの
 */
export async function composeCapturePng(source: CaptureCompositeSource): Promise<string> {
  const { snapshotDataUrl, canvas, inset } = source;

  if (inset === null) {
    return snapshotDataUrl;
  }

  const backing = { width: canvas.width, height: canvas.height };
  const placement = computeInsetPlacement(
    measureInset(inset, canvas),
    // `window.devicePixelRatio` ではなく**実際のバッキング比**を使う。
    // `computeBackingSize` は MAX_PIXEL_RATIO で頭打ちにし floor もするので、
    // DPR 3 の環境では両者が食い違う。写像の真実は撮れた画素の側にある
    backing.width / canvas.clientWidth,
    backing
  );

  const [base, overlay] = await Promise.all([
    loadImage(snapshotDataUrl),
    loadImage(serializeForRaster(inset, placement)),
  ]);

  const target = document.createElement('canvas');
  target.width = backing.width;
  target.height = backing.height;

  const context = target.getContext('2d');

  if (context === null) {
    throw new Error('2D コンテキストを取得できません');
  }

  context.drawImage(base, 0, 0);
  context.drawImage(overlay, placement.x, placement.y, placement.width, placement.height);

  return target.toDataURL('image/png');
}

/**
 * インセットの位置と大きさを canvas の左上を原点として測る。
 *
 * どちらも `getBoundingClientRect` で測るので、CSS の指定（`top: 16px` など）を
 * 読み直す必要がない。**画面に出ている位置がそのまま写る**。
 *
 * @param inset 断面図の要素
 * @param canvas 書き出し元の canvas
 * @returns canvas 内での矩形 [CSS px]
 */
function measureInset(inset: SVGSVGElement, canvas: HTMLCanvasElement): CssRect {
  const insetRect = inset.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();

  return {
    x: insetRect.left - canvasRect.left,
    y: insetRect.top - canvasRect.top,
    width: insetRect.width,
    height: insetRect.height,
  };
}

/**
 * ラスタ化できる形へ整えた SVG を data URL にする。
 *
 * **ライブの要素には指一本触れない。** 背景の矩形を実際の断面図へ差し込んだら
 * 画面の図が壊れる。複製してから `augmentSvgForRaster` に渡す。
 *
 * @param inset ライブの断面図
 * @param placement 重ねる先の大きさ [バッキング px]
 * @returns `data:image/svg+xml,...` 形式の文字列
 */
function serializeForRaster(inset: SVGSVGElement, placement: CssRect): string {
  const clone = inset.cloneNode(true) as SVGSVGElement;

  // 孤立した文書になるので名前空間を明示し、外側の CSS への参照は落とす
  clone.setAttribute('xmlns', SVG_NS);
  clone.removeAttribute('class');
  clone.removeAttribute('hidden');

  // viewBox はそのままに、描く大きさだけバッキング画素へ広げる。
  // ラスタ化の解像度がここで決まるので、DPR が高い環境でも図が甘くならない
  clone.setAttribute('width', String(placement.width));
  clone.setAttribute('height', String(placement.height));

  augmentSvgForRaster(clone, readRasterStyle(inset));

  const xml = new XMLSerializer().serializeToString(clone);

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
}

/**
 * 外部 CSS 由来で失われる見た目を、ライブの要素から読み取る。
 *
 * 背景・枠線・角丸は容器（`.section-view`）から、書体はラベルの 1 つから読む。
 * **書体を容器から読んではならない**。容器の `font-size` は本文から継承した値で、
 * ラベルが属性で持つ 10 とは違う。
 *
 * @param inset ライブの断面図
 * @returns 焼き込む見た目
 */
function readRasterStyle(inset: SVGSVGElement): RasterStyle {
  const box = getComputedStyle(inset);
  const label = getComputedStyle(inset.querySelector('text') ?? inset);
  const background = splitCssColorAlpha(box.backgroundColor);

  return {
    bgFill: background.color,
    bgAlpha: background.alpha,
    borderColor: box.borderTopColor,
    borderWidth: Number.parseFloat(box.borderTopWidth) || 0,
    radius: Number.parseFloat(box.borderTopLeftRadius) || 0,
    fontFamily: label.fontFamily,
    fontSize: label.fontSize,
    fontWeight: label.fontWeight,
  };
}

/**
 * data URL から `Image` を読み込む。
 *
 * @param src data URL
 * @returns 読み込み終わった画像
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = (): void => {
      resolve(image);
    };
    image.onerror = (): void => {
      reject(new Error('画像を読み込めませんでした'));
    };
    image.src = src;
  });
}
