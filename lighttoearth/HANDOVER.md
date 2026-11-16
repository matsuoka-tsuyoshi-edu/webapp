# 引き継ぎドキュメント（HANDOVER.md）

本ドキュメントは、宇宙から見た太陽・地球・月の動きと光の当たり方シミュレーションWebアプリ **「ひかりと地球・月（v1.2）」**（iPad Safari 横向き対応）の保守・改修・環境移行を安全に行うための技術引き継ぎ書です。

---

## 1. プロジェクト概要

- **アプリ名**: ひかりと地球・月（`v1.2`／小学校高学年〜中学生の天体学習向け）
- **対象・利用環境**: 主に小学校高学年〜中学生が授業やタブレット学習で直感的に操作する用途（**iPad の Safari 横向き表示**を前提に設計）
- **技術構成**: ビルドツール・外部ライブラリ一切不要の純粋な静的フロントエンド（HTML5 / CSS3 / Vanilla JavaScript / Canvas 2D / SVG）
  - 外部CDN・Three.js・Node.js には一切依存していないため、オフライン環境や校内Webサーバーに配置するだけで即動作します。

---

## 2. 厳守事項・開発ルール

1. **フォルダ境界の厳守**
   - 本プロジェクトの作業対象は本ディレクトリ（`lighttoearth`）配下のみです。外部フォルダ・ファイルの読み込み、参照、改変は行わないでください。
2. **配布フォルダとの同期**
   - アプリ本体（`index.html`, `style.css`, `astro.js`, `app.js`）および `UPDATE_LOG.md` を更新した場合は、必ず `配布用_宇宙から見た太陽と地球と月/` 配下の本体ファイル・`アップデートログ/`（`UPDATE_LOG.md`, `UPDATE_LOG.txt`）・`マニュアル/` も最新状態に同期してください。
3. **ターゲット（小学校高学年〜中学生）への配慮・表現ルール**
   - 小学校5・6年〜中学生の理科に即したわかりやすい漢字表記（「太陽」「地球」「月」「太陽の光」「地平線の下」「天体を残す」「比べる」等）を維持してください。
   - 天体の「出」「入り」「一番高いとき」や方角表記には **「南中」という語を使わない** でください（「南（みなみ）」「一番高いとき」を使用）。
   - 月の拡大モーダル内の解説（`#modal-explanation`）は **初期状態では折りたたんで隠す**（児童・生徒の予想・発表の機会を守るため）。
4. **ベタ塗り（フラットシェーディング）の維持**
   - 地球や月の光の当たり方（昼と夜・満ち欠け）はグラデーションを使わず、**くっきりしたベタ塗り**で描画してください（教室後ろや大型提示装置での視認性最優先）。
5. **iPad Safari 横向き・マルチタッチ制御の維持**
   - Safari ブラウザ自体のページ拡大・ページスクロール・ダブルタップ拡大は無効のまま維持しつつ、宇宙キャンバス上（`#space-main-canvas`）では **2本指ドラッグ（地球を端までスクロール）** と **2本指ピンチイン・アウト（地球を中心に佐伯市観測点まで拡大・縮小）** の独自マルチタッチ操作が動作するように維持してください。
   - 縦向き（`height > width`）時は `#portrait-warning-overlay` で透過グレーアウトし、横向き使用を案内する仕様を維持してください。

---

## 3. ファイル構成

```text
lighttoearth/
├── index.html                                 # メインHTML（3D Canvas、左上地上カード、右上日時・地点ダイアログ、左下視点バー、下部バー、モーダル群）
├── style.css                                  # iPad Safari横向き対応スタイル、カードUI、縦向きグレーアウト案内
├── astro.js                                   # 天文計算＆宇宙3D座標エンジン（AstroCalc）
├── app.js                                     # 3D投影・ベタ塗り球体描画、ドラッグ回転/視点操作、ピン留め、比較、カレンダー
├── UPDATE_LOG.md                              # バージョン別アップデート履歴
├── HANDOVER.md                                # 本引き継ぎ資料
└── 配布用_宇宙から見た太陽と地球と月/          # 先生・児童配布用一式
    ├── index.html
    ├── style.css
    ├── astro.js
    ├── app.js
    ├── アップデートログ/
    │   ├── UPDATE_LOG.md
    │   └── UPDATE_LOG.txt
    └── マニュアル/
        ├── 操作マニュアル_Word貼り付け用.md
        ├── 授業スライド構成案_PowerPoint用.md
        └── 先生向けマニュアル_印刷・閲覧用.html
```

---

## 4. 各モジュールの設計と主要ロジック

### 4.1 天文計算・宇宙座標エンジン (`astro.js` / `AstroCalc`)

グローバルオブジェクト `window.AstroCalc` として公開しています。

- **`setObserver(lat, lon, name)` / `getObserver()`**:
  - 観測地点の設定・取得を行います（初期値は `大分県佐伯市`: 北緯 `32.96°`, 東経 `131.90°`）。
- **`getJulianDay(date)` / `getSunPosition(jd, lat, lon)` / `getMoonPosition(jd, lat, lon)`**:
  - 太陽・月の黄道座標（`lambda`, `beta`）、赤道座標（`alpha`, `delta`）、恒星時（`gmst`, `lmst`）、時角（`hourAngle`）、地平座標（`alt`, `rawAlt`, `az`）、離角（`elongation`）・月齢（`age`）・輝面比（`phaseFraction`）を算出します。
- **`getSpaceState(date, lat, lon)`**:
  - 宇宙3Dビュー用の状態を一括返却します。
  - `sunDirEcl`: 地球から太陽へ向かう黄道3D単位ベクトル（平行太陽光の基準）。
  - `moonDirEcl`: 地球中心から月へ向かう黄道3D単位ベクトル（白道傾斜約5.1°反映）。
  - `earthOrbitAngleDeg`: 太陽を中心とした地球の公転角度（`sunPos.lambda + 180°`）。
  - `earthSpinAngleDeg`: 太陽光方向に対する観測地点の自転角度（`sunPos.hourAngle`）。
  - `sunSpinAngleDeg`: 太陽の自転演出用角度（約25.38日周期）。
  - `observerTimeZoneLabel`: 観測地点の現在時間帯（`☀️ 昼` / `🌅 朝` / `🌇 夕方` / `🌙 夜` に加え、高緯度では `☀️ 白夜（夜でも太陽が出る）` / `🌙 極夜（昼でも夜のまま）`）。
- **`getMoonPhaseInfo(age, elongation)` / `getDailyEvents(...)` / `getDailyPath(...)`**:
  - 月相名・説明・1日の出入り時刻（5分刻み探索・白夜/極夜判定あり）・軌道サンプリングを返します。

### 4.2 カテゴリ別観測地点モーダル ＆ 海外・極地対応 (`index.html` / `app.js`)

- 右上カードの `📍` ボタン（`#btn-location-picker`）からカテゴリタブ切り替え式モーダル（`#location-modal`）を開きます。
- `LOCATIONS_DATA` で以下7カテゴリ＋自由入力フォームを管理しています：
  1. `elementary`（小学校）：佐伯市内小学校 全15校
  2. `junior_high`（中学校）：佐伯市内中学校 全11校（米水津中・鶴見中・宇目緑豊中・直川中・本匠中・東雲中・昭和中・彦陽中・鶴谷中・佐伯城南中・佐伯南中）＋蒲江翔南学園
  3. `saiki`（佐伯市）：佐伯市代表・市内9地区
  4. `oita`（大分県の市町村）：大分県全18市町村
  5. `kyushu`（九州）：九州・沖縄8県庁所在地
  6. `other`（その他）：日本主要21都市
  7. `overseas`（海外・極地）：ノルウェー（トロムソ・オスロ）・南極点・昭和基地・北極点・シンガポール・シドニー・ケアンズ・ハワイ・アラスカ・ロンドン・カイロ
- 南半球・極地設定時（`obs.lat < -20`）はカメラ仰角（`camera.pitch`）を自動で南側に見やすい角度へ傾け、`drawEarthSurfaceLayer` で南極氷冠と `南極(S)` マーカーを描画します。また地上カードでは `sky-dir-center` を「北」とし、`renderMoonSVG` を南半球の見え方に反転させます。

### 4.3 3D宇宙投影とベタ塗り球体描画 (`app.js`)

#### カメラ投影 (`rotateVecToCam`, `projectWorldPoint`)
- ワールド座標は黄道面を XY、黄道北極を +Z とする右手系です。
- `state.camera`（`yaw`, `pitch`, `panX`, `panY`, `zoom`, `scaleMode`）に従い、回転行列と弱透視投影（`focal = 1750`）でスクリーン座標 `(sx, sy)` と奥行き `camZ` を算出します。
- `scaleMode` は `'solar-system'`（太陽中心・地球が公転軌道上を回る全体表示）と `'earth-focus'`（地球と月を大きく映す拡大表示）をワンタップで切り替えられます。

#### グラデーションなしの3D球体ベタ塗り (`buildLitHemispherePath`, `drawFlatEarth`, `drawFlatMoon`)
- カメラ空間での太陽光ベクトル `lightCam = (lx, ly, lz)` から、2D面内角度 `alpha = atan2(-ly, lx)` と奥行き成分 `lz` を求め、外周半円＋ターミネーター楕円弧（短軸 `rx = |lz| * R`）で **光が当たる半面の閉パス** を構築しています。
- 地球（`drawFlatEarth`）では：
  1. 球体全体を影色（海 `#0f172a`、大陸 `#166534`）で描画。
  2. `buildLitHemispherePath` でクリッピングし、昼色（海 `#38bdf8`、大陸 `#4ade80`）で同じ3D大陸・緯線・経線を上描き。
- 大陸・極冠ポリゴンは `latLonToEclipticVec` と Sutherland-Hodgman 法（`clipSpherePolygonFront`）により球の前面半球（`z >= 0`）へ正確にクリップしているため、どの角度にカメラを回しても破綻しません。
- 観測地点（`📍佐伯`）も同じ `latLonToEclipticVec` で配置しているため、`sunAlt = 0°`（日の出・日の入り）の瞬間に佐伯マーカーが正確に昼夜の境界線上に位置します。

#### 天体ドラッグ回転 ＆ 背景視点操作 ＆ 2本指スクロール・地球中心ピンチ拡大 (`setupSpaceCanvasInteractions`)
- Pointer Events（`activePointers` Map + `setPointerCapture`）でマルチタッチおよびヒット判定を行い、1本指／2本指操作を振り分けます：
  - **2本指ドラッグ＆ピンチ（`activePointers.size >= 2`）**:
    - 2本指が触れた瞬間に `switchToEarthCenteredZoomMode()` により地球の画面位置を保ったまま地球中心座標系へシームレスに切り替え、2本指中点の移動で **画面の端まで自由に地球をスクロール（`clampPanBounds`）**、2本指間距離の比率で **地球を中心に `0.22x`〜`16.0x` まで拡大・縮小** します（PC環境では `wheel` イベントでも同様に地球中心ズームが可能）。
    - 高倍率（`earthScreenR >= 85px`）にズームインすると、佐伯市マーカーの周囲に接平面地平線ガイド（東・西）と「🌙 月の方向」矢印を描画します。
  - **1本指で月をドラッグ**: 地球中心の極座標角変化から朔望月（`29.5306日`）基準で日時を進め、月を公転させます（`⌚ 時刻固定` ON 時は時分を保ったまま日単位移動）。移動 `6px` 未満のタップで `#moon-modal` を開きます。
  - **1本指で地球をドラッグ**:
    - `'solar-system'` 時：太陽中心の角度変化で地球を公転軌道上に動かし、1回転＝1年（`365.2422日`）として **地球が自転しながら公転する様子** を直感的に操作できます（`⌚ 時刻固定` ON 時は日単位移動）。
    - `'earth-focus'` 時：地球中心の角度変化で1回転＝24時間（`1440分`）として **地球の自転** を滑らかに回せます。
  - **1本指で太陽をドラッグ**: 太陽自身の視覚的自転オフセット `sunVisualSpinOffsetDeg` を回転させます。
  - **1本指で何もないところ（背景）をドラッグ**: `state.camera.dragMode` に応じて視点回転（`'rotate'`: `yaw` / `pitch`）または視点移動（`'pan'`: `panX` / `panY`）を行います。

#### 左上カードの満ち欠け安定化 (`updateSimulation`, `renderMoonSVG`)
- 左上の「佐伯から見た月」（`#saiki-moon-svg`）は、1日周期の見かけの傾き回転（`angleToSun`）を掛けず `rotateDeg = 0` で描画し、半月境界（`rx < 0.25`）を直線補間することで、再生中・ドラッグ中も月が左右に揺れることなく滑らかに満ち欠けします。

### 4.4 iPad Safari 横向き対策・タッチ保護 (`style.css` / `app.js`)

- `getViewportSize()` で `window.visualViewport`（`scale ≈ 1` 時）から実表示領域を取得し、`--app-height` を更新することで Safari のアドレスバー・タブバーがあっても最下部 `#control-panel`（高さ `60px`）が画面内に収まります。
- `html, body`, `#app-container`, `#space-main-canvas` に `touch-action: none` を設定し、`gesturestart/change/end`、`dblclick`、複数指・不要領域での `touchmove` スクロール、連続タップ拡大をブロックしています（`#time-slider` の横ドラッグとモーダル内縦スクロールのみ許可）。
- `updateOrientationWarning()` および `@media (orientation: portrait)` で縦向き時は `#portrait-warning-overlay` を透過グレーアウト表示します。

---

## 5. ローカル動作確認手順

本アプリは静的ファイルのみで動作します。`lighttoearth` フォルダ内で静的HTTPサーバーを起動して確認できます。

```powershell
python -m http.server 8090
```

ブラウザで `http://localhost:8090/` にアクセスしてください。iPad への展開時は `配布用_宇宙から見た太陽と地球と月/` の中身一式をWebサーバーへ配置し、Safari（横向き）で開きます。

---

## 6. 今後の拡張・改修時のチェックポイント

- **年の選択肢範囲**: `initDropdownSelectors()`・`initCompareSelectors()`・`initCalendarSelectors()` は `2024`〜`2030` 年を生成しています（必要に応じて拡張可能）。
- **キャッシュ回避ローダー**: `index.html` 末尾のインラインローダーで `style.css?v=1.2&t=<Date.now()>`・`astro.js` → `app.js` を動的読み込みしています。バージョンアップ時は `index.html` の `v=1.2` 表記とキャッシュバスター定数を合わせて更新してください。
- **改修後チェックリスト**:
  1. 月・地球・太陽を指ドラッグしたときにそれぞれ自然に回転／公転し、背景ドラッグで視点回転・移動ができること。
  2. 地球と月の昼夜・満ち欠けがグラデーションなしのベタ塗りで描画され、佐伯のピンが昼夜の境界と整合していること。
  3. 左上カード「佐伯から見た月」・拡大モーダル・くらべるモーダルの月の形が、宇宙空間での太陽・地球・月の位置関係と一致していること。
  4. iPad横向き相当サイズ（例：`1024×650`）で上部カードや下部バーが見切れないこと、縦向きで透過グレーアウト案内が出ること。
  5. ルートの `index.html`, `style.css`, `astro.js`, `app.js`, `UPDATE_LOG.md` と配布用フォルダ内の同名ファイルが一致していること。
