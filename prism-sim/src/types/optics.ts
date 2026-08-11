/**
 * 光学計算で共有する型定義。
 *
 * 型宣言のみを置き、実行時の振る舞いは持たない。
 * Three.js には依存しない（`THREE.Vector3` への変換は scene 層の責務）。
 *
 * NOTE: Segment / LightPath は tracer（1-4）で、PrismMaterial の constants.ts からの
 *       移設は 1-1-1 の残タスクとして、それぞれ別途追加する。
 */

/**
 * 3 次元ベクトル。不変。
 *
 * 生成と演算は `optics/vec3.ts` の純粋関数で行う。すべての演算は
 * 引数を変更せず、新しいオブジェクトを返す。
 */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * 半直線。光線 1 本を表す。
 *
 * `direction` は単位ベクトルであること。これにより交差パラメータ t が
 * そのまま原点からの距離になる。生成時に `optics/convexSolid.ts` の
 * `ray()` が検証する。
 */
export interface Ray {
  /** 始点 */
  readonly origin: Vec3;
  /** 進行方向（単位ベクトル） */
  readonly direction: Vec3;
}

/**
 * 平面 `n·x = d`。
 *
 * `normal` は**外向き**の単位ベクトル（SPEC.md「光路計算」1）。
 * 凸多面体の内部は符号付き距離 `n·p - d` が負の側になる。
 */
export interface Plane {
  /** 外向き単位法線 */
  readonly normal: Vec3;
  /** 原点から平面までの符号付き距離 d */
  readonly distance: number;
}

/**
 * 凸多面体。外向き法線を持つ平面が張る半空間の共通部分として表す。
 *
 * 3 次元で有界な立体を作るには半空間が最低 4 枚必要。
 */
export type ConvexSolid = readonly Plane[];

/**
 * 正三角柱を構成する平面 5 枚。`ConvexSolid` に代入できる。
 *
 * 順序は `[左側面, 右側面, 底面, 前端面(+z), 後端面(-z)]`（SPEC.md「プリズムの標準配置」）。
 * 配列ではなくタプルにすることで「必ず 5 枚」という契約が型に表れ、
 * `noUncheckedIndexedAccess` の下でもリテラル添字が `Plane | undefined` にならない。
 */
export type TriangularPrismPlanes = readonly [Plane, Plane, Plane, Plane, Plane];

/**
 * レイが凸多面体を貫く区間と、その入口・出口の面。
 *
 * `tEnter` は負にもなる（レイの始点が立体の内部にある場合）。前方への絞り込みは
 * tracer の責務であり、ここでは幾何的な区間をそのまま返す。
 */
export interface ConvexSolidHit {
  /** 立体に入る位置の交差パラメータ */
  readonly tEnter: number;
  /** 立体から出る位置の交差パラメータ */
  readonly tExit: number;
  /** 入口の面（法線は外向き） */
  readonly enterPlane: Plane;
  /** 出口の面（法線は外向き） */
  readonly exitPlane: Plane;
}
