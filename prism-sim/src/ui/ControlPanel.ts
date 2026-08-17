import {
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
 * 右側の操作パネル（SPEC.md「画面構成」）。
 *
 * store とだけ結び、three にもレンダラにも触れない。UI からの入力は store へ、
 * store の変化は表示へ、という一方向の往復に閉じる。
 *
 * **プリズムの姿勢だけは store を経由しない。** 姿勢の単一の真実は `matrixWorld` であり、
 * 姿勢スライダーはギズモと並ぶ「もう一つのビュー」にすぎない。パネルは three を知らないので、
 * 実際の読み書きは `onRotationInput` / `setRotationDeg` を通じて配線側に委ねる。
 *
 * NOTE: I-4 時点。材質セレクト・誇張スライダーは I-5、数値パネル一式は I-6（4-6）で足す。
 */
export default class ControlPanel {
  /** パネルのルート要素。 */
  readonly element: HTMLElement;

  private readonly angleSlider: HTMLInputElement;
  private readonly angleValue: HTMLElement;
  private readonly measuredValue: HTMLElement;
  private readonly rotationSlider: HTMLInputElement;
  private readonly rotationValue: HTMLElement;

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
  }
}
