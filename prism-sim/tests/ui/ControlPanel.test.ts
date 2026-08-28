// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import ControlPanel from '../../src/ui/ControlPanel';
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
