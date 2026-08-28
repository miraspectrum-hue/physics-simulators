/** メッセージ要素の id。冪等判定にも使う。 */
const FALLBACK_ID = 'webgl-fallback';

/**
 * WebGL2 非対応時のフォールバックメッセージを構築し、container へ挿入する（TASKS 5-3）。
 *
 * DOM の構造・状態束縛のみを行う純粋な副作用関数。WebGL・three.js には一切触れない
 * （検出そのものは main.ts 側の呼び出し元の責務）。
 *
 * 無地画面の代わりになる表示なので、隅の極小要素ではなく画面中央に大きく置く
 * （レイアウトは `main.css` の `#webgl-fallback`）。配色は既存の `.control-panel__warning`
 * をそのまま再利用し、新しい配色を増やさない。
 *
 * @param container メッセージを挿入する要素。既に挿入済みなら何もしない（冪等）
 */
export function renderWebGLFallback(container: HTMLElement): void {
  if (container.querySelector(`#${FALLBACK_ID}`) !== null) {
    return;
  }

  const element = document.createElement('div');
  element.id = FALLBACK_ID;
  element.setAttribute('role', 'alert');
  element.className = 'control-panel__warning';

  const notice = document.createElement('p');
  notice.textContent =
    'このブラウザは WebGL2 に対応していないため、プリズム分光シミュレータを表示できません。';

  const guidance = document.createElement('p');
  guidance.textContent =
    'Chrome の最新版をお使いのうえ、ブラウザの設定でハードウェアアクセラレーションが' +
    '有効になっているかをご確認ください。';

  element.append(notice, guidance);
  container.append(element);
}
