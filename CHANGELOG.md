# Starlit Timeline Editor - 変更履歴 📋

## v2.0 (2025/11/14) - プロパティセクション開閉機能

### 🎯 実装内容

プロパティパネルの各セクションに開閉機能を追加しました!

### ✨ 主な変更点

#### 1. **セクション開閉UI**
- **トランジション** (🎬) セクション
- **音声** (🔊) セクション
- **ループ** (🔁) セクション  
- **トランスフォーム** (📐) セクション

各セクションヘッダーをクリックすると開閉できます。

#### 2. **視覚的フィードバック**
- ▼ アイコンで開閉状態を表示
- 閉じた状態では ◀ に変化
- スムーズなアニメーション効果

#### 3. **コード変更**

**app.js:**
- `togglePropertySection(sectionName)` メソッドを追加
- `updatePropertiesPanel()` メソッドを更新
  - 各セクションヘッダーに `onclick="app.togglePropertySection('セクション名')"` を追加
  - コンテンツを `<div class="property-section-content" id="セクション名Content">` で囲む
  - トグルアイコン `<span class="section-toggle-icon" id="セクション名Toggle">▼</span>` を追加

**styles.css:**
- `.section-toggle-icon.collapsed` スタイルを追加済み(回転アニメーション)
- `.property-section-content.collapsed` スタイルを追加済み(高さ0に縮小)

### 🎨 ユーザー体験の向上

- 長いプロパティリストでもスッキリ表示
- 必要なセクションだけ開いて作業効率アップ
- 視覚的に分かりやすいUI

### 📦 ファイル構成

```
StarlitTimelineEditor_v2.zip
├── index.html      (変更なし)
├── styles.css      (変更なし - 既存のスタイル利用)
├── app.js          (更新: セクション開閉機能追加)
└── README.md       (更新: 新機能の説明追加)
```

### 🚀 使い方

1. クリップを選択
2. 右サイドバーのプロパティパネルでセクションヘッダーをクリック
3. セクションが開閉します!

---

**Made with ❤️ by Ambrose Starlit VTuber**
