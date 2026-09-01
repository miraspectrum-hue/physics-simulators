/**
 * 断面図の角度弧を組み立てる純粋関数（TASKS 6-1 段階4a）。
 *
 * DOM にも Three にも触れない（`dispersionViewport.ts` と同じ立場で、scene 層に属しつつ
 * Vitest の対象になる）。SVG 要素の生成やラベルの配置は段階4b の責務。
 *
 * 扱うのは**断面座標 uv の 2 次元**である。v は上向き（数学の慣習）なので、角の正の向きは
 * 反時計回り（CCW）になる。SVG へ写すときに `uvToSvg()` が y を反転するため、
 * **絵の上では時計回りに見える** — その反転は描画側の責任で、ここでは扱わない。
 *
 * **物理は再計算しない。** 角を測る相手（入射方向・面法線）は既に求まっている量であり、
 * ここが持つのは「2 本の向きから角を出す」「その角を弧の点列にする」という幾何だけである。
 */

import type { PlaneUV } from '../types/optics';

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/**
 * 単位ベクトル判定の許容差。
 * `normalize()` の結果は丸めで長さが 1 から 1e-16 程度ずれるため厳密比較はできない。
 * `screenPlane.ts` / `dispersionPlane.ts` と同じ値・同じ流儀（モジュール内の私的ガード）に倣う。
 */
const UNIT_LENGTH_TOLERANCE = 1e-9;

/**
 * 2 次元の点が有限であることを検証する。
 *
 * @param point 検証する点
 * @param label エラーメッセージ用の引数名
 * @throws {RangeError} 非有限な成分がある場合
 */
function assertFinitePoint(point: PlaneUV, label: string): void {
  if (!Number.isFinite(point.u) || !Number.isFinite(point.v)) {
    throw new RangeError(
      `${label}の成分は有限数である必要があります（受け取った値: ${point.u}, ${point.v}）`
    );
  }
}

/**
 * 2 次元の向きが有限かつ単位ベクトルであることを検証する。
 *
 * **零ベクトルをここで弾くことに意味がある。** `atan2(0, 0)` は例外を投げずに 0 を返すので、
 * 長さを見ないと「向きが定まらない入力」が角 0 として静かに通ってしまう。
 * 非有限も同様で、長さの比較は NaN では常に false になり単位性の検査を素通りする。
 *
 * @param direction 検証する向き
 * @param label エラーメッセージ用の引数名
 * @throws {RangeError} 非有限、または単位ベクトルでない場合
 */
function assertUnitDirection(direction: PlaneUV, label: string): void {
  assertFinitePoint(direction, label);

  const currentLength = Math.hypot(direction.u, direction.v);

  if (Math.abs(currentLength - 1) > UNIT_LENGTH_TOLERANCE) {
    throw new RangeError(`${label}は単位ベクトルである必要があります（長さ: ${currentLength}）`);
  }
}

/**
 * 2 次元ベクトルを単位ベクトルにする。
 *
 * 弧の向きは「区間の始点と終点の差」から作るので、正規化が要る。零ベクトルは
 * 向きが定まらないため弾く（0 除算で NaN を返して静かに壊れるのを防ぐ）。
 *
 * @param vector 正規化する 2 次元ベクトル
 * @returns 同じ向きの単位ベクトル
 * @throws {RangeError} 非有限、または長さが 0 の場合
 */
export function normalizeUv(vector: PlaneUV): PlaneUV {
  assertFinitePoint(vector, '正規化するベクトル');

  const currentLength = Math.hypot(vector.u, vector.v);

  if (currentLength === 0) {
    throw new RangeError('長さ 0 のベクトルは向きを持ちません');
  }

  return { u: vector.u / currentLength, v: vector.v / currentLength };
}

/**
 * 2 本の向きのあいだの符号付き角を求める。
 *
 * 反時計回り（CCW）が正。`atan2(外積, 内積)` なので値域は (-180, 180] に収まり、
 * **常に短い方の回り方**を返す。真後ろ（反平行）だけは +180 になる。
 *
 * @param from 起点の向き（単位ベクトル）
 * @param to 終点の向き（単位ベクトル）
 * @returns `from` から `to` への符号付き角 [deg]。CCW が正で (-180, 180]
 * @throws {RangeError} いずれかが非有限、または単位ベクトルでない場合
 */
export function signedAngleDeg(from: PlaneUV, to: PlaneUV): number {
  assertUnitDirection(from, '起点の向き');
  assertUnitDirection(to, '終点の向き');

  // atan2(外積, 内積)。外積の符号がそのまま回り方（CCW が正）になり、
  // 値域が (-180, 180] に収まるので、常に短い方の回り方が返る
  const cross = from.u * to.v - from.v * to.u;
  const dot = from.u * to.u + from.v * to.v;

  return Math.atan2(cross, dot) * DEG_PER_RAD;
}

/**
 * 円弧上の点列を求める。
 *
 * `fromDir` から `toDir` へ、`signedAngleDeg()` が返す向き・大きさで掃引する。
 * したがって描かれるのは常に **|角| <= 180 の短い方の弧**である。
 *
 * 点列は円弧を等角で刻んだもので、長さは `segments + 1`（両端を含む）。
 * 最初の点は `center + radius·fromDir`、最後の点は `center + radius·toDir` に一致する。
 *
 * @param center 弧の中心（断面座標）
 * @param radius 弧の半径。正の有限数
 * @param fromDir 掃引の始まりの向き（単位ベクトル）
 * @param toDir 掃引の終わりの向き（単位ベクトル）
 * @param segments 弧を刻む数。1 以上の整数
 * @returns 弧上の点列（長さ `segments + 1`）
 * @throws {RangeError} center が非有限、radius が正の有限数でない、
 *                      向きが単位ベクトルでない、または segments が 1 以上の整数でない場合
 */
export function arcPolyline(
  center: PlaneUV,
  radius: number,
  fromDir: PlaneUV,
  toDir: PlaneUV,
  segments: number
): readonly PlaneUV[] {
  assertFinitePoint(center, '弧の中心');

  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError(`弧の半径は正の有限数である必要があります（受け取った値: ${radius}）`);
  }

  if (!Number.isInteger(segments) || segments < 1) {
    throw new RangeError(`刻み数は 1 以上の整数である必要があります（受け取った値: ${segments}）`);
  }

  // 向きの検証は signedAngleDeg に委ねる（同じ検査を 2 か所に持たない）
  const sweepDeg = signedAngleDeg(fromDir, toDir);
  const points: PlaneUV[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const angleRad = ((sweepDeg * index) / segments) * RAD_PER_DEG;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    points.push({
      u: center.u + radius * (fromDir.u * cos - fromDir.v * sin),
      v: center.v + radius * (fromDir.u * sin + fromDir.v * cos),
    });
  }

  return points;
}
