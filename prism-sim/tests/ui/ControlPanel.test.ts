// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import ControlPanel from '../../src/ui/ControlPanel';
import { DEFAULT_BEAM_WIDTH_PX } from '../../src/ui/shareUrl';
import { createStore, type Store } from '../../src/ui/store';

/**
 * src/ui/ControlPanel.ts の受け入れ条件のうち、スペクトル表示モードのラジオ（TASKS 4-3）。
 *
 * 対象:
 *   ControlPanel の「表示」節に置いたラジオ ⇄ store の双方向
 *
 * 何を守るためのテストか:
 *   4-3 のモードは断面図トグルと違い**計算の入力**なので、状態の単一の真実は store に
 *   ある。UI はその 1 つのビューにすぎず、
 *     - 人が選ぶ → store が変わる
 *     - store が変わる（共有 URL の復元・hashchange） → 選択が追従する
 *   の両方向が要る。片方向だけだと「URL で 7 色を開いたのにラジオは連続のまま」
 *   という食い違いが出る。
 *
 *   併せて**エコーが起きないこと**を縛る。`checked` への代入は `change` を発火しないので、
 *   復元 → render → change → store.update → render … の輪にならない。
 *
 * 環境についての注記:
 *   **このファイルだけ `jsdom` で走らせる**（先頭の `@vitest-environment`）。
 *   CLAUDE.md は DOM を触るモジュールを Vitest の対象外としており、ControlPanel には
 *   これまでテストが無かった。ここはその方針の例外として、`svgRaster.test.ts` で
 *   導入済みの jsdom を使う。**扱うのは DOM 要素と store の往復だけ**で、
 *   Three にもレンダラにも触らない。
 *
 * 期待値の出典:
 *   SPEC.md「画面構成」の `○連続 ●7色`、および 4-3 の裁定②（既定は連続 48）。
 */

/** ラジオの id。ControlPanel の SPECTRUM_MODE_OPTIONS と対応する。 */
const CONTINUOUS_ID = 'spectrum-continuous';
const SEVEN_COLOR_ID = 'spectrum-seven';

/**
 * パネルを組み立てる。
 *
 * @param store 束ねる store
 * @returns パネルを差し込んだ親要素
 */
function mount(store: Store): HTMLElement {
  const parent = document.createElement('div');

  document.body.appendChild(parent);
  new ControlPanel(parent, store);

  return parent;
}

/**
 * ラジオを取り出す。
 *
 * @param parent パネルを差し込んだ親要素
 * @param id ラジオの id
 * @returns ラジオの要素
 */
function radioOf(parent: HTMLElement, id: string): HTMLInputElement {
  const radio = parent.querySelector(`#${id}`);

  if (!(radio instanceof HTMLInputElement)) {
    throw new Error(`ラジオ ${id} が見つかりません`);
  }

  return radio;
}

/**
 * パネルを組み立て、要素とインスタンスの両方を返す。
 *
 * グロー・数値表示トグルの購読者テスト（`onToggleGlow` 等）はインスタンスへの参照が要る。
 * 上の `mount` はスペクトルラジオのテストが要素だけで足りるため既存のままにしてある。
 *
 * @param store 束ねる store
 * @returns パネルを差し込んだ親要素と ControlPanel インスタンス
 */
function mountPanel(store: Store): { parent: HTMLElement; panel: ControlPanel } {
  const parent = document.createElement('div');

  document.body.appendChild(parent);
  const panel = new ControlPanel(parent, store);

  return { parent, panel };
}

/**
 * ボタンを id で取り出す。
 *
 * @param parent パネルを差し込んだ親要素
 * @param id ボタンの id
 * @returns ボタンの要素
 */
function buttonOf(parent: HTMLElement, id: string): HTMLButtonElement {
  const button = parent.querySelector(`#${id}`);

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`ボタン ${id} が見つかりません`);
  }

  return button;
}

/** グロートグルの id。 */
const GLOW_ID = 'glow-toggle';
/** 数値表示トグルの id。 */
const NUMBERS_ID = 'numbers-toggle';

/**
 * range スライダーを id で取り出す。`radioOf` と同じ形だが、range 入力に使うことを
 * 名前で示す（`#prism-rotation` にも `#prism-position-x/y` にも使う）。
 *
 * @param parent パネルを差し込んだ親要素
 * @param id スライダーの id
 * @returns スライダーの要素
 */
function sliderOf(parent: HTMLElement, id: string): HTMLInputElement {
  const slider = parent.querySelector(`#${id}`);

  if (!(slider instanceof HTMLInputElement)) {
    throw new Error(`スライダー ${id} が見つかりません`);
  }

  return slider;
}

describe('4-3: スペクトル表示モードのラジオ', () => {
  // パネルは id を持つので、前のテストの残骸があると id が重複する。
  // jsdom の `#id` セレクタは `getElementById` に落ちるため、重複すると
  // 親の外側にある方を拾って null になる（実際にそれで 4 件落ちた）
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('構築時の選択が store の既定（連続）を映す', () => {
    // Arrange
    const store = createStore();

    // Act
    const parent = mount(store);

    // Assert
    expect(radioOf(parent, CONTINUOUS_ID).checked).toBe(true);
    expect(radioOf(parent, SEVEN_COLOR_ID).checked).toBe(false);
  });

  it('store が 7 色で始まれば 7 色が選択済みになる', () => {
    // Arrange: 共有 URL `spec=7` で開いたときの経路。復元は store を先に立てる
    const store = createStore();
    store.update({ spectrumMode: 'sevenColor' });

    // Act
    const parent = mount(store);

    // Assert
    expect(radioOf(parent, SEVEN_COLOR_ID).checked).toBe(true);
    expect(radioOf(parent, CONTINUOUS_ID).checked).toBe(false);
  });

  it('7 色を選ぶと store が更新される', () => {
    // Arrange
    const store = createStore();
    const parent = mount(store);
    const seven = radioOf(parent, SEVEN_COLOR_ID);

    // Act: 人がクリックしたときと同じ経路（click は checked を立てて change を発火する）
    seven.click();

    // Assert
    expect(store.getState().spectrumMode).toBe('sevenColor');
  });

  it('store が後から変わると選択が追従する', () => {
    // Arrange: hashchange で `spec=7` を貼られたときの経路
    const store = createStore();
    const parent = mount(store);

    // Act
    store.update({ spectrumMode: 'sevenColor' });

    // Assert
    expect(radioOf(parent, SEVEN_COLOR_ID).checked).toBe(true);
    expect(radioOf(parent, CONTINUOUS_ID).checked).toBe(false);
  });

  it('2 つのラジオが 1 つの radiogroup に束ねられている', () => {
    // Arrange: 矢印キーでの移動もロービング tabindex もブラウザ任せなので、
    //          守るべきは「同じ name で 1 つの群になっていること」と群の意味論
    const store = createStore();

    // Act
    const parent = mount(store);
    const group = parent.querySelector('[role="radiogroup"]');

    // Assert
    expect(group).not.toBeNull();
    expect(group?.querySelector('legend')?.textContent).toBe('スペクトル');
    expect(radioOf(parent, CONTINUOUS_ID).name).toBe('spectrum-mode');
    expect(radioOf(parent, SEVEN_COLOR_ID).name).toBe(
      radioOf(parent, CONTINUOUS_ID).name
    );
    expect(group?.querySelectorAll('input[type="radio"]')).toHaveLength(2);
  });
});

/**
 * ControlPanel の「表示」節に置いたグロー・数値表示トグル（TASKS 4-7）。
 *
 * 何を守るためのテストか:
 *   どちらも断面図トグルと同じ性質（描画専用・計算に無関係）なので store を経由しない。
 *   守るべきは
 *     - 既定が ON（押された状態）で始まること
 *     - 人がクリックすると反転し、購読者にその状態が届くこと
 *     - 共有 URL からの復元は `setGlowPressed`/`setNumbersPressed` で見た目だけ動き、
 *       購読者を呼ばない（`setSectionPressed` と同じ非発火の流儀。エコーを防ぐ）
 *     - グローと数値表示が互いに独立していること
 */
describe('4-7: グロー・数値表示トグル', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('構築時は両方とも押された状態（既定 ON）', () => {
    // Arrange
    const store = createStore();

    // Act
    const { parent } = mountPanel(store);

    // Assert
    expect(buttonOf(parent, GLOW_ID).getAttribute('aria-pressed')).toBe('true');
    expect(buttonOf(parent, NUMBERS_ID).getAttribute('aria-pressed')).toBe('true');
  });

  it('グローをクリックすると押下状態が反転し、購読者に false が届く', () => {
    // Arrange
    const store = createStore();
    const { parent, panel } = mountPanel(store);
    const received: boolean[] = [];

    panel.onToggleGlow((enabled) => received.push(enabled));

    // Act
    buttonOf(parent, GLOW_ID).click();

    // Assert
    expect(buttonOf(parent, GLOW_ID).getAttribute('aria-pressed')).toBe('false');
    expect(received).toEqual([false]);
  });

  it('数値表示をクリックすると押下状態が反転し、購読者に false が届く', () => {
    // Arrange
    const store = createStore();
    const { parent, panel } = mountPanel(store);
    const received: boolean[] = [];

    panel.onToggleNumbers((visible) => received.push(visible));

    // Act
    buttonOf(parent, NUMBERS_ID).click();

    // Assert
    expect(buttonOf(parent, NUMBERS_ID).getAttribute('aria-pressed')).toBe('false');
    expect(received).toEqual([false]);
  });

  it('復元用の setter は購読者を呼ばずに見た目だけ変える', () => {
    // Arrange: 共有 URL からの復元（setSectionPressed と同じ非発火の流儀）
    const store = createStore();
    const { parent, panel } = mountPanel(store);
    const received: boolean[] = [];

    panel.onToggleGlow((enabled) => received.push(enabled));
    panel.onToggleNumbers((visible) => received.push(visible));

    // Act
    panel.setGlowPressed(false);
    panel.setNumbersPressed(false);

    // Assert
    expect(buttonOf(parent, GLOW_ID).getAttribute('aria-pressed')).toBe('false');
    expect(buttonOf(parent, NUMBERS_ID).getAttribute('aria-pressed')).toBe('false');
    expect(panel.isGlowPressed()).toBe(false);
    expect(panel.isNumbersPressed()).toBe(false);
    expect(received).toEqual([]);
  });

  it('グローと数値表示は独立している（片方のクリックがもう片方に波及しない）', () => {
    // Arrange
    const store = createStore();
    const { parent } = mountPanel(store);

    // Act
    buttonOf(parent, GLOW_ID).click();

    // Assert
    expect(buttonOf(parent, GLOW_ID).getAttribute('aria-pressed')).toBe('false');
    expect(buttonOf(parent, NUMBERS_ID).getAttribute('aria-pressed')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// 4-8 段階1→2: プリズムの X/Y 位置スライダー。
//
// 段階1では `ControlPanel` にまだ無い操作面を、`unknown` キャスト経由の局所拡張
// （`withFuturePosition`）で疑似的に呼び、8件が個別に Red で落ちることを確認した。
// 段階2で `onPositionXInput`/`onPositionYInput`/`setPositionX`/`setPositionY` を
// 本体へ正式に追加したので、ここからは局所拡張を使わず直接呼び出しに統合する。
//
// #prism-rotation（既存）が確立した鏡写し元のパターン:
//   - ネイティブ input[type=range]。id は label[for] と対応する
//   - onXxxInput(subscriber) は人の操作（input イベント）だけを拾う
//   - setXxx(value) は表示だけを書き換え、購読者を呼ばない
//     （ギズモ → スライダー → ギズモ、というエコーを防ぐ。setRotationDeg と同じ流儀）
//
// ★4-7（glow/nums）とは性質が逆であることに注意。あちらは表示専用で計算に無関係
// だったが、位置は世界座標の並進成分そのもの＝幾何入力である。変更されたときに
// 光路が再計算されるのが正しい（source-angle/screen-distance と同類）。
// ただし ControlPanel は three を一切知らないので、実際に Object3D.position を
// 読み書きし refreshBeams を誘発するかどうかは main.ts の責務であり、jsdom では
// 検証できない（CDP は段階2で確認済み）。ここで縛れるのは ControlPanel 自身の契約だけである。
//
// 純粋スライス（clamp/range/単位変換）について:
//   #prism-rotation に対応するクランプ関数は無い。ROTATION_MIN_DEG/MAX_DEG は
//   HTML の min/max 属性文字列としてしか使われず、範囲の強制はブラウザのネイティブ
//   range 入力に委ねている。共有 URL の rz 読み取り（decodeUrl）も同様にクランプ無し・
//   有限性チェックのみ（shareUrl.ts のコメントに「回転はギズモで連続、位置は無制限」と
//   明記されている）。鏡写しの結果、位置（px/py）にも純粋スライスは無い。
//
// 期待値の出典:
//   既定値は `src/scene/prismPose.ts` の DEFAULT_PRISM_X / DEFAULT_PRISM_Y（= 0）。
//   SUT 側の値を読んで作らず、定数の値をそのままハードコードする。
// ---------------------------------------------------------------------------

/** X 位置スライダーの id。 */
const POSITION_X_ID = 'prism-position-x';
/** Y 位置スライダーの id。 */
const POSITION_Y_ID = 'prism-position-y';

describe('4-8 段階1 A: X/Y 位置スライダーの存在と既定値', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('プリズム節に X 位置スライダーが存在し、label[for] を持つ', () => {
    // Arrange
    const store = createStore();

    // Act
    const { parent } = mountPanel(store);
    const slider = sliderOf(parent, POSITION_X_ID);

    // Assert
    expect(slider.type).toBe('range');
    expect(parent.querySelector(`label[for="${POSITION_X_ID}"]`)).not.toBeNull();
  });

  it('プリズム節に Y 位置スライダーが存在し、label[for] を持つ', () => {
    // Arrange
    const store = createStore();

    // Act
    const { parent } = mountPanel(store);
    const slider = sliderOf(parent, POSITION_Y_ID);

    // Assert
    expect(slider.type).toBe('range');
    expect(parent.querySelector(`label[for="${POSITION_Y_ID}"]`)).not.toBeNull();
  });

  it('構築時の値は DEFAULT_PRISM_X/Y（0）を映す', () => {
    // Arrange: 期待値は prismPose.ts の定数からそのまま。SUT からは作らない
    const store = createStore();

    // Act
    const { parent } = mountPanel(store);

    // Assert
    expect(Number(sliderOf(parent, POSITION_X_ID).value)).toBe(0);
    expect(Number(sliderOf(parent, POSITION_Y_ID).value)).toBe(0);
  });
});

describe('4-8 段階1 B: 人の操作 → 購読者', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('X スライダーを動かすと onPositionXInput の購読者に新しい x が届く', () => {
    // Arrange
    const store = createStore();
    const { parent, panel } = mountPanel(store);
    const received: number[] = [];

    panel.onPositionXInput((x) => received.push(x));

    // Act: input イベントで人の操作を模す（rotationSlider と同じ経路）
    const slider = sliderOf(parent, POSITION_X_ID);

    slider.value = '1.5';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    // Assert
    expect(received).toEqual([1.5]);
  });

  it('Y スライダーを動かすと onPositionYInput の購読者に新しい y が届く', () => {
    // Arrange
    const store = createStore();
    const { parent, panel } = mountPanel(store);
    const received: number[] = [];

    panel.onPositionYInput((y) => received.push(y));

    // Act
    const slider = sliderOf(parent, POSITION_Y_ID);

    slider.value = '-0.75';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    // Assert
    expect(received).toEqual([-0.75]);
  });
});

describe('4-8 段階1 C: 表示専用 setter（ギズモ→スライダーの非発火経路）', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('setPositionX は購読者を呼ばずに見た目だけを変える（エコー防止）', () => {
    // Arrange: setRotationDeg と同じ非発火の流儀。ギズモ → スライダー → ギズモ、の輪にしない
    const store = createStore();
    const { parent, panel } = mountPanel(store);
    const received: number[] = [];

    panel.onPositionXInput((x) => received.push(x));

    // Act
    panel.setPositionX(2.25);

    // Assert
    expect(Number(sliderOf(parent, POSITION_X_ID).value)).toBe(2.25);
    expect(received).toEqual([]);
  });

  it('setPositionY は購読者を呼ばずに見た目だけを変える（エコー防止）', () => {
    // Arrange
    const store = createStore();
    const { parent, panel } = mountPanel(store);
    const received: number[] = [];

    panel.onPositionYInput((y) => received.push(y));

    // Act
    panel.setPositionY(-1.1);

    // Assert
    expect(Number(sliderOf(parent, POSITION_Y_ID).value)).toBe(-1.1);
    expect(received).toEqual([]);
  });
});

describe('4-8 段階1 D: 回転スライダーの回帰を巻き込まない', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('X 位置スライダーを動かしても回転スライダーの値は変わらない', () => {
    // Arrange: #prism-rotation は既存の要素。値そのものをハードコードせず、
    // 「操作の前後で変わらないこと」だけを見る（無関係のはずの回帰を検知する）
    const store = createStore();
    const { parent } = mountPanel(store);
    const rotationBefore = sliderOf(parent, 'prism-rotation').value;

    // Act
    const slider = sliderOf(parent, POSITION_X_ID);

    slider.value = '3';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    // Assert
    expect(sliderOf(parent, 'prism-rotation').value).toBe(rotationBefore);
  });
});

// ---------------------------------------------------------------------------
// 4-5 段階2: ビーム幅スライダー。
//
// #prism-position-x/y と同じ鏡写しパターン（表示専用・非 store・非発火 setter）。
// 4-5 裁定：ビーム幅は traceSpectrum の入力にならないため、位置/回転と同じ非 AppState の
// 独立配線を採る（glow/nums と同じ理由だが、値は連続数なので range 入力）。
//
// ★jsdom の罠（4-8 で発覚）: range 入力は value 属性を省くと min/max の中点になる仕様だが、
// jsdom はこれを再計算しない。ControlPanel のコンストラクタは `setBeamWidth(DEFAULT_BEAM_WIDTH_PX)`
// を明示的に呼んでいるので、初期値が中点（(1.0+8.0)/2 = 4.5）ではなく既定の 3.5 になることを
// ここで固定し、この罠を実際に踏んでいないことを回帰的に確認する。
//
// 期待値の出典: 既定値は src/ui/shareUrl.ts の DEFAULT_BEAM_WIDTH_PX（= 3.5）。
// ---------------------------------------------------------------------------

/** ビーム幅スライダーの id。 */
const BEAM_WIDTH_ID = 'beam-width';

describe('4-5 段階2 A: ビーム幅スライダーの存在と既定値', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('光源節にビーム幅スライダーが存在し、label[for] を持つ', () => {
    // Arrange
    const store = createStore();

    // Act
    const { parent } = mountPanel(store);
    const slider = sliderOf(parent, BEAM_WIDTH_ID);

    // Assert
    expect(slider.type).toBe('range');
    expect(parent.querySelector(`label[for="${BEAM_WIDTH_ID}"]`)).not.toBeNull();
  });

  it('min/max/step が裁定どおり（1.0 / 8.0 / 0.5）', () => {
    // Arrange
    const store = createStore();

    // Act
    const { parent } = mountPanel(store);
    const slider = sliderOf(parent, BEAM_WIDTH_ID);

    // Assert
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('8');
    expect(slider.step).toBe('0.5');
  });

  it('★jsdom罠回避: 構築時の値は min/max の中点（4.5）ではなく DEFAULT_BEAM_WIDTH_PX（3.5）', () => {
    // Arrange: 期待値は shareUrl.ts の定数からそのまま。SUT からは作らない
    const store = createStore();

    // Act
    const { parent } = mountPanel(store);

    // Assert
    expect(Number(sliderOf(parent, BEAM_WIDTH_ID).value)).toBe(DEFAULT_BEAM_WIDTH_PX);
    expect(Number(sliderOf(parent, BEAM_WIDTH_ID).value)).not.toBe(4.5);
  });
});

describe('4-5 段階2 B: 人の操作 → 購読者', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('ビーム幅スライダーを動かすと onBeamWidthInput の購読者に新しい px が届く', () => {
    // Arrange
    const store = createStore();
    const { parent, panel } = mountPanel(store);
    const received: number[] = [];

    panel.onBeamWidthInput((widthPx) => received.push(widthPx));

    // Act: input イベントで人の操作を模す（position/rotation と同じ経路）
    const slider = sliderOf(parent, BEAM_WIDTH_ID);

    slider.value = '6';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    // Assert
    expect(received).toEqual([6]);
  });
});

describe('4-5 段階2 C: 表示専用 setter（URL 復元の非発火経路）', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('setBeamWidth は購読者を呼ばずに見た目だけを変える（エコー防止）', () => {
    // Arrange: setPositionX/Y と同じ非発火の流儀
    const store = createStore();
    const { parent, panel } = mountPanel(store);
    const received: number[] = [];

    panel.onBeamWidthInput((widthPx) => received.push(widthPx));

    // Act
    panel.setBeamWidth(6.5);

    // Assert
    expect(Number(sliderOf(parent, BEAM_WIDTH_ID).value)).toBe(6.5);
    expect(received).toEqual([]);
  });
});

describe('4-5 段階2 D: 位置スライダーの回帰を巻き込まない', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('ビーム幅スライダーを動かしても X 位置スライダーの値は変わらない', () => {
    // Arrange: 無関係のはずの回帰を検知する（4-8 段階1 D と同じ形）
    const store = createStore();
    const { parent } = mountPanel(store);
    const positionXBefore = sliderOf(parent, POSITION_X_ID).value;

    // Act
    const slider = sliderOf(parent, BEAM_WIDTH_ID);

    slider.value = '7';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    // Assert
    expect(sliderOf(parent, POSITION_X_ID).value).toBe(positionXBefore);
  });
});
