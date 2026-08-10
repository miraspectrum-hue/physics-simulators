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
