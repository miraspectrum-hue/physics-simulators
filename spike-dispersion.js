/*
 * =============================================================================
 * SPIKE: プリズム分散の数値検証（使い捨てコード / 本実装では破棄する）
 * =============================================================================
 *
 * 検証したい唯一の問い:
 *   白色光を頂角60°の正三角形プリズムに入射させたとき、波長ごとの屈折角の差
 *   （＝虹の分離）が物理的に妥当な値で計算できるか。
 *
 * 実行: node spike-dispersion.js
 *
 * -----------------------------------------------------------------------------
 * 【モデルと前提】
 * -----------------------------------------------------------------------------
 * 光路は「プリズムの主断面内に完全に含まれる」と仮定する（2Dスカラー計算）。
 * この仮定により、3Dベクトル演算なしで以下の4式だけで解ける:
 *
 *   (1) 第一面での屈折:  sinθ₁ = n · sin r₁      →  r₁ = asin(sinθ₁ / n)
 *   (2) 内部の幾何拘束:  r₁ + r₂ = A             →  r₂ = A - r₁
 *   (3) 第二面での屈折:  n · sin r₂ = sinθ₂      →  θ₂ = asin(n · sin r₂)
 *   (4) 全偏角:          δ = θ₁ + θ₂ - A
 *
 *   A  : 頂角 = 60°（正三角形）
 *   θ₁ : 第一面への入射角（面法線からの角）
 *   r₁ : 第一面での屈折角（ガラス内部）
 *   r₂ : 第二面への入射角（ガラス内部）
 *   θ₂ : 第二面からの射出角
 *   δ  : 入射光線と射出光線のなす角（偏角）
 *
 * (2) は「三角形の内角の和」から導かれる純幾何の関係。両面の法線がなす角が
 * (180° - A) であることによる。
 *
 * 【この近似で捨てているもの】
 *   - 光線の太さ（無限に細い光線として扱う）
 *   - フレネル反射（各界面での部分反射。強度のみに効き、角度には効かない）
 *   - ガラスの吸収・散乱
 *   - 主断面から外れた斜め入射（3D的な入射）
 *   - 端面（三角柱の前後の面）への入射
 * 角度の議論に限れば、上記はいずれも結果に影響しない。
 *
 * -----------------------------------------------------------------------------
 * 【屈折率の分散モデル】
 * -----------------------------------------------------------------------------
 * コーシーの分散式:  n(λ) = A_c + B_c / λ²   （λ の単位は µm）
 *
 * 材質: BK7（ホウケイ酸クラウンガラス）
 *   A_c = 1.5047 [無次元]
 *   B_c = 0.004200 [µm²]
 *
 * 出典と決定手順:
 *   B_c は一般に流通しているクラウンガラスの値 0.00420 µm²（Wikipedia
 *   "Cauchy's equation" の Borosilicate crown glass BK7 の項）をそのまま採用。
 *   A_c は「n(589.3nm) が SCHOTT のカタログ値 n_d = 1.5168 に一致する」よう
 *   逆算した:  A_c = n_d - B_c / λ_d²  = 1.5168 - 0.00420/0.5893² = 1.50470
 *   （流通値 1.5046 とほぼ一致するため、この係数組は自己整合している）
 *
 * ※注意: 同じ出典表の SF10（重フリント）の係数 A=1.7280, B=0.01342 をそのまま
 *   使うと n(589.3nm)=1.7666 となり、カタログ値 1.72828 と 0.04 ずれる。
 *   本 Spike では BK7 のみを扱うが、本実装で材質を増やす際は必ず
 *   「n_d 一致」と「アッベ数一致」の2条件で検算すること。
 *
 * 有効範囲: コーシー式は可視域の正常分散領域でのみ妥当。吸収帯に近い
 *   紫外・赤外へ外挿してはいけない。本 Spike は 400-700nm に限定。
 * =============================================================================
 */

'use strict';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** プリズムの頂角 [deg]。正三角形なので 60。 */
const APEX_DEG = 60;

/** BK7 のコーシー係数（上のコメント参照） */
const CAUCHY_A = 1.5047;
const CAUCHY_B = 0.004200; // [µm²]

/** 検証対象の波長 [nm] */
const WAVELENGTHS_NM = [400, 450, 500, 550, 600, 650, 700];

/** 主要スペクトル線 [nm]（検算用） */
const LINE_F_NM = 486.13; // 水素 F 線（青）
const LINE_D_NM = 589.3; // ナトリウム d 線（黄）
const LINE_C_NM = 656.27; // 水素 C 線（赤）

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** 表示用に固定小数で右詰めする */
const pad = (v, width, digits = 3) =>
  (typeof v === 'number' ? v.toFixed(digits) : String(v)).padStart(width);

// ---------------------------------------------------------------------------
// 物理: 屈折率
// ---------------------------------------------------------------------------

/**
 * コーシーの分散式で屈折率を求める。
 * @param {number} wavelengthNm 波長 [nm]
 * @returns {number} 屈折率（無次元）
 */
function refractiveIndex(wavelengthNm) {
  const um = wavelengthNm / 1000; // nm -> µm
  return CAUCHY_A + CAUCHY_B / (um * um);
}

/**
 * 全反射の臨界角。ガラス→空気の界面で、これを超える内部入射角は射出しない。
 * @param {number} n 屈折率
 * @returns {number} 臨界角 [deg]
 */
function criticalAngleDeg(n) {
  return toDeg(Math.asin(1 / n));
}

// ---------------------------------------------------------------------------
// 物理: 光路計算
// ---------------------------------------------------------------------------

/**
 * 頂角 A のプリズムを通る光路を計算する。
 *
 * @param {number} incidentDeg 第一面への入射角 θ₁ [deg]（法線基準、符号つき）
 * @param {number} n           屈折率
 * @param {number} apexDeg     頂角 A [deg]
 * @returns {{
 *   ok: boolean,          射出したか
 *   reason: string|null,  射出しなかった理由
 *   r1Deg: number,        第一面での屈折角
 *   r2Deg: number,        第二面への内部入射角
 *   exitDeg: number|null, 射出角 θ₂
 *   deviationDeg: number|null, 偏角 δ
 *   tir: boolean          第二面で全反射したか
 * }}
 */
function tracePrism(incidentDeg, n, apexDeg = APEX_DEG) {
  const theta1 = toRad(incidentDeg);
  const apex = toRad(apexDeg);

  // (1) 第一面での屈折。空気(n=1)→ガラス(n) なので必ず解が存在する
  //     （sinθ₁/n は |sinθ₁| ≤ 1 かつ n > 1 より必ず 1 未満）
  const sinR1 = Math.sin(theta1) / n;
  const r1 = Math.asin(sinR1);

  // (2) 内部の幾何拘束
  const r2 = apex - r1;

  // (3) 第二面での屈折。ガラス→空気なので全反射しうる
  const sinExit = n * Math.sin(r2);

  if (Math.abs(sinExit) > 1) {
    // |n·sin r₂| > 1 → スネルの法則に実数解なし → 全反射
    return {
      ok: false,
      reason: 'TIR',
      r1Deg: toDeg(r1),
      r2Deg: toDeg(r2),
      exitDeg: null,
      deviationDeg: null,
      tir: true,
    };
  }

  const theta2 = Math.asin(sinExit);
  // (4) 偏角
  const deviation = theta1 + theta2 - apex;

  return {
    ok: true,
    reason: null,
    r1Deg: toDeg(r1),
    r2Deg: toDeg(r2),
    exitDeg: toDeg(theta2),
    deviationDeg: toDeg(deviation),
    tir: false,
  };
}

// ---------------------------------------------------------------------------
// 検証 1: 屈折率そのものの妥当性
// ---------------------------------------------------------------------------

function verifyDispersion() {
  console.log('='.repeat(78));
  console.log('検証 1: コーシー式による屈折率と、既知値との突き合わせ');
  console.log('='.repeat(78));
  console.log(`  n(λ) = ${CAUCHY_A} + ${CAUCHY_B}/λ²   (λ [µm], BK7)`);
  console.log('');
  console.log('  λ[nm]      n(λ)    臨界角θc[deg]');
  console.log('  ' + '-'.repeat(34));
  for (const nm of WAVELENGTHS_NM) {
    const n = refractiveIndex(nm);
    console.log(`  ${pad(nm, 5, 0)}   ${pad(n, 8, 5)}   ${pad(criticalAngleDeg(n), 10, 2)}`);
  }

  const nd = refractiveIndex(LINE_D_NM);
  const nF = refractiveIndex(LINE_F_NM);
  const nC = refractiveIndex(LINE_C_NM);
  const abbe = (nd - 1) / (nF - nC);

  console.log('');
  console.log('  [検算] カタログ値との比較');
  console.log(`    n_d (589.3nm) = ${nd.toFixed(5)}   カタログ値 1.51680  差 ${(nd - 1.5168).toFixed(5)}`);
  console.log(`    アッベ数 v_d  = ${abbe.toFixed(2)}     カタログ値 64.17    差 ${(abbe - 64.17).toFixed(2)}`);
  console.log('');
  return { nd, abbe };
}

// ---------------------------------------------------------------------------
// 検証 2: 7波長の射出角（本 Spike の主目的）
// ---------------------------------------------------------------------------

function verifySpectrum(incidentDeg) {
  console.log('='.repeat(78));
  console.log(`検証 2: 7波長の光路　（頂角 A=${APEX_DEG}°, 入射角 θ₁=${incidentDeg}°）`);
  console.log('='.repeat(78));
  console.log('  λ[nm]      n(λ)    r₁[deg]  r₂[deg]  θ₂射出[deg]  δ偏角[deg]  状態');
  console.log('  ' + '-'.repeat(72));

  const results = [];
  for (const nm of WAVELENGTHS_NM) {
    const n = refractiveIndex(nm);
    const t = tracePrism(incidentDeg, n);
    results.push({ nm, n, ...t });

    const exitStr = t.ok ? pad(t.exitDeg, 11, 3) : pad('-', 11);
    const devStr = t.ok ? pad(t.deviationDeg, 11, 3) : pad('-', 11);
    const state = t.ok ? '射出' : '★全反射';
    console.log(
      `  ${pad(nm, 5, 0)}   ${pad(n, 8, 5)}  ${pad(t.r1Deg, 7, 3)}  ${pad(t.r2Deg, 7, 3)}` +
        `  ${exitStr}  ${devStr}   ${state}`
    );
  }

  const transmitted = results.filter((r) => r.ok);
  if (transmitted.length >= 2) {
    const violet = transmitted[0]; // 400nm 側
    const red = transmitted[transmitted.length - 1]; // 700nm 側
    const spreadDeg = violet.deviationDeg - red.deviationDeg;

    console.log('');
    console.log('  [分離量]');
    console.log(`    δ(${violet.nm}nm 紫) = ${violet.deviationDeg.toFixed(3)}°`);
    console.log(`    δ(${red.nm}nm 赤) = ${red.deviationDeg.toFixed(3)}°`);
    console.log(`    角度分散 Δδ       = ${spreadDeg.toFixed(3)}°  （紫 - 赤）`);
    console.log(`    1m 先での虹の幅   = ${(1000 * Math.tan(toRad(Math.abs(spreadDeg)))).toFixed(1)} mm`);
  }
  console.log('');
  return results;
}

// ---------------------------------------------------------------------------
// 検証 3: 最小偏角（解析解との突き合わせ）
// ---------------------------------------------------------------------------

/**
 * 入射角を走査して偏角 δ の最小値を数値的に求める。
 * δ(θ₁) は下に凸な単峰関数なので単純走査＋二分細分で十分。
 */
function findMinDeviation(n, apexDeg = APEX_DEG) {
  let best = { incidentDeg: null, deviationDeg: Infinity };
  // 粗い走査 → 細かい走査、の2段階
  for (const step of [0.1, 0.001]) {
    const lo = best.incidentDeg === null ? 0 : best.incidentDeg - 0.2;
    const hi = best.incidentDeg === null ? 89 : best.incidentDeg + 0.2;
    for (let a = lo; a <= hi; a += step) {
      const t = tracePrism(a, n, apexDeg);
      if (t.ok && t.deviationDeg < best.deviationDeg) {
        best = { incidentDeg: a, deviationDeg: t.deviationDeg };
      }
    }
  }
  return best;
}

function verifyMinDeviation() {
  console.log('='.repeat(78));
  console.log('検証 3: 最小偏角　（数値解 vs 解析解）');
  console.log('='.repeat(78));
  console.log('  解析解:  n = sin((A + δmin)/2) / sin(A/2)');
  console.log('');
  console.log('  λ[nm]      n(λ)   θ₁@最小[deg]  δmin[deg]   逆算n      差');
  console.log('  ' + '-'.repeat(66));

  let maxErr = 0;
  for (const nm of WAVELENGTHS_NM) {
    const n = refractiveIndex(nm);
    const { incidentDeg, deviationDeg } = findMinDeviation(n);
    // 解析解から屈折率を逆算し、元の n と一致するか見る
    const backN =
      Math.sin(toRad((APEX_DEG + deviationDeg) / 2)) / Math.sin(toRad(APEX_DEG / 2));
    const err = Math.abs(backN - n);
    maxErr = Math.max(maxErr, err);
    console.log(
      `  ${pad(nm, 5, 0)}   ${pad(n, 8, 5)}  ${pad(incidentDeg, 12, 3)}  ${pad(deviationDeg, 9, 3)}` +
        `  ${pad(backN, 8, 5)}  ${pad(err, 9, 6)}`
    );
  }
  console.log('');
  console.log(`  最大誤差 = ${maxErr.toExponential(2)}`);
  console.log('');
  return maxErr;
}

// ---------------------------------------------------------------------------
// 検証 4: 全反射が起きる条件
// ---------------------------------------------------------------------------

function verifyTIR() {
  console.log('='.repeat(78));
  console.log('検証 4: 全反射の発生条件');
  console.log('='.repeat(78));

  const nd = refractiveIndex(LINE_D_NM);
  const thetaC = criticalAngleDeg(nd);

  console.log('  [理論]');
  console.log(`    臨界角 θc = asin(1/n) = ${thetaC.toFixed(2)}°   (n=${nd.toFixed(4)} @589.3nm)`);
  console.log(`    第二面で射出する条件:  r₂ = A - r₁ < θc`);
  console.log(`    → r₁ > A - θc = ${(APEX_DEG - thetaC).toFixed(2)}° が必要`);
  console.log(`    r₁ の上限は θ₁→90° のときの asin(1/n) = θc = ${thetaC.toFixed(2)}°`);
  console.log(`    → 透過可能な材質の条件:  A < 2·θc = ${(2 * thetaC).toFixed(2)}°`);
  console.log(
    `    → A=${APEX_DEG}° は ${APEX_DEG < 2 * thetaC ? '条件を満たす（透過しうる）' : '条件を満たさない（常に全反射）'}`
  );
  console.log('');

  // 入射角を走査して、透過→全反射の境界を探す
  console.log('  [数値走査] θ₁ を -89°→89° に振って射出可否を判定（λ=589.3nm）');
  const boundaries = [];
  let prevOk = null;
  for (let a = -89; a <= 89; a += 0.01) {
    const ok = tracePrism(a, nd).ok;
    if (prevOk !== null && ok !== prevOk) {
      boundaries.push({ angleDeg: a, becomes: ok ? '射出' : '全反射' });
    }
    prevOk = ok;
  }
  for (const b of boundaries) {
    console.log(`    θ₁ = ${b.angleDeg.toFixed(2)}° を境に → ${b.becomes}`);
  }
  console.log('');

  // 波長ごとに透過できる入射角の下限を出す（分散があるので波長で違う）
  console.log('  [波長依存] 全反射しなくなる入射角の下限 θ₁_min');
  console.log('    λ[nm]    n(λ)    θc[deg]   θ₁_min[deg]');
  console.log('    ' + '-'.repeat(42));
  for (const nm of WAVELENGTHS_NM) {
    const n = refractiveIndex(nm);
    let firstOk = null;
    for (let a = -89; a <= 89; a += 0.01) {
      if (tracePrism(a, n).ok) {
        firstOk = a;
        break;
      }
    }
    console.log(
      `    ${pad(nm, 5, 0)}  ${pad(n, 8, 5)}  ${pad(criticalAngleDeg(n), 8, 2)}` +
        `   ${firstOk === null ? pad('射出せず', 11) : pad(firstOk, 11, 2)}`
    );
  }
  console.log('');

  // 全反射が起きている具体例
  console.log('  [具体例] θ₁ = 10° （浅い入射 → 第二面で全反射するはず）');
  const ex = tracePrism(10, nd);
  console.log(`    r₁ = ${ex.r1Deg.toFixed(2)}°,  r₂ = ${ex.r2Deg.toFixed(2)}°,  θc = ${thetaC.toFixed(2)}°`);
  console.log(`    r₂ > θc か: ${ex.r2Deg > thetaC}  → ${ex.tir ? '全反射（射出しない）' : '射出する'}`);
  console.log('');

  return { thetaC, boundaries };
}

// ---------------------------------------------------------------------------
// 検証 5: 物理常識との一致（自己検証）
// ---------------------------------------------------------------------------

function selfCheck(spectrumResults, minDevMaxErr, dispersionInfo) {
  console.log('='.repeat(78));
  console.log('検証 5: 物理常識との一致（自己検証）');
  console.log('='.repeat(78));

  const checks = [];
  const transmitted = spectrumResults.filter((r) => r.ok);

  // 1. 短波長ほど屈折率が大きい（正常分散）
  let monotonic = true;
  for (let i = 1; i < WAVELENGTHS_NM.length; i++) {
    if (refractiveIndex(WAVELENGTHS_NM[i]) >= refractiveIndex(WAVELENGTHS_NM[i - 1])) {
      monotonic = false;
    }
  }
  checks.push({
    name: '正常分散: λ が長いほど n が小さい',
    pass: monotonic,
    detail: `n(400)=${refractiveIndex(400).toFixed(5)} > n(700)=${refractiveIndex(700).toFixed(5)}`,
  });

  // 2. 紫の方が大きく曲がる
  if (transmitted.length >= 2) {
    const v = transmitted[0];
    const r = transmitted[transmitted.length - 1];
    checks.push({
      name: '紫は赤より大きく曲がる（δ紫 > δ赤）',
      pass: v.deviationDeg > r.deviationDeg,
      detail: `δ(${v.nm})=${v.deviationDeg.toFixed(3)}° > δ(${r.nm})=${r.deviationDeg.toFixed(3)}°`,
    });

    // 3. 偏角が波長に対して単調
    let devMonotonic = true;
    for (let i = 1; i < transmitted.length; i++) {
      if (transmitted[i].deviationDeg >= transmitted[i - 1].deviationDeg) devMonotonic = false;
    }
    checks.push({
      name: '偏角が波長に対して単調減少（色の順序が入れ替わらない）',
      pass: devMonotonic,
      detail: '赤橙黄緑青藍紫の順序が保たれる',
    });

    // 4. 分離量のオーダー（プリズム分光器として現実的か）
    const spread = v.deviationDeg - r.deviationDeg;
    checks.push({
      name: '角度分散が現実的なオーダー（0.5°〜5°）',
      pass: spread > 0.5 && spread < 5,
      detail: `Δδ = ${spread.toFixed(3)}°`,
    });
  }

  // 5. 屈折率のカタログ一致
  checks.push({
    name: 'n_d がカタログ値と ±0.001 で一致',
    pass: Math.abs(dispersionInfo.nd - 1.5168) < 0.001,
    detail: `n_d = ${dispersionInfo.nd.toFixed(5)} (cat. 1.51680)`,
  });
  checks.push({
    name: 'アッベ数がカタログ値と ±1.0 で一致',
    pass: Math.abs(dispersionInfo.abbe - 64.17) < 1.0,
    detail: `v_d = ${dispersionInfo.abbe.toFixed(2)} (cat. 64.17)`,
  });

  // 6. 最小偏角の解析解と一致
  checks.push({
    name: '最小偏角の解析解と数値解が一致（誤差 < 1e-4）',
    pass: minDevMaxErr < 1e-4,
    detail: `最大誤差 = ${minDevMaxErr.toExponential(2)}`,
  });

  // 7. 垂直入射で第一面の偏向がゼロ
  const normal = tracePrism(0, refractiveIndex(LINE_D_NM));
  checks.push({
    name: '垂直入射（θ₁=0）で第一面の屈折角がゼロ',
    pass: Math.abs(normal.r1Deg) < 1e-9,
    detail: `r₁ = ${normal.r1Deg.toExponential(2)}°`,
  });

  // 8. 対称通過で最小偏角になる（r₁ = r₂ = A/2）
  const n = refractiveIndex(LINE_D_NM);
  const { incidentDeg } = findMinDeviation(n);
  const atMin = tracePrism(incidentDeg, n);
  checks.push({
    name: '最小偏角のとき光路が対称（r₁ ≈ r₂ ≈ A/2）',
    pass: Math.abs(atMin.r1Deg - atMin.r2Deg) < 0.01,
    detail: `r₁=${atMin.r1Deg.toFixed(3)}°, r₂=${atMin.r2Deg.toFixed(3)}° (A/2=${APEX_DEG / 2}°)`,
  });

  // 9. NaN / Infinity が出ない
  let clean = true;
  for (let a = -89; a <= 89; a += 0.5) {
    for (const nm of WAVELENGTHS_NM) {
      const t = tracePrism(a, refractiveIndex(nm));
      if (Number.isNaN(t.r1Deg) || Number.isNaN(t.r2Deg)) clean = false;
      if (t.ok && (!Number.isFinite(t.exitDeg) || !Number.isFinite(t.deviationDeg))) clean = false;
    }
  }
  checks.push({
    name: '入射角 -89〜89° の全域で NaN / Infinity が出ない',
    pass: clean,
    detail: '7波長 × 357 サンプルで検査',
  });

  let allPass = true;
  for (const c of checks) {
    if (!c.pass) allPass = false;
    console.log(`  [${c.pass ? ' OK ' : 'FAIL'}] ${c.name}`);
    console.log(`         ${c.detail}`);
  }
  console.log('');
  console.log(`  総合判定: ${allPass ? '全項目 PASS — 物理的に妥当' : '★ FAIL あり — 要調査'}`);
  console.log('');
  return allPass;
}

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------

function main() {
  console.log('');
  console.log('  SPIKE: プリズム分散の数値検証（使い捨て / 本実装では破棄）');
  console.log(`  材質 BK7 / 頂角 ${APEX_DEG}° / 主断面内の2Dスカラー計算`);
  console.log('');

  const dispersionInfo = verifyDispersion();

  // 主目的の表。最小偏角付近（θ₁≈49°）と、浅い入射・深い入射も見る
  const spectrum45 = verifySpectrum(45);
  verifySpectrum(49.3); // 最小偏角付近
  verifySpectrum(20); // 浅い入射 → 一部/全部が全反射するはず

  const minDevMaxErr = verifyMinDeviation();
  verifyTIR();
  selfCheck(spectrum45, minDevMaxErr, dispersionInfo);

  console.log('='.repeat(78));
  console.log('  Spike 完了');
  console.log('='.repeat(78));
  console.log('');
}

main();
