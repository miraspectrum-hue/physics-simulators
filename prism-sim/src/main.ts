// 仮エントリポイント。Phase 2（3D 描画）で本実装に置き換える。
// 現状は three が解決できることだけを示す。
import { REVISION } from 'three';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = `three r${REVISION}`;
}
