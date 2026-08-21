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
 * 有限で向きを持つ矩形のスクリーン面（TASKS 6-3）。
 *
 * **`Plane` とは別型にする。** `Plane` は `n·x = d` の**無限平面**で、凸多面体の半空間を
 * 切り出すための道具であり、原点も面内軸も持たない。対してスクリーンは
 * 「どこが中心か」「面内のどちらが横か」「どこまでが縁か」を持たないと
 * 投影像の uv も縁の判定も定義できない。`Plane` を拡張すると、プリズムを構成する
 * 5 枚の平面にまで面内軸という無意味な情報を強要することになる。
 *
 * 無限平面としての表現が要る場面では `plane(normal, dot(normal, origin))` で作れる。
 *
 * **`axisU` / `axisV` / `normal` は正規直交であることを前提とする。**
 * 崩れると uv が面への正射影でなくなるため、生成は必ず `screenPlane()` を通すこと
 * （`axisV` は `normal × axisU` から導出され、直交性が構造的に保証される）。
 */
export interface ScreenPlane {
  /** 面の中心（ワールド座標）。uv の原点でもある */
  readonly origin: Vec3;
  /** 面の単位法線 */
  readonly normal: Vec3;
  /** 面内の第 1 軸（単位ベクトル）。uv の u 方向 */
  readonly axisU: Vec3;
  /** 面内の第 2 軸（単位ベクトル）。uv の v 方向 */
  readonly axisV: Vec3;
  /** 中心から縁までの距離。矩形の半幅 */
  readonly halfExtent: number;
}

/**
 * スクリーン面内の 2 次元座標。面の中心が原点。
 *
 * 単位はワールド座標と同じ（`axisU` / `axisV` が単位ベクトルのため）。
 * 縁からのはみ出し判定（`|u| > halfExtent` など）は描画層の責務であり、
 * この型自体は範囲を制限しない。
 */
export interface PlaneUV {
  /** `axisU` 方向の座標 */
  readonly u: number;
  /** `axisV` 方向の座標 */
  readonly v: number;
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
 * 正三角柱の頂点 6 個。`TriangularPrismPlanes` と同じ寸法から生成される同一の立体を表す。
 *
 * 順序は `[前(+z) の 頂点・左下・右下, 後(-z) の 頂点・左下・右下]`。
 * 描画メッシュはこの頂点から組み立て、平面集合と同一の引数から生やすことで
 * 「絵のプリズムと光路がズレる」経路を断つ。
 */
export type TriangularPrismVertices = readonly [Vec3, Vec3, Vec3, Vec3, Vec3, Vec3];

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
/**
 * 材質の識別子。UI のセレクトの値であり、`MATERIALS` レコードのキーでもある。
 *
 * `PrismMaterial.name` をこの型にすることで、材質定数を足したときに
 * 「ユニオンへの追記」と「レコードへの登録」の両方をコンパイラが要求するようになる
 * （TASKS 2-8。手書き列挙の追記漏れを塞ぐ）。
 */
export type MaterialName = 'BK7' | 'SF10' | '水' | 'ダイヤモンド';

export interface PrismMaterial {
  /** 表示名。レコードのキーと一致する */
  readonly name: MaterialName;
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
 * 最小偏角の配置（TASKS 6-2）。
 *
 * 頂角と屈折率が決まれば一意に定まる。**探索の結果ではなく解析式の値**であり、
 * δ_min = 2·asin(n·sin(A/2)) − A、θ₁_min = asin(n·sin(A/2))。
 *
 * 2 つを 1 つの型で返すのは、どちらか片方だけを使う場面が無いためである。
 * UI は θ₁_min で光源を合わせ、δ_min を目標値として表示する。
 */
export interface MinimumDeviation {
  /** 最小偏角となる入射角 θ₁_min [deg]（面法線から測る） */
  readonly incidenceAngleDeg: number;
  /** 最小偏角 δ_min [deg] */
  readonly deviationDeg: number;
}

/**
 * 光路を構成する 1 区間（折れ線の 1 辺）。
 *
 * `insidePrism` は描画層が屈折区間だけを別マテリアルで描くために持つほか、
 * テストが内部区間を特定して δ_min の対称通過を検証するのにも使う。
 *
 * `intensity` は入射時を 1 とした相対強度（TASKS 6-5）。界面を通るたびに透過率 (1 − R) が
 * 掛かるので、**1 本の光路の中でも区間ごとに値が変わる**。だから `LightPath` ではなく
 * 区間が持つ。全反射域では `reflectance` が 1 を返すため、反射側は減衰しない。
 */
export interface Segment {
  /** 区間の始点 */
  readonly start: Vec3;
  /** 区間の終点 */
  readonly end: Vec3;
  /** この区間がプリズム内部を通るなら true */
  readonly insidePrism: boolean;
  /** 入射時を 1 とした相対強度（0〜1） */
  readonly intensity: number;
}

/**
 * 光路の終わり方。
 *
 * - `exited`: プリズムを**透過して**外部へ射出した（最終区間は一定長で打ち切る）
 * - `missed`: プリズムと交差せず直進した
 * - `bounceLimit`: 内部反射が上限に達し、射出しないまま追跡を打ち切った
 * - `reflected`: 入射面で反射して光源側へ戻った（プリズムに入っていない。TASKS 6-5b）
 *
 * **`reflected` を `exited` に相乗りさせない。** 入射面反射はプリズムを透過しておらず、
 * 進む向きも射出光と逆（光源側へ後退する）。同じ値にすると「透過して射出した光」だけを
 * 選びたい場所（`screenProjection.projectPathsToScreen` など）が反射光まで拾ってしまう。
 * union に 1 つ増えるが、網羅 switch の漏れはコンパイラが全部拾う。
 */
export type PathTermination = 'exited' | 'missed' | 'bounceLimit' | 'reflected';

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

/**
 * 表示用の RGB 値。各成分は 0〜1 の sRGB（表示参照）値。
 *
 * `THREE.Color` へは scene 層が `setRGB(r, g, b, SRGBColorSpace)` として渡す
 * （SPEC.md「波長サンプリングと色」）。ここでは素の数値だけを持ち、Three には依存しない。
 */
export interface Rgb {
  /** 赤成分（0〜1） */
  readonly r: number;
  /** 緑成分（0〜1） */
  readonly g: number;
  /** 青成分（0〜1） */
  readonly b: number;
}
