import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  SRGBColorSpace,
} from 'three';

import { createPrismGeometry } from './prismGeometry';

/** プリズムの一辺の長さ。光路計算の平面集合と共有する寸法。 */
export const PRISM_SIDE_LENGTH = 2;

/** プリズムの押し出し長。 */
export const PRISM_DEPTH = 2;

/**
 * three の `MeshPhysicalMaterial.ior` が受け付ける範囲。
 *
 * ダイヤモンド（n_d = 2.4173）は上限を超えるため頭打ちになる。見た目の反射が
 * わずかに弱くなるだけで、**光路計算はこの値を一切使わない**（tracer は材質定数から
 * 独立に屈折率を引く）ので、物理の正しさには影響しない。
 */
const IOR_MIN = 1;
const IOR_MAX = 2.333;

/** 環境マップの解像度 [px]。粗い反射を作るだけなので小さくてよい（PMREM 化も一度きり）。 */
const ENV_TEXTURE_WIDTH = 256;
const ENV_TEXTURE_HEIGHT = 128;

/**
 * 縁の光り方の倍率。
 *
 * 誘電体の垂直反射率 F0 = ((n-1)/(n+1))² は 0.02（水）〜0.17（ダイヤ）と小さく、
 * そのままでは暗背景で差が見えない。教材として「屈折率が高いほど縁が強く光る」ことが
 * 読み取れるよう、比を保ったまま一律に持ち上げる。
 */
const RIM_GAIN = 5;

/** フレネルの立ち上がりの鋭さ。3 乗はガラスの縁光りとして一般的な値。 */
const RIM_POWER = 3;

/**
 * 縁のフレネル光をアルファと発光へ加える差し込み。
 *
 * `MeshPhysicalMaterial` は一様な `opacity` しか持たないため、そのままでは面全体が
 * 均一に薄くなり、ガラスらしい「縁が締まって光る」形にならない。視線と法線のなす角から
 * フレネル項を作り、縁だけ不透明かつ明るくする。
 *
 * `outgoingLight` と `diffuseColor` は three の meshphysical シェーダが
 * `<opaque_fragment>` の直前で定義している変数。
 */
const RIM_FRAGMENT_CHUNK = `
  float rimFresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), ${RIM_POWER}.0);
  float rim = rimFresnel * uRimStrength;
  diffuseColor.a = clamp(diffuseColor.a + rim, 0.0, 1.0);
  outgoingLight += vec3(rim);
`;

/**
 * プリズムのメッシュと姿勢を保持する。
 *
 * 姿勢の単一の真実は `object.matrix`（Object3D）であり、オイラー角を自前に二重保持しない
 * （CLAUDE.md「やってはいけないこと」）。
 *
 * **`transmission` は使わない（TASKS 4-2c・案 A）。** transmission は「同一フレームの
 * 不透明パスを写したバッファ」をサンプルする機能で、加算ブレンドで描くビームはそこに
 * 入らない。素直に transmission 化すると**プリズム越しの内部ビームが消える**ため、
 * 現行の透明マテリアル（`depthWrite: false`）を保ち、ガラスらしさは環境マップの反射で出す。
 *
 * 反射の強さは `ior` が決める。誘電体の垂直反射率 F0 = ((n-1)/(n+1))² が ior から
 * 導かれるので、材質を変えると縁の光り方が変わる（水 0.021 ↔ ダイヤ 0.160）。
 */
export default class PrismObject {
  /** シーンに追加するノード。姿勢はこの `matrix` が単一の真実。 */
  readonly object: Object3D;

  private readonly mesh: Mesh;
  private readonly material: MeshPhysicalMaterial;
  private readonly envTexture: CanvasTexture;

  /**
   * 縁の光の強さ。シェーダの uniform と実体を共有するので、値の代入だけで反映される。
   *
   * 初期値 0（縁光りなし）。実際の値は配線側が `setRefractiveIndex` で与える。
   * 材質は store が持つものが唯一の真実なので、既定値をここに二重に持たない。
   */
  private readonly rimStrength = { value: 0 };

  constructor(sideLength: number = PRISM_SIDE_LENGTH, depth: number = PRISM_DEPTH) {
    const geometry = createPrismGeometry(sideLength, depth);

    this.envTexture = createGlassEnvTexture();
    this.material = new MeshPhysicalMaterial({
      color: 0x35577f,
      metalness: 0,
      // ガラスは滑らかな面。環境マップがぼけずに映り、縁のフレネル反射が締まる
      roughness: 0.05,
      transparent: true,
      // 面はごく薄く。立体の形は縁のフレネル光が描く
      opacity: 0.22,
      envMap: this.envTexture,
      envMapIntensity: 2.4,
      // 深度を書き込むと、プリズム内部を通る光路（前面より奥）が深度テストで落ちて見えなくなる。
      // 透明体は深度を書かないのが定石で、内部の光が透けて見えるのが物理的にも正しい
      depthWrite: false,
    });

    this.material.onBeforeCompile = (shader): void => {
      shader.uniforms.uRimStrength = this.rimStrength;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uRimStrength;`)
        .replace('#include <opaque_fragment>', `${RIM_FRAGMENT_CHUNK}
#include <opaque_fragment>`);
    };

    this.mesh = new Mesh(geometry, this.material);
    this.object = this.mesh;
  }

  /**
   * 材質の屈折率を見た目へ反映する。
   *
   * `ior` は誘電体の垂直反射率 F0 = ((n-1)/(n+1))² を決めるので、屈折率が高い材質ほど
   * 面と縁が強く光る。**光路計算はこの値を使わない**（tracer は `PrismMaterial` から
   * 波長ごとの屈折率を独立に引く）。ここは純粋に見た目の話である。
   *
   * @param refractiveIndex 材質の基準屈折率 n_d（無次元）
   */
  setRefractiveIndex(refractiveIndex: number): void {
    const clamped = Math.min(Math.max(refractiveIndex, IOR_MIN), IOR_MAX);

    if (this.material.ior !== clamped) {
      this.material.ior = clamped;
    }

    // 誘電体の垂直反射率 F0 = ((n-1)/(n+1))²。頭打ちのない生の n_d から求める
    const normalReflectance =
      ((refractiveIndex - 1) / (refractiveIndex + 1)) ** 2;

    this.rimStrength.value = normalReflectance * RIM_GAIN;
  }

  /** ジオメトリ・マテリアル・環境マップを解放する。 */
  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.envTexture.dispose();
  }
}

/**
 * ガラスに映り込ませる環境マップを手続き的に作る。
 *
 * HDR ファイルは読み込まない（CDN 禁止・起動を重くしない）。上方が明るく下方が暗い
 * 正距円筒の帯に、キーライトを模した明るい斑点を 1 つ置くだけで、面の向きに応じて
 * 動く映り込みが得られる。小さなテクスチャなので three による PMREM 化も一度きりで済む。
 *
 * @returns 環境マップとして使う CanvasTexture
 */
function createGlassEnvTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ENV_TEXTURE_WIDTH;
  canvas.height = ENV_TEXTURE_HEIGHT;

  const context = canvas.getContext('2d');

  if (context === null) {
    throw new Error('2D コンテキストを取得できません');
  }

  // 天頂から地平へ向かう明度の勾配。これが面の傾きの違いを可視化する
  const sky = context.createLinearGradient(0, 0, 0, ENV_TEXTURE_HEIGHT);
  sky.addColorStop(0, '#6f86b8');
  sky.addColorStop(0.45, '#243349');
  sky.addColorStop(0.55, '#10161f');
  sky.addColorStop(1, '#05070b');
  context.fillStyle = sky;
  context.fillRect(0, 0, ENV_TEXTURE_WIDTH, ENV_TEXTURE_HEIGHT);

  // キーライト（main.ts の DirectionalLight に対応する位置）を模した明るい斑点
  const highlightX = ENV_TEXTURE_WIDTH * 0.72;
  const highlightY = ENV_TEXTURE_HEIGHT * 0.28;
  const highlight = context.createRadialGradient(
    highlightX,
    highlightY,
    0,
    highlightX,
    highlightY,
    ENV_TEXTURE_HEIGHT * 0.34
  );
  highlight.addColorStop(0, '#ffffff');
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = highlight;
  context.fillRect(0, 0, ENV_TEXTURE_WIDTH, ENV_TEXTURE_HEIGHT);

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;

  return texture;
}
