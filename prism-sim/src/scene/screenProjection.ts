/**
 * 射出光を仮想スクリーンへ投影するための純粋関数群（TASKS 6-3 の幾何部分）。
 *
 * Three.js / DOM には依存しない。`beamPacker.ts` と同じく「scene 層に属するが
 * Three の数学にも触れない」ため、Vitest の対象になる（CLAUDE.md のテスト方針）。
 *
 * **`src/optics/` には一切変更を加えない。** レイと平面の交差は既存の
 * `intersectRayPlane()`（t を返す）と `pointOnRay()`（t から点を作る）の合成で賄い、
 * uv は `worldToPlaneUV()` に委ねる。ここが持つのは「どの波長を採用するか」という
 * **描画側の方針**だけで、幾何そのものは optics の関数が持つ。
 *
 * 射出方向は**必ず最終区間（外部区間）から取る**。内部区間は θ₁ = 0 で長さ 0 に
 * 縮退しうるため、向きの正規化に使ってはならない（I-6 で確定した規約）。
 */

import { intersectRayPlane, plane, pointOnRay, ray } from '../optics/convexSolid';
import { worldToPlaneUV } from '../optics/screenPlane';
import { add, dot, normalize, scale, sub, vec3 } from '../optics/vec3';
import type { LightPath, PlaneUV, Ray, ScreenPlane, Segment, Vec3 } from '../types/optics';

/**
 * 光路の最終区間を取り出す。
 *
 * 射出方向はここからしか取らない（内部区間は縮退しうる）。
 *
 * @param path 光路
 * @returns 最終区間。区間が無ければ undefined
 */
function lastSegment(path: LightPath): Segment | undefined {
  return path.segments[path.segments.length - 1];
}

/**
 * 最終区間から射出レイを作る。
 *
 * @param segment 最終区間（外部区間）
 * @returns 射出点を始点とする単位方向のレイ
 */
function exitRay(segment: Segment): Ray {
  return ray(segment.start, normalize(sub(segment.end, segment.start)));
}

/**
 * 1 波長ぶんのスクリーン投影結果。
 *
 * スクリーンに載らなかった波長には `null` を割り当てるので、この型自体は
 * 「載った」ことを表す。
 */
export interface ScreenHit {
  /** 射出レイの交差パラメータ。射出点からスクリーンまでの距離に等しい */
  readonly t: number;
  /** 交点（ワールド座標） */
  readonly point: Vec3;
  /** スクリーン面内の 2 次元座標 */
  readonly uv: PlaneUV;
}

/**
 * 射出光の代表的な位置と向き。「光路に合わせる」でスクリーンを置き直す基準になる。
 */
export interface ExitAnchor {
  /** 射出点の平均（ワールド座標） */
  readonly origin: Vec3;
  /** 射出方向の平均を正規化した単位ベクトル */
  readonly direction: Vec3;
}

/**
 * 各波長の射出レイをスクリーンへ投影する。
 *
 * 採用条件は 4 つすべてを満たすこと。1 つでも欠ければ `null` を返す。
 *   1. `termination === 'exited'`（射出していない光はスクリーンに届かない）
 *   2. `t > 0`（スクリーンが射出方向の前方にある）
 *   3. `|u| <= halfExtent`
 *   4. `|v| <= halfExtent`
 *
 * 境界（`|u| === halfExtent`）は**載っているものとして扱う**。矩形を閉集合と見る。
 *
 * @param paths 光路の束（波長順）
 * @param screen 投影先のスクリーン面
 * @returns 入力と同じ本数・同じ並びの投影結果。載らなかった波長は null
 */
export function projectPathsToScreen(
  paths: readonly LightPath[],
  screen: ScreenPlane
): readonly (ScreenHit | null)[] {
  // ScreenPlane は中心と面内軸を持つが、交差計算に要るのは無限平面 n·x = d だけ
  const infinitePlane = plane(screen.normal, dot(screen.normal, screen.origin));

  return paths.map((path) => {
    if (path.termination !== 'exited') {
      return null;
    }

    const segment = lastSegment(path);

    if (segment === undefined) {
      return null;
    }

    const outgoing = exitRay(segment);
    const t = intersectRayPlane(outgoing, infinitePlane);

    // 平行（null）と後方（t <= 0）はスクリーンに届かない
    if (t === null || t <= 0) {
      return null;
    }

    const point = pointOnRay(outgoing, t);
    const uv = worldToPlaneUV(screen, point);

    // 境界は載っているものとして扱うので比較は <= 側で書く
    if (Math.abs(uv.u) > screen.halfExtent || Math.abs(uv.v) > screen.halfExtent) {
      return null;
    }

    return { t, point, uv };
  });
}

/**
 * スクリーンに載った波長だけ、描画用に最終区間をスクリーンまでで打ち切る。
 *
 * 射出光は本来無限に伸びるので `EXIT_EXTENSION_LENGTH`（40）で打ち切って描いている。
 * スクリーンに当たる波長はそこで受け止められるのだから、交点までに縮めた方が絵として正しい。
 *
 * **交点の計算に 40 は一切関与しない。** ここで行うのは描画用の長さの差し替えだけで、
 * 採用されなかった波長（外れ・はみ出し・射出せず）は 40 のまま変えない。
 *
 * @param paths 光路の束
 * @param hits `projectPathsToScreen` の結果（同じ本数・同じ並び）
 * @returns 最終区間を差し替えた光路の束。入力は変更しない
 */
export function clipPathsToScreen(
  paths: readonly LightPath[],
  hits: readonly (ScreenHit | null)[]
): readonly LightPath[] {
  return paths.map((path, index) => {
    const hit = hits[index];

    if (hit === undefined || hit === null) {
      return path;
    }

    const lastIndex = path.segments.length - 1;

    // 最終区間だけを差し替える。それ以外は同じ参照のまま渡す（入力は変更しない）
    const segments = path.segments.map((segment, segmentIndex) =>
      segmentIndex === lastIndex
        ? // 打ち切るのは長さだけ。強度は光の量なので運び直す
          {
            start: segment.start,
            end: hit.point,
            insidePrism: segment.insidePrism,
            intensity: segment.intensity,
          }
        : segment
    );

    return {
      wavelengthNm: path.wavelengthNm,
      refractiveIndex: path.refractiveIndex,
      segments,
      termination: path.termination,
    };
  });
}

/**
 * スクリーンに載った波長が連続している区間（run）へ切り分ける。
 *
 * 帯は隣り合う波長どうしを結んで作るので、**脱落した波長を跨いで結んではならない**。
 * 跨ぐと、そこに光が届いていないのに帯が続いているという嘘の絵になる。
 *
 * 要素数 1 の run も返す。四角形を作れないので描画側が読み飛ばすが、
 * 「そこに 1 本だけ届いている」という事実はこの関数の管轄ではない。
 *
 * @param hits `projectPathsToScreen` の結果
 * @returns 連続する添字の配列の配列。載った波長が無ければ空配列
 */
export function splitOnScreenRuns(
  hits: readonly (ScreenHit | null)[]
): readonly (readonly number[])[] {
  const runs: number[][] = [];
  let current: number[] | null = null;

  for (let index = 0; index < hits.length; index += 1) {
    if (hits[index] === null || hits[index] === undefined) {
      // 脱落波長で run を打ち切る。ここを跨いで繋ぐと嘘の帯になる
      current = null;
      continue;
    }

    if (current === null) {
      current = [];
      runs.push(current);
    }

    current.push(index);
  }

  return runs;
}

/**
 * 射出光の代表的な位置と向きを求める。
 *
 * 「光路に合わせる」でスクリーンを置き直す基準に使う。射出した光路だけを平均し、
 * 射出していない光路（外れ・内部で打ち切り）は数に入れない。
 *
 * 射出方向は最終区間から取る（内部区間は縮退しうる）。
 *
 * @param paths 光路の束
 * @returns 射出点の平均と、射出方向の平均を正規化したもの。射出した光路が無ければ null
 */
export function meanExitAnchor(paths: readonly LightPath[]): ExitAnchor | null {
  let count = 0;
  let originSum = vec3(0, 0, 0);
  let directionSum = vec3(0, 0, 0);

  for (const path of paths) {
    if (path.termination !== 'exited') {
      continue;
    }

    const segment = lastSegment(path);

    if (segment === undefined) {
      continue;
    }

    originSum = add(originSum, segment.start);
    directionSum = add(directionSum, exitRay(segment).direction);
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  return { origin: scale(originSum, 1 / count), direction: normalize(directionSum) };
}
