import { describe, expect, it } from 'vitest';

// NOTE: convexSolid.ts / vec3.ts は未実装。TDD の Red フェーズのため、この import は解決しない。
import {
  intersectRayConvexSolid,
  intersectRayPlane,
  plane,
  pointOnRay,
  ray,
  signedDistanceToPlane,
} from '../../src/optics/convexSolid';
import { normalize, vec3 } from '../../src/optics/vec3';
import type { ConvexSolid, ConvexSolidHit } from '../../src/types/optics';

/**
 * src/optics/convexSolid.ts の受け入れ条件（1-3-3: レイ⇔平面交差）。
 *
 * 対象:
 *   ray(origin, direction)              — 半直線の生成（direction は単位ベクトル）
 *   plane(normal, distance)             — 平面 n·x = d の生成（normal は外向き単位ベクトル）
 *   signedDistanceToPlane(plane, point) — 符号付き距離 n·p - d
 *   pointOnRay(ray, t)                  — origin + t·direction
 *   intersectRayPlane(ray, plane)       — 交点パラメータ t
 *
 * 設計判断:
 *   - 法線は**外向き**（SPEC.md「光路計算」1）。凸多面体の内部は符号付き距離が負の側。
 *   - intersectRayPlane は平行（n·dir === 0 の厳密比較）のとき null を返す。
 *     交点が数学的に存在しないため。イプシロンは入れない。ほぼ平行なレイは t が
 *     巨大な有限値になるだけでスラブ法は正しく扱えるため、許容差は物理的意味を持つ
 *     上位層（tracer）の責務とする。
 *   - t < 0 はそのまま返す（null にしない）。プリズム内部で屈折した後のレイは
 *     始点が立体の内部にあり、後方の面も含めて near/far を分類する必要があるため。
 *     前方だけに絞るのは tracer の方針であり、幾何プリミティブの責務ではない。
 *   - 単位でない方向ベクトル・法線は RangeError（発生源で落とす）。
 *
 * 期待値は手計算できる軸並行ケースをハードコードする。
 */

/** 浮動小数の許容差。 */
const TOLERANCE = 1e-12;

/** 平面 x = 2（外向き法線 +x）。多くのケースで共有する。 */
const PLANE_X2 = { normal: { x: 1, y: 0, z: 0 }, distance: 2 };

// ---------------------------------------------------------------------------
// ray / plane: 生成と検証
// ---------------------------------------------------------------------------

describe('ray: 生成', () => {
  it('原点と単位方向をそのまま保持する', () => {
    // Arrange
    const origin = vec3(1, 2, 3);
    const direction = vec3(0, 0, 1);

    // Act
    const actual = ray(origin, direction);

    // Assert
    expect(actual).toEqual({ origin: { x: 1, y: 2, z: 3 }, direction: { x: 0, y: 0, z: 1 } });
  });

  it('方向が単位ベクトルでなければ RangeError を投げる', () => {
    // Arrange: 長さ 2 の方向ベクトル
    const direction = vec3(2, 0, 0);

    // Act & Assert
    expect(() => ray(vec3(0, 0, 0), direction)).toThrow(RangeError);
  });

  it('方向が零ベクトルなら RangeError を投げる', () => {
    // Arrange
    const direction = vec3(0, 0, 0);

    // Act & Assert
    expect(() => ray(vec3(0, 0, 0), direction)).toThrow(RangeError);
  });
});

describe('plane: 生成', () => {
  it('法線と距離をそのまま保持する', () => {
    // Arrange
    const normal = vec3(0, 1, 0);

    // Act
    const actual = plane(normal, -3);

    // Assert
    expect(actual).toEqual({ normal: { x: 0, y: 1, z: 0 }, distance: -3 });
  });

  it('法線が単位ベクトルでなければ RangeError を投げる', () => {
    // Arrange: 長さ 2 の法線
    const normal = vec3(0, 2, 0);

    // Act & Assert
    expect(() => plane(normal, 0)).toThrow(RangeError);
  });

  it('法線が零ベクトルなら RangeError を投げる', () => {
    // Arrange
    const normal = vec3(0, 0, 0);

    // Act & Assert
    expect(() => plane(normal, 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// pointOnRay
// ---------------------------------------------------------------------------

describe('pointOnRay: レイ上の点', () => {
  it('t = 0 では原点そのものを返す', () => {
    // Arrange
    const r = ray(vec3(1, 2, 3), vec3(0, 0, 1));

    // Act
    const actual = pointOnRay(r, 0);

    // Assert
    expect(actual).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('t = 2 では origin + 2·direction を返す', () => {
    // Arrange
    const r = ray(vec3(1, 2, 3), vec3(0, 0, 1));

    // Act
    const actual = pointOnRay(r, 2);

    // Assert
    expect(actual).toEqual({ x: 1, y: 2, z: 5 });
  });

  it('負の t ではレイの後方の点を返す', () => {
    // Arrange
    const r = ray(vec3(1, 2, 3), vec3(0, 0, 1));

    // Act
    const actual = pointOnRay(r, -4);

    // Assert
    expect(actual).toEqual({ x: 1, y: 2, z: -1 });
  });
});

// ---------------------------------------------------------------------------
// signedDistanceToPlane
// ---------------------------------------------------------------------------
//
// 外向き法線なので、負なら平面の内側（凸多面体の内部側）、正なら外側。

describe('signedDistanceToPlane: 符号付き距離', () => {
  it('平面の内側（法線と逆側）では負になる', () => {
    // Arrange: 平面 x = 2、点は原点
    const point = vec3(0, 0, 0);

    // Act
    const actual = signedDistanceToPlane(PLANE_X2, point);

    // Assert
    expect(actual).toBe(-2);
  });

  it('平面の外側（法線側）では正になる', () => {
    // Arrange: 平面 x = 2、点は x = 5
    const point = vec3(5, 0, 0);

    // Act
    const actual = signedDistanceToPlane(PLANE_X2, point);

    // Assert
    expect(actual).toBe(3);
  });

  it('平面上の点では 0 になる', () => {
    // Arrange
    const point = vec3(2, 100, -100);

    // Act
    const actual = signedDistanceToPlane(PLANE_X2, point);

    // Assert
    expect(actual).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// intersectRayPlane: 既知の幾何（軸並行ケース）
// ---------------------------------------------------------------------------

describe('intersectRayPlane: 正面から当たる基本形', () => {
  it('原点から +x へ進むと平面 x = 2 に t = 2 で当たる', () => {
    // Arrange
    const r = ray(vec3(0, 0, 0), vec3(1, 0, 0));

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).toBe(2);
  });

  it('原点を通る平面 z = 0 に対し (0,0,5) から -z へ進むと t = 5 で当たる', () => {
    // Arrange
    const r = ray(vec3(0, 0, 5), vec3(0, 0, -1));
    const planeZ0 = plane(vec3(0, 0, 1), 0);

    // Act
    const actual = intersectRayPlane(r, planeZ0);

    // Assert
    expect(actual).toBe(5);
  });
});

describe('intersectRayPlane: 後方の交点は符号付きで返す', () => {
  it('原点から -x へ進むと平面 x = 2 に対し t = -2 を返す（null にしない）', () => {
    // Arrange
    const r = ray(vec3(0, 0, 0), vec3(-1, 0, 0));

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).toBe(-2);
  });
});

describe('intersectRayPlane: 始点が平面上にある場合', () => {
  it('t = 0 を返す', () => {
    // Arrange
    const r = ray(vec3(2, 5, -3), vec3(1, 0, 0));

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).toBe(0);
  });
});

describe('intersectRayPlane: 平行なレイ', () => {
  it('平面の内側を平行に進む場合は null を返す', () => {
    // Arrange: 平面 x = 2 に対し原点から +y へ進む（内側）
    const r = ray(vec3(0, 0, 0), vec3(0, 1, 0));

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).toBeNull();
  });

  it('平面の外側を平行に進む場合も null を返す', () => {
    // Arrange: 平面 x = 2 に対し (5,0,0) から +y へ進む（外側）
    const r = ray(vec3(5, 0, 0), vec3(0, 1, 0));

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).toBeNull();
  });

  it('平行なレイの内外は signedDistanceToPlane で判別できる', () => {
    // Arrange: 上の 2 ケースは交差結果が同じ null なので、側の判別は別関数が担う
    const insideOrigin = vec3(0, 0, 0);
    const outsideOrigin = vec3(5, 0, 0);

    // Act
    const insideDistance = signedDistanceToPlane(PLANE_X2, insideOrigin);
    const outsideDistance = signedDistanceToPlane(PLANE_X2, outsideOrigin);

    // Assert
    expect([insideDistance < 0, outsideDistance > 0]).toEqual([true, true]);
  });
});

describe('intersectRayPlane: 斜め入射', () => {
  it('45° で進むと t が交点までの距離 2√2 = 2.8284271247461903 になる', () => {
    // Arrange: 方向が単位ベクトルなので t は距離と一致する
    const r = ray(vec3(0, 0, 0), normalize(vec3(1, 1, 0)));
    const expectedT = 2.8284271247461903;

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).not.toBeNull();
    expect(Math.abs((actual ?? Number.NaN) - expectedT)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('交点が平面上にある（符号付き距離が 0）', () => {
    // Arrange
    const r = ray(vec3(0, 0, 0), normalize(vec3(1, 1, 0)));

    // Act
    const t = intersectRayPlane(r, PLANE_X2);
    const intersection = pointOnRay(r, t ?? Number.NaN);

    // Assert
    expect(Math.abs(signedDistanceToPlane(PLANE_X2, intersection))).toBeLessThanOrEqual(TOLERANCE);
  });
});

// ===========================================================================
// intersectRayConvexSolid（スラブ法）の受け入れ条件
// ===========================================================================
//
// 凸多面体を半空間の共通部分とみなし、レイが貫く区間 [tEnter, tExit] を求める。
//
// 設計判断:
//   - tEnter < 0 はクランプしない。屈折後のレイは始点が立体の内部にあり、
//     「始点が内部だった」情報を失うと tracer が入口面と出口面を取り違えるため。
//   - 平行な面（n·dir === 0）は、始点が外側（dist > 0）なら全体が交差せず null、
//     内側または面上（dist <= 0）なら区間を狭めない制約なしとして読み飛ばす。
//   - dist === 0（面上を滑る）は内側扱い、tEnter === tExit（辺・頂点をかすめる）は
//     交差ありとする。凸多面体を閉集合として扱い、signedDistanceToPlane の
//     「負が内側・0 が面上」という規約と揃えるため。
//   - solid.length < 4 は RangeError（3 次元で有界な立体には半空間が最低 4 枚要る）。
//     4 枚以上でも非有界な組み合わせでは enter/exit が確定しないため null を返す。

/** 立方体 [-1,1]³ を構成する 6 平面。同一性で入口・出口の面を検証するため個別に持つ。 */
const CUBE_PLANE_POS_X = plane(vec3(1, 0, 0), 1);
const CUBE_PLANE_NEG_X = plane(vec3(-1, 0, 0), 1);
const CUBE_PLANE_POS_Y = plane(vec3(0, 1, 0), 1);
const CUBE_PLANE_NEG_Y = plane(vec3(0, -1, 0), 1);
const CUBE_PLANE_POS_Z = plane(vec3(0, 0, 1), 1);
const CUBE_PLANE_NEG_Z = plane(vec3(0, 0, -1), 1);

/** 手組みの立方体 [-1,1]³。プリズム固有の幾何から切り離してアルゴリズムを検証する。 */
const UNIT_CUBE: ConvexSolid = [
  CUBE_PLANE_POS_X,
  CUBE_PLANE_NEG_X,
  CUBE_PLANE_POS_Y,
  CUBE_PLANE_NEG_Y,
  CUBE_PLANE_POS_Z,
  CUBE_PLANE_NEG_Z,
];

/** 交差するはずのケースで null を弾き、以降を非 null として扱えるようにする。 */
function expectHit(hit: ConvexSolidHit | null): ConvexSolidHit {
  if (hit === null) {
    throw new Error('交差するはずのケースで null が返りました');
  }

  return hit;
}

describe('intersectRayConvexSolid: 正面貫通', () => {
  it('入口と出口の t が 4 と 6 になる', () => {
    // Arrange
    const r = ray(vec3(-5, 0, 0), vec3(1, 0, 0));

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect([hit.tEnter, hit.tExit]).toEqual([4, 6]);
  });

  it('入口面が -x、出口面が +x になる', () => {
    // Arrange
    const r = ray(vec3(-5, 0, 0), vec3(1, 0, 0));

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect([hit.enterPlane, hit.exitPlane]).toEqual([CUBE_PLANE_NEG_X, CUBE_PLANE_POS_X]);
  });
});

describe('intersectRayConvexSolid: 始点が立体の内部', () => {
  it('tEnter が負・tExit が正になる（-1 と 1。クランプしない）', () => {
    // Arrange: 屈折後のレイに相当する最重要ケース
    const r = ray(vec3(0, 0, 0), vec3(1, 0, 0));

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect([hit.tEnter, hit.tExit]).toEqual([-1, 1]);
  });

  it('入口面は後方の -x 面として返る', () => {
    // Arrange
    const r = ray(vec3(0, 0, 0), vec3(1, 0, 0));

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect([hit.enterPlane, hit.exitPlane]).toEqual([CUBE_PLANE_NEG_X, CUBE_PLANE_POS_X]);
  });
});

describe('intersectRayConvexSolid: 立体がレイの後方にある', () => {
  it('tEnter と tExit がともに負のまま返る（-6 と -4）', () => {
    // Arrange: 前方への絞り込みは tracer の責務なので、ここでは区間をそのまま返す
    const r = ray(vec3(5, 0, 0), vec3(1, 0, 0));

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect([hit.tEnter, hit.tExit]).toEqual([-6, -4]);
  });
});

describe('intersectRayConvexSolid: 交差しない', () => {
  it('平行な面の外側を進む場合は null を返す', () => {
    // Arrange: y = 2 は +y 面の外側。+y 面に対し n·dir = 0 かつ dist > 0
    const r = ray(vec3(-5, 2, 0), vec3(1, 0, 0));

    // Act
    const actual = intersectRayConvexSolid(r, UNIT_CUBE);

    // Assert
    expect(actual).toBeNull();
  });

  it('tEnter > tExit となる場合は null を返す', () => {
    // Arrange: 斜めに進んで立方体の脇を通り抜ける（tEnter≈5.66 > tExit≈1.41）
    const r = ray(vec3(-5, 0, 0), normalize(vec3(1, 1, 0)));

    // Act
    const actual = intersectRayConvexSolid(r, UNIT_CUBE);

    // Assert
    expect(actual).toBeNull();
  });
});

describe('intersectRayConvexSolid: 面上を滑る（かすめ）', () => {
  it('dist === 0 を内側として扱い、交差ありと報告する', () => {
    // Arrange: y = 1 はちょうど +y 面上。閉集合として扱う規約を固定する
    const r = ray(vec3(-5, 1, 0), vec3(1, 0, 0));

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect([hit.tEnter, hit.tExit]).toEqual([4, 6]);
  });
});

describe('intersectRayConvexSolid: 平行な面を読み飛ばす', () => {
  it('z 軸方向のレイで x・y の 4 面が制約にならない', () => {
    // Arrange: x,y の 4 面は n·dir = 0 かつ dist < 0（内側）なので区間を狭めない
    const r = ray(vec3(0, 0, 5), vec3(0, 0, -1));

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect([hit.tEnter, hit.tExit]).toEqual([4, 6]);
  });

  it('入口面が +z、出口面が -z になる', () => {
    // Arrange
    const r = ray(vec3(0, 0, 5), vec3(0, 0, -1));

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect([hit.enterPlane, hit.exitPlane]).toEqual([CUBE_PLANE_POS_Z, CUBE_PLANE_NEG_Z]);
  });
});

describe('intersectRayConvexSolid: 斜め入射', () => {
  it('tEnter が √2 = 1.4142135623730951 になる', () => {
    // Arrange
    const r = ray(vec3(-2, -0.5, 0), normalize(vec3(1, 1, 0)));
    const expectedTEnter = 1.4142135623730951;

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect(Math.abs(hit.tEnter - expectedTEnter)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('tExit が 1.5√2 = 2.1213203435596428 になる', () => {
    // Arrange
    const r = ray(vec3(-2, -0.5, 0), normalize(vec3(1, 1, 0)));
    const expectedTExit = 2.1213203435596428;

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect(Math.abs(hit.tExit - expectedTExit)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('入口面と出口面が別々の軸の面になる（-x で入り +y で出る）', () => {
    // Arrange: 入口・出口を独立に選んでいることを担保する
    const r = ray(vec3(-2, -0.5, 0), normalize(vec3(1, 1, 0)));

    // Act
    const hit = expectHit(intersectRayConvexSolid(r, UNIT_CUBE));

    // Assert
    expect([hit.enterPlane, hit.exitPlane]).toEqual([CUBE_PLANE_NEG_X, CUBE_PLANE_POS_Y]);
  });
});

describe('intersectRayConvexSolid: 異常系と非有界', () => {
  it('平面が 3 枚なら RangeError を投げる（有界な立体には最低 4 枚要る）', () => {
    // Arrange
    const tooFewPlanes: ConvexSolid = [CUBE_PLANE_POS_X, CUBE_PLANE_NEG_X, CUBE_PLANE_POS_Y];
    const r = ray(vec3(-5, 0, 0), vec3(1, 0, 0));

    // Act & Assert
    expect(() => intersectRayConvexSolid(r, tooFewPlanes)).toThrow(RangeError);
  });

  it('非有界な無限角柱に軸方向のレイを流すと null を返す', () => {
    // Arrange: ±x, ±y の 4 面は z 方向に開いており、z 軸方向のレイに対しては
    //          すべて n·dir = 0 かつ内側となるため enter / exit が確定しない
    const infiniteColumn: ConvexSolid = [
      CUBE_PLANE_POS_X,
      CUBE_PLANE_NEG_X,
      CUBE_PLANE_POS_Y,
      CUBE_PLANE_NEG_Y,
    ];
    const r = ray(vec3(0, 0, -5), vec3(0, 0, 1));

    // Act
    const actual = intersectRayConvexSolid(r, infiniteColumn);

    // Assert
    expect(actual).toBeNull();
  });
});
