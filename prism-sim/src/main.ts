// ツールチェーン疎通確認用の仮エントリポイント。
// three の解決・@types/three の型付け・バンドルが通ることだけを確認する。
// Phase 2 以降で本実装に置き換える。
import { REVISION } from 'three';

import { addForToolchainCheck } from './optics/dummy';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = `three r${REVISION} / 1+1=${addForToolchainCheck(1, 1)}`;
}
