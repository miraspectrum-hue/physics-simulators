import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';

import { RENDER_ORDER } from './renderOrder';

/** 床の高さ [world]。プリズム（一辺 2・中心が原点）の下端よりわずかに下。 */
export const FLOOR_Y = -1.2;

/** 床の一辺の長さ。射出光が 40 単位伸びるので、それを受けられる広さを取る。 */
const FLOOR_SIZE = 120;

/** 減衰マスクの解像度 [px]。滑らかなグラデーションが出れば十分で、大きくしても見た目は変わらない。 */
const FADE_TEXTURE_SIZE = 256;

/**
 * 床面（TASKS 2-6）。
 *
 * `prizm.png` は床の映り込みがほとんど無い暗い空間なので、鏡面反射（`Reflector`）は使わない。
 * 反射は 1 フレームにつきシーンをもう一度描くことになり、60fps 要件（SPEC.md「非機能要件」）に
 * 対して割に合わない。
 *
 * 平面をそのまま置くと、縁が画面を横切る直線として見えてしまう。中心から外側へ向かって
 * 透明にする減衰マスク（`alphaMap`）を掛け、地面が闇に溶けるようにする。
 *
 * 光路計算には一切関与しない。`optics/` はこの物体の存在を知らない。
 */
export default class FloorObject {
  /** シーンに追加するノード。 */
  readonly object: Mesh;

  private readonly geometry: PlaneGeometry;
  private readonly material: MeshStandardMaterial;
  private readonly fadeTexture: CanvasTexture;

  constructor() {
    this.geometry = new PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);
    this.fadeTexture = createRadialFadeTexture();

    this.material = new MeshStandardMaterial({
      color: 0x24314d,
      roughness: 0.95,
      metalness: 0,
      alphaMap: this.fadeTexture,
      transparent: true,
      // 「地面がある」と分かる程度に留める。濃くすると水平線が主張して虹から目が逸れる
      opacity: 0.75,
      // カメラが床とほぼ同じ高さにあるため、裏面が見える角度でも消えないようにする
      side: DoubleSide,
      // 透明体は深度を書かない。ビームが床より奥にあっても深度テストで落ちないようにする
      depthWrite: false,
    });

    this.object = new Mesh(this.geometry, this.material);
    this.object.renderOrder = RENDER_ORDER.floor;
    this.object.rotation.x = -Math.PI / 2;
    this.object.position.y = FLOOR_Y;
  }

  /** ジオメトリ・マテリアル・テクスチャを解放する。 */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.fadeTexture.dispose();
  }
}

/**
 * 中心が不透明、外周が透明になる円形の減衰マスクを作る。
 *
 * @returns アルファマップとして使う CanvasTexture
 */
function createRadialFadeTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = FADE_TEXTURE_SIZE;
  canvas.height = FADE_TEXTURE_SIZE;

  const context = canvas.getContext('2d');

  if (context === null) {
    throw new Error('2D コンテキストを取得できません');
  }

  const center = FADE_TEXTURE_SIZE / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);

  // 中心付近だけを残し、外周は完全に透明にする。白 = 不透明（alphaMap は輝度を見る）
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.18, '#a0a0a0');
  gradient.addColorStop(0.45, '#242424');
  gradient.addColorStop(0.75, '#000000');
  gradient.addColorStop(1, '#000000');

  context.fillStyle = gradient;
  context.fillRect(0, 0, FADE_TEXTURE_SIZE, FADE_TEXTURE_SIZE);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  return texture;
}
