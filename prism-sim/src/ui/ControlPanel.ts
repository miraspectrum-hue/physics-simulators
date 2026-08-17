import { ALL_MATERIALS, APEX_ANGLE_DEG, MATERIALS } from '../optics/constants';
import { canTransmitThroughPrism } from '../optics/prism';
import type { MaterialName } from '../types/optics';
import {
  EXAGGERATION_MAX,
  EXAGGERATION_MIN,
  SOURCE_ANGLE_MAX_DEG,
  SOURCE_ANGLE_MIN_DEG,
  type AppState,
  type Store,
} from './store';

/** 値が定まらないときの表示。NaN をそのまま出さないための記号。 */
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
 * 右側の操作パネル（SPEC.md「画面構成」）。
 *
 * store とだけ結び、three にもレンダラにも触れない。UI からの入力は store へ、
 * store の変化は表示へ、という一方向の往復に閉じる。
 *
 * **プリズムの姿勢だけは store を経由しない。** 姿勢の単一の真実は `matrixWorld` であり、
 * 姿勢スライダーはギズモと並ぶ「もう一つのビュー」にすぎない。パネルは three を知らないので、
 * 実際の読み書きは `onRotationInput` / `setRotationDeg` を通じて配線側に委ねる。
 *
 * NOTE: I-5 時点。数値パネル一式は I-6（4-6）で足す。
 */
export default class ControlPanel {
  /** パネルのルート要素。 */
  readonly element: HTMLElement;

  private readonly angleSlider: HTMLInputElement;
  private readonly angleValue: HTMLElement;
  private readonly measuredValue: HTMLElement;
  private readonly rotationSlider: HTMLInputElement;
  private readonly rotationValue: HTMLElement;
  private readonly materialSelect: HTMLSelectElement;
  private readonly materialWarning: HTMLElement;
  private readonly exaggerationSlider: HTMLInputElement;
  private readonly exaggerationValue: HTMLElement;

  /** 姿勢スライダーが動かされたときに呼ぶ購読者。 */
  private readonly rotationSubscribers: Array<(angleDeg: number) => void> = [];

  /** リセットが押されたときに呼ぶ購読者。 */
  private readonly resetSubscribers: Array<() => void> = [];

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
      store.update({ sourceAngleDeg: Number(this.angleSlider.value) });
    });

    section.append(label, this.angleSlider);
    this.element.appendChild(section);

    // 実測 θ₁。スライダー値は「既定姿勢での入射角」なので、プリズムを回すと乖離する
    const measured = document.createElement('p');
    measured.className = 'control-panel__readout';

    const measuredLabel = document.createElement('span');
    measuredLabel.textContent = '実測 θ₁';

    this.measuredValue = document.createElement('span');
    this.measuredValue.className = 'control-panel__value';
    this.measuredValue.textContent = UNAVAILABLE;

    measured.append(measuredLabel, this.measuredValue);
    section.appendChild(measured);

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
   * 実測の入射角を表示する。
   *
   * @param angleDeg 入射角 [deg]。ビームがプリズムを外れていれば null
   */
  setMeasuredIncidenceDeg(angleDeg: number | null): void {
    this.measuredValue.textContent =
      angleDeg === null || !Number.isFinite(angleDeg) ? UNAVAILABLE : `${angleDeg.toFixed(2)}°`;
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
    // 頂角 60° で直接透過しない材質のときだけ注意書きを出す（TASKS 4-2b）
    this.materialWarning.hidden = !isNoDispersionMaterial(state.material);

    const exaggerationText = String(state.exaggeration);
    if (this.exaggerationSlider.value !== exaggerationText) {
      this.exaggerationSlider.value = exaggerationText;
    }
    this.exaggerationValue.textContent =
      state.exaggeration === 1 ? '×1（実物理）' : `×${exaggerationText}`;
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
 * 頂角 60° のプリズムで直接透過が起きない材質かどうか。
 *
 * 材質名で決め打ちにせず、条件 `A < 2·θc` を検証済みの `canTransmitThroughPrism` に
 * 委ねる。こうしておけば、将来 屈折率の高い材質を足したときも警告が自動で追従する。
 *
 * @param material 材質名
 * @returns 直接透過しないなら true
 */
function isNoDispersionMaterial(material: MaterialName): boolean {
  return !canTransmitThroughPrism(APEX_ANGLE_DEG, MATERIALS[material].catalogNd);
}
