import {
  SOURCE_ANGLE_MAX_DEG,
  SOURCE_ANGLE_MIN_DEG,
  type AppState,
  type Store,
} from './store';

/** 値が定まらないときの表示。NaN をそのまま出さないための記号。 */
const UNAVAILABLE = '—';

/**
 * 右側の操作パネル（SPEC.md「画面構成」）。
 *
 * store とだけ結び、three にもレンダラにも触れない。UI からの入力は store へ、
 * store の変化は表示へ、という一方向の往復に閉じる。
 *
 * NOTE: I-3 の骨格。入射角スライダーと、実測 θ₁ の最小表示だけを持つ。
 *       材質セレクト・誇張スライダーは I-5、数値パネル一式は I-6（4-6）で足す。
 */
export default class ControlPanel {
  /** パネルのルート要素。 */
  readonly element: HTMLElement;

  private readonly angleSlider: HTMLInputElement;
  private readonly angleValue: HTMLElement;
  private readonly measuredValue: HTMLElement;

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

    parent.appendChild(this.element);

    store.subscribe((state) => {
      this.render(state);
    });
    this.render(store.getState());
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
