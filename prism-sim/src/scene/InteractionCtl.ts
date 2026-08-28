import { Vector3 } from 'three';
import type { Camera, Object3D, Scene } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

/**
 * 操作モード。`camera` はカメラ操作のみ、`rotate` は回転ギズモ、`translate` は移動ギズモを出す。
 */
export type InteractionMode = 'camera' | 'rotate' | 'translate';

/** ギズモの大きさ。プリズムの一辺 2 に対して掴みやすい値。 */
const GIZMO_SIZE = 1.2;

/** 回転リングが乗る平面の法線。回転は Z 軸まわりのみなので、リングは XY 平面上にある。 */
const RING_NORMAL = new Vector3(0, 0, 1);

/**
 * 回転ギズモを隠す視線の閾値。
 *
 * `|視線 · リング法線|` で測る。1 ならリングを正面から見ている状態、0 なら真横＝リングが
 * 線に潰れた状態。**光路も XY 平面上にあるため、リングが線に潰れる視点ではリングが
 * ビームの上に正確に重なり、光が途切れて見える**（ギズモは UI として最前面に描かれる）。
 * その視点ではリング自体も掴めないので、隠しても操作性は落ちない。
 *
 * 0.15 は視線が主断面から約 8.6 度以内に入ったとき、という意味になる。
 */
const RING_EDGE_ON_THRESHOLD = 0.15;

/** 視線の計算に使う作業用インスタンス。毎フレーム new しない（CLAUDE.md「Three.js 運用」）。 */
const workViewDirection = new Vector3();

/**
 * キーボードによるモード切替の対応表。
 *
 * R = rotate（回転）、G = translate（掴んで動かす。Blender の grab に倣う）、
 * Escape = camera（ギズモを外してカメラ操作へ戻る）。
 * 入力欄で打鍵しているときは切り替えない（I-3 でスライダーが載るため先に備える）。
 */
const MODE_KEYS: Readonly<Record<string, InteractionMode>> = {
  KeyR: 'rotate',
  KeyG: 'translate',
  Escape: 'camera',
};

/**
 * カメラ操作（OrbitControls）とプリズム操作（TransformControls）を所有し、調停する。
 *
 * このクラスは 2 つのコントロールの排他だけを持ち、光路も状態も知らない。
 * 姿勢は `Object3D.matrixWorld` が単一の真実なので、ギズモは対象を直接動かし、
 * 「姿勢が実際に変わった」ことだけを `onPoseChange` で外へ知らせる
 * （CLAUDE.md「プリズム姿勢をオイラー角で自前に二重保持すること」の禁止）。
 *
 * 排他の要点は 2 つある。
 * 1. ギズモをドラッグしている間は Orbit を止める（`dragging-changed`）。
 *    止めないと、ギズモを掴んだまま同時にカメラが回ってしまう。
 * 2. `camera` モードでは `detach()` する。`visible = false` だけではギズモが
 *    見えないままポインタを拾い続け、プリズムの奥のクリックを奪う。
 */
export default class InteractionCtl {
  private readonly camera: Camera;
  private readonly orbit: OrbitControls;
  private readonly transform: TransformControls;
  private readonly scene: Scene;
  private readonly helper: Object3D;

  /** ギズモを付ける対象。未設定なら `rotate` にしてもギズモは出ない。 */
  private target: Object3D | null = null;

  private mode: InteractionMode = 'camera';

  /** 姿勢が変わったときに呼ぶ購読者。 */
  private readonly poseSubscribers: Array<() => void> = [];

  /** モードが変わったときに呼ぶ購読者。 */
  private readonly modeSubscribers: Array<(mode: InteractionMode) => void> = [];

  /** カメラ視点が変わったときに呼ぶ購読者（カメラ共有）。 */
  private readonly cameraChangeSubscribers: Array<() => void> = [];

  /** キーボード切替のリスナ。dispose で外すために保持する。 */
  private readonly keyListener: (event: KeyboardEvent) => void;

  /**
   * @param camera 操作対象のカメラ
   * @param domElement イベントを拾う要素（レンダラの canvas）
   * @param scene ギズモのヘルパーを追加するシーン
   */
  constructor(camera: Camera, domElement: HTMLElement, scene: Scene) {
    this.camera = camera;
    this.scene = scene;

    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enableDamping = true;

    // カメラ視点の変化を中継する（カメラ共有）。ドラッグ中は毎フレーム飛ぶので、
    // 呼び出し側（main.ts）でデバウンスする前提。`orbit` オブジェクト自体は
    // 外へ漏らさず、この 3 面（取得・設定・購読）だけを公開する
    this.orbit.addEventListener('change', () => {
      for (const subscriber of this.cameraChangeSubscribers) {
        subscriber();
      }
    });

    this.transform = new TransformControls(camera, domElement);
    this.transform.mode = 'rotate';
    this.transform.size = GIZMO_SIZE;

    // TransformControls は Object3D ではないので、シーンに足すのはヘルパーの方
    this.helper = this.transform.getHelper();
    this.scene.add(this.helper);

    this.transform.addEventListener('dragging-changed', (event) => {
      // payload の型は unknown。`any` を使わずに絞り込む
      if (typeof event.value === 'boolean') {
        this.orbit.enabled = !event.value;
      }
    });

    // 姿勢が実際に変わったときだけ飛ぶ。ドラッグ開始・終了では飛ばない
    this.transform.addEventListener('objectChange', () => {
      for (const subscriber of this.poseSubscribers) {
        subscriber();
      }
    });

    this.keyListener = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const mode = MODE_KEYS[event.code];

      if (mode === undefined) {
        return;
      }

      event.preventDefault();
      this.setMode(mode);
    };
    window.addEventListener('keydown', this.keyListener);
  }

  /**
   * ギズモの対象を設定する。
   *
   * @param object 動かす対象。現在のモードが `camera` ならまだギズモは出ない
   */
  attachTarget(object: Object3D): void {
    this.target = object;
    this.applyMode();
  }

  /**
   * 操作モードを切り替える。
   *
   * @param mode `camera` でカメラ操作のみ、`rotate` で回転ギズモを表示
   */
  setMode(mode: InteractionMode): void {
    if (mode === this.mode) {
      return;
    }

    this.mode = mode;
    this.applyMode();

    for (const subscriber of this.modeSubscribers) {
      subscriber(mode);
    }
  }

  /** 現在の操作モード。 */
  currentMode(): InteractionMode {
    return this.mode;
  }

  /**
   * 姿勢の変化を購読する。
   *
   * @param subscriber ギズモ操作で対象の姿勢が変わったときに呼ばれる
   */
  onPoseChange(subscriber: () => void): void {
    this.poseSubscribers.push(subscriber);
  }

  /**
   * 操作モードの変化を購読する。
   *
   * @param subscriber 切り替わった後のモードを受け取る
   */
  onModeChange(subscriber: (mode: InteractionMode) => void): void {
    this.modeSubscribers.push(subscriber);
  }

  /**
   * 現在の注視点を読む（カメラ共有）。
   *
   * `OrbitControls.target` の複製を返す。**生の参照ではない**——呼び出し側が直接
   * 書き換えると `orbit` の内部状態（球面座標のキャッシュ）と食い違うため、
   * 視点を変えるときは必ず `setCameraView` を通す。
   *
   * @returns 注視点の複製
   */
  cameraTarget(): Vector3 {
    return this.orbit.target.clone();
  }

  /**
   * カメラ視点（位置と注視点）を直接設定する（カメラ共有）。
   *
   * Perspective カメラでは `OrbitControls` のドリー（ズーム操作）が `camera.zoom`
   * ではなく `camera.position` の移動に畳み込まれるため（`zoom` が動くのは
   * Orthographic のときだけ）、視点は position + target の 2 点で過不足なく定まる。
   *
   * 設定直後に `orbit.update()` を明示的に呼ぶ。呼ばないと、次にレンダーループが
   * `update(deltaSeconds)` を呼ぶまで内部の球面座標（カメラの向き）が古いままになり、
   * 同一フレーム内での確実な反映が保証できない。
   *
   * @param position 新しいカメラ位置（ワールド座標）
   * @param target 新しい注視点（ワールド座標）
   */
  setCameraView(
    position: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number }
  ): void {
    this.camera.position.set(position.x, position.y, position.z);
    this.orbit.target.set(target.x, target.y, target.z);
    this.orbit.update();
  }

  /**
   * カメラ視点の変化を購読する（カメラ共有）。
   *
   * `OrbitControls` の `'change'` イベントを中継するだけ。ドラッグ中は 1 フレームごとに
   * 発火するため、購読側でデバウンスすること（`main.ts` は既存の `scheduleUrlUpdate`
   * の静穏時間デバウンスにそのまま乗せる）。
   *
   * @param subscriber 視点が変わるたびに呼ばれる
   */
  onCameraChange(subscriber: () => void): void {
    this.cameraChangeSubscribers.push(subscriber);
  }

  /**
   * 毎フレームの更新。`enableDamping` を使うため呼び出しが必須。
   *
   * @param deltaSeconds 前フレームからの経過時間 [s]
   */
  update(deltaSeconds: number): void {
    this.orbit.update(deltaSeconds);
    this.applyRingVisibility();
  }

  /**
   * 回転リングが線に潰れる視点では、リングを隠す。
   *
   * リングは光路と同じ XY 平面上にあるので、真横から見ると光の上に重なって
   * ビームを途切れて見せてしまう。掴めない向きでもあるため、隠す方が素直。
   * 見た目だけでなく `enabled` も落とし、見えないギズモがクリックを奪わないようにする。
   */
  private applyRingVisibility(): void {
    // **ここは「隠す」方向にしか働かせない。** `camera` モードでは applyMode() が detach 済みで
    // ギズモは出ないのに、毎フレーム visible = true を書き戻すと detach を打ち消してしまう
    // （実際に camera モードでリングが残る回帰を出した）。見せ直しは applyMode() の責務。
    if (this.mode !== 'rotate') {
      return;
    }

    this.camera.getWorldDirection(workViewDirection);

    const alignment = Math.abs(workViewDirection.dot(RING_NORMAL));
    const visible = alignment >= RING_EDGE_ON_THRESHOLD;

    this.helper.visible = visible;
    this.transform.enabled = visible;
  }

  /** イベントリスナと GPU リソースを解放する。 */
  dispose(): void {
    window.removeEventListener('keydown', this.keyListener);
    this.transform.detach();
    this.scene.remove(this.helper);
    this.transform.dispose();
    this.orbit.dispose();
  }

  /** モードと対象からギズモの着脱・種類・見せる軸を決める。 */
  private applyMode(): void {
    if (this.mode === 'camera' || this.target === null) {
      this.transform.detach();

      return;
    }

    this.transform.mode = this.mode;
    this.applyAxisConstraint();
    this.transform.attach(this.target);

    // 直前が rotate で、リングを隠したまま切り替わった場合の復帰
    this.helper.visible = true;
    this.transform.enabled = true;
  }

  /**
   * 操作の自由度を主断面（XY 平面）に閉じる。
   *
   * 回転は Z 軸まわりのみ、移動は XY 面内のみに制約する。主断面内で完結させることで、
   * 1 自由度の姿勢スライダーとギズモが素直に双方向同期する（自由度が増えると
   * スライダー側が姿勢を表現しきれず、両者の表示が食い違う）。
   * 3D 的な斜め入射を見たい場合はカメラを回して観察する。
   */
  private applyAxisConstraint(): void {
    const isRotate = this.mode === 'rotate';

    this.transform.showX = !isRotate;
    this.transform.showY = !isRotate;
    this.transform.showZ = isRotate;

    // 平面ハンドルは移動の XY だけ残す
    this.transform.showXY = !isRotate;
    this.transform.showYZ = false;
    this.transform.showXZ = false;

    // 回転の E（画面内まわり）と XYZE（自由回転）は主断面から外れるので出さない
    this.transform.showE = false;
    this.transform.showXYZE = false;
  }
}

/**
 * 打鍵先が文字入力を受け取る要素かどうかを判定する。
 *
 * スライダーやテキスト欄を操作している最中に R/G がモード切替へ吸われないようにする。
 *
 * @param target イベントの発生元
 * @returns 入力欄なら true
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
