import { APEX_ANGLE_DEG, MATERIALS } from '../optics/constants';
import { minimumDeviation } from '../optics/prism';
import type { MaterialName, MinimumDeviation } from '../types/optics';

/**
 * 材質セレクトの選択値から光学量を引く写像（TASKS 6-2）。
 *
 * `src/optics/` は「頂角と屈折率」というスカラーだけを受け取る純粋層で、材質名も
 * セレクトの都合も知らない。その隙間を埋めるのがこのモジュールで、**材質名 → 屈折率 →
 * 最小偏角** の対応をアプリ全体で 1 か所に固定する。
 *
 * DOM にも Three にも触れないので Vitest の対象になる（CLAUDE.md「使用言語・フレームワーク」の
 * `src/ui/store.ts` と同じ立場）。`ControlPanel` から切り出してあるのは、
 * この写像がビューの都合ではなくアプリの決めごとだからである。
 */

/**
 * 材質の最小偏角を引く。**表示と適用が同じ値を使うための唯一の入口。**
 *
 * `ControlPanel` は目標値の表示に、`main` はスライダーへの適用に、これを呼ぶ。
 * 2 か所が別々に `minimumDeviation` を呼ぶと、いずれ引数の屈折率だけが食い違って
 * 「表示された δ_min にならない角へ飛ぶ」ことが起こりうる。入口を 1 つにして塞ぐ。
 *
 * 屈折率にカタログ値 `catalogNd` を使うのは、これが**分散誇張の軸**そのものだからである。
 * 誇張は n' = n_d + m(n(λ) − n_d) なので、d 線での n' は m に依らず n_d のまま。
 * 材質セレクトが表示している `n_d = 1.517` とも一致し、既定の入射角
 * `DEFAULT_SOURCE_ANGLE_DEG = 49.323347736` はこの n から出た値そのものである。
 *
 * 直接透過しない材質（ダイヤモンド）では例外ではなく null が返る。「解が無い」は
 * セレクトから普通に選べる状態であって、呼び出し規約の違反ではない。
 * null になる条件は `canTransmitThroughPrism` の否定と厳密に一致する（6-2 B でピン留め済み）。
 *
 * @param material 材質名
 * @returns 最小偏角の配置（θ₁_min と δ_min）。頂角 60° で直接透過しない材質なら null
 */
export function minimumDeviationOf(material: MaterialName): MinimumDeviation | null {
  return minimumDeviation(APEX_ANGLE_DEG, MATERIALS[material].catalogNd);
}

/**
 * 頂角 60° のプリズムで直接透過が起きない材質かどうか（TASKS 4-2b）。
 *
 * 材質名で決め打ちにせず `minimumDeviationOf` の結果から導く。こうしておけば、
 * 材質警告・ボタンの無効化・δ_min の「—」がすべて同じ 1 つの判定から出るので、
 * 「δ_min は出るのに警告も出る」という食い違いが原理的に作れない。
 *
 * @param material 材質名
 * @returns 直接透過しないなら true
 */
export function isNoDispersionMaterial(material: MaterialName): boolean {
  return minimumDeviationOf(material) === null;
}
