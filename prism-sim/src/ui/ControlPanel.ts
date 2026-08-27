import { ALL_MATERIALS } from '../optics/constants';
import type { MaterialName, MinimumDeviation, SpectrumMode } from '../types/optics';

import { minimumDeviationOf } from './materialOptics';
import {
  EXAGGERATION_MAX,
  EXAGGERATION_MIN,
  SCREEN_DISTANCE_MAX,
  SCREEN_DISTANCE_MIN,
  SOURCE_ANGLE_MAX_DEG,
  SOURCE_ANGLE_MIN_DEG,
  type AppState,
  type Store,
} from './store';

/** 値が定まらないときの表示。情報バー（`InfoOverlay`）と同じ記号を使う。 */
const UNAVAILABLE = '—';

/** 姿勢スライダーの下限・上限 [deg]。Euler の Z が取りうる範囲に合わせる。 */
const ROTATION_MIN_DEG = -180;
const ROTATION_MAX_DEG = 180;

/**
 * 頂角 60° で直接透過が起きない材質の警告文（TASKS 4-2b）。
 *
 * ダイヤモンドは臨界角 24.4° が小さすぎ、第 2 面の内部入射角（60°−θᵣ ≥ 35.6°）が
 * 常にこれを超えるため必ず全反射する。バグではなく物理的に正しい挙動である
 * （SPEC.md「ダイヤの全反射」）。
 */
const NO_DISPERSION_WARNING =
  '臨界角が小さく、この頂角（60°）では直接透過せず七色が出ません（全反射のデモ）。';

/**
 * 「最小偏角に合わせる」を無効にした理由（TASKS 6-2）。
 *
 * 出る条件は `NO_DISPERSION_WARNING` とまったく同じ（`isNoDispersionMaterial` が唯一の判定元）
 * だが、同じ画面に同じ全文を 2 度並べない。**なぜ透過しないのか**は材質セクションの全文が
 * 説明しており、ここで要るのは**なぜこのボタンが押せないのか**だけである。
 */
const NO_MINIMUM_DEVIATION_REASON = 'この材質では直接透過しないため無効です。';

/**
 * 一時表示（`showSourceAngleNotice`）を掲げておく時間 [ms]。
 *
 * 押した瞬間にしか出さないので、**毎フレーム出し直して点滅させない**。時間で自然に消し、
 * 押し直せば掲出し直す。状態が変わっても消さないのは、消えた理由が
 * 「時間切れ」か「状況が変わった」かを読み手が区別できないため。
 */
const NOTICE_DURATION_MS = 6000;

/** 共有セクションの平常時の案内。コピーの結果を出したあとはここへ戻る。 */
const SHARE_STATUS_IDLE = 'アドレスバーの URL には今の状態が入っています。';

/**
 * スペクトル表示モードの選択肢（TASKS 4-3）。
 *
 * 並びは SPEC.md の画面構成モックどおり「連続 → 7 色」。`Array<{ mode: SpectrumMode }>`
 * ではなく `SpectrumMode` を明示した組にしてあるので、モードを足したときに
 * ここへの追記を忘れると選べない選択肢が生まれる（型では捕まらないため、
 * 網羅は `SPECTRUM_MODE_CODES` 側の `Record` が受け持つ）。
 */
const SPECTRUM_MODE_OPTIONS: ReadonlyArray<{
  readonly mode: SpectrumMode;
  readonly label: string;
  readonly id: string;
}> = [
  { mode: 'continuous', label: '連続 48 波長', id: 'spectrum-continuous' },
  { mode: 'sevenColor', label: '7 色', id: 'spectrum-seven' },
];

/**
 * 右側の操作パネル（SPEC.md「画面構成」）。
 *
 * store とだけ結び、three にもレンダラにも触れない。UI からの入力は store へ、
 * store の変化は表示へ、という一方向の往復に閉じる。
 *
 * **プリズムの姿勢だけは store を経由しない。** 姿勢の単一の真実は `matrixWorld` であり、
 * 姿勢スライダーはギズモと並ぶ「もう一つのビュー」にすぎない。パネルは three を知らないので、
 * 実際の読み書きは `onRotationInput` / `setRotationDeg` を通じて配線側に委ねる。
 *
 * 計算結果の数値表示は持たない。そちらは `InfoOverlay`（情報バー）の責務。
 */
export default class ControlPanel {
  /** パネルのルート要素。 */
  readonly element: HTMLElement;

  private readonly angleSlider: HTMLInputElement;
  private readonly angleValue: HTMLElement;
  private readonly minimumValue: HTMLElement;
  private readonly minimumButton: HTMLButtonElement;
  private readonly minimumWarning: HTMLElement;
  private readonly sourceAngleNotice: HTMLElement;
  private readonly rotationSlider: HTMLInputElement;
  private readonly rotationValue: HTMLElement;
  private readonly materialSelect: HTMLSelectElement;
  private readonly materialWarning: HTMLElement;
  private readonly exaggerationSlider: HTMLInputElement;
  private readonly exaggerationValue: HTMLElement;
  private readonly screenDistanceSlider: HTMLInputElement;
  private readonly screenDistanceValue: HTMLElement;
  private readonly sectionToggle: HTMLButtonElement;
  private readonly shareStatus: HTMLElement;

  /** 姿勢スライダーが動かされたときに呼ぶ購読者。 */
  private readonly rotationSubscribers: Array<(angleDeg: number) => void> = [];

  /** リセットが押されたときに呼ぶ購読者。 */
  private readonly resetSubscribers: Array<() => void> = [];

  /** 「光路に合わせる」が押されたときに呼ぶ購読者。 */
  private readonly focusScreenSubscribers: Array<() => void> = [];

  /** 「最小偏角に合わせる」が押されたときに呼ぶ購読者。 */
  private readonly applyMinimumSubscribers: Array<() => void> = [];

  /** 入射角スライダーが**人の手で**動かされたときに呼ぶ購読者。 */
  private readonly sourceAngleSubscribers: Array<() => void> = [];

  /** 断面図トグルが押されたときに呼ぶ購読者。 */
  private readonly sectionToggleSubscribers: Array<(visible: boolean) => void> = [];

  /** 「URL をコピー」が押されたときに呼ぶ購読者。 */
  private readonly copyShareUrlSubscribers: Array<() => void> = [];

  /** 「PNG を保存」が押されたときの購読者。 */
  private readonly savePngSubscribers: Array<() => void> = [];

  /** 共有の結果表示を消すためのタイマー。掲出中でなければ undefined。 */
  /**
   * スペクトル表示モードのラジオ。`value` は `SpectrumMode` の文字列。
   *
   * ネイティブの `input[type=radio]` を同じ `name` で束ねる。矢印キーでの移動も
   * ロービング tabindex も読み上げの「2 個中 1 個」も**ブラウザが持っている**ので、
   * `role="radio"` を手で組んで再実装しない（自前の実装はキーボード操作を落としやすい）。
   */
  private readonly spectrumRadios: readonly HTMLInputElement[];

  private shareStatusTimer: number | undefined;

  /** 一時表示を消すためのタイマー。掲出中でなければ undefined。 */
  private noticeTimer: number | undefined;

  /**
   * @param parent パネルを差し込む親要素
   * @param store 状態の保持先
   */
  constructor(parent: HTMLElement, store: Store) {
    this.element = document.createElement('aside');
    this.element.className = 'control-panel';

    const heading = document.createElement('h1');
    heading.className = 'control-panel__title';
    heading.textContent = 'プリズム分光シミュレータ';
    this.element.appendChild(heading);

    const section = document.createElement('section');
    section.className = 'control-panel__section';

    const legend = document.createElement('h2');
    legend.className = 'control-panel__legend';
    legend.textContent = '光源';
    section.appendChild(legend);

    const label = document.createElement('label');
    label.className = 'control-panel__row';
    label.htmlFor = 'source-angle';

    const labelText = document.createElement('span');
    labelText.textContent = '入射角 θ₁';

    this.angleValue = document.createElement('span');
    this.angleValue.className = 'control-panel__value';

    label.append(labelText, this.angleValue);

    this.angleSlider = document.createElement('input');
    this.angleSlider.type = 'range';
    this.angleSlider.id = 'source-angle';
    this.angleSlider.className = 'control-panel__slider';
    this.angleSlider.min = String(SOURCE_ANGLE_MIN_DEG);
    this.angleSlider.max = String(SOURCE_ANGLE_MAX_DEG);
    this.angleSlider.step = '0.1';

    this.angleSlider.addEventListener('input', () => {
      // 先に知らせてから書く。進行中のアニメーションを取り消す購読者が、
      // ユーザーの入れた値より後に走って上書きすることがないようにする
      for (const subscriber of this.sourceAngleSubscribers) {
        subscriber();
      }

      store.update({ sourceAngleDeg: Number(this.angleSlider.value) });
    });

    const angleHint = document.createElement('p');
    angleHint.className = 'control-panel__hint';
    angleHint.textContent =
      'スライダーは「既定姿勢での入射角」です。プリズムを回すと実測 θ₁（下の情報バー）と乖離します。';

    // 最小偏角（TASKS 6-2）。目標を先に読ませ、その下のボタンで合わせる、という順に並べる。
    // δ_min は 6 項目の情報バーには入れない。目標値は操作の直前に見えているのが自然で、
    // 結果（実測 θ₁・偏角 δ）を情報バーで確かめる、という流れになる（案 b）
    const minimumReadout = document.createElement('p');
    minimumReadout.className = 'control-panel__readout';

    const minimumLabel = document.createElement('span');
    minimumLabel.textContent = '最小偏角 δ_min';

    this.minimumValue = document.createElement('span');
    this.minimumValue.className = 'control-panel__value';

    minimumReadout.append(minimumLabel, this.minimumValue);

    this.minimumButton = document.createElement('button');
    this.minimumButton.type = 'button';
    this.minimumButton.className = 'control-panel__button';
    this.minimumButton.textContent = '最小偏角に合わせる';
    this.minimumButton.addEventListener('click', () => {
      for (const subscriber of this.applyMinimumSubscribers) {
        subscriber();
      }
    });

    // ボタンを無効にした理由。押せない場所のすぐ下に短く置く
    this.minimumWarning = document.createElement('p');
    this.minimumWarning.className = 'control-panel__warning';
    this.minimumWarning.hidden = true;
    this.minimumWarning.textContent = NO_MINIMUM_DEVIATION_REASON;

    // 押した瞬間にだけ出る案内（スライダーの可動域を外れたとき）。
    // aria-live で読み上げにも届かせる（4-7 の方針）
    this.sourceAngleNotice = document.createElement('p');
    this.sourceAngleNotice.className = 'control-panel__warning';
    this.sourceAngleNotice.hidden = true;
    this.sourceAngleNotice.setAttribute('aria-live', 'polite');

    section.append(
      label,
      this.angleSlider,
      angleHint,
      minimumReadout,
      this.minimumButton,
      this.minimumWarning,
      this.sourceAngleNotice
    );
    this.element.appendChild(section);

    // 材質セクション（4-2）。選択肢は ALL_MATERIALS から生やすので追記漏れが起きない
    const materialSection = document.createElement('section');
    materialSection.className = 'control-panel__section';

    const materialLegend = document.createElement('h2');
    materialLegend.className = 'control-panel__legend';
    materialLegend.textContent = '材質';
    materialSection.appendChild(materialLegend);

    const materialLabel = document.createElement('label');
    materialLabel.className = 'control-panel__row';
    materialLabel.htmlFor = 'material';
    materialLabel.textContent = 'ガラスの種類';

    this.materialSelect = document.createElement('select');
    this.materialSelect.id = 'material';
    this.materialSelect.className = 'control-panel__select';

    for (const material of ALL_MATERIALS) {
      const option = document.createElement('option');
      option.value = material.name;
      option.textContent = `${material.name}（n_d = ${material.catalogNd.toFixed(3)}）`;
      this.materialSelect.appendChild(option);
    }

    this.materialSelect.addEventListener('change', () => {
      store.update({ material: toMaterialName(this.materialSelect.value) });
    });

    this.materialWarning = document.createElement('p');
    this.materialWarning.className = 'control-panel__warning';
    this.materialWarning.hidden = true;
    this.materialWarning.textContent = NO_DISPERSION_WARNING;

    materialSection.append(materialLabel, this.materialSelect, this.materialWarning);

    // 分散誇張（4-4）。m=1 が実物理で、上げるほど教育用に分離を強調する
    const exaggerationLabel = document.createElement('label');
    exaggerationLabel.className = 'control-panel__row';
    exaggerationLabel.htmlFor = 'exaggeration';

    const exaggerationText = document.createElement('span');
    exaggerationText.textContent = '分散の誇張';

    this.exaggerationValue = document.createElement('span');
    this.exaggerationValue.className = 'control-panel__value';

    exaggerationLabel.append(exaggerationText, this.exaggerationValue);

    this.exaggerationSlider = document.createElement('input');
    this.exaggerationSlider.type = 'range';
    this.exaggerationSlider.id = 'exaggeration';
    this.exaggerationSlider.className = 'control-panel__slider';
    this.exaggerationSlider.min = String(EXAGGERATION_MIN);
    this.exaggerationSlider.max = String(EXAGGERATION_MAX);
    this.exaggerationSlider.step = '1';

    this.exaggerationSlider.addEventListener('input', () => {
      store.update({ exaggeration: Number(this.exaggerationSlider.value) });
    });

    const exaggerationHint = document.createElement('p');
    exaggerationHint.className = 'control-panel__hint';
    exaggerationHint.textContent = '×1 が実際の物理。上げるほど七色の広がりを強調します。';

    materialSection.append(exaggerationLabel, this.exaggerationSlider, exaggerationHint);
    this.element.appendChild(materialSection);

    // スクリーンのセクション（TASKS 6-3）。距離は凍結アンカー上を滑るだけで、
    // 向きはボタンを押したときにしか変わらない（案 C）
    const screenSection = document.createElement('section');
    screenSection.className = 'control-panel__section';

    const screenLegend = document.createElement('h2');
    screenLegend.className = 'control-panel__legend';
    screenLegend.textContent = 'スクリーン';
    screenSection.appendChild(screenLegend);

    const distanceLabel = document.createElement('label');
    distanceLabel.className = 'control-panel__row';
    distanceLabel.htmlFor = 'screen-distance';

    const distanceText = document.createElement('span');
    distanceText.textContent = '距離';

    this.screenDistanceValue = document.createElement('span');
    this.screenDistanceValue.className = 'control-panel__value';

    distanceLabel.append(distanceText, this.screenDistanceValue);

    this.screenDistanceSlider = document.createElement('input');
    this.screenDistanceSlider.type = 'range';
    this.screenDistanceSlider.id = 'screen-distance';
    this.screenDistanceSlider.className = 'control-panel__slider';
    this.screenDistanceSlider.min = String(SCREEN_DISTANCE_MIN);
    this.screenDistanceSlider.max = String(SCREEN_DISTANCE_MAX);
    this.screenDistanceSlider.step = '0.5';

    this.screenDistanceSlider.addEventListener('input', () => {
      store.update({ screenDistance: Number(this.screenDistanceSlider.value) });
    });

    const focusButton = document.createElement('button');
    focusButton.type = 'button';
    focusButton.className = 'control-panel__button';
    focusButton.textContent = '光路に合わせる';
    focusButton.addEventListener('click', () => {
      for (const subscriber of this.focusScreenSubscribers) {
        subscriber();
      }
    });

    const screenHint = document.createElement('p');
    screenHint.className = 'control-panel__hint';
    screenHint.textContent =
      'スクリーンは置いた位置に留まります。材質を変えて光が外れたら、ボタンで捕まえ直します。';

    screenSection.append(distanceLabel, this.screenDistanceSlider, screenHint, focusButton);
    this.element.appendChild(screenSection);

    // 表示セクション（SPEC.md「画面構成」の 表示）。ユーザーから見て「見せ方の選択」に
    // あたるものを置く。
    //
    // **ただし内部での性質は一様ではない。** 断面図トグルは本当に描画だけの切り替えで、
    // 光路の計算に一切影響しないので store を通さず `aria-pressed` が状態を持てる。
    // 対してスペクトル表示モードは `traceSpectrum` に渡す波長列そのものを変える＝
    // **計算の入力**なので、store の第 5 項目として持ち、`subscribe` → `markDirty` →
    // 再追跡の一方向に乗せている（TASKS 4-3 の裁定③）。
    const viewSection = document.createElement('section');
    viewSection.className = 'control-panel__section';

    const viewLegend = document.createElement('h2');
    viewLegend.className = 'control-panel__legend';
    viewLegend.textContent = '表示';
    viewSection.appendChild(viewLegend);

    // スペクトル表示モード（TASKS 4-3）。パネルで唯一のラジオなので、
    // `fieldset` + `legend` で群を明示したうえで `role="radiogroup"` も添える
    const spectrumGroup = document.createElement('fieldset');
    spectrumGroup.className = 'control-panel__radiogroup';
    spectrumGroup.setAttribute('role', 'radiogroup');

    const spectrumLegend = document.createElement('legend');
    spectrumLegend.className = 'control-panel__radiolegend';
    spectrumLegend.textContent = 'スペクトル';
    spectrumGroup.appendChild(spectrumLegend);

    this.spectrumRadios = SPECTRUM_MODE_OPTIONS.map(({ mode, label, id }) => {
      const option = document.createElement('label');
      option.className = 'control-panel__radio';
      option.htmlFor = id;

      const input = document.createElement('input');
      input.type = 'radio';
      input.id = id;
      input.name = 'spectrum-mode';
      input.value = mode;
      input.className = 'control-panel__radioinput';
      input.addEventListener('change', () => {
        if (input.checked) {
          store.update({ spectrumMode: mode });
        }
      });

      const text = document.createElement('span');
      text.textContent = label;

      option.append(input, text);
      spectrumGroup.appendChild(option);

      return input;
    });

    const spectrumHint = document.createElement('p');
    spectrumHint.className = 'control-panel__hint';
    spectrumHint.textContent =
      '7 色は代表 7 波長だけを追跡します。見せ方の選択ですが、光路は選んだ波長で計算し直します。';

    viewSection.append(spectrumGroup, spectrumHint);

    // トグルボタン。押されている状態は aria-pressed が持ち、見た目はそれに従う
    // （状態を色だけで伝えると読み上げに届かない）
    this.sectionToggle = document.createElement('button');
    this.sectionToggle.type = 'button';
    this.sectionToggle.className = 'control-panel__button';
    this.sectionToggle.textContent = '断面図';
    this.sectionToggle.setAttribute('aria-pressed', 'false');
    this.sectionToggle.addEventListener('click', () => {
      const next = this.sectionToggle.getAttribute('aria-pressed') !== 'true';

      this.sectionToggle.setAttribute('aria-pressed', String(next));

      for (const subscriber of this.sectionToggleSubscribers) {
        subscriber(next);
      }
    });

    const viewHint = document.createElement('p');
    viewHint.className = 'control-panel__hint';
    viewHint.textContent =
      '主断面を真横から見た図を左上に重ねます。プリズムを回しても図の向きは変わりません。';

    viewSection.append(this.sectionToggle, viewHint);
    this.element.appendChild(viewSection);

    // 姿勢セクション。ギズモと同じ 1 自由度（Z 軸まわり）を扱う
    const poseSection = document.createElement('section');
    poseSection.className = 'control-panel__section';

    const poseLegend = document.createElement('h2');
    poseLegend.className = 'control-panel__legend';
    poseLegend.textContent = 'プリズム';
    poseSection.appendChild(poseLegend);

    const poseLabel = document.createElement('label');
    poseLabel.className = 'control-panel__row';
    poseLabel.htmlFor = 'prism-rotation';

    const poseLabelText = document.createElement('span');
    poseLabelText.textContent = 'Z 軸回転';

    this.rotationValue = document.createElement('span');
    this.rotationValue.className = 'control-panel__value';

    poseLabel.append(poseLabelText, this.rotationValue);

    this.rotationSlider = document.createElement('input');
    this.rotationSlider.type = 'range';
    this.rotationSlider.id = 'prism-rotation';
    this.rotationSlider.className = 'control-panel__slider';
    this.rotationSlider.min = String(ROTATION_MIN_DEG);
    this.rotationSlider.max = String(ROTATION_MAX_DEG);
    this.rotationSlider.step = '0.5';

    this.rotationSlider.addEventListener('input', () => {
      const angleDeg = Number(this.rotationSlider.value);
      this.rotationValue.textContent = `${angleDeg.toFixed(1)}°`;

      for (const subscriber of this.rotationSubscribers) {
        subscriber(angleDeg);
      }
    });

    poseSection.append(poseLabel, this.rotationSlider);

    const hint = document.createElement('p');
    hint.className = 'control-panel__hint';
    hint.textContent = 'R: 回転ギズモ / G: 移動ギズモ / Esc: カメラ操作';
    poseSection.appendChild(hint);

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'control-panel__button';
    resetButton.textContent = '初期状態に戻す';
    resetButton.addEventListener('click', () => {
      for (const subscriber of this.resetSubscribers) {
        subscriber();
      }
    });
    poseSection.appendChild(resetButton);

    this.element.appendChild(poseSection);

    // 共有セクション（TASKS 6-6 段階4）。今の状態を映した URL をクリップボードへ渡す
    const shareSection = document.createElement('section');
    shareSection.className = 'control-panel__section';

    const shareLegend = document.createElement('h2');
    shareLegend.className = 'control-panel__legend';
    shareLegend.textContent = '共有';
    shareSection.appendChild(shareLegend);

    const shareButton = document.createElement('button');
    shareButton.type = 'button';
    shareButton.className = 'control-panel__button';
    shareButton.textContent = 'URL をコピー';
    shareButton.addEventListener('click', () => {
      for (const subscriber of this.copyShareUrlSubscribers) {
        subscriber();
      }
    });

    // 結果は**ボタンのラベルを書き換えずに**別行へ出す。ラベルが入れ替わると
    // 読み上げの利用者にはボタンそのものが変わったように聞こえる
    this.shareStatus = document.createElement('p');
    this.shareStatus.className = 'control-panel__hint';
    this.shareStatus.setAttribute('aria-live', 'polite');
    this.shareStatus.textContent = SHARE_STATUS_IDLE;

    // 保存ボタン（TASKS 6-6 段階5, PNG-1）。書き出しは配線側が
    // 「同一同期タスクで描画 → 読み出し」で行う（SceneManager.captureDataUrl 参照）
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'control-panel__button';
    saveButton.textContent = 'PNG を保存';
    saveButton.addEventListener('click', () => {
      for (const subscriber of this.savePngSubscribers) {
        subscriber();
      }
    });

    shareSection.append(shareButton, saveButton, this.shareStatus);
    this.element.appendChild(shareSection);

    parent.appendChild(this.element);

    store.subscribe((state) => {
      this.render(state);
    });
    this.render(store.getState());
  }

  /**
   * 姿勢スライダーが動かされたときの購読者を登録する。
   *
   * @param subscriber 新しい Z 軸回転角 [deg] を受け取る
   */
  onRotationInput(subscriber: (angleDeg: number) => void): void {
    this.rotationSubscribers.push(subscriber);
  }

  /** リセットが押されたときの購読者を登録する。 */
  onReset(subscriber: () => void): void {
    this.resetSubscribers.push(subscriber);
  }

  /**
   * 「光路に合わせる」が押されたときの購読者を登録する。
   *
   * スクリーンの向きは配線側（アンカーを凍結している main）が持つので、
   * パネルは押されたことだけを伝える。
   */
  onFocusScreen(subscriber: () => void): void {
    this.focusScreenSubscribers.push(subscriber);
  }

  /**
   * 「最小偏角に合わせる」が押されたときの購読者を登録する。
   *
   * パネルは押されたことだけを伝える。**スライダーへ書くのは配線側の責務**である。
   * θ₁_min は入射面の法線から測った角なので、スライダー値へ直すには
   * 現在のプリズム姿勢が要る。姿勢の単一の真実は `matrixWorld` にあり、パネルは
   * three を知らない（`onRotationInput` と同じ分担）。
   */
  onApplyMinimumDeviation(subscriber: () => void): void {
    this.applyMinimumSubscribers.push(subscriber);
  }

  /**
   * 入射角スライダーが**人の手で**動かされたときの購読者を登録する。
   *
   * `render()` が値を書き戻すときには発火しない（`value` への代入は `input` を起こさない）。
   * だから進行中のアニメーションがスライダーを動かしても、これを通じて
   * 自分自身を取り消してしまうことがない。人の操作だけがここへ来る。
   */
  onSourceAngleInput(subscriber: () => void): void {
    this.sourceAngleSubscribers.push(subscriber);
  }

  /**
   * 断面図トグルが押されたときの購読者を登録する。
   *
   * 押した後の状態（表示するなら true）を受け取る。**store には持たせない。**
   * 断面図の出し入れは光路の計算に何も影響しないので、状態を store へ入れると
   * 「値が変わった＝48 波長を追跡し直す」という store の意味づけと食い違う。
   */
  onToggleSection(subscriber: (visible: boolean) => void): void {
    this.sectionToggleSubscribers.push(subscriber);
  }

  /**
   * 入射角まわりの案内を一時的に掲げる。null で即座に下ろす。
   *
   * 押下時にだけ呼ぶこと。`render()` は触らないので、状態が変わっても点滅しない。
   *
   * **成功した操作では必ず null を渡して下ろすこと。** 掲出は時間で消えるので、
   * 「届かなかった → プリズムを戻した → 今度は届いた」のあと数秒のあいだ、
   * 成功しているのに失敗の案内が残る。それは嘘を出していることになる。
   *
   * @param message 掲げる文言。null なら下ろす
   */
  setSourceAngleNotice(message: string | null): void {
    if (this.noticeTimer !== undefined) {
      window.clearTimeout(this.noticeTimer);
      this.noticeTimer = undefined;
    }

    if (message === null) {
      this.sourceAngleNotice.hidden = true;

      return;
    }

    this.sourceAngleNotice.textContent = message;
    this.sourceAngleNotice.hidden = false;

    this.noticeTimer = window.setTimeout(() => {
      this.sourceAngleNotice.hidden = true;
      this.noticeTimer = undefined;
    }, NOTICE_DURATION_MS);
  }

  /**
   * 「URL をコピー」が押されたときの購読者を登録する。
   *
   * クリップボードへ書くのは配線側の責務。パネルは `location` を知らない。
   */
  onCopyShareUrl(subscriber: () => void): void {
    this.copyShareUrlSubscribers.push(subscriber);
  }

  /**
   * 「PNG を保存」が押されたときの購読者を登録する。
   *
   * **購読者はクリックの同期タスクの中で呼ばれる。** 書き出しは描画バッファが
   * 合成される前に読む必要があるので、ここに `await` を挟んではならない
   * （`SceneManager.captureDataUrl` の説明を参照）。
   */
  onSavePng(subscriber: () => void): void {
    this.savePngSubscribers.push(subscriber);
  }

  /**
   * 共有の結果を一時的に表示する。
   *
   * 押下時にだけ呼ぶこと。時間が経てば案内文へ戻る（`setSourceAngleNotice` と同じ流儀で、
   * 毎フレーム出し直して点滅させない）。
   *
   * @param message 表示する文言
   */
  setShareStatus(message: string): void {
    this.shareStatus.textContent = message;

    if (this.shareStatusTimer !== undefined) {
      window.clearTimeout(this.shareStatusTimer);
    }

    this.shareStatusTimer = window.setTimeout(() => {
      this.shareStatus.textContent = SHARE_STATUS_IDLE;
      this.shareStatusTimer = undefined;
    }, NOTICE_DURATION_MS);
  }

  /**
   * 断面図トグルの**表示だけ**を更新する（共有 URL からの復元用。TASKS 6-6 段階3）。
   *
   * `setRotationDeg` とまったく同じ非発火の流儀。属性を直接書くので `click` は起きず、
   * `onToggleSection` の購読者は動かない。復元側が自分の通知で自分を呼び戻す
   * エコーが原理的に生じない。
   *
   * @param visible 押された状態にするなら true
   */
  setSectionPressed(visible: boolean): void {
    this.sectionToggle.setAttribute('aria-pressed', String(visible));
  }

  /** 断面図トグルが押された状態かどうか。共有 URL へ書き出すために読む。 */
  isSectionPressed(): boolean {
    return this.sectionToggle.getAttribute('aria-pressed') === 'true';
  }

  /**
   * 姿勢スライダーの**表示だけ**を更新する（ギズモ操作の反映用）。
   *
   * `value` への代入は `input` イベントを発火しないので、これを呼んでも
   * `onRotationInput` の購読者は動かない。ギズモ → スライダー → ギズモ、という
   * エコーが原理的に起こらないのはこの性質による。
   *
   * @param angleDeg Z 軸回転角 [deg]
   */
  setRotationDeg(angleDeg: number): void {
    const text = angleDeg.toFixed(1);

    this.rotationSlider.value = text;
    this.rotationValue.textContent = `${text}°`;
  }

  /**
   * 状態を表示へ反映する。
   *
   * @param state 現在の状態
   */
  private render(state: AppState): void {
    const angleText = state.sourceAngleDeg.toFixed(1);

    // クランプ後の値で入力欄を上書きする。範囲外を打ち込まれても表示と状態がずれない
    if (this.angleSlider.value !== angleText) {
      this.angleSlider.value = angleText;
    }
    this.angleValue.textContent = `${angleText}°`;

    if (this.materialSelect.value !== state.material) {
      this.materialSelect.value = state.material;
    }

    // 最小偏角は材質だけで決まる（頂角 60° は固定）。誇張倍率 m には依らない ——
    // 誇張は d 線を軸に n を伸ばす写像なので、d 線の n はどの m でも catalogNd のまま
    const minimum = minimumDeviationOf(state.material);

    // 頂角 60° で直接透過しない材質のときだけ注意書きを出す（TASKS 4-2b）。
    // 判定元は最小偏角と同一なので、「δ_min は出るのに警告も出る」状態が作れない
    this.materialWarning.hidden = minimum !== null;
    this.minimumWarning.hidden = minimum !== null;
    this.minimumButton.disabled = minimum === null;
    this.minimumValue.textContent = formatMinimumDeviation(minimum);

    const exaggerationText = String(state.exaggeration);
    if (this.exaggerationSlider.value !== exaggerationText) {
      this.exaggerationSlider.value = exaggerationText;
    }
    this.exaggerationValue.textContent =
      state.exaggeration === 1 ? '×1（実物理）' : `×${exaggerationText}`;

    // 共有 URL の復元・hashchange もここを通る（store.update → subscribe → render）。
    // `checked` への代入は change を発火しないので、自分の通知で自分を呼び戻さない
    for (const radio of this.spectrumRadios) {
      const selected = radio.value === state.spectrumMode;

      if (radio.checked !== selected) {
        radio.checked = selected;
      }
    }

    const distanceText = state.screenDistance.toFixed(1);
    if (this.screenDistanceSlider.value !== distanceText) {
      this.screenDistanceSlider.value = distanceText;
    }
    this.screenDistanceValue.textContent = distanceText;
  }
}

/**
 * セレクトの値を `MaterialName` へ絞り込む。
 *
 * 選択肢は `ALL_MATERIALS` から生やしているので実際には常に一致するが、
 * DOM の値は `string` なので、キャストを使わずに型を回復させる。
 *
 * @param value セレクトの値
 * @returns 材質名。未知の値なら既定の BK7
 */
function toMaterialName(value: string): MaterialName {
  const matched = ALL_MATERIALS.find((material) => material.name === value);

  return matched?.name ?? 'BK7';
}

/**
 * 最小偏角を表示用の文字列にする。
 *
 * 目標として読む値なので、δ_min と、そこへ至る入射角 θ₁_min を併記する。
 * 押した後は情報バーの「実測 θ₁」がこの θ₁ に一致するはずで、両者を突き合わせられる。
 *
 * @param minimum 最小偏角の配置。存在しなければ null
 * @returns 例 `38.65°（θ₁ = 49.32°）`。存在しなければ `—`
 */
function formatMinimumDeviation(minimum: MinimumDeviation | null): string {
  if (minimum === null) {
    return UNAVAILABLE;
  }

  return (
    `${minimum.deviationDeg.toFixed(2)}°` +
    `（θ₁ = ${minimum.incidenceAngleDeg.toFixed(2)}°）`
  );
}
