import { MAX_BOUNCE_COUNT } from '../optics/constants';
import type { LightPath } from '../types/optics';

/**
 * 光路を線分バッファへ詰める。
 *
 * `LineSegments2` の位置属性は「区間ごとに始点 xyz と終点 xyz」を並べた平坦な配列である。
 * 区間数は光路ごとに変わるが、バッファを毎回作り直すと更新のたびに割り当てが発生するため、
 * **1 光路あたり最大区間数ぶんの枠を固定で確保し、余った枠は縮退区間（始点＝終点）で埋める**。
 * 縮退区間は長さ 0 なので描画されず、本数が変わっても確保量は一定に保てる。
 *
 * Three には依存しない（基準色の sRGB → 作業色空間の変換は `THREE.Color` を使う別の関心事で、
 * 波長ごとに一定なので初期化時に一度だけ計算する）。
 *
 * 頂点色も同じ枠割りで扱う（`packSegmentColors`）。強度は 1 本の光路の中でも区間ごとに
 * 変わるため（`Segment.intensity`）、色は波長ごとに 1 回決めるだけでは足りず、
 * **位置と同じく毎フレーム書き換える**。波長ごとに一定なのは基準色の方だけである。
 *
 * NOTE: `packSegmentPositions` / `packSegmentColors` は呼び出し側が持つバッファへ書き込む。
 *       `src/optics/` の純粋関数と違い、この書き込みこそが目的である
 *       （CLAUDE.md「毎フレームでの `new` を禁止」は scene 層に適用される）。
 *       同じ入力に対し同じ結果を書く点は変わらない。
 */

/**
 * 1 光路あたりの最大区間数。
 *
 * 入射（外部）1 本 + 内部の最大 `MAX_BOUNCE_COUNT` 本 + 射出（外部）1 本。
 * tracer の打ち切り条件から導くので、追跡上限を変えればここも追従する。
 */
export const MAX_SEGMENTS_PER_PATH = MAX_BOUNCE_COUNT + 2;

/** 1 頂点あたりの成分数（xyz）。 */
const COMPONENTS_PER_VERTEX = 3;

/** 1 区間あたりの端点数（始点・終点）。 */
const ENDPOINTS_PER_SEGMENT = 2;

/** 1 区間が占める要素数。 */
const FLOATS_PER_SEGMENT = ENDPOINTS_PER_SEGMENT * COMPONENTS_PER_VERTEX;

/** 光路 1 本が占める要素数。 */
const FLOATS_PER_PATH = MAX_SEGMENTS_PER_PATH * FLOATS_PER_SEGMENT;

/**
 * 光路 pathCount 本を収めるのに必要な位置バッファの長さを返す。
 *
 * @param pathCount 光路の本数
 * @returns Float32Array の要素数
 */
export function beamBufferLength(pathCount: number): number {
  return pathCount * FLOATS_PER_PATH;
}

/**
 * 表示用の強度写像。
 *
 * **非物理の演出であり、モデルには一切戻さない。** 実物理の強度をそのまま色に掛けると
 * 暗すぎて読めない光（入射面の部分反射など）を、見える明るさへ持ち上げるために使う。
 * 区間の添字を受け取るのは、光路の一部だけを描かない（＝強度 0 にする）ためである。
 *
 * @param intensity モデルが持つ相対強度（0〜1）
 * @param segmentIndex 光路内での区間の添字
 * @returns 描画に使う強度
 */
export type IntensityShaping = (intensity: number, segmentIndex: number) => number;

/** 既定の強度写像。何も変えない＝実物理をそのまま描く。 */
const identityIntensity: IntensityShaping = (intensity) => intensity;

/**
 * 書き込み先の長さが枠と厳密に一致することを検証する。
 *
 * 容量ではなく厳密一致を要求する。余りが出ると「末尾に何を書くか」が未定義になるため。
 *
 * @param target 書き込み先
 * @param pathCount 光路の本数
 * @param label エラーメッセージ用のバッファ名
 * @throws {RangeError} 長さが一致しない場合
 */
function assertTargetLength(target: Float32Array, pathCount: number, label: string): void {
  const required = beamBufferLength(pathCount);

  if (target.length !== required) {
    throw new RangeError(
      `${label}の長さが一致しません（必要 ${required} / 実際 ${target.length}）`
    );
  }
}

/**
 * 光路の区間数が枠に収まることを検証する。
 *
 * tracer は上限内に収めるが、詰め込み側でも黙って切り捨てない。
 * 区間 0 本は縮退の充填内容を決められないため同様に弾く。
 *
 * @param segmentCount 区間数
 * @param pathIndex 光路の添字（エラーメッセージ用）
 * @throws {RangeError} 区間数が 1〜上限の範囲外の場合
 */
function assertSegmentCount(segmentCount: number, pathIndex: number): void {
  if (segmentCount === 0 || segmentCount > MAX_SEGMENTS_PER_PATH) {
    throw new RangeError(
      `光路 ${pathIndex} の区間数 ${segmentCount} が 1〜${MAX_SEGMENTS_PER_PATH} の範囲外です`
    );
  }
}

/**
 * 光路の区間を位置バッファへ詰める。
 *
 * 光路ごとに `MAX_SEGMENTS_PER_PATH` 区間ぶんの枠を占め、実際の区間を先頭から並べ、
 * 余った枠はその光路の**最終区間の終点**で縮退させる。原点で埋めないのは、
 * 原点がプリズムの内部にあり、描画側の実装次第では見えるアーティファクトになりうるためである。
 * 最終点なら射出光の先端に重なるので、見えても光路の一部でしかない。
 *
 * @param paths 詰める光路（ワールド座標）。順序はそのまま保たれる
 * @param target 書き込み先。長さは `beamBufferLength(paths.length)` と一致すること
 * @returns 書き込んだ `target` そのもの
 * @throws {RangeError} 長さが一致しない場合、または区間数が 1〜上限の範囲外の光路がある場合
 */
export function packSegmentPositions(
  paths: readonly LightPath[],
  target: Float32Array
): Float32Array {
  assertTargetLength(target, paths.length, '位置バッファ');

  paths.forEach((path, pathIndex) => {
    const { segments } = path;

    assertSegmentCount(segments.length, pathIndex);

    const pathOffset = pathIndex * FLOATS_PER_PATH;

    segments.forEach((segment, segmentIndex) => {
      const offset = pathOffset + segmentIndex * FLOATS_PER_SEGMENT;

      target[offset] = segment.start.x;
      target[offset + 1] = segment.start.y;
      target[offset + 2] = segment.start.z;
      target[offset + 3] = segment.end.x;
      target[offset + 4] = segment.end.y;
      target[offset + 5] = segment.end.z;
    });

    // 余った枠は最終点で縮退させる。長さ 0 の線分は描画されない
    const last = segments[segments.length - 1];

    if (last === undefined) {
      return;
    }

    for (
      let segmentIndex = segments.length;
      segmentIndex < MAX_SEGMENTS_PER_PATH;
      segmentIndex += 1
    ) {
      const offset = pathOffset + segmentIndex * FLOATS_PER_SEGMENT;

      target[offset] = last.end.x;
      target[offset + 1] = last.end.y;
      target[offset + 2] = last.end.z;
      target[offset + 3] = last.end.x;
      target[offset + 4] = last.end.y;
      target[offset + 5] = last.end.z;
    }
  });

  return target;
}

/**
 * 波長ごとの基準色に区間の強度を掛け、頂点色バッファへ詰める。
 *
 * 枠割りは `packSegmentPositions` と同一である。同じ枠に同じ区間の色が載るので、
 * 「位置は区間 k のもの・色は区間 k+1 のもの」というずれが構造的に起こらない。
 *
 * **区間ごとに掛ける。** 強度は界面を通るたびに透過率 (1 − R) が掛かって落ちるので、
 * 1 本の光路の中でも入射区間・内部区間・射出区間で値が違う（`Segment.intensity`）。
 * 波長ごとに 1 色を割り当てるだけでは、プリズムに入る前と出た後が同じ明るさになってしまう。
 *
 * 余った枠は最終区間の強度で埋める。位置側でその枠が最終区間の終点に縮退しており、
 * 長さ 0 で描画されないため値そのものは絵に出ないが、**縮退区間は最終区間の続きである**
 * という位置側の扱いと辻褄を合わせておく。
 *
 * 既定では表示ゲインを掛けない。既定のまま使えば、ここに出るのは実物理の相対強度そのものである。
 * `shapeIntensity` を渡した場合だけ、**表示のためだけに**強度を写像してから色に掛ける
 * （モデル側の `Segment.intensity` は書き換えない）。
 *
 * @param paths 詰める光路。順序はそのまま保たれる
 * @param baseColors 波長ごとの基準色（作業色空間の rgb を並べたもの）。長さは `paths.length * 3`
 * @param target 書き込み先。長さは `beamBufferLength(paths.length)` と一致すること
 * @param shapeIntensity 表示用の強度写像。第 2 引数は光路内での区間の添字。既定は恒等写像
 * @returns 書き込んだ `target` そのもの
 * @throws {RangeError} 長さが一致しない場合、または区間数が 1〜上限の範囲外の光路がある場合
 */
export function packSegmentColors(
  paths: readonly LightPath[],
  baseColors: Float32Array,
  target: Float32Array,
  shapeIntensity: IntensityShaping = identityIntensity
): Float32Array {
  assertTargetLength(target, paths.length, '頂点色バッファ');

  const requiredBaseLength = paths.length * COMPONENTS_PER_VERTEX;

  if (baseColors.length !== requiredBaseLength) {
    throw new RangeError(
      `基準色バッファの長さが一致しません（必要 ${requiredBaseLength} / 実際 ${baseColors.length}）`
    );
  }

  paths.forEach((path, pathIndex) => {
    const { segments } = path;

    assertSegmentCount(segments.length, pathIndex);

    const baseOffset = pathIndex * COMPONENTS_PER_VERTEX;
    const baseR = baseColors[baseOffset] ?? 0;
    const baseG = baseColors[baseOffset + 1] ?? 0;
    const baseB = baseColors[baseOffset + 2] ?? 0;
    const pathOffset = pathIndex * FLOATS_PER_PATH;

    const lastIndex = segments.length - 1;
    const last = segments[lastIndex];
    // assertSegmentCount を通っているので最終区間は必ず存在する
    const fillIntensity =
      last === undefined ? 0 : shapeIntensity(last.intensity, lastIndex);

    for (
      let segmentIndex = 0;
      segmentIndex < MAX_SEGMENTS_PER_PATH;
      segmentIndex += 1
    ) {
      const segment = segments[segmentIndex];
      const intensity =
        segment === undefined ? fillIntensity : shapeIntensity(segment.intensity, segmentIndex);
      const offset = pathOffset + segmentIndex * FLOATS_PER_SEGMENT;

      // 始点・終点の 2 頂点。1 区間の中では強度が変わらないので同じ値を入れる
      target[offset] = baseR * intensity;
      target[offset + 1] = baseG * intensity;
      target[offset + 2] = baseB * intensity;
      target[offset + 3] = baseR * intensity;
      target[offset + 4] = baseG * intensity;
      target[offset + 5] = baseB * intensity;
    }
  });

  return target;
}
