/**
 * 光路追跡の方向ベクトル・プリミティブ。
 *
 * すべてプリズムの局所空間で完結する純粋関数であり、Three.js / DOM には依存しない。
 * 物理そのものは持たない: 全反射の判定は fresnel.canTransmit、屈折角は
 * refraction.refractionAngleDeg に委譲し、本モジュールは
 * 「角度を方向ベクトルへ戻す幾何変換」だけを担う（SPEC.md「光路計算」3）。
 *
 * ベクトル判別式 k = 1 - η²(1 - cos²θᵢ) による独自の全反射判定は使わない。
 * 臨界角ちょうどで canTransmit と境界がずれ、全反射の判定元が二重化するため。
 */

import type {
  ConvexSolid,
  LightPath,
  PrismMaterial,
  Ray,
  Segment,
  Vec3,
} from '../types/optics';

import { EXIT_EXTENSION_LENGTH, MAX_BOUNCE_COUNT } from './constants';
import { intersectRayConvexSolid, pointOnRay, ray } from './convexSolid';
import { exaggerateIndex, refractiveIndex } from './dispersion';
import { canTransmit, reflectance } from './fresnel';
import { refractionAngleDeg } from './refraction';
import { addScaled, dot, length, lengthSquared, negate, normalize, scale, sub } from './vec3';

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/** 入射光の強度。すべての強度はこれを 1 とした相対値（TASKS 6-5）。 */
const INCIDENT_INTENSITY = 1;

/** 周囲媒質（空気）の屈折率。 */
const N_AIR = 1;

/**
 * 単位ベクトル判定の許容差。
 * normalize() の結果は丸めにより長さが 1 から 1e-16 程度ずれるため、厳密比較はできない。
 */
const UNIT_LENGTH_TOLERANCE = 1e-9;

/**
 * ベクトルが単位ベクトルであることを検証する。
 *
 * 零ベクトルは長さ 0 なのでこの検査で同時に弾かれる。
 *
 * @param v 検証対象
 * @param label エラーメッセージ用の引数名
 * @throws {RangeError} v が単位ベクトルでない場合
 */
function assertUnitVector(v: Vec3, label: string): void {
  const currentLength = length(v);

  if (Math.abs(currentLength - 1) > UNIT_LENGTH_TOLERANCE) {
    throw new RangeError(`${label} は単位ベクトルである必要があります（長さ: ${currentLength}）`);
  }
}

/**
 * 法線を入射レイに正対させる（レイの進行方向と逆側を向かせる）。
 *
 * 面の外向き法線はレイがどちら側から来るかに関わらず一定なので、
 * 内部計算では常に `d · n_face < 0` となる向きへ揃えてから使う。
 *
 * @param direction 入射レイの進行方向（単位ベクトル）
 * @param normal 界面の外向き単位法線
 * @returns 入射レイに正対させた単位法線
 */
function facingNormal(direction: Vec3, normal: Vec3): Vec3 {
  return dot(direction, normal) < 0 ? normal : negate(normal);
}

/**
 * 界面法線から測った入射角を求める。
 *
 * cosθᵢ = |d · n| （法線の符号に依らないよう絶対値を取る）
 *
 * @param direction 入射レイの進行方向（単位ベクトル）
 * @param normal 界面の外向き単位法線。レイと同じ側を向いていてもよい
 * @returns 入射角 [deg]（0〜90）
 * @throws {RangeError} direction または normal が単位ベクトルでない場合
 */
export function incidenceAngleDeg(direction: Vec3, normal: Vec3): number {
  assertUnitVector(direction, 'direction');
  assertUnitVector(normal, 'normal');

  // 丸めで |d · n| が 1 をわずかに超えると acos が NaN になるため頭打ちにする
  const cosIncidence = Math.min(Math.abs(dot(direction, normal)), 1);

  return Math.acos(cosIncidence) * DEG_PER_RAD;
}

/**
 * 界面での鏡面反射の方向を求める。
 *
 * r = d - 2(d · n)n（n の符号に依らない）
 *
 * @param direction 入射レイの進行方向（単位ベクトル）
 * @param normal 界面の外向き単位法線。レイと同じ側を向いていてもよい
 * @returns 反射方向の単位ベクトル
 * @throws {RangeError} direction または normal が単位ベクトルでない場合
 */
export function reflectDirection(direction: Vec3, normal: Vec3): Vec3 {
  assertUnitVector(direction, 'direction');
  assertUnitVector(normal, 'normal');

  return sub(direction, scale(normal, 2 * dot(direction, normal)));
}

/**
 * 界面での屈折の方向を求める。
 *
 * 屈折角 θₜ は refraction.refractionAngleDeg に委譲し、ここでは角度を方向へ戻す。
 *   s = normalize(d + cosθᵢ·n_face)  界面の接線方向（|d + cosθᵢ·n_face| = sinθᵢ）
 *   t = sinθₜ·s - cosθₜ·n_face
 * 接線成分が厳密に 0 になる垂直入射では s が定義できないため、t = d とする。
 *
 * 全反射域では refractionAngleDeg が投げる RangeError をそのまま伝播させる（NaN を返さない）。
 * 屈折率の定義域検証も同関数（内部で canTransmit）に委譲する。
 *
 * @param direction 入射レイの進行方向（単位ベクトル）
 * @param normal 界面の外向き単位法線。レイと同じ側を向いていてもよい
 * @param nFrom 入射側媒質の屈折率（無次元）。1 以上の有限数
 * @param nTo 射出側媒質の屈折率（無次元）。1 以上の有限数
 * @returns 屈折方向の単位ベクトル
 * @throws {RangeError} 引数が定義域外の場合、または全反射域の場合
 */
export function refractDirection(
  direction: Vec3,
  normal: Vec3,
  nFrom: number,
  nTo: number
): Vec3 {
  const incidenceDeg = incidenceAngleDeg(direction, normal);
  const refractionDeg = refractionAngleDeg(nFrom, nTo, incidenceDeg);

  const faceNormal = facingNormal(direction, normal);
  const cosIncidence = Math.min(Math.abs(dot(direction, normal)), 1);

  // 接線ベクトル d + cosθᵢ·n_face。長さは sinθᵢ に等しい
  const rawTangent = addScaled(direction, faceNormal, cosIncidence);

  // 垂直入射では接線が定義できない。屈折も起きないため方向をそのまま返す
  if (lengthSquared(rawTangent) === 0) {
    return direction;
  }

  // 法線成分を落としてから正規化する（Gram-Schmidt の直交化 1 回ぶん）。
  // 上の式は厳密には n_face と直交するが、垂直入射に近いと桁落ちで長さ 1e-16 程度の
  // 丸め誤差だけが残り、正規化するとその誤差が法線方向へ O(1) で拡大する。
  // その s を使うと結果が単位ベクトルでなくなるため、割る前に直交性を回復させる
  const tangent = addScaled(rawTangent, faceNormal, -dot(rawTangent, faceNormal));

  const refractionRad = refractionDeg * RAD_PER_DEG;

  return addScaled(
    scale(normalize(tangent), Math.sin(refractionRad)),
    faceNormal,
    -Math.cos(refractionRad)
  );
}

/**
 * 1 本の光線をプリズム（凸多面体）に対して追跡し、折れ線の光路を返す。
 *
 * 手順は SPEC.md「光路計算」2〜4 に対応する。
 *   1. 凸多面体との交差をスラブ法で求める。交差しなければ直進して打ち切る
 *   2. 入射面で空気 → プリズムの屈折（疎→密なので全反射しない）
 *   3. 内部ループ: 出口面を探し、透過できれば屈折して射出、できなければ反射して継続
 *   4. 反射が MAX_BOUNCE_COUNT に達したら射出しないまま打ち切る
 *
 * 屈折率は引数で受け取る（波長依存性は呼び出し側の責務）。本関数は分散に依存しない。
 * 全反射の判定は fresnel.canTransmit に委ねており、tracer は物理を持たない。
 *
 * 入射光線はプリズムの外部から入ることを前提とする。立体がレイの後方にある場合
 * （`tExit <= 0`）は交差しなかったものとして扱う。
 *
 * @param incidentRay 入射光線（局所空間。direction は単位ベクトル）
 * @param solid プリズムを表す凸多面体（外向き法線つき平面の集合）
 * @param refractiveIndex プリズム材質の屈折率（無次元）。1 以上の有限数
 * @param wavelengthNm 追跡する波長 [nm]（結果に記録するだけで計算には使わない）
 * @returns 光路（区間は始点側から順に並ぶ）
 * @throws {RangeError} 引数が定義域外の場合（検証は各プリミティブに委譲する）
 */
export function traceRay(
  incidentRay: Ray,
  solid: ConvexSolid,
  refractiveIndex: number,
  wavelengthNm: number
): LightPath {
  const hit = intersectRayConvexSolid(incidentRay, solid);

  if (hit === null || hit.tExit <= 0) {
    return missedPath(incidentRay, refractiveIndex, wavelengthNm);
  }

  const entryPoint = pointOnRay(incidentRay, hit.tEnter);
  const segments: Segment[] = [
    {
      start: incidentRay.origin,
      end: entryPoint,
      insidePrism: false,
      intensity: INCIDENT_INTENSITY,
    },
  ];

  // 入射面は空気 → プリズム（疎→密）なので全反射は起こらない
  let position = entryPoint;
  let direction = refractDirection(
    incidentRay.direction,
    hit.enterPlane.normal,
    N_AIR,
    refractiveIndex
  );

  // 入射面で反射したぶんだけ弱まる。反射光そのものは traceEntryReflection の管轄（6-5b）
  const entryReflectance = reflectance(
    N_AIR,
    refractiveIndex,
    incidenceAngleDeg(incidentRay.direction, hit.enterPlane.normal)
  );
  let intensity = INCIDENT_INTENSITY * (1 - entryReflectance);

  for (let bounceCount = 0; bounceCount < MAX_BOUNCE_COUNT; bounceCount += 1) {
    const innerRay = ray(position, direction);
    const innerHit = intersectRayConvexSolid(innerRay, solid);

    if (innerHit === null) {
      // 内部の光が頂点を正確に射抜くと、その点から出る面が見つからずここへ来る。
      // 稀だが到達する経路であり（tracer.test.ts R 節）、射出しないまま打ち切る
      return { wavelengthNm, refractiveIndex, segments, termination: 'bounceLimit' };
    }

    const facePoint = pointOnRay(innerRay, innerHit.tExit);
    const faceNormal = innerHit.exitPlane.normal;
    segments.push({ start: position, end: facePoint, insidePrism: true, intensity });

    const innerIncidenceDeg = incidenceAngleDeg(direction, faceNormal);

    if (canTransmit(refractiveIndex, N_AIR, innerIncidenceDeg)) {
      const exitDirection = refractDirection(direction, faceNormal, refractiveIndex, N_AIR);
      const exitReflectance = reflectance(refractiveIndex, N_AIR, innerIncidenceDeg);

      segments.push(
        extendedSegment(facePoint, exitDirection, false, intensity * (1 - exitReflectance))
      );

      return { wavelengthNm, refractiveIndex, segments, termination: 'exited' };
    }

    // 全反射域では reflectance が 1 を返すので、反射側は減衰しない（強度はそのまま）。
    // 判定元は canTransmit のままで、ここに新しい物理判断は足さない
    position = facePoint;
    direction = reflectDirection(direction, faceNormal);
  }

  return { wavelengthNm, refractiveIndex, segments, termination: 'bounceLimit' };
}

/**
 * 同じ入射光線を波長ごとに追跡し、光路の束を返す。分散はこの束の広がりとして現れる。
 *
 * 波長ごとに dispersion.refractiveIndex で屈折率を求め、traceRay に渡す。
 * 追跡そのものは屈折率を受け取るだけの traceRay に閉じており、分散への依存は本関数に集約する。
 * 色（λ → sRGB）は描画層の関心事なので、ここでは扱わない。
 *
 * 波長ごとの追跡は独立で、互いに影響しない。本関数は屈折率を引いて traceRay へ渡すだけの
 * 薄いラッパーであり、固有の物理を持たない。
 *
 * 分散誇張倍率 exaggeration を指定すると、各波長の屈折率を n_d 基準で誇張してから追跡する
 * （SPEC.md「分散誇張（F-23）」）。既定値 1 では物理的に正しい実屈折率をそのまま用いる。
 *
 * @param incidentRay 入射光線（局所空間。direction は単位ベクトル）
 * @param solid プリズムを表す凸多面体（外向き法線つき平面の集合）
 * @param material プリズムの材質（Cauchy 分散パラメータ）
 * @param wavelengths 追跡する波長の並び [nm]
 * @param exaggeration 分散誇張倍率 m。1 以上の有限数。既定 1（実物理）。検証は exaggerateIndex に委譲する
 * @returns 波長リストと同じ順序・同じ本数の光路
 * @throws {RangeError} 波長や引数が定義域外の場合（検証は refractiveIndex / exaggerateIndex / traceRay に委譲する）
 */
export function traceSpectrum(
  incidentRay: Ray,
  solid: ConvexSolid,
  material: PrismMaterial,
  wavelengths: readonly number[],
  exaggeration = 1
): readonly LightPath[] {
  return wavelengths.map((wavelengthNm) =>
    traceRay(
      incidentRay,
      solid,
      exaggerateIndex(refractiveIndex(material, wavelengthNm), material.catalogNd, exaggeration),
      wavelengthNm
    )
  );
}

/**
 * 入射面で反射した光（フレネル反射）を追跡し、折れ線の光路を返す（TASKS 6-5b）。
 *
 * **再帰しない。** `traceRay` を呼ばず、自分自身も呼ばない。分岐が 1 回きりであることを
 * 「そう決めた」ではなく、**その呼び出しがコードのどこにも存在しないこと**で保証する。
 * 反射光がこの先で別の面に当たっても追わない（TASKS 6-5「分岐は 1 回まで」）。
 *
 * 反射率は `traceRay` の入射面とまったく同じ `reflectance(N_AIR, refractiveIndex, θ_entry)`
 * を使う。**反射率の源はこの 1 か所に限る**（透過側と反射側で別々に計算しない）。
 * 両者を独立に呼んだ和が I₀ になることは 6-5b のオラクル #5 が縛る。
 *
 * 返す区間は 2 本で、どちらもプリズムの外を通る。
 *   1. 入射区間（光源 → 入射点、`intensity` = 1）
 *   2. 反射区間（入射点から `EXIT_EXTENSION_LENGTH` 延長、`intensity` = R_entry）
 *
 * `termination` は専用の `'reflected'` とする。**`'exited'` に相乗りさせない。**
 * 入射面反射はプリズムを透過しておらず、進む向きも射出光と逆（光源側へ後退する）ため、
 * 射出側に置いたスクリーンには当たらない。`screenProjection.projectPathsToScreen` は
 * `'exited'` だけを投影対象にしており、反射光はそこへ乗らないのが正しい。
 *
 * 入射光線がプリズムの外部から入ることを前提とする点も `traceRay` と同じで、
 * 立体がレイの後方にある場合（`tExit <= 0`）は交差しなかったものとして扱う。
 *
 * @param incidentRay 入射光線（局所空間。direction は単位ベクトル）
 * @param solid プリズムを表す凸多面体（外向き法線つき平面の集合）
 * @param refractiveIndex プリズム材質の屈折率（無次元）。1 以上の有限数
 * @param wavelengthNm 追跡する波長 [nm]（結果に記録するだけで計算には使わない）
 * @returns 反射光の光路。レイがプリズムに当たらなければ null
 * @throws {RangeError} 引数が定義域外の場合（検証は各プリミティブに委譲する）
 */
export function traceEntryReflection(
  incidentRay: Ray,
  solid: ConvexSolid,
  refractiveIndex: number,
  wavelengthNm: number
): LightPath | null {
  const hit = intersectRayConvexSolid(incidentRay, solid);

  if (hit === null || hit.tExit <= 0) {
    return null;
  }

  const entryPoint = pointOnRay(incidentRay, hit.tEnter);

  // 入射角・反射率とも traceRay の入射面とまったく同じ式・同じ引数で求める。
  // ここを別の求め方にすると、透過と反射の和が入射強度からずれる（オラクル #5 が落ちる）
  const entryIncidenceDeg = incidenceAngleDeg(incidentRay.direction, hit.enterPlane.normal);
  const entryReflectance = reflectance(N_AIR, refractiveIndex, entryIncidenceDeg);
  const reflectedDirection = reflectDirection(incidentRay.direction, hit.enterPlane.normal);

  return {
    wavelengthNm,
    refractiveIndex,
    segments: [
      {
        start: incidentRay.origin,
        end: entryPoint,
        insidePrism: false,
        intensity: INCIDENT_INTENSITY,
      },
      // 反射光もこの先どこまでも伝わるので、射出光と同じ長さで打ち切る
      extendedSegment(
        entryPoint,
        reflectedDirection,
        false,
        INCIDENT_INTENSITY * entryReflectance
      ),
    ],
    termination: 'reflected',
  };
}

/**
 * 同じ入射光線の入射面反射を波長ごとに追跡し、光路の束を返す（TASKS 6-5b）。
 *
 * `traceSpectrum` と対になる薄いラッパーで、屈折率を引いて `traceEntryReflection` へ渡す
 * だけの役割しか持たない。分散は反射率の波長差として現れる。
 *
 * **レイがプリズムを外れても本数は変わらない。** `traceSpectrum` とまったく同じ型・同じ形
 * （当たらなかった波長は `missedPath`）で返すので、描画側に「0 本か 48 本か」の分岐が
 * 生まれない。起こり得ない分岐を作らないことが、そこで起こり得たバグを消す。
 *
 * @param incidentRay 入射光線（局所空間。direction は単位ベクトル）
 * @param solid プリズムを表す凸多面体（外向き法線つき平面の集合）
 * @param material プリズムの材質（Cauchy 分散パラメータ）
 * @param wavelengths 追跡する波長の並び [nm]
 * @param exaggeration 分散誇張倍率 m。1 以上の有限数。既定 1（実物理）
 * @returns 波長リストと同じ順序・同じ本数の光路。当たらなかった波長は missed の光路
 * @throws {RangeError} 波長や引数が定義域外の場合
 */
export function traceEntryReflectionSpectrum(
  incidentRay: Ray,
  solid: ConvexSolid,
  material: PrismMaterial,
  wavelengths: readonly number[],
  exaggeration = 1
): readonly LightPath[] {
  return wavelengths.map((wavelengthNm) => {
    const index = exaggerateIndex(
      refractiveIndex(material, wavelengthNm),
      material.catalogNd,
      exaggeration
    );

    return (
      traceEntryReflection(incidentRay, solid, index, wavelengthNm) ??
      missedPath(incidentRay, index, wavelengthNm)
    );
  });
}

/**
 * プリズムに当たらなかった光路を作る。
 *
 * 入射光をそのまま `EXIT_EXTENSION_LENGTH` だけ延ばした 1 区間で表す。強度は減衰しない
 * （界面を 1 つも通らないため）。
 *
 * `traceRay` と `traceEntryReflectionSpectrum` が**この 1 つの関数から**同じ形を作るので、
 * 2 つのスペクトル関数が「外れたとき」に違う形を返す経路が存在しない。
 *
 * @param incidentRay 入射光線
 * @param refractiveIndex 追跡に使った屈折率（結果に記録するだけ）
 * @param wavelengthNm 追跡した波長 [nm]
 * @returns termination が missed の光路
 */
function missedPath(
  incidentRay: Ray,
  refractiveIndex: number,
  wavelengthNm: number
): LightPath {
  return {
    wavelengthNm,
    refractiveIndex,
    segments: [
      extendedSegment(incidentRay.origin, incidentRay.direction, false, INCIDENT_INTENSITY),
    ],
    termination: 'missed',
  };
}

/**
 * 始点から一定長だけ延ばした区間を作る。
 *
 * 射出光とプリズムを外れた光は無限に伸びるため、SPEC.md「光路計算」4 に従い
 * EXIT_EXTENSION_LENGTH で打ち切る。
 *
 * @param start 始点
 * @param direction 進行方向（単位ベクトル）
 * @param insidePrism プリズム内部を通る区間なら true
 * @param intensity この区間を進む光の強度（0〜1）
 * @returns 長さ EXIT_EXTENSION_LENGTH の区間
 */
function extendedSegment(
  start: Vec3,
  direction: Vec3,
  insidePrism: boolean,
  intensity: number
): Segment {
  return {
    start,
    end: addScaled(start, direction, EXIT_EXTENSION_LENGTH),
    insidePrism,
    intensity,
  };
}
