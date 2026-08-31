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
   * @param controlPanelElement トリガーボタンを差し込む先（`ControlPanel` のルート要素）。
   *   タイトル（`h1.control-panel__title`）の直後に置く（4-9 裁定②）。新設のヘッダーは
   *   作らない
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
 * 同一の表現を再利用する（新しい説明文を発明しない）。
 *
 * @returns 見出し・セクション群の並び
 */
function buildContent(): HTMLElement[] {
  const heading = document.createElement('h2');

  heading.id = TITLE_ID;
  heading.textContent = '操作ガイド';

  const keyboardSection = document.createElement('section');
  const keyboardHeading = document.createElement('h3');

  keyboardHeading.textContent = 'キーボード';

  const keyboardText = document.createElement('p');

  // ControlPanel.ts の既存ヒント文言と同一（TASKS 4-8）
  keyboardText.textContent = 'R: 回転ギズモ / G: 移動ギズモ / Esc: カメラ操作';
  keyboardSection.append(keyboardHeading, keyboardText);

  const mouseSection = document.createElement('section');
  const mouseHeading = document.createElement('h3');

  mouseHeading.textContent = 'マウス';

  const mouseText = document.createElement('p');

  mouseText.textContent = 'ドラッグでカメラを周回できます。';
  mouseSection.append(mouseHeading, mouseText);

  const slidersSection = document.createElement('section');
  const slidersHeading = document.createElement('h3');

  slidersHeading.textContent = 'スライダー';

  const list = document.createElement('dl');

  appendTerm(list, '入射角 θ₁', '光源がプリズムへ入射する角度です。');
  appendTerm(list, 'ビーム幅', '光線の表示上の太さです（見た目のみで、計算には影響しません）。');
  appendTerm(list, 'ガラスの種類', 'プリズムの材質を切り替えます。');
  // ControlPanel.ts の分散誇張ヒントと同一（正直さの一文。TASKS 4-9 裁定④）
  appendTerm(list, '分散の誇張', '×1 が実際の物理。上げるほど七色の広がりを強調します。');
  appendTerm(list, '距離', '射出光を映すスクリーンまでの距離です。');
  appendTerm(list, 'Z 軸回転 / X 位置 / Y 位置', 'プリズムの姿勢と位置です。');

  slidersSection.append(slidersHeading, list);

  return [heading, keyboardSection, mouseSection, slidersSection];
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
