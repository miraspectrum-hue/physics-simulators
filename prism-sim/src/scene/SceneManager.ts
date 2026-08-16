import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

/** 既定のカメラ画角 [deg]。 */
const FIELD_OF_VIEW_DEG = 45;

/** カメラの近クリップ面と遠クリップ面。射出光は 40 単位伸びるので遠方に余裕を持たせる。 */
const NEAR_PLANE = 0.1;
const FAR_PLANE = 200;

/** 既定のカメラ位置。プリズム（一辺 2）と入射光の始点が収まる距離。 */
const DEFAULT_CAMERA_Z = 6.5;

/** デバイスピクセル比の上限。高 DPI 環境での過剰な描画負荷を抑える。 */
const MAX_PIXEL_RATIO = 2;

/**
 * レンダラ・カメラ・シーン・描画ループを束ねる。
 *
 * 描画ループは常時回し、光路の再計算のみ上位層が dirty フラグで抑制する
 * （CLAUDE.md「Three.js 運用」）。
 */
export default class SceneManager {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;

  private readonly container: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly resizeListener: () => void;

  /** 描画面の大きさが変わったときに呼ぶ購読者。`LineMaterial.resolution` の更新に使う。 */
  private readonly resizeSubscribers: Array<(width: number, height: number) => void> = [];

  /** 直前フレームの時刻 [ms]。経過時間の算出に使う。 */
  private lastFrameTimeMs: number | null = null;

  /**
   * @param container canvas を追加する要素。この要素の大きさに追従する
   */
  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new Scene();

    this.camera = new PerspectiveCamera(
      FIELD_OF_VIEW_DEG,
      this.aspectRatio(),
      NEAR_PLANE,
      FAR_PLANE
    );
    this.camera.position.set(0, 0, DEFAULT_CAMERA_Z);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.applySize();
    this.container.appendChild(this.renderer.domElement);

    this.resizeListener = (): void => {
      this.applySize();
    };
    window.addEventListener('resize', this.resizeListener);
  }

  /**
   * イベントを拾う要素（レンダラの canvas）。コントロール類の接続先になる。
   */
  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * 描画面の大きさの変化を購読する。登録時にも現在の大きさで一度呼ぶ。
   *
   * @param subscriber 幅・高さ [px] を受け取る関数
   */
  onResize(subscriber: (width: number, height: number) => void): void {
    this.resizeSubscribers.push(subscriber);
    subscriber(this.container.clientWidth, this.container.clientHeight);
  }

  /**
   * 描画ループを開始する。
   *
   * ループは常時 60fps で回し、光路の再計算は `onFrame` の中で dirty フラグにより
   * 抑制する（CLAUDE.md「Three.js 運用」）。
   *
   * @param onFrame 描画の直前に毎フレーム呼ぶ関数。前フレームからの経過時間 [s] を受け取る
   */
  start(onFrame?: (deltaSeconds: number) => void): void {
    this.renderer.setAnimationLoop((time) => {
      // 初回は前フレームが無いので 0 とする
      const deltaSeconds = this.lastFrameTimeMs === null ? 0 : (time - this.lastFrameTimeMs) / 1000;
      this.lastFrameTimeMs = time;

      onFrame?.(deltaSeconds);
      this.renderer.render(this.scene, this.camera);
    });
  }

  /** 描画ループを停止する。 */
  stop(): void {
    this.renderer.setAnimationLoop(null);
  }

  /** リスナと GPU リソースを解放する。 */
  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.resizeListener);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** コンテナの縦横比。0 除算を避けるため高さ 0 のときは 1 とする。 */
  private aspectRatio(): number {
    const { clientWidth, clientHeight } = this.container;

    return clientHeight === 0 ? 1 : clientWidth / clientHeight;
  }

  /** コンテナの大きさをレンダラとカメラへ反映する。 */
  private applySize(): void {
    const { clientWidth, clientHeight } = this.container;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = this.aspectRatio();
    this.camera.updateProjectionMatrix();

    for (const subscriber of this.resizeSubscribers) {
      subscriber(clientWidth, clientHeight);
    }
  }
}
