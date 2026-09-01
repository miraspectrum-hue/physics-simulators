// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import HelpModal from '../../src/ui/HelpModal';

/**
 * src/ui/HelpModal.ts の受け入れ条件（TASKS 4-9 段階1）。
 *
 * 対象:
 *   HelpModal(controlPanelElement) — トリガーボタンの生成とモーダルの開閉を持つ
 *
 * 何を守るためのテストか:
 *   4-9 裁定②③⑤の構造・a11y・フォーカス移動/復帰の束縛。
 *   - トリガーは新設ヘッダーではなく既存 control-panel 上部（タイトル直後）に置く
 *   - 開閉は表示専用のローカル UI 状態（store/URL/指紋のいずれにも属さない）
 *   - role="dialog" + aria-modal="true" + aria-labelledby、開閉に伴うフォーカス移動/復帰
 *
 * 段階1の制約:
 *   Tab トラップの実挙動・背景 inert・実際の表示（CDP 案件）はここでは扱わない
 *   （jsdom は Tab 移動を完全に再現しない）。ここで縛るのは構造・aria・
 *   フォーカス移動/復帰の束縛だけである。
 *
 *   `HelpModal` は段階1時点では完全に未配線（コンストラクタは何も生成せず、
 *   `open`/`close` はどちらも throw する未実装スタブ）。よって以下の期待はすべて
 *   段階2 の実装が無いと成立しない——**「トリガーボタンの配置」だけは構築時の
 *   話なので assertion 失敗として Red になり、`open`/`close` に依存するテストは
 *   例外送出として Red になる**（失敗の形は違うが、どちらも段階1時点で確実に Red）。
 *
 * 環境についての注記:
 *   jsdom（`ControlPanel.test.ts`/`svgRaster.test.ts`/`InteractionCtl.test.ts` に続く例）。
 */

/**
 * 実際の `ControlPanel` の骨格（タイトル h1 のみ）を模した親要素を作る。
 *
 * @returns 組み立てた擬似 control-panel 要素
 */
function mountControlPanelStub(): HTMLElement {
  const controlPanel = document.createElement('aside');

  controlPanel.className = 'control-panel';

  const heading = document.createElement('h1');

  heading.className = 'control-panel__title';
  heading.textContent = 'プリズム分光シミュレータ';
  controlPanel.appendChild(heading);

  document.body.appendChild(controlPanel);

  return controlPanel;
}

describe('4-9 段階1 B-1: トリガーボタンの配置', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('control-panel 上部（タイトル h1 の直後）に control-panel__button が1つ生成される', () => {
    // Arrange
    const controlPanel = mountControlPanelStub();
    const heading = controlPanel.querySelector('.control-panel__title');

    // Act
    new HelpModal(controlPanel);

    // Assert: 新設ヘッダーではなく、既存タイトルの直後（4-9 裁定②）
    const trigger = heading?.nextElementSibling;

    expect(trigger).not.toBeNull();
    expect(trigger?.classList.contains('control-panel__button')).toBe(true);
  });
});

describe('4-9 段階1 B-2: open() の構造/aria', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('open() 後、role="dialog" + aria-modal="true" + aria-labelledby を持つ要素が DOM に現れる', () => {
    // Arrange
    const controlPanel = mountControlPanelStub();
    const modal = new HelpModal(controlPanel);

    // Act
    modal.open();

    // Assert
    const dialog = document.querySelector('[role="dialog"]');

    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.hasAttribute('aria-labelledby')).toBe(true);
  });
});

describe('4-9 段階1 B-3: open() 後のフォーカス移動', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('open() 後、フォーカスがモーダル内（閉じるボタン等）へ移る', () => {
    // Arrange
    const controlPanel = mountControlPanelStub();
    const modal = new HelpModal(controlPanel);

    // Act
    modal.open();

    // Assert
    const dialog = document.querySelector('[role="dialog"]');

    expect(dialog?.contains(document.activeElement)).toBe(true);
  });
});

describe('4-9 段階1 B-4: close() 後のフォーカス復帰', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('close() でモーダルが除去/非表示になり、フォーカスがトリガーボタンへ復帰する', () => {
    // Arrange
    const controlPanel = mountControlPanelStub();
    const heading = controlPanel.querySelector('.control-panel__title');
    const modal = new HelpModal(controlPanel);

    modal.open();

    const trigger = heading?.nextElementSibling as HTMLElement | null | undefined;

    // Act
    modal.close();

    // Assert
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('4-9 段階1 B-5: ESC キーでの close', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('ESC キーで close() 相当の後始末が行われる（モーダル自身のハンドラ束縛）', () => {
    // Arrange
    const controlPanel = mountControlPanelStub();
    const modal = new HelpModal(controlPanel);
    const closeSpy = vi.spyOn(modal, 'close');

    modal.open();

    const dialog = document.querySelector('[role="dialog"]');

    // Act: モーダル自身が Escape を消費する（InteractionCtl の window keydown とは別経路）
    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true })
    );

    // Assert
    expect(closeSpy).toHaveBeenCalled();
  });
});
