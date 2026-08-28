// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { renderWebGLFallback } from '../../src/ui/webglFallback';

/**
 * WebGL2 非対応時のフォールバックメッセージ（TASKS 5-3）の受け入れ条件。
 *
 * 対象: renderWebGLFallback(container) —— container の DOM 構造だけを組み立てる
 * 純粋な副作用関数。WebGL・three には一切触れない（CLAUDE.md「テスト方針」節：
 * DOM の構造・状態束縛は jsdom、実描画は CDP の仕事）。
 *
 * 段階1（今回）: 何もしないスタブ（src/ui/webglFallback.ts）に対して Red-first で
 * テストを書く。isWebGL2Available の配線・SceneManager 構築の try/catch・早期 return・
 * CDP 検証は段階2。
 *
 * 期待する文言・クラス名は SUT の出力からではなく、ここで独立にハードコードする。
 */

describe('5-3 段階1 A: 挿入と冪等性', () => {
  it('container にメッセージ要素が1つ挿入される', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    renderWebGLFallback(container);

    // Assert
    expect(container.querySelectorAll('#webgl-fallback')).toHaveLength(1);
  });

  it('複数回呼んでも要素は1つのまま（冪等）', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    renderWebGLFallback(container);
    renderWebGLFallback(container);
    renderWebGLFallback(container);

    // Assert
    expect(container.querySelectorAll('#webgl-fallback')).toHaveLength(1);
  });
});

describe('5-3 段階1 B: アクセシビリティ', () => {
  it('挿入された要素が role="alert" を持つ（スクリーンリーダ通知）', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    renderWebGLFallback(container);

    // Assert
    const element = container.querySelector('#webgl-fallback');
    expect(element?.getAttribute('role')).toBe('alert');
  });
});

describe('5-3 段階1 C: 文言（日本語・WebGL2・ブラウザ更新案内）', () => {
  it('WebGL2 という語を含む', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    renderWebGLFallback(container);

    // Assert
    expect(container.textContent).toContain('WebGL2');
  });

  it('Chrome を促す案内を含む', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    renderWebGLFallback(container);

    // Assert
    expect(container.textContent).toContain('Chrome');
  });

  it('ブラウザの更新・最新版への案内を含む', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    renderWebGLFallback(container);

    // Assert
    expect(container.textContent).toMatch(/更新|最新/);
  });

  it('本文が日本語（ひらがな・カタカナ・漢字のいずれか）を含む', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    renderWebGLFallback(container);

    // Assert
    expect(container.textContent).toMatch(/[぀-ヿ一-鿿]/);
  });
});

describe('5-3 段階1 D: テーマ整合クラス', () => {
  it('既存の .control-panel__warning と同じ配色言語のクラスを持つ', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    renderWebGLFallback(container);

    // Assert
    const element = container.querySelector('#webgl-fallback');
    expect(element?.classList.contains('control-panel__warning')).toBe(true);
  });
});

describe('5-3 段階1 E: WebGL・three に触れない', () => {
  it('canvas 要素を1つも生成しない', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    renderWebGLFallback(container);

    // Assert
    // ★注意（報告時に明記すること）：この関数は設計上 WebGL に一切触れないため、
    // スタブでも実装後でも常に真になる。段階1でも構造的に Red にならない例外
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
  });
});
