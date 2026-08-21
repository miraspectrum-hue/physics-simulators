/** 値が定まらないときの表示。NaN や空文字をそのまま出さないための記号。 */
const UNAVAILABLE = '—';

/**
 * 情報バーに出す数値一式（SPEC.md「画面構成」の下段）。
 *
 * 表示専用の受け取り口であり、計算はしない。**どれも「頑健な源」から導いた値を渡すこと**。
 *   - `measuredIncidenceDeg` は入射レイと入口面法線から測った角。光源のレイは常に非零なので
 *     θ₁ = 0（頂点直撃）でも安全に定まる。
 *   - 屈折率は `dispersion.refractiveIndex` から直接引く。区間には触れない。
 *   - 偏角は外部区間（入射・射出）だけから測る。内部区間は θ₁ = 0 で長さ 0 に縮退しうるため、
 *     向きの正規化に使ってはならない（tracer.test.ts の R 節）。
 *
 * 定まらない値は `null` で渡す。表示側が `—` に落とすので、呼び出し側で NaN を作らないこと。
 */
export interface InfoValues {
  /** 実測の入射角 [deg]。ビームがプリズムを外れていれば null。 */
  readonly measuredIncidenceDeg: number | null;

  /** 赤側の代表波長 [nm]。 */
  readonly redWavelengthNm: number;

  /** 紫側の代表波長 [nm]。 */
  readonly violetWavelengthNm: number;

  /** 赤側の屈折率（実物理・無次元）。 */
  readonly redIndex: number;

  /** 紫側の屈折率（実物理・無次元）。 */
  readonly violetIndex: number;

  /** 赤側の偏角 [deg]（実物理）。射出しなければ null。 */
  readonly redDeviationDeg: number | null;

  /** 紫側の偏角 [deg]（実物理）。射出しなければ null。 */
  readonly violetDeviationDeg: number | null;

  /** 実際に描画している扇の広がり [deg]（誇張後）。両端が射出しなければ null。 */
  readonly drawnSpreadDeg: number | null;

  /** 分散誇張倍率 m。1 なら実物理そのもの。 */
  readonly exaggeration: number;

  /**
   * 入射面の反射率（0〜1・実物理）。ビームがプリズムを外れていれば null。
   *
   * **描画のゲインを掛けていない生の値を渡すこと。** 絵の中の反射光は見えるように
   * 持ち上げてあるが、ここに出すのは物理の事実である（I-6 の方針と同じ）。
   */
  readonly entryReflectance: number | null;

  /** 全反射を経て射出した光路の本数。 */
  readonly totalReflectionCount: number;

  /** 射出せずに追跡打ち切りとなった光路の本数（内部に閉じ込められた光）。 */
  readonly trappedCount: number;

  /** 追跡した光路の総数。 */
  readonly pathCount: number;

  /** ビームがプリズムを外れているなら true。 */
  readonly missed: boolean;
}

/**
 * ビューポート下端の情報バー（SPEC.md「画面構成」）。
 *
 * 計算結果の数値表示だけを担う読み取り専用のビューで、操作 UI は持たない。
 * three にも store にも触れず、配線側から `update()` で値を受け取る。
 *
 * **表示の方針（I-6 で確定）**: 主に出すのは「物理の事実」＝実物理（m=1）の n と δ。
 * 誇張スライダーを上げている間は、その値で描いていないことを隠さず、実際に描いている
 * 広がりを併記する。数値が絵と食い違って見えるのを防ぎつつ、教材としての正しさを保つ。
 */
export default class InfoOverlay {
  /** バーのルート要素。 */
  readonly element: HTMLElement;

  private readonly incidenceValue: HTMLElement;
  private readonly indexValue: HTMLElement;
  private readonly deviationValue: HTMLElement;
  private readonly spreadValue: HTMLElement;
  private readonly entryReflectionValue: HTMLElement;
  private readonly reflectionValue: HTMLElement;

  /**
   * @param parent バーを差し込む親要素（ビューポートの入れ物）
   */
  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'info-overlay';

    this.incidenceValue = this.appendItem('実測 θ₁');
    this.indexValue = this.appendItem('屈折率 n(λ)');
    this.deviationValue = this.appendItem('偏角 δ');
    this.spreadValue = this.appendItem('分離幅');
    this.entryReflectionValue = this.appendItem('入射面反射');
    this.reflectionValue = this.appendItem('全反射');

    parent.appendChild(this.element);
  }

  /**
   * 表示を更新する。
   *
   * @param values 表示する数値一式
   */
  update(values: InfoValues): void {
    this.incidenceValue.textContent = formatAngle(values.measuredIncidenceDeg);

    this.indexValue.textContent =
      `${values.redWavelengthNm}nm ${values.redIndex.toFixed(4)}` +
      ` / ${values.violetWavelengthNm}nm ${values.violetIndex.toFixed(4)}`;

    this.deviationValue.textContent =
      `赤 ${formatAngle(values.redDeviationDeg)} / 紫 ${formatAngle(values.violetDeviationDeg)}`;

    this.spreadValue.textContent = formatSpread(values);
    this.entryReflectionValue.textContent = formatEntryReflection(values.entryReflectance);
    this.reflectionValue.textContent = formatReflection(values);
  }

  /**
   * ラベルと値の組をバーへ追加する。
   *
   * @param labelText 見出し
   * @returns 値を書き込む要素
   */
  private appendItem(labelText: string): HTMLElement {
    const item = document.createElement('div');
    item.className = 'info-overlay__item';

    const label = document.createElement('span');
    label.className = 'info-overlay__label';
    label.textContent = labelText;

    const value = document.createElement('span');
    value.className = 'info-overlay__value';
    value.textContent = UNAVAILABLE;

    item.append(label, value);
    this.element.appendChild(item);

    return value;
  }
}

/**
 * 角度を表示用の文字列にする。
 *
 * @param angleDeg 角度 [deg]。定まらなければ null
 * @returns 例 `49.32°`。定まらなければ `—`
 */
function formatAngle(angleDeg: number | null): string {
  if (angleDeg === null || !Number.isFinite(angleDeg)) {
    return UNAVAILABLE;
  }

  // 丸めた結果の -0 を 0 に寄せる。表示桁で 0 の値に負号が付くと不具合に見えるため
  const rounded = Number(angleDeg.toFixed(2)) === 0 ? 0 : angleDeg;

  return `${rounded.toFixed(2)}°`;
}

/**
 * 分離幅（紫と赤の偏角差）を表示用の文字列にする。
 *
 * 主として出すのは実物理の差。誇張中は実際に描いている広がりを括弧で併記し、
 * 「絵の広がり ≠ 物理の広がり」であることを明示する。
 *
 * @param values 表示する数値一式
 * @returns 例 `1.36°（描画は ×6 で 12.29°）`
 */
function formatSpread(values: InfoValues): string {
  const { redDeviationDeg, violetDeviationDeg, drawnSpreadDeg, exaggeration } = values;

  if (redDeviationDeg === null || violetDeviationDeg === null) {
    // 射出光がなければ物理の分離幅も描画の分離幅も定まらない。括弧書きを足さない
    return UNAVAILABLE;
  }

  const physical = formatAngle(violetDeviationDeg - redDeviationDeg);

  if (exaggeration === 1) {
    return physical;
  }

  return `${physical}（描画は ×${exaggeration} で ${formatAngle(drawnSpreadDeg)}）`;
}

/**
 * 入射面の反射率を表示用の文字列にする。
 *
 * **絵の明るさとは別物である。** 描画側は暗すぎて見えない反射光を表示ゲインで持ち上げるが、
 * ここに出すのは生の R。入射角を上げると 5.9% → 90% と上がっていくのが物理の事実であり、
 * 教材として読み取ってほしいのはこの数値の方である。
 *
 * @param reflectance 入射面の反射率（0〜1）。定まらなければ null
 * @returns 例 `5.9%`
 */
function formatEntryReflection(reflectance: number | null): string {
  if (reflectance === null) {
    return UNAVAILABLE;
  }

  return `${(reflectance * 100).toFixed(1)}%`;
}

/**
 * 全反射の有無を表示用の文字列にする。
 *
 * 「内部区間が 2 本以上」だけでは足りない。頂角の近くへ入射すると光が角に捕まり、
 * 射出しないまま追跡上限で打ち切られる（termination が `bounceLimit`）。このとき内部区間は
 * 1 本しか残らないので、区間数だけを見ると「全反射なし」と誤って出る。
 * termination の内訳を先に見ることで、閉じ込めを取りこぼさない。
 *
 * @param values 表示する数値一式
 * @returns 例 `あり（48 本中 22 本が全反射を経て射出）`
 */
function formatReflection(values: InfoValues): string {
  const { pathCount, trappedCount, totalReflectionCount } = values;

  if (values.missed) {
    return `${UNAVAILABLE}（ビームがプリズムを外れています）`;
  }

  if (trappedCount > 0) {
    return `あり（${pathCount} 本中 ${trappedCount} 本は射出せず内部で打ち切り）`;
  }

  if (totalReflectionCount === 0) {
    return 'なし';
  }

  return `あり（${pathCount} 本中 ${totalReflectionCount} 本が全反射を経て射出）`;
}
