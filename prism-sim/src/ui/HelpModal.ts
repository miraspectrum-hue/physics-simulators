import {
  mdiKeyboardOutline,
  mdiMonitor,
  mdiMouseOutline,
  mdiPaletteOutline,
  mdiTriangleOutline,
} from '@mdi/js';

import { createMdiIcon } from './icon';

/** モーダル本体（`role="dialog"`）の id。`aria-labelledby` の参照先を確立するのにも使う。 */
const DIALOG_ID = 'help-modal';

/** モーダルの見出しの id。`aria-labelledby` はここを指す。 */
const TITLE_ID = 'help-modal-title';

/**
 * フォーカス可能要素を拾うセレクタ。
 *
 * モーダル内は素朴な `button` しか置かないが、将来リンク等が増えても
 * トラップが機能し続けるよう一般的な集合にしておく。
 */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * ヘルプ（操作説明）モーダル（TASKS 4-9）。
 *
 * 表示専用のローカル UI 状態。store にも `ShareableState` にも属さない
 * （4-9 偵察で確定：開閉は `sourceAngleNotice`（`ControlPanel.ts`）と同種の
 * ローカル一時状態だが、条件で自動的に開閉するあちらと違い、人がボタンで開閉する）。
 * `?help=1` のような URL 共有キーは作らない。指紋・URL・store のいずれにも一切触れない。
 *
 * 開いている間、`Escape` の唯一の所有者はこのモーダル自身である
 * （4-9 裁定①）。`InteractionCtl.setInputSuspended` との一対一結線は呼び出し側
 * （`main.ts`）の責務——`onOpen`/`onClose` で外へ知らせるだけで、ここでは
 * `InteractionCtl` を一切知らない（`glowEnabled`/`numbersVisible` が `sceneManager`/
 * `overlay` を main.ts 側で結線するのと同じ分離）。
 *
 * 内容は操作ガイドに限定する（4-9 裁定④）。物理モデルの散文（Cauchy の分散式・
 * 最小偏角の理屈等）は書かない——それは 5-6 README の領分であり、ここに書くと
 * 二重管理になる。
 */
export default class HelpModal {
  /** トリガーボタン（`control-panel` 上部、タイトル直後）。 */
  private readonly triggerButton: HTMLButtonElement;

  /** 開いている間だけ存在するモーダル本体。閉じている間は null。 */
  private dialog: HTMLElement | null = null;

  /** 開いている間だけ存在する背景の半透明幕。 */
  private backdrop: HTMLElement | null = null;

  /**
   * 開いている間 `inert` にしている背景要素（TASKS 4-9）。`document.body` の
   * 直接の子から自分（backdrop）以外を全て——`#app`（canvas・情報バー）も
   * `.control-panel` も、個別に名指しせず一括で扱う。
   */
  private inertedSiblings: HTMLElement[] = [];

  /** 開いている間だけ `window` へ付ける keydown リスナ（Esc 閉じ・Tab トラップ）。 */
  private keydownListener: ((event: KeyboardEvent) => void) | null = null;

  /** 開いたときに呼ぶ購読者。 */
  private readonly openSubscribers: Array<() => void> = [];

  /** 閉じたときに呼ぶ購読者。 */
  private readonly closeSubscribers: Array<() => void> = [];

  /**
   * トリガーボタンの DOM 要素（TASKS 7-1）。
   *
   * `main.ts` がビューポート右上へ `appendChild` するために公開する。要素そのものは
   * このクラスが生成・保持し続けており、開閉ロジックやフォーカス復帰先は移動しても変わらない。
   */
  get triggerButtonElement(): HTMLButtonElement {
    return this.triggerButton;
  }

  /**
   * @param controlPanelElement トリガーボタンを差し込む先（`ControlPanel` のルート要素）。
   *   タイトル（`h1.control-panel__title`）の直後に置く（4-9 裁定②）。新設のヘッダーは
   *   作らない。**構築直後の仮の置き場所であり、実運用では `main.ts` が
   *   `triggerButtonElement` 経由で取り出しビューポート右上へ `appendChild`（＝再配置）する**
   *   （TASKS 7-1）。`appendChild` は既存ノードを移動させるだけなので、挿入ロジック自体
   *   （タイトル直後）は変えていない
   */
  constructor(controlPanelElement: HTMLElement) {
    this.triggerButton = document.createElement('button');
    this.triggerButton.type = 'button';
    this.triggerButton.id = 'help-trigger';
    this.triggerButton.className = 'control-panel__button';
    this.triggerButton.textContent = '？ ヘルプ';
    this.triggerButton.addEventListener('click', () => this.open());

    const heading = controlPanelElement.querySelector('.control-panel__title');
    const insertBeforeNode = heading?.nextSibling ?? null;

    controlPanelElement.insertBefore(this.triggerButton, insertBeforeNode);
  }

  /**
   * 開いたときの購読者を登録する（`main.ts` から `InteractionCtl.setInputSuspended(true)`
   * や背景の `inert` 化を結ぶために使う。TASKS 4-9）。
   */
  onOpen(subscriber: () => void): void {
    this.openSubscribers.push(subscriber);
  }

  /** 閉じたときの購読者を登録する（`setInputSuspended(false)` 等を結ぶために使う）。 */
  onClose(subscriber: () => void): void {
    this.closeSubscribers.push(subscriber);
  }

  /**
   * モーダルを開く。
   *
   * 冪等——既に開いていれば何もしない（二重に `keydown` リスナが付くのを防ぐ）。
   */
  open(): void {
    if (this.dialog !== null) {
      return;
    }

    const backdrop = document.createElement('div');

    backdrop.className = 'help-modal-backdrop';

    const dialog = document.createElement('div');

    dialog.id = DIALOG_ID;
    dialog.className = 'help-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', TITLE_ID);

    dialog.append(...buildContent());

    const closeButton = document.createElement('button');

    closeButton.type = 'button';
    closeButton.id = 'help-close';
    closeButton.className = 'control-panel__button';
    closeButton.textContent = '閉じる';
    closeButton.addEventListener('click', () => this.close());
    dialog.appendChild(closeButton);

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    this.dialog = dialog;
    this.backdrop = backdrop;

    // 背景を inert に（TASKS 4-9）。backdrop 自身は除く。個別の要素を名指ししないので、
    // #app（canvas・情報バー）にも .control-panel にも新しい兄弟が増えても追随する
    this.inertedSiblings = Array.from(document.body.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child !== backdrop
    );

    for (const sibling of this.inertedSiblings) {
      sibling.inert = true;
    }

    this.keydownListener = (event: KeyboardEvent): void => {
      if (event.code === 'Escape') {
        event.preventDefault();
        this.close();

        return;
      }

      if (event.code === 'Tab') {
        this.trapFocus(event);
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    closeButton.focus();

    for (const subscriber of this.openSubscribers) {
      subscriber();
    }
  }

  /**
   * モーダルを閉じる。
   *
   * 冪等——開いていなければ何もしない。フォーカスをトリガーボタンへ復帰させる。
   */
  close(): void {
    if (this.dialog === null || this.backdrop === null) {
      return;
    }

    if (this.keydownListener !== null) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }

    this.backdrop.remove();
    this.dialog = null;
    this.backdrop = null;

    for (const sibling of this.inertedSiblings) {
      sibling.inert = false;
    }
    this.inertedSiblings = [];

    this.triggerButton.focus();

    for (const subscriber of this.closeSubscribers) {
      subscriber();
    }
  }

  /**
   * Tab / Shift+Tab をモーダル内で循環させる（TASKS 4-9）。
   *
   * 最初の要素で Shift+Tab → 最後へ、最後の要素で Tab → 最初へ。
   * それ以外は既定の Tab 移動に任せる（モーダル内で完結するのでフォーカスは出ない）。
   *
   * @param event Tab キーの keydown イベント
   */
  private trapFocus(event: KeyboardEvent): void {
    const focusable = this.focusableElements();

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }

      return;
    }

    if (document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  /** モーダル内のフォーカス可能要素を、DOM 順のまま返す。 */
  private focusableElements(): HTMLElement[] {
    if (this.dialog === null) {
      return [];
    }

    return Array.from(this.dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }
}

/**
 * モーダル本文を組み立てる（TASKS 4-9 裁定④）。
 *
 * **操作ガイドに限定する。** 物理モデルの散文は書かない（5-6 README の領分）。
 * キーボード操作の文言と分散誇張の一文は、`ControlPanel.ts` の既存ヒント文言と
 * 同一の語句を再利用する（新しい説明文を発明しない。TASKS 7-14 で `<kbd>` タグを
 * 足したのは装飾のみで、単語そのものは変えていない）。
 *
 * **カテゴリは2列レイアウトで並べる**（TASKS 7-13）。`h3`（カテゴリ名。左列）と
 * `p`/`dl`（中身。右列）が `.help-modal__group`（`main.css` 側、`display: grid`）の
 * 直接の子になっていれば自動でその2列に収まる——`createGroup()` へ `className` と
 * 2つの子を渡すだけで、実際の並び方は CSS 側の責務にとどめる。
 *
 * **旧「スライダー」1カテゴリを、右サイドバーの3見出しに合わせて分割した**
 * （TASKS 7-14）。「光路／表現／スクリーン」という区切りは `ControlPanel.ts` の
 * セクション見出しと一字一句同じ——ガイドとサイドバーの対応が一目でわかることを
 * 優先し、ここで独自の分類名を作らない。
 *
 * @returns 見出し・セクション群の並び
 */
function buildContent(): HTMLElement[] {
  const heading = document.createElement('h2');

  heading.id = TITLE_ID;
  heading.textContent = '操作ガイド';

  const keyboardGroup = createGroup(mdiKeyboardOutline, 'キーボード', buildKeyboardBody());
  const mouseGroup = createGroup(mdiMouseOutline, 'マウス', buildMouseBody());

  // 並びは右サイドバーの現在の並び順に合わせる（TASKS 7-12・7-14）。
  // アイコンも ControlPanel.ts の同名セクション見出しと同じものを使う（TASKS 7-15）
  const pathGroup = createGroup(
    mdiTriangleOutline,
    '光路',
    buildTermsList([
      ['ガラスの種類', 'プリズムの材質を切り替えます。'],
      ['入射角 θ₁', '光源がプリズムへ入射する角度です。'],
      ['Z 軸回転 / X 位置 / Y 位置', 'プリズムの姿勢と位置です。'],
    ])
  );
  const expressionGroup = createGroup(
    mdiPaletteOutline,
    '表現',
    buildTermsList([
      ['ビーム幅', '光線の表示上の太さです（見た目のみで、計算には影響しません）。'],
      // ControlPanel.ts の分散誇張ヒントと同一（正直さの一文。TASKS 4-9 裁定④）
      ['分散の誇張', '×1 が実際の物理。上げるほど七色の広がりを強調します。'],
    ])
  );
  const screenGroup = createGroup(
    mdiMonitor,
    'スクリーン',
    buildTermsList([['距離', '射出光を映すスクリーンまでの距離です。']])
  );

  return [heading, keyboardGroup, mouseGroup, pathGroup, expressionGroup, screenGroup];
}

/**
 * カテゴリ1つぶんの `<section>` を組み立てる（TASKS 7-13・7-15）。
 *
 * @param iconPath `@mdi/js` から import した MDI のパスデータ。読み上げには乗せない
 * @param label カテゴリ名（左列）
 * @param body 中身（右列）。`p` か `dl`
 * @returns 組み立てた `<section class="help-modal__group">`
 */
function createGroup(iconPath: string, label: string, body: HTMLElement): HTMLElement {
  const section = document.createElement('section');

  section.className = 'help-modal__group';

  const heading = document.createElement('h3');

  heading.className = 'help-modal__group-title';
  // createMdiIcon が aria-hidden 付きの <svg> を返すので、カテゴリ名は
  // 後続のテキストノードだけが読み上げられる（二重に読まれないように）
  heading.append(createMdiIcon(iconPath), document.createTextNode(label));

  body.classList.add('help-modal__group-body');
  section.append(heading, body);

  return section;
}

/**
 * キーボード節の中身を組み立てる（TASKS 7-14）。
 *
 * `ControlPanel.ts` の既存ヒント文言（`R: 回転ギズモ / G: 移動ギズモ / Esc: カメラ操作`）と
 * 同じ語句を使うが、キー名だけ `<kbd>` で囲んで説明文と視覚的に区切る。
 *
 * @returns 組み立てた `<p>`
 */
function buildKeyboardBody(): HTMLParagraphElement {
  const paragraph = document.createElement('p');

  appendKey(paragraph, 'R');
  paragraph.append(' 回転ギズモ　/　');
  appendKey(paragraph, 'G');
  paragraph.append(' 移動ギズモ　/　');
  appendKey(paragraph, 'Esc');
  paragraph.append(' カメラ操作');

  return paragraph;
}

/**
 * `<kbd>` を1つ足す。
 *
 * @param paragraph 差し込み先
 * @param key キー名（例 `R`、`Esc`）
 */
function appendKey(paragraph: HTMLElement, key: string): void {
  const kbd = document.createElement('kbd');

  kbd.textContent = key;
  paragraph.appendChild(kbd);
}

/** マウス節の中身を組み立てる。 */
function buildMouseBody(): HTMLParagraphElement {
  const paragraph = document.createElement('p');

  paragraph.textContent = 'ドラッグでカメラを周回できます。';

  return paragraph;
}

/**
 * 項目名・説明の組から `<dl>` を組み立てる（TASKS 7-14）。
 *
 * @param terms `[項目名, 説明]` の並び
 * @returns 組み立てた `<dl class="help-modal__terms">`
 */
function buildTermsList(terms: ReadonlyArray<readonly [string, string]>): HTMLDListElement {
  const list = document.createElement('dl');

  list.className = 'help-modal__terms';

  for (const [term, description] of terms) {
    appendTerm(list, term, description);
  }

  return list;
}

/**
 * `<dl>` へ 1 組の見出し・説明を足す。
 *
 * @param list 差し込み先の `<dl>`
 * @param term 見出し
 * @param description 説明
 */
function appendTerm(list: HTMLElement, term: string, description: string): void {
  const dt = document.createElement('dt');

  dt.textContent = term;

  const dd = document.createElement('dd');

  dd.textContent = description;

  list.append(dt, dd);
}
