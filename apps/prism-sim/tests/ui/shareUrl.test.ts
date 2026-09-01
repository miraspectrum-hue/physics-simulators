import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BEAM_WIDTH_PX,
  DEFAULT_SHAREABLE_STATE,
  MATERIAL_CODES,
  decodeUrl,
  encodeUrl,
  type ShareableState,
} from '../../src/ui/shareUrl';
import {
  DEFAULT_MATERIAL,
  SOURCE_ANGLE_MAX_DEG,
  SCREEN_DISTANCE_MIN,
} from '../../src/ui/store';
import type { MaterialName, SpectrumMode } from '../../src/types/optics';

/**
 * src/ui/shareUrl.ts の受け入れ条件（状態 ↔ URL 断片）。
 *
 * 対象:
 *   encodeUrl(state)     — 状態 → URL 断片（先頭の `#` は含まない）
 *   decodeUrl(fragment)  — URL 断片 → 状態。**決して投げない**
 *
 * 設計判断:
 *   - 集約はシリアライズの境界で行う。プリズム姿勢の単一の真実は `Object3D.matrix` の
 *     ままで、ここは集まった `ShareableState` しか知らない（所有権を store へ移すと
 *     TransformControls の直書きと競合し、3-5b のエコー問題が再発する）。
 *   - **寛容デコード**が加算的成長の肝。未知キー無視／欠損は既定／解釈不能も既定／
 *     範囲外は store の clampState へ／未知材質は BK7。これで古いビルドが新しい URL を
 *     読んでも壊れず、新しいビルドが古い URL を読めば足りない項目に既定が入る。
 *   - 値域の判定元を二重化しない。範囲の正解は `clampState` にしかない。
 *   - `screenAnchor` の null は「URL が指定していない」であって既定値ではない。
 *     アンカーは起動時に光路から導出される値で、定数の既定を持たない。
 *
 * 期待値の出典:
 *   桁は §3-D の取り決め（a: 6 桁・rz: 3 桁・sd: 1 桁・px/py: 3 桁・sa: 3 桁）。
 *   範囲の境界は store の SOURCE_ANGLE_MAX_DEG / SCREEN_DISTANCE_MIN をそのまま使う。
 *
 * 非空虚の注意（テストを書くときの前提）:
 *   - 往復は**すべて既定と異なる値**で行う。既定のままだと「符号化された」のか
 *     「省略されて既定が入った」のか区別できず、往復テストが空虚になる。
 *   - 「範囲外 → clamp」は clampState をテスト側で作り直さない。既知の境界 1 点
 *     （a=999 → 89）で結果を固定する。
 */

/** 往復に使う状態。**全項目が既定と違う。** */
const SAMPLE: ShareableState = {
  app: {
    sourceAngleDeg: 31.5,
    exaggeration: 3,
    material: 'SF10',
    screenDistance: 12.5,
    spectrumMode: 'sevenColor',
  },
  prismRotationDeg: -47.5,
  prismX: 1.25,
  prismY: -0.75,
  screenAnchor: { x: 1.234, y: -0.567, directionDeg: -38.65 },
  sectionVisible: true,
  glowEnabled: false,
  numbersVisible: false,
  cameraPosition: { x: 3.111111, y: -1.222222, z: 9.333333 },
  cameraTarget: { x: 0.444444, y: -0.555555, z: 0.666666 },
  beamWidthPx: 5.0,
};

/** 桁の取り決め。往復の比較にそのまま使う。 */
const DECIMALS = {
  sourceAngleDeg: 6,
  screenDistance: 1,
  prismRotationDeg: 3,
  prismPosition: 3,
  anchor: 3,
  camera: 6,
  beamWidthPx: 1,
} as const;

/** 断片をキーと値の表に開く。テスト側の独立な道具（SUT を通さない）。 */
function toParams(fragment: string): URLSearchParams {
  return new URLSearchParams(fragment.startsWith('#') ? fragment.slice(1) : fragment);
}

describe('6-6 段階1 A: 往復', () => {
  it('既定と異なる値でも decode(encode(s)) が元に戻る', () => {
    // Arrange: **全項目を既定からずらす**。既定のままだと省略と区別できず空虚になる
    // Act
    const restored = decodeUrl(encodeUrl(SAMPLE));

    // Assert: 丸め桁の範囲で一致すること
    expect(restored.app.sourceAngleDeg).toBeCloseTo(
      SAMPLE.app.sourceAngleDeg,
      DECIMALS.sourceAngleDeg
    );
    expect(restored.app.exaggeration).toBe(SAMPLE.app.exaggeration);
    expect(restored.app.material).toBe(SAMPLE.app.material);
    expect(restored.app.screenDistance).toBeCloseTo(
      SAMPLE.app.screenDistance,
      DECIMALS.screenDistance
    );
    expect(restored.prismRotationDeg).toBeCloseTo(
      SAMPLE.prismRotationDeg,
      DECIMALS.prismRotationDeg
    );
    expect(restored.prismX).toBeCloseTo(SAMPLE.prismX, DECIMALS.prismPosition);
    expect(restored.prismY).toBeCloseTo(SAMPLE.prismY, DECIMALS.prismPosition);
    expect(restored.sectionVisible).toBe(true);
    expect(restored.glowEnabled).toBe(false);
    expect(restored.numbersVisible).toBe(false);
    expect(restored.screenAnchor?.x).toBeCloseTo(1.234, DECIMALS.anchor);
    expect(restored.screenAnchor?.y).toBeCloseTo(-0.567, DECIMALS.anchor);
    expect(restored.screenAnchor?.directionDeg).toBeCloseTo(-38.65, DECIMALS.anchor);
    expect(restored.cameraPosition.x).toBeCloseTo(3.111111, DECIMALS.camera);
    expect(restored.cameraPosition.y).toBeCloseTo(-1.222222, DECIMALS.camera);
    expect(restored.cameraPosition.z).toBeCloseTo(9.333333, DECIMALS.camera);
    expect(restored.cameraTarget.x).toBeCloseTo(0.444444, DECIMALS.camera);
    expect(restored.cameraTarget.y).toBeCloseTo(-0.555555, DECIMALS.camera);
    expect(restored.cameraTarget.z).toBeCloseTo(0.666666, DECIMALS.camera);
  });

  it('2 度目の符号化で値が動かない（冪等安定）', () => {
    // Arrange: 1 度丸めた値を読み戻して再び符号化しても、同じ文字列になること。
    // ここが崩れると、URL を開くたびに末尾の桁が揺れて履歴が汚れる
    const once = encodeUrl(SAMPLE);

    // Act
    const twice = encodeUrl(decodeUrl(once));

    // Assert
    expect(twice).toBe(once);
  });
});

describe('6-6 段階1 B: 既定の省略', () => {
  it('既定の状態は v と spec だけになる', () => {
    // Arrange & Act
    const fragment = encodeUrl(DEFAULT_SHAREABLE_STATE);

    // Assert: 版と表示モード以外は 1 つも出ない。
    //         `spec` が省略の対象外なのは 4-3 の裁定による（既定を将来動かしたときに
    //         過去の共有 URL が別のモードで描かれるのを防ぐ。`sa` と同じ忠実性の扱い）
    const params = toParams(fragment);
    expect(params.get('v')).toBe('1');
    expect(params.get('spec')).toBe('cont');
    expect([...params.keys()]).toEqual(['v', 'spec']);
  });

  it('v だけの断片も空文字も既定へ戻る', () => {
    // Arrange & Act & Assert
    for (const fragment of ['v=1', '', '#v=1']) {
      const restored = decodeUrl(fragment);

      expect(restored.app.sourceAngleDeg).toBe(DEFAULT_SHAREABLE_STATE.app.sourceAngleDeg);
      expect(restored.app.exaggeration).toBe(DEFAULT_SHAREABLE_STATE.app.exaggeration);
      expect(restored.app.material).toBe(DEFAULT_MATERIAL);
      expect(restored.app.screenDistance).toBe(DEFAULT_SHAREABLE_STATE.app.screenDistance);
      expect(restored.app.spectrumMode).toBe(DEFAULT_SHAREABLE_STATE.app.spectrumMode);
      expect(restored.prismRotationDeg).toBe(DEFAULT_SHAREABLE_STATE.prismRotationDeg);
      expect(restored.prismX).toBe(DEFAULT_SHAREABLE_STATE.prismX);
      expect(restored.prismY).toBe(DEFAULT_SHAREABLE_STATE.prismY);
      expect(restored.sectionVisible).toBe(false);
      expect(restored.glowEnabled).toBe(true);
      expect(restored.numbersVisible).toBe(true);
      expect(restored.cameraPosition).toEqual(DEFAULT_SHAREABLE_STATE.cameraPosition);
      expect(restored.cameraTarget).toEqual(DEFAULT_SHAREABLE_STATE.cameraTarget);
    }
  });
});

describe('6-6 段階1 C: 寛容なデコード', () => {
  it('未知のキーは無視する（将来の版が付けたキーで壊れない）', () => {
    // Arrange: 4-3 / 4-6 で足す予定のキーを、まだ実装していない今のビルドが読む状況
    // Act
    const restored = decodeUrl('v=1&mat=sf10&spec=7&glow=0&cam=1,2,3&nazo=xyz');

    // Assert: 知っているキーだけ効き、他は素通り
    expect(restored.app.material).toBe('SF10');
    expect(restored.app.exaggeration).toBe(DEFAULT_SHAREABLE_STATE.app.exaggeration);
  });

  it('欠損したキーは既定値になる', () => {
    // Arrange: 材質だけを載せた断片
    // Act
    const restored = decodeUrl('v=1&mat=water');

    // Assert
    expect(restored.app.material).toBe('水');
    expect(restored.app.sourceAngleDeg).toBe(DEFAULT_SHAREABLE_STATE.app.sourceAngleDeg);
    expect(restored.prismRotationDeg).toBe(DEFAULT_SHAREABLE_STATE.prismRotationDeg);
  });

  it('解釈できない値も既定値になる', () => {
    // Arrange & Act
    const restored = decodeUrl('v=1&a=abc&rz=&px=NaN&sd=Infinity&sec=maybe');

    // Assert: 数として読めないものは既定へ。NaN を持ち込まない
    expect(restored.app.sourceAngleDeg).toBe(DEFAULT_SHAREABLE_STATE.app.sourceAngleDeg);
    expect(restored.prismRotationDeg).toBe(DEFAULT_SHAREABLE_STATE.prismRotationDeg);
    expect(restored.prismX).toBe(DEFAULT_SHAREABLE_STATE.prismX);
    expect(restored.app.screenDistance).toBe(DEFAULT_SHAREABLE_STATE.app.screenDistance);
    expect(restored.sectionVisible).toBe(false);
  });

  it('値域を外れた値は store の clampState に通る', () => {
    // Arrange: **clampState をここで作り直さない。** 既知の境界 1 点で結果を固定する。
    // 上限 89 と下限 2 は store の定数そのものを参照する
    // Act
    const high = decodeUrl('v=1&a=999&sd=0');
    const low = decodeUrl('v=1&a=-999&sd=999');

    // Assert
    expect(high.app.sourceAngleDeg).toBe(SOURCE_ANGLE_MAX_DEG);
    expect(high.app.screenDistance).toBe(SCREEN_DISTANCE_MIN);
    expect(low.app.sourceAngleDeg).toBe(-SOURCE_ANGLE_MAX_DEG);
    expect(low.app.screenDistance).toBeGreaterThan(SCREEN_DISTANCE_MIN);
  });

  it('未知の材質コードは既定の BK7 になる', () => {
    // Arrange & Act & Assert
    expect(decodeUrl('v=1&mat=obsidian').app.material).toBe('BK7');
    expect(decodeUrl('v=1&mat=').app.material).toBe('BK7');
  });

  it('不正な入力の束を与えても一切投げない', () => {
    // Arrange: 壊れた断片を並べる。**1 つでも投げたら、共有 URL を開いた人の画面が白くなる**
    const broken = [
      '',
      '#',
      '&&&',
      '=',
      'v',
      'v=',
      'v=abc',
      'v=99999',
      'a',
      'a=',
      'a=abc&m=xyz&mat=&sd=&rz=&px=&py=&sa=&sec=',
      'sa=1',
      'sa=1,2',
      'sa=a,b,c',
      'sa=1,2,3,4,5',
      'sec=2',
      'm=-100',
      '%%%',
      'a=1&a=2',
      'v=1&'.repeat(50),
    ];

    // Act & Assert
    for (const fragment of broken) {
      expect(() => decodeUrl(fragment), `断片 ${JSON.stringify(fragment)}`).not.toThrow();
      expect(decodeUrl(fragment).app.material).toBe('BK7');
    }
  });

  it('先頭の # はあってもなくても読める', () => {
    // Arrange & Act & Assert: location.hash はそのままだと # 付きで返る
    expect(decodeUrl('#v=1&mat=sf10').app.material).toBe('SF10');
    expect(decodeUrl('v=1&mat=sf10').app.material).toBe('SF10');
  });
});

describe('6-6 段階1 D: 材質コード', () => {
  it('4 材質すべてがコードを往復する', () => {
    // Arrange: 表そのものを回す。材質を足したら Record<MaterialName, string> が
    // 登録を強制するので、この網羅は自動で追随する
    const entries = Object.entries(MATERIAL_CODES) as Array<[MaterialName, string]>;

    // Act & Assert
    expect(entries).toHaveLength(4);

    for (const [name, code] of entries) {
      const fragment = encodeUrl({
        ...DEFAULT_SHAREABLE_STATE,
        app: { ...DEFAULT_SHAREABLE_STATE.app, material: name },
      });

      expect(toParams(fragment).get('mat'), `${name} の符号`).toBe(
        name === DEFAULT_MATERIAL ? null : code
      );
      expect(decodeUrl(`v=1&mat=${code}`).app.material, `${code} の復号`).toBe(name);
    }
  });
});

describe('6-6 段階1 E: 版', () => {
  it('v が無くても未知でも現行として読む', () => {
    // Arrange: 加算的な変更では v を上げないので、v で分岐しないのが正しい振る舞い
    // Act & Assert
    expect(decodeUrl('mat=sf10').app.material).toBe('SF10');
    expect(decodeUrl('v=1&mat=sf10').app.material).toBe('SF10');
    expect(decodeUrl('v=99&mat=sf10').app.material).toBe('SF10');
    expect(decodeUrl('v=abc&mat=sf10').app.material).toBe('SF10');
  });
});

describe('6-6 段階1 F: 桁', () => {
  it('入射角は 6 桁へ丸め、往復のずれが視覚不変域に収まる', () => {
    // Arrange: SF10 で「最小偏角に合わせる」が着地する値。表示は 2 桁なので 6 桁あれば絵は動かない。
    // **BK7 の着地値は使えない。** BK7 の既定入射角がそもそも θ₁_min なので、6 桁に丸めると
    // 既定と一致して省略され、「符号化された桁」を観測できない（下のテストがその事実を固定する）
    const landed = 59.784649106188105;
    const state: ShareableState = {
      ...DEFAULT_SHAREABLE_STATE,
      app: { ...DEFAULT_SHAREABLE_STATE.app, sourceAngleDeg: landed },
    };

    // Act
    const fragment = encodeUrl(state);
    const restored = decodeUrl(fragment);

    // Assert: 断片には 6 桁で載り、往復のずれは 1e-5 度に満たない
    expect(toParams(fragment).get('a')).toBe('59.784649');
    expect(Math.abs(restored.app.sourceAngleDeg - landed)).toBeLessThan(1e-5);
  });

  it('6 桁で既定と一致する値は省略される（BK7 の最小偏角の着地値）', () => {
    // Arrange: 既定の入射角は BK7 の θ₁_min そのもの（DEFAULT_SOURCE_ANGLE_DEG）。
    // ボタンが着地する 49.32334773624993 との差は 2.5e-10 度で、6 桁では区別が付かない。
    // **区別の付かない値を URL に載せない**のが「既定を省く」規則の帰結である
    const landed = 49.32334773624993;
    const state: ShareableState = {
      ...DEFAULT_SHAREABLE_STATE,
      app: { ...DEFAULT_SHAREABLE_STATE.app, sourceAngleDeg: landed },
      prismRotationDeg: -47.5,
    };

    // Act
    const fragment = encodeUrl(state);

    // Assert: a は出ないが、姿勢はずらしてあるので rz は出る（「何も出ない」ではない）
    expect(toParams(fragment).get('a')).toBeNull();
    expect(toParams(fragment).get('rz')).toBe('-47.5');
    expect(Math.abs(decodeUrl(fragment).app.sourceAngleDeg - landed)).toBeLessThan(1e-5);
  });

  it('末尾の 0 は落とし、桁は入力の粒度に合わせる', () => {
    // Arrange: スライダーの刻みより細かく載せても意味が無い
    const state: ShareableState = {
      ...DEFAULT_SHAREABLE_STATE,
      app: { ...DEFAULT_SHAREABLE_STATE.app, sourceAngleDeg: 30, screenDistance: 12.5 },
      prismRotationDeg: -47.5,
      prismX: 1.25,
    };

    // Act
    const params = toParams(encodeUrl(state));

    // Assert
    expect(params.get('a')).toBe('30');
    expect(params.get('sd')).toBe('12.5');
    expect(params.get('rz')).toBe('-47.5');
    expect(params.get('px')).toBe('1.25');
  });
});

describe('6-6 段階1 G: アンカーの不在', () => {
  it('sa が無ければ null になる（既定値ではなく「指定なし」）', () => {
    // Arrange: アンカーは起動時に光路から導出される値なので、定数の既定を持たない。
    // 復元側は null を「起動時に導出したものをそのまま使う」と読む
    // Act & Assert
    expect(decodeUrl('v=1&mat=sf10').screenAnchor).toBeNull();
    expect(decodeUrl('v=1&sa=abc').screenAnchor).toBeNull();
    expect(decodeUrl('v=1&sa=1,2').screenAnchor).toBeNull();
    expect(encodeUrl(DEFAULT_SHAREABLE_STATE)).not.toContain('sa=');
  });
});

// ---------------------------------------------------------------------------
// 4-3 H: スペクトル表示モード
// ---------------------------------------------------------------------------

/**
 * URL 上のモードコード。**`SPECTRUM_MODE_CODES` を import しない。**
 * SUT の表をそのまま期待値にすると、表を書き換えたときにテストも一緒に動いてしまい、
 * 「共有 URL の意味が変わらない」という肝心の性質を守れなくなる。
 */
const CODE = { continuous: 'cont', sevenColor: '7' } as const;

/**
 * 指定したモードを持つ往復用の状態を作る。
 *
 * @param mode 入れるモード
 * @returns 符号化に渡す状態
 */
function stateWithMode(mode: SpectrumMode): ShareableState {
  return { ...SAMPLE, app: { ...SAMPLE.app, spectrumMode: mode } };
}

describe('4-3 H: スペクトル表示モードの往復', () => {
  it('連続モードが往復で保たれる', () => {
    // Arrange
    const state = stateWithMode('continuous');

    // Act
    const restored = decodeUrl('#' + encodeUrl(state));

    // Assert
    expect(restored.app.spectrumMode).toBe('continuous');
  });

  it('7 色モードが往復で保たれる', () => {
    // Arrange
    const state = stateWithMode('sevenColor');

    // Act
    const restored = decodeUrl('#' + encodeUrl(state));

    // Assert
    expect(restored.app.spectrumMode).toBe('sevenColor');
  });

  it('spec を常に出す（既定のモードでも省略しない）', () => {
    // Arrange: 他の項目と違い、これは既定と一致しても省かない。既定を将来変えたときに
    //          過去の共有 URL が別のモードで描かれてしまうため（6-6 段階4 の sa と同じ忠実性）
    const continuous = stateWithMode('continuous');
    const sevenColor = stateWithMode('sevenColor');

    // Act
    const continuousFragment = encodeUrl(continuous);
    const sevenColorFragment = encodeUrl(sevenColor);

    // Assert
    expect(continuousFragment).toContain('spec=' + CODE.continuous);
    expect(sevenColorFragment).toContain('spec=' + CODE.sevenColor);
  });

  it('spec が無い断片は連続モードになる', () => {
    // Arrange: 4-3 より前に作られた共有 URL はこの形。48 連続で作られた絵が
    //          そのまま 48 連続で描かれなければならない

    // Act
    const restored = decodeUrl('#v=1&a=31.5&mat=sf10');

    // Assert
    expect(restored.app.spectrumMode).toBe('continuous');
  });

  it('未知のモードコードは連続モードになる', () => {
    // Arrange: 寛容デコード。未知材質が BK7 になるのと同じ扱いで、投げない

    // Act
    const restored = decodeUrl('#v=1&spec=rainbow');

    // Assert
    expect(restored.app.spectrumMode).toBe('continuous');
  });
});

// ---------------------------------------------------------------------------
// 4-7 段階1→2: 表示専用トグル（glow / nums）の URL 純粋層。
//
// 段階1では `ShareableState` にまだ無い 2 フィールドを、`unknown` キャスト経由の
// 局所拡張型（`withFuture`/`futureOf`）で疑似的に読み書きし、10 件中 9 件が
// 個別に Red で落ちることを確認した（1 件＝既定省略のテストだけは、何も実装して
// いなくても「何も出ない」が真になるため Red にならないと明記して報告済み）。
// 段階2で `glowEnabled`/`numbersVisible` を本体へ正式追加したので、ここからは
// 局所拡張を使わず、`SAMPLE`/`DEFAULT_SHAREABLE_STATE` の実フィールドを直接読む。
// ---------------------------------------------------------------------------

describe('4-7 段階1 A: 往復（両方 false）', () => {
  it('glow=0 & nums=0 が往復で保たれる', () => {
    // Arrange: 既定（両方 true）から両方だけ false に落とす
    const state: ShareableState = {
      ...DEFAULT_SHAREABLE_STATE,
      glowEnabled: false,
      numbersVisible: false,
    };

    // Act
    const restored = decodeUrl(encodeUrl(state));

    // Assert: 期待値は SUT から作らず独立にハードコード
    expect(restored.glowEnabled).toBe(false);
    expect(restored.numbersVisible).toBe(false);
  });
});

describe('4-7 段階1 B: 既定の省略', () => {
  it('既定（両方 true）のとき glow/nums キーが出力に現れない', () => {
    // Arrange: 既定そのもの（sec と同じ非対称。既定と同じなら省く。spec とは異なる）
    // Act
    const params = toParams(encodeUrl(DEFAULT_SHAREABLE_STATE));

    // Assert
    expect(params.get('glow')).toBeNull();
    expect(params.get('nums')).toBeNull();
  });
});

describe('4-7 段階1 C: decode の既定・寛容性（readBoolean と同じ規則）', () => {
  it('キー欠損は既定の true になる', () => {
    // Arrange & Act
    const restored = decodeUrl('v=1&mat=sf10');

    // Assert
    expect(restored.glowEnabled).toBe(true);
    expect(restored.numbersVisible).toBe(true);
  });

  it("'0' は false になる", () => {
    // Arrange & Act
    const restored = decodeUrl('v=1&glow=0&nums=0');

    // Assert
    expect(restored.glowEnabled).toBe(false);
    expect(restored.numbersVisible).toBe(false);
  });

  it("'1' は true になる", () => {
    // Arrange & Act
    const restored = decodeUrl('v=1&glow=1&nums=1');

    // Assert
    expect(restored.glowEnabled).toBe(true);
    expect(restored.numbersVisible).toBe(true);
  });

  it('未知コードは既定の true になる', () => {
    // Arrange & Act: readBoolean は '1'/'0' 以外をすべて既定へ落とす
    const restored = decodeUrl('v=1&glow=maybe&nums=xyz');

    // Assert
    expect(restored.glowEnabled).toBe(true);
    expect(restored.numbersVisible).toBe(true);
  });
});

describe('4-7 段階1 D: glow と nums の独立性', () => {
  it('glow だけ false にしても、nums は巻き込まれない', () => {
    // Arrange
    const glowOnly: ShareableState = { ...DEFAULT_SHAREABLE_STATE, glowEnabled: false };

    // Act
    const restored = decodeUrl(encodeUrl(glowOnly));

    // Assert
    expect(restored.glowEnabled).toBe(false);
    expect(restored.numbersVisible).toBe(true);
  });

  it('nums だけ false にしても、glow は巻き込まれない', () => {
    // Arrange
    const numsOnly: ShareableState = { ...DEFAULT_SHAREABLE_STATE, numbersVisible: false };

    // Act
    const restored = decodeUrl(encodeUrl(numsOnly));

    // Assert
    expect(restored.glowEnabled).toBe(true);
    expect(restored.numbersVisible).toBe(false);
  });
});

describe('4-7 段階1 E: sec との同時デコード（★既存 sec の回帰も兼ねる）', () => {
  it('sec=0&glow=0&nums=0 が同じ断片から同時に読める', () => {
    // Arrange & Act: 生の断片を直接デコードする。sec の既定は false なので
    // encodeUrl 経由では sec=0 を再現できない（既定と同じなら省く規則で消える）。
    // decode 側が glow/nums を新しく足しても sec の読み取りを壊さないかを見る
    const restored = decodeUrl('v=1&sec=0&glow=0&nums=0');

    // Assert
    expect(restored.sectionVisible).toBe(false);
    expect(restored.glowEnabled).toBe(false);
    expect(restored.numbersVisible).toBe(false);
  });

  it('sec=1&glow=0&nums=1 のように混在しても個別に読める', () => {
    // Arrange & Act: 3 つが同じ値である必要はない。混在時の独立性を見る
    const restored = decodeUrl('v=1&sec=1&glow=0&nums=1');

    // Assert
    expect(restored.sectionVisible).toBe(true);
    expect(restored.glowEnabled).toBe(false);
    expect(restored.numbersVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// カメラ共有 段階1→2: `ShareableState.cameraPosition`/`cameraTarget` の URL 純粋層。
//
// 段階1では局所拡張型（`withFutureCamera`/`futureOf`）で疑似的に読み書きし、
// 6 件中 5 件が個別に Red で落ちることを確認した（1 件＝既定省略のテストだけは、
// 何も実装していなくても「cam キーが無い」が真になるため Red にならないと明記して
// 報告済み。4-7 段階1 の glow/nums と同じ構造的な非空虚の例外）。
// 段階2で `cameraPosition`/`cameraTarget` を本体へ正式追加したので、ここからは
// 局所拡張を使わず、`SAMPLE`/`DEFAULT_SHAREABLE_STATE` の実フィールドを直接読む。
//
// 住処は glow/nums と同型（裁定①）：表示専用・独立フィールド・AppState に入れない。
// エンコードは sa 流の手動カンマ結合（裁定②）：cam = px,py,pz,tx,ty,tz を 1 キーに、
// 6 桁、全 6 成分が既定と一致するときだけ cam ごと省く「複合 omit-when-default」。
// ---------------------------------------------------------------------------

describe('カメラ共有 段階2 A: 往復', () => {
  it('非既定の視点が往復で保たれる（position + target、6 桁）', () => {
    // Arrange: 期待値は既定とも SUT 出力とも独立にハードコード
    const state: ShareableState = {
      ...SAMPLE,
      cameraPosition: { x: 3.123456, y: -2.654321, z: 8.111111 },
      cameraTarget: { x: 0.5, y: -0.25, z: 0.75 },
    };

    // Act
    const restored = decodeUrl(encodeUrl(state));

    // Assert
    expect(restored.cameraPosition.x).toBeCloseTo(3.123456, 6);
    expect(restored.cameraPosition.y).toBeCloseTo(-2.654321, 6);
    expect(restored.cameraPosition.z).toBeCloseTo(8.111111, 6);
    expect(restored.cameraTarget.x).toBeCloseTo(0.5, 6);
    expect(restored.cameraTarget.y).toBeCloseTo(-0.25, 6);
    expect(restored.cameraTarget.z).toBeCloseTo(0.75, 6);
  });
});

describe('カメラ共有 段階2 B: 既定の省略（複合キー）', () => {
  it('既定視点のとき cam キーが出力に現れない', () => {
    // Arrange: position/target とも既定のまま（DEFAULT_SHAREABLE_STATE そのもの）
    // Act
    const params = toParams(encodeUrl(DEFAULT_SHAREABLE_STATE));

    // Assert
    expect(params.get('cam')).toBeNull();
  });

  it('1 成分でも既定と違えば cam が 6 値まとめて掲載される（複合 omit-when-default の裏）', () => {
    // Arrange: target は既定のまま、position.z だけ既定 6.5 → 9 にずらす
    const state: ShareableState = {
      ...DEFAULT_SHAREABLE_STATE,
      cameraPosition: { x: 0, y: 0, z: 9 },
    };

    // Act
    const params = toParams(encodeUrl(state));

    // Assert: 変わっていない 5 成分も含めて 6 値まとめて出る（間引かない）
    expect(params.get('cam')).toBe('0,0,9,0,0,0');
  });
});

describe('カメラ共有 段階2 C: decode の既定・寛容性', () => {
  it('cam キー欠損は既定視点になる', () => {
    // Arrange & Act
    const restored = decodeUrl('v=1&mat=sf10');

    // Assert
    expect(restored.cameraPosition).toEqual(DEFAULT_SHAREABLE_STATE.cameraPosition);
    expect(restored.cameraTarget).toEqual(DEFAULT_SHAREABLE_STATE.cameraTarget);
  });

  it('壊れた cam（6 個でない・NaN 混入・空）は既定視点になる（投げない）', () => {
    // Arrange: 6-6 の decodeUrl と同じ寛容規則をカメラにも適用する
    const brokenCams = [
      'v=1&cam=1,2,3',
      'v=1&cam=1,2,3,4,5',
      'v=1&cam=1,2,3,4,5,6,7',
      'v=1&cam=a,b,c,d,e,f',
      'v=1&cam=1,2,NaN,4,5,6',
      'v=1&cam=',
    ];

    // Act & Assert
    for (const fragment of brokenCams) {
      expect(() => decodeUrl(fragment), `断片 ${JSON.stringify(fragment)}`).not.toThrow();

      const restored = decodeUrl(fragment);

      expect(restored.cameraPosition, fragment).toEqual(DEFAULT_SHAREABLE_STATE.cameraPosition);
      expect(restored.cameraTarget, fragment).toEqual(DEFAULT_SHAREABLE_STATE.cameraTarget);
    }
  });
});

describe('カメラ共有 段階2 D: 他キーとの独立性', () => {
  it('cam・sa・sec が同じ断片から同時に個別に読める', () => {
    // Arrange & Act: 生の断片を直接デコードする
    const restored = decodeUrl('v=1&sec=1&sa=1.5,-2.5,30&cam=1,2,3,4,5,6');

    // Assert
    expect(restored.sectionVisible).toBe(true);
    expect(restored.screenAnchor).toEqual({ x: 1.5, y: -2.5, directionDeg: 30 });
    expect(restored.cameraPosition).toEqual({ x: 1, y: 2, z: 3 });
    expect(restored.cameraTarget).toEqual({ x: 4, y: 5, z: 6 });
  });

  it('cam を足しても sa・sec の既存往復は影響を受けない（回帰）', () => {
    // Arrange: SAMPLE は screenAnchor も sectionVisible も既定と異なる
    const state: ShareableState = {
      ...SAMPLE,
      cameraPosition: { x: 9, y: 8, z: 7 },
      cameraTarget: { x: 6, y: 5, z: 4 },
    };

    // Act
    const restored = decodeUrl(encodeUrl(state));

    // Assert: 期待値は SAMPLE 自身の値（SUT 出力から作らない）
    expect(restored.screenAnchor?.x).toBeCloseTo(SAMPLE.screenAnchor!.x, 3);
    expect(restored.screenAnchor?.y).toBeCloseTo(SAMPLE.screenAnchor!.y, 3);
    expect(restored.sectionVisible).toBe(SAMPLE.sectionVisible);
  });
});

describe('カメラ共有 段階2 E: 桁', () => {
  it('cam は 6 桁に丸められ、末尾の 0 は落ちる', () => {
    // Arrange: position.x は 7 桁目で丸めが要る値、y/z は既定のまま
    const state: ShareableState = {
      ...DEFAULT_SHAREABLE_STATE,
      cameraPosition: { x: 1.1234567, y: 0, z: 6.5 },
    };

    // Act
    const params = toParams(encodeUrl(state));

    // Assert: 1.1234567 → 1.123457（6 桁丸め）。target 側は既定のまま 0,0,0
    expect(params.get('cam')).toBe('1.123457,0,6.5,0,0,0');
  });
});

/**
 * 4-5 段階1: ビーム幅（`beamWidthPx`）の URL 往復。
 *
 * **段階1時点では未配線。** `ShareableState.beamWidthPx` と `DEFAULT_BEAM_WIDTH_PX`（=3.5）
 * だけを先に用意し、`encodeUrl`/`decodeUrl` はまだ `bw` キーに一切触れない
 * （4-5 偵察で確定：ビーム幅は `traceSpectrum` の入力にならない表示専用値なので
 * `glowEnabled`/`numbersVisible` と同じ独立フィールドとして置く。桁は 1 桁——
 * 世界の幾何（座標）には効かない px 表示スカラーであり、0.1px 未満はどの画面密度でも
 * 知覚できず、UI 側のスライダー刻みが 0.5 px を想定する前提なら 1 桁で完全にロスレス。
 * 6 桁組・exaggeration の 0 桁のどちらとも異なる、初めての「連続値かつ表示専用」の桁）。
 *
 * A・D は「既定を動かさない」側の挙動で、未配線のままでも成立してしまう
 * （何もしなければ既定のまま、が結果的に正解と一致する）。**B・C・E は実際に
 * 非既定の値を運ぶ経路が要るため、段階1時点では確実に Red になる。**
 */
describe('4-5 段階1 A: 既定の省略', () => {
  it('既定値（3.5px）のとき bw キーが出力に現れない', () => {
    // Arrange: 既定そのもの
    // Act
    const params = toParams(encodeUrl(DEFAULT_SHAREABLE_STATE));

    // Assert
    expect(params.get('bw')).toBeNull();
  });
});

describe('4-5 段階1 B: 非既定値の emit', () => {
  it('非既定値（5.0px, 2.0px）が bw として小数 1 桁で載る', () => {
    // Arrange & Act & Assert: 末尾の 0 は落ちる（他の数値キーと同じ規約）
    for (const [beamWidthPx, expected] of [
      [5.0, '5'],
      [2.0, '2'],
    ] as const) {
      const state: ShareableState = { ...DEFAULT_SHAREABLE_STATE, beamWidthPx };
      const params = toParams(encodeUrl(state));

      expect(params.get('bw'), `beamWidthPx=${beamWidthPx}`).toBe(expected);
    }
  });
});

describe('4-5 段階1 C: decode の復元', () => {
  it('bw キーありの URL から beamWidthPx が復元される', () => {
    // Arrange & Act
    const restored = decodeUrl('v=1&bw=5.0');

    // Assert
    expect(restored.beamWidthPx).toBe(5.0);
  });
});

describe('4-5 段階1 D: decode の寛容性', () => {
  it('bw キー欠損は既定の 3.5 になる', () => {
    // Arrange & Act
    const restored = decodeUrl('v=1&mat=sf10');

    // Assert
    expect(restored.beamWidthPx).toBe(DEFAULT_BEAM_WIDTH_PX);
  });

  it('bw が不正値（数として読めない）でも既定の 3.5 になる（投げない）', () => {
    // Arrange & Act
    const restored = decodeUrl('v=1&bw=not-a-number');

    // Assert
    expect(restored.beamWidthPx).toBe(DEFAULT_BEAM_WIDTH_PX);
  });
});

describe('4-5 段階1 E: ラウンドトリップ', () => {
  it('0.5 刻みの代表値が encode→decode で完全一致する', () => {
    // Arrange & Act & Assert: いずれも既定（3.5）とは異なる値
    for (const beamWidthPx of [1.5, 2.0, 4.5, 6.0, 10.0]) {
      const state: ShareableState = { ...DEFAULT_SHAREABLE_STATE, beamWidthPx };
      const restored = decodeUrl(encodeUrl(state));

      expect(restored.beamWidthPx, `beamWidthPx=${beamWidthPx}`).toBe(beamWidthPx);
    }
  });
});

describe('4-5 段階1 F: 桁', () => {
  it('小数 2 桁以上の値は 1 桁に丸められる', () => {
    // Arrange: DECIMALS.beamWidthPx = 1（このファイル冒頭の桁の取り決めを参照）
    const state: ShareableState = { ...DEFAULT_SHAREABLE_STATE, beamWidthPx: 4.73 };

    // Act
    const params = toParams(encodeUrl(state));

    // Assert: 4.73 → 4.7（1 桁丸め）
    expect(params.get('bw')).toBe('4.7');
  });
});
