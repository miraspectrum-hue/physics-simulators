import {
  ACESFilmicToneMapping,
  CanvasTexture,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { computeBackingSize } from './backingSize';

/** 既定のカメラ画角 [deg]。 */
const FIELD_OF_VIEW_DEG = 45;

/** カメラの近クリップ面と遠クリップ面。射出光は 40 単位伸びるので遠方に余裕を持たせる。 */
const NEAR_PLANE = 0.1;
const FAR_PLANE = 200;

/** 既定のカメラ位置。プリズム（一辺 2）と入射光の始点が収まる距離。 */
const DEFAULT_CAMERA_Z = 6.5;

/**
 * 背景のラジアルグラデーション（TASKS 2-6）。中心がわずかに明るい暗青。
 *
 * ポストエフェクトを挟むと描画がレンダーターゲット経由になり、透明な canvas に
 * CSS の背景を透かす方法では Bloom の合成が破綻する。そのためシーン側で塗る。
 *
 * 閾値 1.2 の Bloom には遠く届かない暗さなので、背景そのものは滲まない。
 */
const BACKGROUND_INNER_COLOR = '#131c30';
const BACKGROUND_OUTER_COLOR = '#04060b';

/** 背景テクスチャの解像度 [px]。緩やかなグラデーションなので低くてよい。 */
const BACKGROUND_TEXTURE_SIZE = 512;

/**
 * Bloom の強さ・広がり・閾値（TASKS 2-7）。
 *
 * 全画面に掛けたうえで**閾値で対象を選ぶ**。明るいのは加算ブレンドの光線だけで、
 * プリズム面は暗い青（opacity 0.45）なので、レイヤ分離をせずとも光線だけが滲む。
 *
 * **閾値が 1 を超えているのは誤りではない。** Bloom はトーンマッピング前の線形バッファに
 * 掛かり、48 本を加算合成した光線はそこで 1 を大きく超える。閾値を 1 未満にすると
 * 画面全体が拾われ、虹の色が白く飛ぶ（目視で確認済み）。
 */
const BLOOM_STRENGTH = 0.3;
const BLOOM_RADIUS = 0.2;
const BLOOM_THRESHOLD = 1.2;

/**
 * レンダラ・カメラ・シーン・描画ループを束ねる。
 *
 * 描画ループは常時回し、光路の再計算のみ上位層が dirty フラグで抑制する
 * （CLAUDE.md「Three.js 運用」）。
 *
 * 描画は `EffectComposer` を通す。`RenderPass` の出力はレンダーターゲット行きなので
 * three はトーンマッピングも sRGB 変換も適用しない。**最後の `OutputPass` がその 2 つを
 * まとめて行う**ため、外すと全体が暗く色も転ぶ。
 */
export default class SceneManager {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;

  private readonly container: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly backgroundTexture: CanvasTexture;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;

  /**
   * 描画面の大きさの単一の源（アスペクト是正）。
   *
   * **監視するのは canvas ではなく容器（`#app`）である。** canvas は
   * `width: 100%` で容器に従うだけなので、容器の大きさは canvas のバッキングに
   * 依存しない。canvas を監視すると、バッキングを変える → canvas の箱が変わる →
   * また通知が来る、というフィードバックループになる。
   */
  private readonly resizeObserver: ResizeObserver;

  /** 適用待ちの箱 [CSS px]。待機中でなければ null。 */
  private pendingBox: { width: number; height: number } | null = null;

  /** 適用を予約した `requestAnimationFrame` の番号。待機中でなければ null。 */
  private pendingFrame: number | null = null;

  /** 直近に適用した箱 [CSS px]。冪等ガードの比較元。 */
  private appliedBox: { width: number; height: number } | null = null;

  /** 箱を実際に適用した回数。**検証用**（冪等ガードが効いているかを外から数える）。 */
  private resizeApplyCount = 0;

  /**
   * `ResizeObserver` から箱を一度でも受け取ったか。
   *
   * **受け取るまでは 1 フレームも描かない。** 構築時の下敷きのまま描くと、
   * 潰れた絵が実際に画面へ出る（是正前の実測で 2 フレーム）。描かない間に見えるのは
   * body の背景で、これはアプリが起動する前と同じ絵なので、ちらつきにならない。
   */
  private boxObserved = false;

  /** 描画面の大きさが変わったときに呼ぶ購読者。`LineMaterial.resolution` の更新に使う。 */
  private readonly resizeSubscribers: Array<(width: number, height: number) => void> = [];

  /** 直前フレームの時刻 [ms]。経過時間の算出に使う。 */
  private lastFrameTimeMs: number | null = null;

  /**
   * `composer.render()` を撃った回数。**検証用**。
   *
   * `renderer.info.render.frame` は使えない。あれは `WebGLRenderer.render()` の回数で、
   * Bloom が内部で何度も全画面矩形を描くため、`composer.render()` 1 回につき
   * 十数回増える（実測 15）。ここで数えたいのは合成 1 回ぶんである。
   */
  private renderCallCount = 0;

  /**
   * @param container canvas を追加する要素。この要素の大きさに追従する
   */
  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new Scene();
    this.backgroundTexture = createBackgroundTexture();
    this.scene.background = this.backgroundTexture;

    // 下敷きの値。正しいアスペクトは下の applyBox（と ResizeObserver）が入れる
    this.camera = new PerspectiveCamera(
      FIELD_OF_VIEW_DEG,
      computeBackingSize(container.clientWidth, container.clientHeight, window.devicePixelRatio)
        .aspect,
      NEAR_PLANE,
      FAR_PLANE
    );
    this.camera.position.set(0, 0, DEFAULT_CAMERA_Z);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // 解像度は applySize が直後に上書きする。ここでは 0 除算を避ける値を入れておく
    this.bloomPass = new UnrealBloomPass(
      new Vector2(1, 1),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    // 初回の一撃。この時点の箱はまだ操作パネルを含まない可能性があるが、
    // 直後に走る ResizeObserver の初回通知が正しい箱で上書きする。
    // **正しさを持っているのは観測の側で、ここは 0 除算を避けるための下敷きである。**
    this.applyBox(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    // window の resize では足りない。今回の不整合は window が変わらないまま
    // 容器だけが縮んだ（操作パネルが後から入った）ために起きた
    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];

      if (entry === undefined) {
        return;
      }

      const { width, height } = entry.contentRect;

      // 適用は RAF に整列させる。通知の中で寸法を書くと、同じフレームで
      // レイアウトを読み直すことになり layout thrash を招く
      this.pendingBox = { width, height };
      this.boxObserved = true;

      if (this.pendingFrame === null) {
        this.pendingFrame = requestAnimationFrame(() => {
          this.pendingFrame = null;
          this.flushPendingBox();
        });
      }
    });

    this.resizeObserver.observe(this.container);
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

    // 容器をここで測り直さない。**箱の値は applyBox が持つ 1 つだけ**にしておく
    const box = this.appliedBox;

    if (box !== null) {
      subscriber(box.width, box.height);
    }
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
      // **描く直前に**、観測された箱を反映する。ResizeObserver の通知は
      // そのフレームの rAF より後に届くので、ここで拾わないと 1 フレーム遅れる
      this.flushPendingBox();

      // 初回は前フレームが無いので 0 とする
      const deltaSeconds = this.lastFrameTimeMs === null ? 0 : (time - this.lastFrameTimeMs) / 1000;
      this.lastFrameTimeMs = time;

      // 箱をまだ観測していないうちは描かない（上の boxObserved を参照）
      if (!this.boxObserved) {
        return;
      }

      onFrame?.(deltaSeconds);
      this.composer.render(deltaSeconds);
      this.renderCallCount += 1;
    });
  }

  /**
   * 3D キャンバスを PNG の data URL として書き出す（TASKS 6-6 段階5, PNG-1）。
   *
   * **`composer.render()` と `toDataURL()` を同一の同期タスクで続けて呼ぶこと**が
   * この関数の要である。`WebGLRenderer` は `preserveDrawingBuffer: true` を
   * 立てていない。この指定はフレームごとに描画バッファの複製を保持させるので、
   * 「たまに押される保存ボタン」のために常時そのコストを払うのは割に合わない。
   *
   * 代わりに仕様の側を使う。描画バッファが破棄されるのは**ブラウザが canvas を
   * 合成した後**であり、合成は現在のタスクが終わってから起きる。したがって
   * 同じタスクの中で描き直して直後に読めば、必ず中身が入っている。
   * 逆に言えば、この 2 行の間に `await` や `setTimeout` を挟んだ瞬間に
   * 空の画像が返る。**呼び出し側もクリックハンドラから同期で呼ぶこと。**
   *
   * 書き出すのは 3D キャンバスだけで、断面図の SVG インセットは DOM の重畳なので
   * 写らない（PNG-1 の仕様。合成は PNG-2 の仕事）。
   *
   * 解像度は現在のバッキングストア（CSS 上の大きさ × `devicePixelRatio`、
   * `MAX_PIXEL_RATIO` で頭打ち）そのままになる。
   *
   * @returns `data:image/png;base64,...` 形式の文字列
   */
  captureDataUrl(): string {
    this.composer.render(0);
    this.renderCallCount += 1;

    return this.renderer.domElement.toDataURL('image/png');
  }

  /**
   * これまでに箱を適用した回数。**検証用**（同じ箱の通知で増えないこと）。
   */
  get resizeCount(): number {
    return this.resizeApplyCount;
  }

  /**
   * これまでに `composer.render()` を撃った回数。**検証用**
   * （書き出しが余分に撃つ回数を外から数える）。
   */
  get renderCount(): number {
    return this.renderCallCount;
  }

  /** 描画ループを停止する。 */
  stop(): void {
    this.renderer.setAnimationLoop(null);
  }

  /** リスナと GPU リソースを解放する。 */
  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();

    if (this.pendingFrame !== null) {
      cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
    }

    this.composer.dispose();
    this.backgroundTexture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /**
   * 待機中の箱があれば、いま反映する。
   *
   * 予約してある RAF は取り消す（同じ箱を二度適用しても冪等ガードが弾くが、
   * 取り消しておく方が意図が読める）。
   */
  private flushPendingBox(): void {
    const box = this.pendingBox;

    if (box === null) {
      return;
    }

    this.pendingBox = null;

    if (this.pendingFrame !== null) {
      cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
    }

    this.applyBox(box.width, box.height);
  }

  /**
   * 観測された箱をレンダラ・カメラ・全パスへ反映する。
   *
   * **バッキングは常にこの箱から導かれる**（`computeBackingSize`）。
   * 箱以外から寸法を作る経路を残さないのが、この関数を 1 本にしている理由である。
   *
   * @param boxWidth 容器の幅 [CSS px]
   * @param boxHeight 容器の高さ [CSS px]
   */
  private applyBox(boxWidth: number, boxHeight: number): void {
    // 冪等ガード。同じ箱で呼ばれたら何もしない（RAF ごとの無駄な再確保を避ける）
    if (
      this.appliedBox !== null &&
      this.appliedBox.width === boxWidth &&
      this.appliedBox.height === boxHeight
    ) {
      return;
    }

    this.appliedBox = { width: boxWidth, height: boxHeight };
    this.resizeApplyCount += 1;

    const backing = computeBackingSize(boxWidth, boxHeight, window.devicePixelRatio);
    // three の setSize は CSS 寸法 × pixelRatio を floor する。同じ結果になるよう
    // pixelRatio を復元して渡す（バッキングの正解は computeBackingSize が持つ）
    const pixelRatio = backing.width / boxWidth;

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(boxWidth, boxHeight, false);

    // composer のレンダーターゲットは renderer と別管理なので、同じ大きさへ揃える。
    // **ここを忘れると書き出しと画面の画素が食い違う**
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(boxWidth, boxHeight);
    this.bloomPass.setSize(boxWidth, boxHeight);

    this.camera.aspect = backing.aspect;
    this.camera.updateProjectionMatrix();

    for (const subscriber of this.resizeSubscribers) {
      subscriber(boxWidth, boxHeight);
    }
  }
}

/**
 * 背景に敷くラジアルグラデーションのテクスチャを作る。
 *
 * 2D テクスチャを `scene.background` に置くと画面いっぱいに引き伸ばして描かれる。
 * 横長のビューポートでは円が楕円に潰れるが、緩いビネットなので破綻しない。
 *
 * @returns 背景として使う CanvasTexture
 */
function createBackgroundTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = BACKGROUND_TEXTURE_SIZE;
  canvas.height = BACKGROUND_TEXTURE_SIZE;

  const context = canvas.getContext('2d');

  if (context === null) {
    throw new Error('2D コンテキストを取得できません');
  }

  const center = BACKGROUND_TEXTURE_SIZE / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, BACKGROUND_INNER_COLOR);
  gradient.addColorStop(1, BACKGROUND_OUTER_COLOR);

  context.fillStyle = gradient;
  context.fillRect(0, 0, BACKGROUND_TEXTURE_SIZE, BACKGROUND_TEXTURE_SIZE);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  return texture;
}
