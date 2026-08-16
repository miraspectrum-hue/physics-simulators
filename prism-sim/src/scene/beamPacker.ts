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
 * Three には依存しない（色の sRGB → 作業色空間の変換は `THREE.Color` を使う別の関心事で、
 * 波長ごとに一定なので初期化時に一度だけ計算する）。
 *
 * NOTE: `packSegmentPositions` は呼び出し側が持つバッファへ書き込む。
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
  const required = beamBufferLength(paths.length);

  // 容量ではなく厳密一致を要求する。余りが出ると「末尾に何を書くか」が未定義になるため
  if (target.length !== required) {
    throw new RangeError(
      `位置バッファの長さが一致しません（必要 ${required} / 実際 ${target.length}）`
    );
  }

  paths.forEach((path, pathIndex) => {
    const { segments } = path;

    if (segments.length === 0 || segments.length > MAX_SEGMENTS_PER_PATH) {
      throw new RangeError(
        `光路 ${pathIndex} の区間数 ${segments.length} が 1〜${MAX_SEGMENTS_PER_PATH} の範囲外です`
      );
    }

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
