/**
 * 光学計算で共有する型定義。
 *
 * 型宣言のみを置き、実行時の振る舞いは持たない。
 * Three.js には依存しない（`THREE.Vector3` への変換は scene 層の責務）。
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

/**
 * プリズム材質の Cauchy 分散パラメータとカタログ値。
 *
 * 実際の材質データ（BK7 / SF10 / 水 / ダイヤモンド）は `optics/constants.ts` が持つ。
 * ここには形だけを置き、値の出典と検算はデータ側に集約する。
 */
export interface PrismMaterial {
  /** 表示名 */
  readonly name: string;
  /** Cauchy 式の A 項（無次元） */
  readonly cauchyA: number;
  /** Cauchy 式の B 項 [µm²] */
  readonly cauchyB: number;
  /** カタログ屈折率 n_d（λ_d = 587.56nm） */
  readonly catalogNd: number;
  /** カタログアッベ数 v_d */
  readonly catalogAbbe: number;
}

/**
 * 光路を構成する 1 区間（折れ線の 1 辺）。
 *
 * `insidePrism` は描画層が屈折区間だけを別マテリアルで描くために持つほか、
 * テストが内部区間を特定して δ_min の対称通過を検証するのにも使う。
 *
 * NOTE: 強度（フレネル反射率）は Phase 6 で実際に計算する値として追加する。
 *       常に 1 のダミー値を今持たせることはしない。
 */
export interface Segment {
  /** 区間の始点 */
  readonly start: Vec3;
  /** 区間の終点 */
  readonly end: Vec3;
  /** この区間がプリズム内部を通るなら true */
  readonly insidePrism: boolean;
}

/**
 * 光路の終わり方。
 *
 * - `exited`: プリズムを透過して外部へ射出した（最終区間は一定長で打ち切る）
 * - `missed`: プリズムと交差せず直進した
 * - `bounceLimit`: 内部反射が上限に達し、射出しないまま追跡を打ち切った
 */
export type PathTermination = 'exited' | 'missed' | 'bounceLimit';

/**
 * 1 波長ぶんの光路。
 *
 * 分散は「波長ごとに屈折率を変えて独立に追跡した結果」として現れる。
 * `refractiveIndex` は追跡に使った屈折率をそのまま記録したもので、
 * 情報表示（F-21）が n(λ) を再計算せずに済むようにするために持つ。
 */
export interface LightPath {
  /** 追跡した波長 [nm] */
  readonly wavelengthNm: number;
  /** 追跡に使ったプリズム材質の屈折率（無次元） */
  readonly refractiveIndex: number;
  /** 折れ線を構成する区間。始点側から順に並ぶ */
  readonly segments: readonly Segment[];
  /** 追跡の終わり方 */
  readonly termination: PathTermination;
}
