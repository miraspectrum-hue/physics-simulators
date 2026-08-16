import type { Camera, Object3D, Scene } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

/**
 * 操作モード。`camera` はカメラ操作のみ、`rotate` はプリズムの回転ギズモを出す。
 *
 * NOTE: 移動ギズモ（`translate`）は I-2 で追加する。
 */
export type InteractionMode = 'camera' | 'rotate';

/** ギズモの大きさ。プリズムの一辺 2 に対して掴みやすい値。 */
const GIZMO_SIZE = 1.2;

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
  private readonly orbit: OrbitControls;
  private readonly transform: TransformControls;
  private readonly scene: Scene;
  private readonly helper: Object3D;

  /** ギズモを付ける対象。未設定なら `rotate` にしてもギズモは出ない。 */
  private target: Object3D | null = null;

  private mode: InteractionMode = 'camera';

  /** 姿勢が変わったときに呼ぶ購読者。 */
  private readonly poseSubscribers: Array<() => void> = [];

  /**
   * @param camera 操作対象のカメラ
   * @param domElement イベントを拾う要素（レンダラの canvas）
   * @param scene ギズモのヘルパーを追加するシーン
   */
  constructor(camera: Camera, domElement: HTMLElement, scene: Scene) {
    this.scene = scene;

    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enableDamping = true;

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
    this.mode = mode;
    this.applyMode();
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
   * 毎フレームの更新。`enableDamping` を使うため呼び出しが必須。
   *
   * @param deltaSeconds 前フレームからの経過時間 [s]
   */
  update(deltaSeconds: number): void {
    this.orbit.update(deltaSeconds);
  }

  /** イベントリスナと GPU リソースを解放する。 */
  dispose(): void {
    this.transform.detach();
    this.scene.remove(this.helper);
    this.transform.dispose();
    this.orbit.dispose();
  }

  /** モードと対象からギズモの着脱を決める。 */
  private applyMode(): void {
    if (this.mode === 'camera' || this.target === null) {
      this.transform.detach();

      return;
    }

    this.transform.attach(this.target);
  }
}
