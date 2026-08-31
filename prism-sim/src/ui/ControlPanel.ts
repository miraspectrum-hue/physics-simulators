import { mdiMonitor, mdiPaletteOutline, mdiShimmer, mdiTarget, mdiTriangleOutline } from '@mdi/js';

import { ALL_MATERIALS } from '../optics/constants';
import { DEFAULT_PRISM_X, DEFAULT_PRISM_Y } from '../scene/prismPose';
import type { MaterialName, MinimumDeviation, SpectrumMode } from '../types/optics';

import { createMdiIcon } from './icon';
import { minimumDeviationOf } from './materialOptics';
import { DEFAULT_BEAM_WIDTH_PX } from './shareUrl';
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
 * 位置スライダーの下限・上限（TASKS 4-8）。
 *
 * 位置そのものに値域は無い（`shareUrl.ts` の px/py は無制限のまま）。
 * ただし `range` 入力である以上、有限の min/max が要る。既定カメラ
 * （FOV 45°・z=6.5）の可視半高がおよそ 2.69、プリズムの外接半径が
 * 一辺 2 の正三角形で ≈1.15 なので、±3 なら回転させても既定カメラから
 * 大きく外れず、遠クリップ面（200）にも床（y=-1.2）にも余裕を持って収まる。
 */
const POSITION_MIN = -3;
const POSITION_MAX = 3;

/**
 * ビーム幅スライダーの下限・上限 [px]（TASKS 4-5、裁定済み）。
 *
 * `position`/`rotation` と同じ非 `AppState` の値域（`shareUrl.ts` に確立した値域は無く、
 * ここが range 入力としての唯一の正解）。既定 3.5px を中心に、細く見づらい下限（1.0）から
 * 個別の光線が潰れて識別しづらくなる上限（8.0）まで、0.5 刻み。
 */
const BEAM_WIDTH_MIN_PX = 1.0;
const BEAM_WIDTH_MAX_PX = 8.0;

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
 * 「合わせる」ボタン（入射角 θ₁ 側）の `aria-label`/`title`（TASKS 7-15）。
 *
 * TASKS 7-1 で「最小偏角に合わせる」から「合わせる」へ短縮した見出し文言そのもの。
 * TASKS 7-15 でボタンをアイコンのみへ変えたため、短縮前の文言をここへ退避し、
 * 読み上げ名（`aria-label`）とホバー時のツールチップ（`title`）の両方に使う。
 */
const MINIMUM_DEVIATION_ACTION_LABEL = '最小偏角に合わせる';

/** 「合わせる」ボタン（スクリーン距離側）の `aria-label`/`title`。上と同じ理由・同じ流儀。 */
const FOCUS_SCREEN_ACTION_LABEL = '光路に合わせる';

/**
 * グロートグルの `title`（TASKS 7-16）。
 *
 * 「合わせる」と違い、これは瞬間の操作ではなく ON/OFF を持つトグルなので、
 * `aria-label` は名前（「グロー」）のまま、説明はホバー時のツールチップ（`title`）
 * にだけ持たせる——状態は `aria-pressed` が既に伝えている。
 */
const GLOW_DESCRIPTION =
  'グロー（光線のにじみ）の表示を切り替えます。見た目のみで、計算には影響しません。';

/**
 * 一時表示（`showSourceAngleNotice`）を掲げておく時間 [ms]。
 *
 * 押した瞬間にしか出さないので、**毎フレーム出し直して点滅させない**。時間で自然に消し、
 * 押し直せば掲出し直す。状態が変わっても消さないのは、消えた理由が
 * 「時間切れ」か「状況が変わった」かを読み手が区別できないため。
 */
const NOTICE_DURATION_MS = 6000;

/**
 * 共有結果のメッセージ（`setShareStatus`）を掲げておく時間 [ms]（TASKS 7-4）。
 *
 * `NOTICE_DURATION_MS` とは独立の値——どちらか一方だけを後から変える依頼が来ても、
 * もう一方に影響しない。実際に共有結果の側だけ 10 秒→6 秒→3 秒と調整された経緯がある。
 * 押した直後だけ結果を見せ、時間が来たら `hidden` で消す——`sourceAngleNotice` と
 * 同じ「時間で自然に消す」流儀だが、こちらは常時表示の代替文言へは戻さない
 * （ボタンの直下という目立つ位置に居座り続けないようにする、というユーザー指定の挙動）。
 */
const SHARE_STATUS_DURATION_MS = 3000;

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
 *
 * **断面図トグル・数値表示トグル・初期状態に戻す・URL をコピー・PNG を保存の5つは、
 * 構築直後は `this.element` 直下に仮置きされる**（TASKS 7-1・7-2）。断面図・数値表示は
 * ウィンドウ（断面図パネル／情報バー）に紐づく性質の切替、残る3つはどの1カテゴリにも
 * 閉じない「全体操作」であり、実運用では `main.ts` が構築直後に
 * `sectionToggleElement`/`numbersToggleElement`/`resetButtonElement`/
 * `shareUrlButtonElement`/`savePngButtonElement`/`shareStatusElement` 経由で取り出し、
 * ビューポート側へ `appendChild`（＝再配置）する。`appendChild` は既存ノードを移動させる
 * だけなので、要素の参照・イベントリスナーはそのまま保たれる。`aria-pressed` の状態機械・
 * 購読者配列・`onToggleSection`/`setSectionPressed`/`onReset`/`setShareStatus` 等の
 * 公開契約は一切変えていない——変わるのは最終的な DOM 上の置き場所だけである。
 */
export default class ControlPanel {
  /** パネルのルート要素。 */
  readonly element: HTMLElement;

  private readonly angleSlider: HTMLInputElement;
  private readonly angleValue: HTMLElement;
  private readonly beamWidthSlider: HTMLInputElement;
  private readonly beamWidthValue: HTMLElement;
  private readonly minimumValue: HTMLElement;
  private readonly minimumButton: HTMLButtonElement;
  private readonly minimumWarning: HTMLElement;
  private readonly sourceAngleNotice: HTMLElement;
  private readonly rotationSlider: HTMLInputElement;
  private readonly rotationValue: HTMLElement;
  private readonly positionXSlider: HTMLInputElement;
  private readonly positionXValue: HTMLElement;
  private readonly positionYSlider: HTMLInputElement;
  private readonly positionYValue: HTMLElement;
  private readonly materialSelect: HTMLSelectElement;
  private readonly materialWarning: HTMLElement;
  private readonly exaggerationSlider: HTMLInputElement;
  private readonly exaggerationValue: HTMLElement;
  private readonly screenDistanceSlider: HTMLInputElement;
  private readonly screenDistanceValue: HTMLElement;
  private readonly sectionToggle: HTMLButtonElement;
  private readonly glowToggle: HTMLButtonElement;
  private readonly numbersToggle: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly shareUrlButton: HTMLButtonElement;
  private readonly savePngButton: HTMLButtonElement;
  private readonly shareStatus: HTMLElement;

  /** 姿勢スライダーが動かされたときに呼ぶ購読者。 */
  private readonly rotationSubscribers: Array<(angleDeg: number) => void> = [];

  /** X 位置スライダーが動かされたときに呼ぶ購読者（TASKS 4-8）。 */
  private readonly positionXSubscribers: Array<(x: number) => void> = [];

  /** Y 位置スライダーが動かされたときに呼ぶ購読者（TASKS 4-8）。 */
  private readonly positionYSubscribers: Array<(y: number) => void> = [];

  /**
   * ビーム幅スライダーが動かされたときに呼ぶ購読者（TASKS 4-5）。
   *
   * `position`/`rotation` と同じ非 `store` の独立配線（4-5 裁定：表示専用で
   * `traceSpectrum` の入力にならないため）。
   */
  private readonly beamWidthSubscribers: Array<(widthPx: number) => void> = [];

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

  /** グロートグルが押されたときに呼ぶ購読者（TASKS 4-7）。 */
  private readonly glowToggleSubscribers: Array<(enabled: boolean) => void> = [];

  /** 数値表示トグルが押されたときに呼ぶ購読者（TASKS 4-7）。 */
  private readonly numbersToggleSubscribers: Array<(visible: boolean) => void> = [];

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

    // 光路セクション（TASKS 7-1：光源／材質／プリズムの3見出しを統合）。
    // 「計算に効く入力」という性質で束ねる——入射角・材質・姿勢のどれも
    // traceSpectrum の入力そのものであり、見た目だけの切替（表現セクション）とは分ける
    const pathSection = document.createElement('section');
    pathSection.className = 'control-panel__section';

    // 見出しのアイコンはヘルプガイドの同名カテゴリ（HelpModal.ts）と揃える（TASKS 7-15）
    const pathLegend = document.createElement('h2');
    pathLegend.className = 'control-panel__legend';
    pathLegend.append(createMdiIcon(mdiTriangleOutline), document.createTextNode('光路'));
    pathSection.appendChild(pathLegend);

    // 材質（4-2）。選択肢は ALL_MATERIALS から生やすので追記漏れが起きない。
    // 並び順は「ガラスの種類 → 最小偏角 δ_min → 入射角 θ₁」（TASKS 7-11）——
    // δ_min は材質だけで決まる値なので、材質のすぐ下に置くと「この材質を選ぶと
    // 目指せる最小偏角はこれ」という依存関係が視覚的な並びと一致する
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

    pathSection.append(materialLabel, this.materialSelect, this.materialWarning);

    // 最小偏角（TASKS 6-2）。ここは**読むだけ**の行にする（TASKS 7-11）——
    // 「合わせる」ボタンは実際には入射角 θ₁ を書き換える操作なので、効き先である
    // θ₁ スライダーの隣に置く。ここは目標値（δ_min とそこへ至る θ₁_min）を
    // 先に見せるだけの読み取り専用行として残す
    const minimumReadout = document.createElement('p');
    minimumReadout.className = 'control-panel__readout';

    const minimumLabel = document.createElement('span');
    minimumLabel.textContent = '最小偏角 δ_min';

    this.minimumValue = document.createElement('span');
    this.minimumValue.className = 'control-panel__value';

    minimumReadout.append(minimumLabel, this.minimumValue);
    pathSection.appendChild(minimumReadout);

    // 入射角 θ₁。スライダーの右に「合わせる」ボタンをインライン化する（TASKS 7-11）——
    // ボタンは実際にこのスライダーの値を書き換えるので、効き先の隣に置くのが自然
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

    // アイコンのみのボタンにする（TASKS 7-15）。読み上げ用の名前とホバー時のツールチップは
    // 短縮前の文言（「合わせる」に短縮する前の TASKS 7-1 裁定を参照）をそのまま使う——
    // アイコンだけでは何をするボタンか伝わらないため、`aria-label`/`title` で補う
    this.minimumButton = document.createElement('button');
    this.minimumButton.type = 'button';
    this.minimumButton.className =
      'control-panel__button control-panel__inline-button control-panel__icon-button';
    this.minimumButton.setAttribute('aria-label', MINIMUM_DEVIATION_ACTION_LABEL);
    this.minimumButton.title = MINIMUM_DEVIATION_ACTION_LABEL;
    this.minimumButton.appendChild(createMdiIcon(mdiTarget));
    this.minimumButton.addEventListener('click', () => {
      for (const subscriber of this.applyMinimumSubscribers) {
        subscriber();
      }
    });

    const angleRow = document.createElement('div');
    angleRow.className = 'control-panel__slider-row';
    angleRow.append(this.angleSlider, this.minimumButton);

    const angleHint = document.createElement('p');
    angleHint.className = 'control-panel__hint';
    angleHint.textContent =
      'スライダーは「既定姿勢での入射角」です。プリズムを回すと実測 θ₁（下の情報バー）と乖離します。';

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

    pathSection.append(label, angleRow, angleHint, this.minimumWarning, this.sourceAngleNotice);

    // 姿勢。ギズモと同じ 1 自由度（Z 軸まわり）を扱う
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

    pathSection.append(poseLabel, this.rotationSlider);

    // X/Y 位置スライダー（TASKS 4-8）。#prism-rotation をそのまま鏡写しする——
    // ネイティブ range・label[for]・非発火の表示専用 setter を持つ 1 自由度の対
    const positionXLabel = document.createElement('label');
    positionXLabel.className = 'control-panel__row';
    positionXLabel.htmlFor = 'prism-position-x';

    const positionXLabelText = document.createElement('span');
    positionXLabelText.textContent = 'X 位置';

    this.positionXValue = document.createElement('span');
    this.positionXValue.className = 'control-panel__value';

    positionXLabel.append(positionXLabelText, this.positionXValue);

    this.positionXSlider = document.createElement('input');
    this.positionXSlider.type = 'range';
    this.positionXSlider.id = 'prism-position-x';
    this.positionXSlider.className = 'control-panel__slider';
    this.positionXSlider.min = String(POSITION_MIN);
    this.positionXSlider.max = String(POSITION_MAX);
    this.positionXSlider.step = '0.05';

    this.positionXSlider.addEventListener('input', () => {
      const x = Number(this.positionXSlider.value);

      this.positionXValue.textContent = x.toFixed(2);

      for (const subscriber of this.positionXSubscribers) {
        subscriber(x);
      }
    });

    pathSection.append(positionXLabel, this.positionXSlider);

    const positionYLabel = document.createElement('label');
    positionYLabel.className = 'control-panel__row';
    positionYLabel.htmlFor = 'prism-position-y';

    const positionYLabelText = document.createElement('span');
    positionYLabelText.textContent = 'Y 位置';

    this.positionYValue = document.createElement('span');
    this.positionYValue.className = 'control-panel__value';

    positionYLabel.append(positionYLabelText, this.positionYValue);

    this.positionYSlider = document.createElement('input');
    this.positionYSlider.type = 'range';
    this.positionYSlider.id = 'prism-position-y';
    this.positionYSlider.className = 'control-panel__slider';
    this.positionYSlider.min = String(POSITION_MIN);
    this.positionYSlider.max = String(POSITION_MAX);
    this.positionYSlider.step = '0.05';

    this.positionYSlider.addEventListener('input', () => {
      const y = Number(this.positionYSlider.value);

      this.positionYValue.textContent = y.toFixed(2);

      for (const subscriber of this.positionYSubscribers) {
        subscriber(y);
      }
    });

    pathSection.append(positionYLabel, this.positionYSlider);

    // 明示的に既定値を書く。range 入力は value 属性を省くと min/max の中点になる仕様だが、
    // jsdom はこれを再計算しない（テストで実際に判明した）。ブラウザ差に
    // 依存させず、ここで DEFAULT_PRISM_X/Y をそのまま書き込んでおくのが確実
    this.setPositionX(DEFAULT_PRISM_X);
    this.setPositionY(DEFAULT_PRISM_Y);

    const poseHint = document.createElement('p');
    poseHint.className = 'control-panel__hint';
    poseHint.textContent = 'R: 回転ギズモ / G: 移動ギズモ / Esc: カメラ操作';
    pathSection.appendChild(poseHint);

    this.element.appendChild(pathSection);

    // 初期状態に戻すボタン（TASKS 7-2）。光路（入射角・材質・姿勢）だけでなく
    // store.reset() 経由で表現（分散の誇張・スペクトルモード）・スクリーン（距離）も
    // まとめてリセットする「全体操作」なので、単一カテゴリの節には置かない。
    // sectionToggle 等と同じ仮置きの流儀——構築直後は `this.element` 直下に置き、
    // 最終的な置き場所（ビューポート右上、共有ボタン・ヘルプの並び）は
    // `resetButtonElement` 経由で配線側（main.ts）に委ねる
    this.resetButton = document.createElement('button');
    this.resetButton.type = 'button';
    this.resetButton.className = 'control-panel__button';
    this.resetButton.textContent = '初期状態に戻す';
    this.resetButton.addEventListener('click', () => {
      for (const subscriber of this.resetSubscribers) {
        subscriber();
      }
    });
    this.element.appendChild(this.resetButton);

    // 表現セクション（TASKS 7-1）。「見え方・見せ方」という性質で束ねる——
    // グロー・ビーム幅・分散の誇張・スペクトル表示モードはいずれも光路の幾何入力ではなく、
    // 同じ光路をどう描く／どう強調するかという表現側の選択である。
    //
    // **ただし内部での性質は一様ではない。** グロー・ビーム幅は本当に描画だけの切り替えで、
    // 光路の計算に一切影響しない。対してスペクトル表示モードは `traceSpectrum` に渡す
    // 波長列そのものを変える＝**計算の入力**なので、store の第 5 項目として持ち、
    // `subscribe` → `markDirty` → 再追跡の一方向に乗せている（TASKS 4-3 の裁定③）。
    // 分散の誇張も同様に `traceSpectrum` の `exaggeration` 引数（store 経由）である。
    // どちらも「ユーザーから見た性質（見え方の強調）」でこのセクションに置く。
    const expressionSection = document.createElement('section');
    expressionSection.className = 'control-panel__section';

    const expressionLegend = document.createElement('h2');
    expressionLegend.className = 'control-panel__legend';
    expressionLegend.append(createMdiIcon(mdiPaletteOutline), document.createTextNode('表現'));
    expressionSection.appendChild(expressionLegend);

    // ビーム幅（TASKS 4-5）。表示専用（4-5 裁定）なので store には触れず、position/rotation
    // と同じ独立の購読者配列で通知する
    const beamWidthLabel = document.createElement('label');
    beamWidthLabel.className = 'control-panel__row';
    beamWidthLabel.htmlFor = 'beam-width';

    const beamWidthLabelText = document.createElement('span');
    beamWidthLabelText.textContent = 'ビーム幅';

    this.beamWidthValue = document.createElement('span');
    this.beamWidthValue.className = 'control-panel__value';

    beamWidthLabel.append(beamWidthLabelText, this.beamWidthValue);

    this.beamWidthSlider = document.createElement('input');
    this.beamWidthSlider.type = 'range';
    this.beamWidthSlider.id = 'beam-width';
    this.beamWidthSlider.className = 'control-panel__slider';
    this.beamWidthSlider.min = String(BEAM_WIDTH_MIN_PX);
    this.beamWidthSlider.max = String(BEAM_WIDTH_MAX_PX);
    this.beamWidthSlider.step = '0.5';

    this.beamWidthSlider.addEventListener('input', () => {
      const widthPx = Number(this.beamWidthSlider.value);

      this.beamWidthValue.textContent = `${widthPx.toFixed(1)}px`;

      for (const subscriber of this.beamWidthSubscribers) {
        subscriber(widthPx);
      }
    });

    // 明示的に既定値を書く。range 入力は value 属性を省くと min/max の中点になる仕様だが、
    // jsdom はこれを再計算しない（4-8 の position スライダーと同じ罠。実測では
    // 中点ですらなく `50` に落ちることを確認済み——テストで実際に判明済み）
    this.setBeamWidth(DEFAULT_BEAM_WIDTH_PX);

    // グロートグル（TASKS 4-7）。断面図・数値表示と違い特定のウィンドウに紐づかないため
    // サイドバーに残すが、ビーム幅スライダーの行にインライン化する（TASKS 7-2 裁定）——
    // 「距離＋合わせる」（TASKS 7-1）と同じ、スライダー行にワンショット系の操作を
    // 添えるパターンをトグルボタンにも広げた形。アイコンのみの表示にする（TASKS 7-16）
    this.glowToggle = document.createElement('button');
    this.glowToggle.type = 'button';
    this.glowToggle.id = 'glow-toggle';
    this.glowToggle.className =
      'control-panel__button control-panel__inline-button control-panel__icon-button';
    this.glowToggle.setAttribute('aria-label', 'グロー');
    this.glowToggle.title = GLOW_DESCRIPTION;
    this.glowToggle.appendChild(createMdiIcon(mdiShimmer));
    this.glowToggle.setAttribute('aria-pressed', 'true');
    this.glowToggle.addEventListener('click', () => {
      const next = this.glowToggle.getAttribute('aria-pressed') !== 'true';

      this.glowToggle.setAttribute('aria-pressed', String(next));

      for (const subscriber of this.glowToggleSubscribers) {
        subscriber(next);
      }
    });

    const beamWidthRow = document.createElement('div');
    beamWidthRow.className = 'control-panel__slider-row';
    beamWidthRow.append(this.beamWidthSlider, this.glowToggle);

    expressionSection.append(beamWidthLabel, beamWidthRow);

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

    expressionSection.append(exaggerationLabel, this.exaggerationSlider, exaggerationHint);

    // スペクトル表示モード（TASKS 4-3）。パネルで唯一のラジオなので、
    // `fieldset` + `legend` で群を明示したうえで `role="radiogroup"` も添える
    const spectrumGroup = document.createElement('fieldset');
    spectrumGroup.className = 'control-panel__radiogroup';
    spectrumGroup.setAttribute('role', 'radiogroup');

    const spectrumLegend = document.createElement('legend');
    spectrumLegend.className = 'control-panel__radiolegend';
    spectrumLegend.textContent = 'スペクトル';
    spectrumGroup.appendChild(spectrumLegend);

    // 選択肢だけを横並びの行にまとめる（TASKS 7-10）。legend は fieldset 直下の
    // ブロックのまま残し、選択肢はこの内側のラッパーで横に並べる
    const spectrumOptions = document.createElement('div');
    spectrumOptions.className = 'control-panel__radiooptions';

    this.spectrumRadios = SPECTRUM_MODE_OPTIONS.map(({ mode, label: optionLabel, id }) => {
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
      text.textContent = optionLabel;

      option.append(input, text);
      spectrumOptions.appendChild(option);

      return input;
    });

    spectrumGroup.appendChild(spectrumOptions);

    const spectrumHint = document.createElement('p');
    spectrumHint.className = 'control-panel__hint';
    spectrumHint.textContent =
      '7 色は代表 7 波長だけを追跡します。見せ方の選択ですが、光路は選んだ波長で計算し直します。';

    expressionSection.append(spectrumGroup, spectrumHint);
    this.element.appendChild(expressionSection);

    // スクリーンのセクション（TASKS 6-3）。距離は凍結アンカー上を滑るだけで、
    // 向きはボタンを押したときにしか変わらない（案 C）。
    // 距離スライダーと「合わせる」ボタンは1行にインライン化する（TASKS 7-1）
    const screenSection = document.createElement('section');
    screenSection.className = 'control-panel__section';

    const screenLegend = document.createElement('h2');
    screenLegend.className = 'control-panel__legend';
    screenLegend.append(createMdiIcon(mdiMonitor), document.createTextNode('スクリーン'));
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

    // アイコンのみのボタンにする（TASKS 7-15）。minimumButton と同じ理由・同じ流儀
    const focusButton = document.createElement('button');
    focusButton.type = 'button';
    focusButton.className =
      'control-panel__button control-panel__inline-button control-panel__icon-button';
    focusButton.setAttribute('aria-label', FOCUS_SCREEN_ACTION_LABEL);
    focusButton.title = FOCUS_SCREEN_ACTION_LABEL;
    focusButton.appendChild(createMdiIcon(mdiTarget));
    focusButton.addEventListener('click', () => {
      for (const subscriber of this.focusScreenSubscribers) {
        subscriber();
      }
    });

    const distanceRow = document.createElement('div');
    distanceRow.className = 'control-panel__slider-row';
    distanceRow.append(this.screenDistanceSlider, focusButton);

    const screenHint = document.createElement('p');
    screenHint.className = 'control-panel__hint';
    screenHint.textContent =
      'スクリーンは置いた位置に留まります。材質を変えて光が外れたら、ボタンで捕まえ直します。';

    screenSection.append(distanceLabel, distanceRow, screenHint);
    this.element.appendChild(screenSection);

    // 断面図トグル（TASKS 6-1）。生成と状態機械（aria-pressed・購読者配列）はここで持つが、
    // **最終的な置き場所は `sectionToggleElement` 経由で配線側（main.ts）が決める**
    // （TASKS 7-1：実際の位置は断面図パネルのすぐ上、ビューポート左上）。
    // 構築直後はいったん `this.element` の末尾に置く——`main.ts` は構築直後の同期処理で
    // 必ず移すので画面には出ないが、`main.ts` を経由しない場面（テスト等）でも
    // `parent` の子孫であることが保証され、要素の参照・リスナーは移動しても保持される
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
    this.element.appendChild(this.sectionToggle);

    // 数値表示トグル（TASKS 4-7）。断面図と同じ流儀——既定は ON（押された状態）。
    // 最終的な置き場所は `numbersToggleElement` 経由で配線側に委ねる
    // （TASKS 7-1：実際の位置は情報バーの隣）
    this.numbersToggle = document.createElement('button');
    this.numbersToggle.type = 'button';
    this.numbersToggle.id = 'numbers-toggle';
    this.numbersToggle.className = 'control-panel__button';
    this.numbersToggle.textContent = '数値表示';
    this.numbersToggle.setAttribute('aria-pressed', 'true');
    this.numbersToggle.addEventListener('click', () => {
      const next = this.numbersToggle.getAttribute('aria-pressed') !== 'true';

      this.numbersToggle.setAttribute('aria-pressed', String(next));

      for (const subscriber of this.numbersToggleSubscribers) {
        subscriber(next);
      }
    });
    this.element.appendChild(this.numbersToggle);

    // 共有ボタン群（TASKS 6-6 段階4／TASKS 7-2）。今の状態を映した URL をクリップボードへ
    // 渡す・PNG を書き出す、という「全体操作」で、初期状態に戻す・ヘルプと同じ性質のため
    // 単一カテゴリの節には置かない。sectionToggle 等と同じ仮置きの流儀——構築直後は
    // `this.element` 直下に置き、最終的な置き場所は各 `...Element` ゲッター経由で
    // 配線側（main.ts）に委ねる（ビューポート右上、初期状態に戻す・ヘルプの並び）
    this.shareUrlButton = document.createElement('button');
    this.shareUrlButton.type = 'button';
    this.shareUrlButton.className = 'control-panel__button';
    this.shareUrlButton.textContent = 'URL をコピー';
    this.shareUrlButton.addEventListener('click', () => {
      for (const subscriber of this.copyShareUrlSubscribers) {
        subscriber();
      }
    });
    this.element.appendChild(this.shareUrlButton);

    // 保存ボタン（TASKS 6-6 段階5, PNG-1）。書き出しは配線側が
    // 「同一同期タスクで描画 → 読み出し」で行う（SceneManager.captureDataUrl 参照）
    this.savePngButton = document.createElement('button');
    this.savePngButton.type = 'button';
    this.savePngButton.className = 'control-panel__button';
    this.savePngButton.textContent = 'PNG を保存';
    this.savePngButton.addEventListener('click', () => {
      for (const subscriber of this.savePngSubscribers) {
        subscriber();
      }
    });
    this.element.appendChild(this.savePngButton);

    // 結果は**ボタンのラベルを書き換えずに**別行へ出す。ラベルが入れ替わると
    // 読み上げの利用者にはボタンそのものが変わったように聞こえる
    this.shareStatus = document.createElement('p');
    this.shareStatus.className = 'control-panel__hint';
    this.shareStatus.setAttribute('aria-live', 'polite');
    // 押すまでは何も掲げない（TASKS 7-4）。常時表示の案内文は持たず、結果が出たときだけ現れる
    this.shareStatus.hidden = true;
    this.element.appendChild(this.shareStatus);

    parent.appendChild(this.element);

    store.subscribe((state) => {
      this.render(state);
    });
    this.render(store.getState());
  }

  /**
   * 断面図トグルの DOM 要素（TASKS 7-1）。
   *
   * `main.ts` が断面図パネルの近くへ `appendChild` するために公開する。要素そのものは
   * このクラスが生成・保持し続けており、イベントリスナーや `aria-pressed` の状態機械は
   * 移動しても変わらない。
   */
  get sectionToggleElement(): HTMLButtonElement {
    return this.sectionToggle;
  }

  /**
   * 数値表示トグルの DOM 要素（TASKS 7-1）。
   *
   * `main.ts` が情報バーの隣へ `appendChild` するために公開する。`sectionToggleElement` と
   * 同じ理由・同じ流儀。
   */
  get numbersToggleElement(): HTMLButtonElement {
    return this.numbersToggle;
  }

  /**
   * 「初期状態に戻す」ボタンの DOM 要素（TASKS 7-2）。
   *
   * `main.ts` がビューポート右上（共有ボタン・ヘルプの並び）へ `appendChild` するために
   * 公開する。`sectionToggleElement` と同じ理由・同じ流儀。
   */
  get resetButtonElement(): HTMLButtonElement {
    return this.resetButton;
  }

  /**
   * 「URL をコピー」ボタンの DOM 要素（TASKS 7-2）。
   *
   * `main.ts` がビューポート右上へ `appendChild` するために公開する。`sectionToggleElement`
   * と同じ理由・同じ流儀。
   */
  get shareUrlButtonElement(): HTMLButtonElement {
    return this.shareUrlButton;
  }

  /**
   * 「PNG を保存」ボタンの DOM 要素（TASKS 7-2）。
   *
   * `main.ts` がビューポート右上へ `appendChild` するために公開する。`sectionToggleElement`
   * と同じ理由・同じ流儀。
   */
  get savePngButtonElement(): HTMLButtonElement {
    return this.savePngButton;
  }

  /**
   * 共有結果の案内文（`p[aria-live="polite"]`）の DOM 要素（TASKS 7-2）。
   *
   * `main.ts` が共有ボタンと同じ場所（ビューポート右上）へ `appendChild` するために公開する。
   * `setShareStatus()` が書き込む対象そのものであり、移動しても中身・`aria-live` は変わらない。
   */
  get shareStatusElement(): HTMLElement {
    return this.shareStatus;
  }

  /**
   * 姿勢スライダーが動かされたときの購読者を登録する。
   *
   * @param subscriber 新しい Z 軸回転角 [deg] を受け取る
   */
  onRotationInput(subscriber: (angleDeg: number) => void): void {
    this.rotationSubscribers.push(subscriber);
  }

  /**
   * X 位置スライダーが動かされたときの購読者を登録する（TASKS 4-8）。
   *
   * @param subscriber 新しい X 位置（ワールド）を受け取る
   */
  onPositionXInput(subscriber: (x: number) => void): void {
    this.positionXSubscribers.push(subscriber);
  }

  /**
   * Y 位置スライダーが動かされたときの購読者を登録する（TASKS 4-8）。
   *
   * @param subscriber 新しい Y 位置（ワールド）を受け取る
   */
  onPositionYInput(subscriber: (y: number) => void): void {
    this.positionYSubscribers.push(subscriber);
  }

  /**
   * ビーム幅スライダーが動かされたときの購読者を登録する（TASKS 4-5）。
   *
   * @param subscriber 新しいビーム幅 [px] を受け取る
   */
  onBeamWidthInput(subscriber: (widthPx: number) => void): void {
    this.beamWidthSubscribers.push(subscriber);
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
   * グロートグルが押されたときの購読者を登録する（TASKS 4-7）。
   *
   * 押した後の状態（有効にするなら true）を受け取る。断面図と同じ理由で store には
   * 持たせない —— Bloom の ON/OFF はポストプロセスだけの話で、光路の計算に無関係。
   */
  onToggleGlow(subscriber: (enabled: boolean) => void): void {
    this.glowToggleSubscribers.push(subscriber);
  }

  /**
   * 数値表示トグルが押されたときの購読者を登録する（TASKS 4-7）。
   *
   * 押した後の状態（表示するなら true）を受け取る。情報バーの DOM 表示だけの話で、
   * 光路の計算に無関係なので store には持たせない。
   */
  onToggleNumbers(subscriber: (visible: boolean) => void): void {
    this.numbersToggleSubscribers.push(subscriber);
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
   * 共有の結果を一時的に表示する（TASKS 7-4）。
   *
   * 押下時にだけ呼ぶこと。`SHARE_STATUS_DURATION_MS`（3 秒）が経てば `hidden` で消える
   * （`setSourceAngleNotice` と同じ流儀で、毎フレーム出し直して点滅させない）。
   * 案内文へ戻すことはしない——ボタン直下という目立つ位置に居座り続けないための挙動。
   *
   * @param message 表示する文言
   */
  setShareStatus(message: string): void {
    this.shareStatus.textContent = message;
    this.shareStatus.hidden = false;

    if (this.shareStatusTimer !== undefined) {
      window.clearTimeout(this.shareStatusTimer);
    }

    this.shareStatusTimer = window.setTimeout(() => {
      this.shareStatus.hidden = true;
      this.shareStatusTimer = undefined;
    }, SHARE_STATUS_DURATION_MS);
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
   * グロートグルの**表示だけ**を更新する（共有 URL からの復元用。TASKS 4-7）。
   *
   * `setSectionPressed` と同じ非発火の流儀。属性を直接書くので `click` は起きず、
   * `onToggleGlow` の購読者は動かない。
   *
   * @param enabled 押された状態にするなら true
   */
  setGlowPressed(enabled: boolean): void {
    this.glowToggle.setAttribute('aria-pressed', String(enabled));
  }

  /** グロートグルが押された状態かどうか。共有 URL へ書き出すために読む。 */
  isGlowPressed(): boolean {
    return this.glowToggle.getAttribute('aria-pressed') === 'true';
  }

  /**
   * 数値表示トグルの**表示だけ**を更新する（共有 URL からの復元用。TASKS 4-7）。
   *
   * `setSectionPressed` と同じ非発火の流儀。
   *
   * @param visible 押された状態にするなら true
   */
  setNumbersPressed(visible: boolean): void {
    this.numbersToggle.setAttribute('aria-pressed', String(visible));
  }

  /** 数値表示トグルが押された状態かどうか。共有 URL へ書き出すために読む。 */
  isNumbersPressed(): boolean {
    return this.numbersToggle.getAttribute('aria-pressed') === 'true';
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
   * X 位置スライダーの**表示だけ**を更新する（ギズモ操作の反映用。TASKS 4-8）。
   *
   * `setRotationDeg` と同じ非発火の流儀。`onPositionXInput` の購読者は動かない。
   *
   * @param x X 位置（ワールド）
   */
  setPositionX(x: number): void {
    const text = x.toFixed(2);

    this.positionXSlider.value = text;
    this.positionXValue.textContent = text;
  }

  /**
   * Y 位置スライダーの**表示だけ**を更新する（ギズモ操作の反映用。TASKS 4-8）。
   *
   * `setRotationDeg` と同じ非発火の流儀。`onPositionYInput` の購読者は動かない。
   *
   * @param y Y 位置（ワールド）
   */
  setPositionY(y: number): void {
    const text = y.toFixed(2);

    this.positionYSlider.value = text;
    this.positionYValue.textContent = text;
  }

  /**
   * ビーム幅スライダーの**表示だけ**を更新する（共有 URL からの復元用。TASKS 4-5）。
   *
   * `setPositionX`/`setPositionY` と同じ非発火の流儀。`onBeamWidthInput` の購読者は動かない。
   * コンストラクタから既定値の明示初期化にも使う（jsdom は value 属性省略時の
   * min/max 中点フォールバックを再計算しないため）。
   *
   * @param widthPx ビーム幅 [px]
   */
  setBeamWidth(widthPx: number): void {
    const text = widthPx.toFixed(1);

    this.beamWidthSlider.value = text;
    this.beamWidthValue.textContent = `${text}px`;
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
