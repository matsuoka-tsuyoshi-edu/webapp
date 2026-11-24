# 📚 POP QUIZ SHOW サンプル問題データフォルダ (`sample/`)

このフォルダは、アプリ内の「サンプル問題ライブラリ」で読み込まれる問題データを、**校種・教科ごとのJSONファイル**として管理するディレクトリです。

## 📂 フォルダ構成
```
sample/
├── catalog.json             # ライブラリの一覧・ツリー構築用インデックス（自動生成）
├── sample_bundle.js         # ローカル直接起動（file://）時のオフライン用フォールバック（自動生成）
├── build_catalog.py         # 配下のJSONから catalog.json と sample_bundle.js を再生成するスクリプト
├── junior_high/             # 中学校
│   ├── health/health.json        # 保健体育 (10セット・30問)
│   ├── history/history.json      # 社会（歴史） (10セット・30問)
│   ├── geography/geography.json  # 社会（地理） (10セット・30問)
│   ├── civics/civics.json        # 社会（公民） (10セット・30問)
│   ├── biology/biology.json      # 理科（生物） (10セット・30問)
│   ├── astronomy/astronomy.json  # 理科（天体） (10セット・30問)
│   └── science/science.json      # 理科（科学） (10セット・30問)
└── general/                 # 共通・お試し
    └── demo/space_science.json   # 基本お試し (1セット・2問)
```

## 🛠️ 新しい問題JSONを追加・更新する方法
1. 各校種・教科フォルダ内に同様のJSON形式で問題セットファイルを作成・編集します。
2. `python sample/build_catalog.py` を実行すると、`catalog.json`（Webサーバーでのオンデマンド高速読込用）と `sample_bundle.js`（ローカル直接開き用）が自動更新されます。
3. Webサイト（GitHub Pages等）では、`host.html` を書き換えなくても `catalog.json` と該当 `.json` ファイルを差し替えるだけで新しい問題が配信されます！
