// @vitest-environment jsdom
import { PerspectiveCamera, Scene } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import InteractionCtl from '../../src/scene/InteractionCtl';

/**
 * src/scene/InteractionCtl.ts の受け入れ条件のうち、入力サスペンドゲート（TASKS 4-9 段階1）。
 *
 * 対象:
 *   setInputSuspended(suspended) — キーボード切替（Escape/R/G）の window keydown を
 *                                  一時的に消費しないようにする
 *
 * 何を守るためのテストか:
 *   4-9 偵察で確定した ESC の二重支配問題——InteractionCtl はグローバル window keydown で
 *   Escape → setMode('camera') を無条件に捕捉するため、ヘルプモーダルが開いている間に
 *   Escape でモーダルを閉じようとすると、同時に InteractionCtl 側もカメラモードへ切り替わって
 *   しまう。ガードは isTypingTarget()（input/textarea/select/contentEditable のみ）で、
 *   モーダルの role="dialog" 要素はこれに該当しない。
 *
 *   裁定：所有権を明示的・排他的にする。isTypingTarget が「文字入力中は譲る」と
 *   言っているのと同じ考え方を「モーダルが開いている間も譲る」へ自然に拡張し、
 *   InteractionCtl 自身に入力サスペンドの門を 1 つ足す。
 *
 * 環境についての注記:
 *   **jsdom で走らせる**（ControlPanel.test.ts / svgRaster.test.ts に続く 3 例目）。
 *   扱うのは「window の keydown をどう消費するか」という DOM 束縛ロジックであり、
 *   実描画・実レイアウトには触れない（OrbitControls/TransformControls の構築は
 *   DOM へのイベント購読のみで、WebGL コンテキストを要求しない）。
 *
 * 段階1の制約:
 *   `setInputSuspended` は本体に追加済みだが `keyListener` はまだこれを参照しない
 *   （既定未配線）。よって「サスペンド時に setMode が呼ばれない」は現状 Red になる。
 *   「サスペンド無効（既定）では従来どおり呼ばれる」は既存の keyListener の実装が
 *   そのまま守っているので、ゲート追加前から成立している——段階2 でゲートを実配線した
 *   ときにこの経路を壊していないことを確かめる回帰テストとして機能する。
 */

/**
 * InteractionCtl を jsdom 上に構築する。
 *
 * @returns 構築したインスタンスと、後始末に使う domElement
 */
function mount(): { ctl: InteractionCtl; domElement: HTMLElement } {
  const domElement = document.createElement('div');

  document.body.appendChild(domElement);

  const camera = new PerspectiveCamera();
  const scene = new Scene();
  const ctl = new InteractionCtl(camera, domElement, scene);

  return { ctl, domElement };
}

/** window に Escape の keydown を実発火する。 */
function dispatchEscape(): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true })
  );
}

describe('4-9 段階1 A: 入力サスペンドゲート', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('サスペンド有効時、Escape を送っても setMode が呼ばれない', () => {
    // Arrange
    const { ctl, domElement } = mount();
    const setModeSpy = vi.spyOn(ctl, 'setMode');

    ctl.setInputSuspended(true);

    // Act
    dispatchEscape();

    // Assert
    expect(setModeSpy).not.toHaveBeenCalled();

    ctl.dispose();
    domElement.remove();
  });

  it('★回帰: サスペンド無効（既定）では従来どおり Escape で setMode(\'camera\') が呼ばれる', () => {
    // Arrange: setInputSuspended を一度も呼ばない＝既定状態
    const { ctl, domElement } = mount();
    const setModeSpy = vi.spyOn(ctl, 'setMode');

    // Act
    dispatchEscape();

    // Assert
    expect(setModeSpy).toHaveBeenCalledWith('camera');

    ctl.dispose();
    domElement.remove();
  });

  it('setInputSuspended(true) 直後は isInputSuspended が true を返す（検証用ゲッターの確認）', () => {
    // Arrange
    const { ctl, domElement } = mount();

    // Act
    ctl.setInputSuspended(true);

    // Assert
    expect(ctl.isInputSuspended).toBe(true);

    ctl.dispose();
    domElement.remove();
  });

  it('setInputSuspended(false) で isInputSuspended が false に戻る', () => {
    // Arrange
    const { ctl, domElement } = mount();

    ctl.setInputSuspended(true);

    // Act
    ctl.setInputSuspended(false);

    // Assert
    expect(ctl.isInputSuspended).toBe(false);

    ctl.dispose();
    domElement.remove();
  });
});
