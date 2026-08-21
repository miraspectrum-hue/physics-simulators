import { describe, expect, it } from 'vitest';

import { APEX_ANGLE_DEG } from '../../src/optics/constants';
import { createTriangularPrism, createTriangularPrismVertices } from '../../src/optics/convexSolid';
import { dispersionPlane, worldToDispersionUV } from '../../src/optics/dispersionPlane';
import { add, addScaled, cross, dot, length, negate, normalize, sub, vec3 } from '../../src/optics/vec3';
import type { Vec3 } from '../../src/types/optics';

/**
 * src/optics/dispersionPlane.ts の受け入れ条件（分散平面＝プリズム主断面への射影）。
 *
 * 対象:
 *   dispersionPlane(origin, axisU, apexEdgeNormal) — 原点と正規直交基底
 *   worldToDispersionUV(plane, point)              — ワールド点 → 断面 2 次元座標
 *
 * 設計判断:
 *   - `screenPlane()` と同じ形。`axisV` は `normal × axisU` から導出し、独立入力にしない。
 *     2 軸を渡させると直交していない組を受け取りうるが、導出すれば正規直交が構造的に
 *     保証される（invalid states unrepresentable）。
 *   - **基底はプリズムの姿勢から取る。** ワールド固定の基底にすると、プリズムを回した
 *     ときに断面図の中でプリズムが回ってしまい「プリズムを正面から見た図」でなくなる。
 *     D 節がこの帰属を縛る唯一のテストである。
 *   - 物理は一切再計算しない。ここが持つのは座標変換だけ。
 *
 * 前提（実装から確認済み）:
 *   プリズムの回転は頂角エッジに平行な軸のみ（InteractionCtl.applyAxisConstraint）、
 *   移動は XY 面内のみ、光源の向きも主断面内（lightSource.createIncidentRay が z を 0 に固定）。
 *   よって全光路がこの平面に載る。
 *
 * 期待値の出典:
 *   一辺 a = 2 の正三角形の頂点（convexSolid.createTriangularPrismVertices と同じ定義）。
 *   外接円半径 R = a/√3 = 1.154700538379252、内接円半径 r = a/(2√3) = 0.5773502691896258。
 *   入射面（平面 0）の外向き法線は (−√3/2, 1/2, 0)。
 */

/**
 * 座標・単位性の比較桁。`toBeCloseTo(expected, 12)` として使う。
 * 基底の回転と内積を経るだけなので、丸めは 1e-15 程度しか出ない。
 */
const DECIMALS = 12;

/** 直交判定の許容差。内積は解析的にゼロだが、回転を経ると同程度の丸めが残る。 */
const ORTHONORMAL_TOLERANCE = 1e-12;

/** プリズムの一辺（PrismObject.PRISM_SIDE_LENGTH と同じ）。 */
const SIDE_LENGTH = 2;

/** プリズムの奥行き（PrismObject.PRISM_DEPTH と同じ）。 */
const DEPTH = 2;

/** 外接円半径 R = a/√3。頂点の y 座標。 */
const CIRCUMRADIUS = SIDE_LENGTH / Math.sqrt(3);

/** 内接円半径 r = a/(2√3)。底辺の y 座標。 */
const INRADIUS = SIDE_LENGTH / (2 * Math.sqrt(3));

/** 正準な断面（プリズム局所座標）での 3 頂点。uv はこれと一致するはず。 */
const CANONICAL_APEX = { u: 0, v: CIRCUMRADIUS };
const CANONICAL_LEFT = { u: -SIDE_LENGTH / 2, v: -INRADIUS };
const CANONICAL_RIGHT = { u: SIDE_LENGTH / 2, v: -INRADIUS };

/** 頂角エッジの向き（プリズム局所 z 軸）。 */
const LOCAL_APEX_EDGE = vec3(0, 0, 1);

/** プリズム局所 x 軸。 */
const LOCAL_X = vec3(1, 0, 0);

const RAD_PER_DEG = Math.PI / 180;

/**
 * 頂角エッジ（= z 軸）に平行な軸まわりに回す。プリズムの姿勢を作るのに使う。
 *
 * Three には触れずにテスト側で回転を組む（optics 層は Three を知らないため）。
 *
 * @param v 回す前のベクトル
 * @param angleDeg 回転角 [deg]
 * @returns 回した後のベクトル
 */
function rotateAboutApexEdge(v: Vec3, angleDeg: number): Vec3 {
  const angleRad = angleDeg * RAD_PER_DEG;
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);

  return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z);
}

/**
 * プリズムを「頂角エッジに平行な軸まわりに θ 回転し、平行移動した」姿勢を作る。
 *
 * @param angleDeg 回転角 [deg]
 * @param translation 平行移動（主断面内）
 * @returns 原点・基底・局所点をワールドへ写す関数
 */
function posePrism(angleDeg: number, translation: Vec3) {
  return {
    origin: translation,
    axisU: rotateAboutApexEdge(LOCAL_X, angleDeg),
    apexEdge: LOCAL_APEX_EDGE,
    toWorld: (local: Vec3): Vec3 => add(rotateAboutApexEdge(local, angleDeg), translation),
  };
}

/** 既定姿勢（回転 20 度・XY 平面内で平行移動）。main.ts の既定と同じ回転角。 */
const POSE = posePrism(20, vec3(0.7, -0.4, 0));

describe('6-1 A: 基底の正規直交と一意な向き', () => {
  it('normal / axisU / axisV がすべて単位ベクトルである', () => {
    // Arrange: 軸に揃っていない一般の姿勢で作る（軸揃えだと誤りが見えないことがある）
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);

    // Act & Assert
    expect(length(plane.normal)).toBeCloseTo(1, DECIMALS);
    expect(length(plane.axisU)).toBeCloseTo(1, DECIMALS);
    expect(length(plane.axisV)).toBeCloseTo(1, DECIMALS);
  });

  it('3 本の軸が相互に直交している', () => {
    // Arrange
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);

    // Act & Assert
    expect(Math.abs(dot(plane.normal, plane.axisU))).toBeLessThan(ORTHONORMAL_TOLERANCE);
    expect(Math.abs(dot(plane.normal, plane.axisV))).toBeLessThan(ORTHONORMAL_TOLERANCE);
    expect(Math.abs(dot(plane.axisU, plane.axisV))).toBeLessThan(ORTHONORMAL_TOLERANCE);
  });

  it('axisV が cross(normal, axisU) である（cross(axisU, normal) ではない）', () => {
    // Arrange: 外積の順序を取り違えると符号が反転する。向きの一意化はここで縛る
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);
    const expected = cross(POSE.apexEdge, POSE.axisU);
    const flipped = negate(expected);

    // Act & Assert
    expect(plane.axisV.x).toBeCloseTo(expected.x, DECIMALS);
    expect(plane.axisV.y).toBeCloseTo(expected.y, DECIMALS);
    expect(plane.axisV.z).toBeCloseTo(expected.z, DECIMALS);
    // 逆順なら落ちることを同じテストの中で示す（縮退した基底では区別できないため）
    expect(length(sub(expected, flipped))).toBeGreaterThan(1);
  });

  it('origin / axisU / normal は渡した値がそのまま保たれる', () => {
    // Arrange & Act
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);

    // Assert: 断面の原点と第 1 軸は呼び出し側が決める。ここで勝手に正規化し直さない
    expect(plane.origin).toEqual(POSE.origin);
    expect(plane.axisU).toEqual(POSE.axisU);
    expect(plane.normal).toEqual(POSE.apexEdge);
  });
});

describe('6-1 B: 面内 2 次元座標への射影', () => {
  it('原点は (0, 0) へ写る', () => {
    // Arrange
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);

    // Act
    const uv = worldToDispersionUV(plane, POSE.origin);

    // Assert
    expect(uv.u).toBeCloseTo(0, DECIMALS);
    expect(uv.v).toBeCloseTo(0, DECIMALS);
  });

  it('origin + d·axisU は (d, 0) へ写る', () => {
    // Arrange
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);
    const d = 2.5;

    // Act
    const uv = worldToDispersionUV(plane, addScaled(POSE.origin, plane.axisU, d));

    // Assert
    expect(uv.u).toBeCloseTo(d, DECIMALS);
    expect(uv.v).toBeCloseTo(0, DECIMALS);
  });

  it('origin + d·axisV は (0, d) へ写る', () => {
    // Arrange
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);
    const d = -1.75;

    // Act
    const uv = worldToDispersionUV(plane, addScaled(POSE.origin, plane.axisV, d));

    // Assert
    expect(uv.u).toBeCloseTo(0, DECIMALS);
    expect(uv.v).toBeCloseTo(d, DECIMALS);
  });

  it('法線（頂角エッジ）方向へずらしても uv は変わらない', () => {
    // Arrange: 面外成分が落ちること。原点ではなく一般の点で見る
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);
    const point = vec3(-1.3, 2.4, 0.9);
    const before = worldToDispersionUV(plane, point);

    // Act
    const after = worldToDispersionUV(plane, addScaled(point, plane.normal, DEPTH));

    // Assert
    expect(after.u).toBeCloseTo(before.u, DECIMALS);
    expect(after.v).toBeCloseTo(before.v, DECIMALS);
  });
});

describe('6-1 C: プリズム断面が正準な正三角形へ写る', () => {
  it('3 頂点が正準な位置へ写る', () => {
    // Arrange: 前面(+z)の 3 頂点。順序は [頂点, 左下, 右下]
    const localVertices = createTriangularPrismVertices(SIDE_LENGTH, DEPTH);
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);

    // Act
    const uv = [0, 1, 2].map((i) =>
      worldToDispersionUV(plane, POSE.toWorld(localVertices[i] as Vec3))
    );

    // Assert
    const expected = [CANONICAL_APEX, CANONICAL_LEFT, CANONICAL_RIGHT];
    uv.forEach((actual, i) => {
      expect(actual.u).toBeCloseTo((expected[i] as { u: number }).u, DECIMALS);
      expect(actual.v).toBeCloseTo((expected[i] as { v: number }).v, DECIMALS);
    });
  });

  it('写った三角形の頂角が 60 度である', () => {
    // Arrange
    const localVertices = createTriangularPrismVertices(SIDE_LENGTH, DEPTH);
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);
    const [apex, left, right] = [0, 1, 2].map((i) =>
      worldToDispersionUV(plane, POSE.toWorld(localVertices[i] as Vec3))
    ) as [{ u: number; v: number }, { u: number; v: number }, { u: number; v: number }];

    // Act: 頂点から両底角へ向かう 2 本のなす角
    const toLeft = { u: left.u - apex.u, v: left.v - apex.v };
    const toRight = { u: right.u - apex.u, v: right.v - apex.v };
    const cosApex =
      (toLeft.u * toRight.u + toLeft.v * toRight.v) /
      (Math.hypot(toLeft.u, toLeft.v) * Math.hypot(toRight.u, toRight.v));

    // Assert
    expect((Math.acos(cosApex) * 180) / Math.PI).toBeCloseTo(APEX_ANGLE_DEG, DECIMALS);
  });

  it('入射面の内向き法線が期待どおりの向きへ写る', () => {
    // Arrange: 平面 0（左側面）の外向き法線は (−√3/2, 1/2, 0)。内向きはその反転
    const solid = createTriangularPrism(SIDE_LENGTH, DEPTH);
    const inwardLocal = negate((solid[0] as { normal: Vec3 }).normal);
    const plane = dispersionPlane(POSE.origin, POSE.axisU, POSE.apexEdge);

    // Act: 方向なので「原点から 1 だけ伸ばした点」の uv で測る
    const uv = worldToDispersionUV(plane, POSE.toWorld(inwardLocal));

    // Assert
    expect(uv.u).toBeCloseTo(Math.sqrt(3) / 2, DECIMALS);
    expect(uv.v).toBeCloseTo(-0.5, DECIMALS);
  });
});

describe('6-1 D: 回転不変（基底がプリズムに属することの証明）', () => {
  it('頂角エッジまわりに何度回しても、自分の頂点は同じ正準三角形へ写る', () => {
    // Arrange: ワールド固定の基底で実装すると、ここが θ ごとに違う値になって落ちる
    const localVertices = createTriangularPrismVertices(SIDE_LENGTH, DEPTH);
    const expected = [CANONICAL_APEX, CANONICAL_LEFT, CANONICAL_RIGHT];

    // Act & Assert
    for (const angleDeg of [0, 20, -70, 55, 130, -175]) {
      const pose = posePrism(angleDeg, vec3(0.7, -0.4, 0));
      const plane = dispersionPlane(pose.origin, pose.axisU, pose.apexEdge);

      [0, 1, 2].forEach((i) => {
        const uv = worldToDispersionUV(plane, pose.toWorld(localVertices[i] as Vec3));

        expect(uv.u, `θ=${angleDeg} の頂点 ${i} の u`).toBeCloseTo(
          (expected[i] as { u: number }).u,
          12
        );
        expect(uv.v, `θ=${angleDeg} の頂点 ${i} の v`).toBeCloseTo(
          (expected[i] as { v: number }).v,
          12
        );
      });
    }
  });

  it('ワールドに固定された外部の点は、逆に θ とともに uv が回る', () => {
    // Arrange: 上の裏返し。プリズムが動くのではなく「観測者がプリズムに乗る」ことの帰結。
    // これが無いと「uv が常に定数を返す実装」でも上のテストが通ってしまう
    const worldFixedPoint = vec3(3, 0, 0);
    const samples = [0, 20, -70, 55].map((angleDeg) => {
      const pose = posePrism(angleDeg, vec3(0.7, -0.4, 0));

      return worldToDispersionUV(
        dispersionPlane(pose.origin, pose.axisU, pose.apexEdge),
        worldFixedPoint
      );
    });

    // Act: θ=0 のときと比べる
    const base = samples[0] as { u: number; v: number };

    // Assert: どの角度でも原点からの距離は保たれるが、uv そのものは動く
    const baseRadius = Math.hypot(base.u, base.v);
    samples.slice(1).forEach((uv) => {
      expect(Math.hypot(uv.u, uv.v)).toBeCloseTo(baseRadius, DECIMALS);
      expect(Math.hypot(uv.u - base.u, uv.v - base.v)).toBeGreaterThan(0.1);
    });
  });
});

describe('6-1 E: 定義域', () => {
  it('axisU が法線と平行なら RangeError', () => {
    // Arrange & Act & Assert: 面内の第 1 軸が取れない縮退
    expect(() => dispersionPlane(POSE.origin, LOCAL_APEX_EDGE, LOCAL_APEX_EDGE)).toThrow(
      RangeError
    );
    expect(() => dispersionPlane(POSE.origin, negate(LOCAL_APEX_EDGE), LOCAL_APEX_EDGE)).toThrow(
      RangeError
    );
  });

  it('axisU が法線と平行でなくても、直交していなければ RangeError', () => {
    // Arrange: **空虚 Green を避ける要**。平行な入力だけで直交検査を試すと、
    // 「平行のときだけ弾く実装」でも通ってしまう。単位長で、平行でもなく、
    // しかし直交もしていない軸を与えて、直交検査そのものが働くことを確かめる
    const tilted = normalize(vec3(1, 0, 1));

    // Act & Assert
    expect(length(tilted)).toBeCloseTo(1, DECIMALS);
    expect(Math.abs(dot(tilted, LOCAL_APEX_EDGE))).toBeGreaterThan(0.5);
    expect(() => dispersionPlane(POSE.origin, tilted, LOCAL_APEX_EDGE)).toThrow(RangeError);
  });

  it('axisU / apexEdgeNormal が単位ベクトルでなければ RangeError', () => {
    // Arrange & Act & Assert
    expect(() => dispersionPlane(POSE.origin, vec3(2, 0, 0), LOCAL_APEX_EDGE)).toThrow(RangeError);
    expect(() => dispersionPlane(POSE.origin, LOCAL_X, vec3(0, 0, 0.5))).toThrow(RangeError);
  });

  it('非有限な成分があれば RangeError（単位ベクトル検査は NaN を素通りさせる）', () => {
    // Arrange: **vec3() を通さずに組み立てる。**
    // 通常の経路では vec3() が発生源で非有限を弾くので、この入力は作れない。
    // だが Vec3 は素のインターフェースなので、行列の列をオブジェクトリテラルで
    // 直に組めば型検査は通ってしまう（段階3 で Matrix4 から基底を取り出すのが
    // まさにその経路になる）。
    //
    // ここを見過ごせない理由は、単位ベクトル検査が NaN に対して**失敗しない**ことにある。
    // |NaN − 1| > tol は false なので、NaN 成分は assertUnitVector をすり抜け、
    // 何も投げないまま NaN だらけの平面が返る。有限性は別に見る必要がある。
    const nanVector: Vec3 = { x: Number.NaN, y: 0, z: 0 };
    const infiniteEdge: Vec3 = { x: 0, y: 0, z: Number.POSITIVE_INFINITY };

    // Act & Assert: まず「単位ベクトル検査だけでは弾けない」ことを示す
    expect(Math.abs(length(nanVector) - 1) > ORTHONORMAL_TOLERANCE).toBe(false);

    expect(() => dispersionPlane(nanVector, LOCAL_X, LOCAL_APEX_EDGE)).toThrow(RangeError);
    expect(() => dispersionPlane(POSE.origin, nanVector, LOCAL_APEX_EDGE)).toThrow(RangeError);
    expect(() => dispersionPlane(POSE.origin, LOCAL_X, infiniteEdge)).toThrow(RangeError);
  });
});

describe('6-1 F: 純粋性', () => {
  it('同じ入力に対して同じ結果を返し、引数を変更しない', () => {
    // Arrange
    const origin = vec3(0.7, -0.4, 0);
    const axisU = rotateAboutApexEdge(LOCAL_X, 20);
    const point = vec3(-1.3, 2.4, 0.9);
    const snapshot = { ...axisU };

    // Act
    const first = dispersionPlane(origin, axisU, LOCAL_APEX_EDGE);
    const second = dispersionPlane(origin, axisU, LOCAL_APEX_EDGE);
    const uvFirst = worldToDispersionUV(first, point);
    const uvSecond = worldToDispersionUV(second, point);

    // Assert
    expect(second).toEqual(first);
    expect(uvSecond).toEqual(uvFirst);
    expect(axisU).toEqual(snapshot);
  });
});
