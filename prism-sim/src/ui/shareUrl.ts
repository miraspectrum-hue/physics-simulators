import {
  DEFAULT_PRISM_ROTATION_DEG,
  DEFAULT_PRISM_X,
  DEFAULT_PRISM_Y,
} from '../scene/prismPose';
import type { MaterialName, SpectrumMode } from '../types/optics';

import type { AppState } from './store';
import {
  clampState,
  DEFAULT_EXAGGERATION,
  DEFAULT_MATERIAL,
  DEFAULT_SCREEN_DISTANCE,
  DEFAULT_SOURCE_ANGLE_DEG,
  DEFAULT_SPECTRUM_MODE,
} from './store';

/**
 * 共有可能な状態と URL 断片の相互変換（TASKS 6-6 段階1・2）。
 *
 * DOM にも Three にも store の実体にも触らない純粋関数だけを置く（`store.ts` と同じ立場で
 * Vitest の対象になる）。**4 つの住処から値を集めること／配ることは段階3 の責務**で、
 * ここが知っているのは「集まった 1 つの `ShareableState` を文字列にする／から戻す」だけである。
 *
 * この分離が要る理由は、プリズムの姿勢の単一の真実が `Object3D.matrix` にあり、
 * 断面図のトグルが `aria-pressed` にあり、スクリーンのアンカーが配線側のクロージャに
 * ある、という現状を**動かさない**ためである（CLAUDE.md「プリズム姿勢をオイラー角で
 * 自前に二重保持することの禁止」。所有権を store へ移すと `TransformControls` が
 * ドラッグ中に直書きする quaternion と競合し、3-5b で潰したエコー問題が再発する）。
 * 集約はシリアライズの境界で行い、`encodeUrl` / `decodeUrl` は `ShareableState` しか見ない。
 *
 * **`decodeUrl` は決して例外を投げない。** 未知キーは無視、欠損は既定、解釈不能も既定、
 * 範囲外は `store` の `clampState` に通す。この寛容さが、Phase 4/5 で項目を足すときの
 * 手戻りを防ぐ（古いビルドが新しい URL を読んでも壊れず、新しいビルドが古い URL を
 * 読めば足りない項目に既定が入る＝**加算的**に育つ）。
 */

/** URL 断片のスキーマ版。**加算（キーの追加）では上げない。** */
export const SHARE_SCHEMA_VERSION = 1;

/** 断面図の既定の表示状態。 */
export const DEFAULT_SECTION_VISIBLE = false;

/** Bloom（グロー）の既定の有効状態（TASKS 4-7）。 */
export const DEFAULT_GLOW_ENABLED = true;

/** 情報バー（数値表示）の既定の表示状態（TASKS 4-7）。 */
export const DEFAULT_NUMBERS_VISIBLE = true;

/** 3 成分の座標値。カメラの位置・注視点はこの形で共有する（カメラ共有）。 */
export interface ShareableVec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * カメラ位置の既定値（カメラ共有）。
 *
 * `SceneManager` の起動時カメラ位置（`DEFAULT_CAMERA_Z = 6.5`）と同じ値。
 * ここへ import すると scene 層から ui 層への逆依存になるため、定数として独立に持つ
 * （glow/nums が sceneManager/panel の実体を知らずに独立フィールドで持つのと同じ形）。
 */
export const DEFAULT_CAMERA_POSITION: ShareableVec3 = { x: 0, y: 0, z: 6.5 };

/** カメラの注視点の既定値（カメラ共有）。`OrbitControls.target` の既定 `(0,0,0)` と同じ値。 */
export const DEFAULT_CAMERA_TARGET: ShareableVec3 = { x: 0, y: 0, z: 0 };

/**
 * スクリーンの凍結アンカー。
 *
 * 全光路が主断面（z = 0）に載るので、`ExitAnchor` の 6 成分は
 * **x・y・方向角の 3 数値**で過不足なく表せる。
 */
export interface ShareableAnchor {
  /** 射出点の平均の x（ワールド） */
  readonly x: number;
  /** 射出点の平均の y（ワールド） */
  readonly y: number;
  /** 射出方向のワールド角 [deg]。+x 軸から反時計回り */
  readonly directionDeg: number;
}

/**
 * URL で復元する状態の全体。
 *
 * 4 つの住処（store / `Object3D` / 配線側のクロージャ / `aria-pressed`）から集めた値を
 * 1 つに束ねたもの。**符号化・復号はこの型だけを見る。**
 */
export interface ShareableState {
  /** store が持つ 4 項目。 */
  readonly app: AppState;
  /** プリズムの Z 軸回転 [deg]。`Object3D.rotation.z` から読む */
  readonly prismRotationDeg: number;
  /** プリズムの位置 x（ワールド） */
  readonly prismX: number;
  /** プリズムの位置 y（ワールド） */
  readonly prismY: number;
  /**
   * スクリーンの凍結アンカー。
   *
   * **null は「URL が指定していない」を意味する**（既定値ではない）。アンカーは
   * 起動時に光路から導出される値なので、定数の既定を持たない。復元側は null を
   * 「起動時に導出したものをそのまま使う」と解釈する。
   */
  readonly screenAnchor: ShareableAnchor | null;
  /** 断面図を表示しているか */
  readonly sectionVisible: boolean;
  /**
   * Bloom（グロー）が有効か（TASKS 4-7）。
   *
   * `sectionVisible` と同じ独立フィールド。ポストプロセスの ON/OFF は光路の計算に
   * 無関係なので `AppState` には入れない（4-3 で spectrumMode を store に置いた基準の裏返し）。
   */
  readonly glowEnabled: boolean;
  /**
   * 情報バー（数値表示）が見えているか（TASKS 4-7）。
   *
   * DOM の表示切替のみで計算に無関係。`glowEnabled` と同じ理由で独立フィールドに置く。
   */
  readonly numbersVisible: boolean;
  /**
   * カメラ位置（ワールド座標）（カメラ共有）。
   *
   * `glowEnabled`/`numbersVisible` と同じ独立フィールド。`AppState` には入れない
   * ——視点を変えても世界座標も光路も動かないため（`traceSpectrum` の入力に無関係）。
   * 真実は `camera.position` そのもので、ここには複製した値を渡すだけである
   * （`Object3D.matrix` が姿勢の単一の真実なのと同型。別変数に二重保持しない）。
   *
   * Perspective カメラでは `OrbitControls` のドリー（ズーム）が `camera.zoom` ではなく
   * `camera.position` の移動に畳み込まれるため（`zoom` は Orthographic のときだけ動く）、
   * 視点は position + target の 2 点で過不足なく定まる（`camera.up` も不変のため不要）。
   */
  readonly cameraPosition: ShareableVec3;
  /** カメラの注視点（`OrbitControls.target`、ワールド座標）（カメラ共有）。 */
  readonly cameraTarget: ShareableVec3;
}

/**
 * 材質名 → URL 上のコード。
 *
 * `MaterialName` に日本語が含まれるため、そのまま載せると percent-encoding で読めなくなる。
 * `Record<MaterialName, string>` と型付けることで、材質を足したらここへの登録を
 * コンパイラが強制する（`MATERIALS` と同じ手。TASKS 2-8）。
 */
export const MATERIAL_CODES: Record<MaterialName, string> = {
  BK7: 'bk7',
  SF10: 'sf10',
  水: 'water',
  ダイヤモンド: 'diamond',
};

/**
 * スペクトル表示モード → URL 上のコード（TASKS 4-3）。
 *
 * 材質と同じ網羅パターン。`Record<SpectrumMode, string>` と型付けることで、
 * モードを足したらここへの登録をコンパイラが強制する。
 */
export const SPECTRUM_MODE_CODES: Record<SpectrumMode, string> = {
  continuous: 'cont',
  sevenColor: '7',
};

/** 何も指定しなかったときの状態。`encodeUrl` はこれと同じ項目を省く。 */
export const DEFAULT_SHAREABLE_STATE: ShareableState = {
  app: {
    sourceAngleDeg: DEFAULT_SOURCE_ANGLE_DEG,
    exaggeration: DEFAULT_EXAGGERATION,
    material: DEFAULT_MATERIAL,
    screenDistance: DEFAULT_SCREEN_DISTANCE,
    spectrumMode: DEFAULT_SPECTRUM_MODE,
  },
  prismRotationDeg: DEFAULT_PRISM_ROTATION_DEG,
  prismX: DEFAULT_PRISM_X,
  prismY: DEFAULT_PRISM_Y,
  screenAnchor: null,
  sectionVisible: DEFAULT_SECTION_VISIBLE,
  glowEnabled: DEFAULT_GLOW_ENABLED,
  numbersVisible: DEFAULT_NUMBERS_VISIBLE,
  cameraPosition: DEFAULT_CAMERA_POSITION,
  cameraTarget: DEFAULT_CAMERA_TARGET,
};

/**
 * 小数の桁数。**「絵が動かないこと」を基準に決める。**
 *
 * 当初は「入力の粒度に合わせる」（スライダーの刻みより細かく載せない）としていたが、
 * これは誤った基準だった。**アンカーはスライダー入力ではなく光路から計算された値**で、
 * 合わせるべき入力粒度が存在しない。3 桁にしたところ、アンカーの誤差 3.2e-4 に
 * スクリーン距離 9.5 が掛かり、48 本のビームのクリップ位置が動いて、往復前後で
 * 虹の縁の画素が 8,786 成分ずれた（実測）。
 *
 * そこで**世界の幾何に効く量はすべて 6 桁**に揃える。この桁で往復の画素差は 0 になる。
 * `screenDistance` も含める。UI のスライダーは 0.5 刻みなので 1 桁でも往復するが、
 * URL から 0.5 の倍数でない値（`sd=9.53` など）を受け取ると 1 桁では 0.03 落ち、
 * 実測で 580 成分ずれた。**表現できない値を黙って動かさない**方を採る。
 * `exaggeration` だけは整数のままでよい（倍率であって座標ではない）。
 */
const DECIMALS = {
  sourceAngleDeg: 6,
  exaggeration: 0,
  screenDistance: 6,
  prismRotationDeg: 6,
  prismPosition: 6,
  anchor: 6,
  camera: 6,
} as const;

/** アンカーの成分数（x, y, 方向角）。 */
const ANCHOR_PART_COUNT = 3;

/** カメラ視点の成分数（position の x,y,z + target の x,y,z）。 */
const CAMERA_PART_COUNT = 6;

/**
 * 指定の桁へ丸める。
 *
 * @param value 丸める値
 * @param decimals 小数桁
 * @returns 丸めた値
 */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

/**
 * 数値を断片の値にする。末尾の 0 は `String` が落とす。
 *
 * `+ 0` を挟むのは -0 を "0" と書くため。
 *
 * @param value 載せる値
 * @param decimals 小数桁
 * @returns 例 `49.323348`、`30`
 */
function formatNumber(value: number, decimals: number): string {
  return String(roundTo(value, decimals) + 0);
}

/**
 * 既定と違うときだけ数値を積む。
 *
 * 比較は**丸めた後の値**で行う。丸めて同じになる値を載せても、復元したときに
 * 区別が付かないためである。非有限は載せない（URL に NaN を持ち込まない）。
 *
 * @param parts 積み先
 * @param key キー
 * @param value 載せる値
 * @param defaultValue 既定値
 * @param decimals 小数桁
 */
function putNumber(
  parts: string[],
  key: string,
  value: number,
  defaultValue: number,
  decimals: number
): void {
  if (!Number.isFinite(value) || roundTo(value, decimals) === roundTo(defaultValue, decimals)) {
    return;
  }

  parts.push(key + '=' + formatNumber(value, decimals));
}

/**
 * 断片をキーと値の表に開く。**投げない。**
 *
 * `URLSearchParams` の解析は寛容で、壊れた percent-encoding もそのまま文字として扱う
 * （`new URLSearchParams('%%%')` は例外にならない）。それでも念のため包む。
 *
 * @param fragment URL 断片。先頭の `#` はあってもなくてもよい
 * @returns 解析結果。解析できなければ空
 */
function readParams(fragment: string): URLSearchParams {
  const body = fragment.startsWith('#') ? fragment.slice(1) : fragment;

  try {
    return new URLSearchParams(body);
  } catch {
    return new URLSearchParams();
  }
}

/**
 * 数値を読む。欠損・空・解釈不能はすべて既定値。
 *
 * `Number('')` は 0 になるので、空文字は数として読む前に弾く。
 * `NaN` / `Infinity` は有限性の検査で落ちる。
 *
 * @param params 表
 * @param key キー
 * @param defaultValue 既定値
 * @returns 読めた値、または既定値
 */
function readNumber(params: URLSearchParams, key: string, defaultValue: number): number {
  const raw = params.get(key);

  if (raw === null || raw.trim() === '') {
    return defaultValue;
  }

  const value = Number(raw);

  return Number.isFinite(value) ? value : defaultValue;
}

/**
 * 真偽値を読む。`1` と `0` だけを認め、他はすべて既定値。
 *
 * @param params 表
 * @param key キー
 * @param defaultValue 既定値
 * @returns 読めた値、または既定値
 */
function readBoolean(params: URLSearchParams, key: string, defaultValue: boolean): boolean {
  const raw = params.get(key);

  if (raw === '1') {
    return true;
  }

  if (raw === '0') {
    return false;
  }

  return defaultValue;
}

/**
 * 材質コードを読む。未知のコードは既定の BK7。
 *
 * 逆引きは `MATERIAL_CODES` を走査して作る。逆向きの表を別に持つと、材質を足したときに
 * 片方だけ更新される余地が生まれる。
 *
 * @param params 表
 * @returns 材質名
 */
function readMaterial(params: URLSearchParams): MaterialName {
  const raw = params.get('mat');
  const entries = Object.entries(MATERIAL_CODES) as Array<[MaterialName, string]>;
  const found = entries.find(([, code]) => code === raw);

  return found?.[0] ?? DEFAULT_MATERIAL;
}

/**
 * モードコードを読む。未知のコードは既定の連続モード。
 *
 * 逆引きは `SPECTRUM_MODE_CODES` を走査して作る（`readMaterial` と同じ手）。
 * 逆向きの表を別に持つと、モードを足したときに片方だけ更新される余地が生まれる。
 *
 * @param params 表
 * @returns 表示モード
 */
function readSpectrumMode(params: URLSearchParams): SpectrumMode {
  const raw = params.get('spec');
  const entries = Object.entries(SPECTRUM_MODE_CODES) as Array<[SpectrumMode, string]>;
  const found = entries.find(([, code]) => code === raw);

  return found?.[0] ?? DEFAULT_SPECTRUM_MODE;
}

/**
 * アンカーを読む。指定が無い・成分数が違う・数として読めない場合は null。
 *
 * null は「URL が指定していない」であって既定値ではない。復元側は
 * 「起動時に光路から導出したものをそのまま使う」と解釈する。
 *
 * @param params 表
 * @returns アンカー、または null
 */
function readAnchor(params: URLSearchParams): ShareableAnchor | null {
  const raw = params.get('sa');

  if (raw === null) {
    return null;
  }

  const parts = raw.split(',');

  if (parts.length !== ANCHOR_PART_COUNT) {
    return null;
  }

  const [x, y, directionDeg] = parts.map(Number);

  if (
    x === undefined ||
    y === undefined ||
    directionDeg === undefined ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(directionDeg)
  ) {
    return null;
  }

  return { x, y, directionDeg };
}

/**
 * カメラ視点を複合キー `cam` として積む（カメラ共有）。
 *
 * `sa` と同じ手動カンマ結合（`URLSearchParams.toString()` の `%2C` 変換を避ける）だが、
 * 省略の判定が `sa` とは違う。**6 成分すべてが丸め後に既定と一致するときだけ、
 * `cam` ごと省く。** 1 成分でも既定と違えば 6 値をまとめて載せる（間引かない）。
 * position/target を別々に省略可否判定すると、「position だけ既定・target だけ非既定」
 * のような部分一致 URL が生まれ、複合キー 1 本という設計と矛盾する。
 *
 * @param parts 積み先
 * @param position カメラ位置
 * @param target 注視点
 * @param defaults 既定の状態
 */
function putCamera(
  parts: string[],
  position: ShareableVec3,
  target: ShareableVec3,
  defaults: ShareableState
): void {
  const { x: px, y: py, z: pz } = position;
  const { x: tx, y: ty, z: tz } = target;

  // 非有限が混じっていたら丸ごと省く（URL に NaN を持ち込まない。putNumber と同じ規約）
  if (
    !Number.isFinite(px) ||
    !Number.isFinite(py) ||
    !Number.isFinite(pz) ||
    !Number.isFinite(tx) ||
    !Number.isFinite(ty) ||
    !Number.isFinite(tz)
  ) {
    return;
  }

  const decimals = DECIMALS.camera;
  const dp = defaults.cameraPosition;
  const dt = defaults.cameraTarget;

  const allDefault =
    roundTo(px, decimals) === roundTo(dp.x, decimals) &&
    roundTo(py, decimals) === roundTo(dp.y, decimals) &&
    roundTo(pz, decimals) === roundTo(dp.z, decimals) &&
    roundTo(tx, decimals) === roundTo(dt.x, decimals) &&
    roundTo(ty, decimals) === roundTo(dt.y, decimals) &&
    roundTo(tz, decimals) === roundTo(dt.z, decimals);

  if (allDefault) {
    return;
  }

  parts.push(
    'cam=' + [px, py, pz, tx, ty, tz].map((value) => formatNumber(value, decimals)).join(',')
  );
}

/**
 * カメラ視点を読む。指定が無い・成分数が違う・数として読めない場合は既定視点。
 *
 * `sa`（screenAnchor）と違い、カメラ視点は「起動時に光路から導出される値」ではなく
 * コード上の定数（`SceneManager` の初期カメラ位置と同じ）を既定として持つ。
 * そのため欠損・解釈不能はどちらも同じ既定へ落とせばよく、`sa` のような
 * 「null＝指定なし、呼び出し側が導出」という中間状態を持たない。
 *
 * @param params 表
 * @param defaults 既定の状態
 * @returns カメラ位置と注視点の組
 */
function readCamera(
  params: URLSearchParams,
  defaults: ShareableState
): { cameraPosition: ShareableVec3; cameraTarget: ShareableVec3 } {
  const fallback = {
    cameraPosition: defaults.cameraPosition,
    cameraTarget: defaults.cameraTarget,
  };
  const raw = params.get('cam');

  if (raw === null) {
    return fallback;
  }

  const parts = raw.split(',').map(Number);

  if (parts.length !== CAMERA_PART_COUNT) {
    return fallback;
  }

  const [px, py, pz, tx, ty, tz] = parts;

  if (
    px === undefined ||
    py === undefined ||
    pz === undefined ||
    tx === undefined ||
    ty === undefined ||
    tz === undefined ||
    !Number.isFinite(px) ||
    !Number.isFinite(py) ||
    !Number.isFinite(pz) ||
    !Number.isFinite(tx) ||
    !Number.isFinite(ty) ||
    !Number.isFinite(tz)
  ) {
    return fallback;
  }

  return {
    cameraPosition: { x: px, y: py, z: pz },
    cameraTarget: { x: tx, y: ty, z: tz },
  };
}

/**
 * 状態を URL 断片へ符号化する。
 *
 * 返すのは先頭の `#` を**含まない**断片（例 `v=1&a=30&mat=sf10`）。
 * 既定と同じ項目は省く。
 *
 * **ただし実アプリの URL は既定でも `v=1&sa=…` になる。** `sa` を省くのは
 * `screenAnchor` が null のときだけで、null は「URL が指定していない」の意味である。
 * 実行時のスクリーンは案 C で常にどこかに置かれているので、
 * `collectShareableState()` は常に具体的なアンカーを返し、`sa` が必ず載る。
 * この非対称は矛盾ではなく、2 つの層で役割が違うことの反映である。
 *
 *   - `collect()`（実行時）: 未配置のスクリーンは存在しない → 常に値がある
 *   - `decode()`（URL）    : `sa` の欠損 = 指定なし → null → 受け取り側が導出する
 *
 * **常に載せる方を選ぶ。** 共有の本質は「送り手が見たものを受け手も見る」ことで、
 * 忠実性が第一の価値になる。`sa` を省くと受け取り側が起動時に導出し直すため、
 * 将来 `DEFAULT_SOURCE_ANGLE_DEG` などを変えた時点で古い URL が別の絵になる。
 * 40 文字のコストはこの忠実性の前では無視できる。「既定 URL は短く」は
 * 機能ではなく見た目の願望であり、衝突するなら忠実性が勝つ。
 *
 * 数値の桁は入力の粒度に合わせる。スライダーの刻みより細かく載せても意味が無く、
 * 逆に入射角だけは「最小偏角に合わせる」の高精度な着地を絵として保つために 6 桁要る
 * （6 桁でも 2.5e-10 度ずれるが、極小は二次で平坦なので δ の差は 1e-13 度未満になる）。
 *
 * @param state 符号化する状態
 * @returns URL 断片（`#` を含まない）
 */
export function encodeUrl(state: ShareableState): string {
  const defaults = DEFAULT_SHAREABLE_STATE;
  // `URLSearchParams.toString()` は `,` を %2C に変える。アンカーが読みにくくなるだけで
  // 得が無いので自分で組み立てる。載る値は URL 安全な文字だけ（数字・`.`・`-`・`,`・
  // 小文字英字）で、材質コードの網羅は Record<MaterialName, string> が強制する
  const parts: string[] = ['v=' + String(SHARE_SCHEMA_VERSION)];

  putNumber(
    parts,
    'a',
    state.app.sourceAngleDeg,
    defaults.app.sourceAngleDeg,
    DECIMALS.sourceAngleDeg
  );
  putNumber(parts, 'm', state.app.exaggeration, defaults.app.exaggeration, DECIMALS.exaggeration);

  if (state.app.material !== defaults.app.material) {
    parts.push('mat=' + MATERIAL_CODES[state.app.material]);
  }

  // **既定と一致しても省かない。** 他の項目と扱いを変えるのは、既定を将来動かしたときに
  // 過去の共有 URL が別のモードで描かれてしまうためである（6-6 段階4 で `sa` を
  // 常に出すと決めたのと同じ忠実性の判断）。載る絵は作られたときのままであるべき
  parts.push('spec=' + SPECTRUM_MODE_CODES[state.app.spectrumMode]);

  putNumber(
    parts,
    'sd',
    state.app.screenDistance,
    defaults.app.screenDistance,
    DECIMALS.screenDistance
  );
  putNumber(
    parts,
    'rz',
    state.prismRotationDeg,
    defaults.prismRotationDeg,
    DECIMALS.prismRotationDeg
  );
  putNumber(parts, 'px', state.prismX, defaults.prismX, DECIMALS.prismPosition);
  putNumber(parts, 'py', state.prismY, defaults.prismY, DECIMALS.prismPosition);

  const anchor = state.screenAnchor;

  if (anchor !== null) {
    const format = (value: number): string => formatNumber(value, DECIMALS.anchor);

    parts.push(
      'sa=' + format(anchor.x) + ',' + format(anchor.y) + ',' + format(anchor.directionDeg)
    );
  }

  if (state.sectionVisible !== defaults.sectionVisible) {
    parts.push('sec=' + (state.sectionVisible ? '1' : '0'));
  }

  // グロー・数値表示（TASKS 4-7）。sec と同じ非対称：既定と同じなら省く。
  // 表示専用の boolean は「既定 ON なら省略」で URL を綺麗に保つ。計算モードの enum
  // （spec）とは扱いが違う（あちらは既定が動いたときの忠実性を優先して常に出す）
  if (state.glowEnabled !== defaults.glowEnabled) {
    parts.push('glow=' + (state.glowEnabled ? '1' : '0'));
  }

  if (state.numbersVisible !== defaults.numbersVisible) {
    parts.push('nums=' + (state.numbersVisible ? '1' : '0'));
  }

  // カメラ視点（カメラ共有）。glow/nums と同じ独立フィールドだが、6 値の複合キーなので
  // 単純な !== 比較ではなく putCamera が丸め後の一致判定と省略をまとめて行う
  putCamera(parts, state.cameraPosition, state.cameraTarget, defaults);

  return parts.join('&');
}

/**
 * URL 断片を状態へ復号する。
 *
 * **決して例外を投げない。** 規則は 5 つ。
 *   1. 未知キーは無視する（将来の版が付けたキーを古い版が読んでも壊れない）
 *   2. 欠損したキーは既定値
 *   3. 解釈できない値も既定値
 *   4. 値域を外れた値は `store` の `clampState` に通す（値域の判定元を二重化しない）
 *   5. 未知の材質コードは既定の BK7
 *
 * `v` が無い場合も未知の値の場合も、現行のスキーマとして読む。**加算的な変更では
 * `v` を上げない**ので、`v` を見て分岐するのは既存キーの意味が変わったときだけになる。
 *
 * @param fragment URL 断片。先頭の `#` はあってもなくてもよい
 * @returns 復号した状態。読めない項目には既定値が入る
 */
export function decodeUrl(fragment: string): ShareableState {
  const params = readParams(fragment);
  const defaults = DEFAULT_SHAREABLE_STATE;

  // 値域の正解は clampState にしかない。ここで範囲を書き直さない
  const app = clampState({
    sourceAngleDeg: readNumber(params, 'a', defaults.app.sourceAngleDeg),
    exaggeration: readNumber(params, 'm', defaults.app.exaggeration),
    material: readMaterial(params),
    screenDistance: readNumber(params, 'sd', defaults.app.screenDistance),
    spectrumMode: readSpectrumMode(params),
  });

  // 姿勢とアンカーには確立した値域が無い（回転はギズモで連続、位置は無制限）。
  // 有限性だけを見て、外れたら既定へ落とす
  const camera = readCamera(params, defaults);

  return {
    app,
    prismRotationDeg: readNumber(params, 'rz', defaults.prismRotationDeg),
    prismX: readNumber(params, 'px', defaults.prismX),
    prismY: readNumber(params, 'py', defaults.prismY),
    screenAnchor: readAnchor(params),
    sectionVisible: readBoolean(params, 'sec', defaults.sectionVisible),
    // readBoolean は '1'/'0' だけを認め、欠損・未知はすべて既定（true）に落ちる
    glowEnabled: readBoolean(params, 'glow', defaults.glowEnabled),
    numbersVisible: readBoolean(params, 'nums', defaults.numbersVisible),
    cameraPosition: camera.cameraPosition,
    cameraTarget: camera.cameraTarget,
  };
}
