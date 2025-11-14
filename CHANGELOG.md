# Starlit Timeline Editor - 変更履歴 📋

## v3.4 (2025/11/14) - JK丸ゴシックフォント対応 🎨✨

### 🎯 実装内容

**カスタムフォントの全面採用！**

すべてのUIテキストに **JK-Maru-Gothic-M.otf** を適用しました。

### ✨ 主な変更点

#### 1. **フォント設定**
- `@font-face` で JK丸ゴシックを定義
- `font-family: 'JK Maru Gothic'` をグローバルに設定
- フォールバック: Hiragino → Meiryo → sans-serif

#### 2. **適用範囲**
すべてのUI要素にフォントを適用：
- ✅ ヘッダー（タイトル、ボタン）
- ✅ サイドバー（素材リスト、プロパティ）
- ✅ タイムライン（トラック名、クリップ名）
- ✅ コントロールバー（時間表示、ボタン）
- ✅ プロパティパネル（ラベル、値）
- ✅ キーフレームマネージャー

#### 3. **フォント読み込み**
```css
@font-face {
    font-family: 'JK Maru Gothic';
    src: url('JK-Maru-Gothic-M.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}
```

#### 4. **グローバルスタイル**
```css
body {
    font-family: 'JK Maru Gothic', 
                 'Hiragino Kaku Gothic ProN', 
                 'ヒラギノ角ゴ ProN W3', 
                 Meiryo, メイリオ, 
                 sans-serif;
}
```

#### 5. **個別要素の明示的指定**
```css
.btn {
    font-family: 'JK Maru Gothic', sans-serif;
}

.filter-tab {
    font-family: 'JK Maru Gothic', sans-serif;
}

.ae-keyframe-indicator {
    font-family: 'JK Maru Gothic', sans-serif;
}

.btn-delete-keyframe {
    font-family: 'JK Maru Gothic', sans-serif;
}
```

### 🎨 デザイン効果

**Before (システムフォント):**
```
Starlit Timeline Editor Pro
```

**After (JK丸ゴシック):**
```
Starlit Timeline Editor Pro
（丸みを帯びた優しい印象に！）
```

### 📦 必要ファイル

```
StarlitTimelineEditor_JK_Font/
├── index.html
├── app.js
├── styles.css
├── JK-Maru-Gothic-M.otf  ← 必須！
├── README.md
└── CHANGELOG.md
```

### ⚠️ 注意事項

1. **フォントファイルの配置**
   - `JK-Maru-Gothic-M.otf` を同じディレクトリに配置
   - 相対パスで読み込み: `url('JK-Maru-Gothic-M.otf')`

2. **ブラウザ対応**
   - OpenType形式 (.otf) をサポート
   - モダンブラウザなら問題なし

3. **フォールバック**
   - フォント読み込み失敗時はシステムフォントに
   - `font-display: swap` で遅延表示を防止

### 🚀 今後の展開

- [ ] 複数ウェイトの対応（太字・細字）
- [ ] Webフォント版の提供（WOFF2）
- [ ] フォント選択機能の追加

---

## v3.3 (2025/11/14) - 素材エクスプローラーの幅調整

### 🎯 改善内容

左サイドバーを 250px → 300px に拡大し、フィルタータブの改行を防止。

#### 📐 変更点
- 左サイドバーの幅: 250px → **300px** (+50px)
- フィルタータブ: `white-space: nowrap` で改行防止

---

## v2.1 (2025/11/14) - After Effects風プロパティUI

### 🎯 実装内容

トランスフォームプロパティをAE風の階層的UIに刷新！

#### ✨ 新機能

1. **階層的プロパティ表示**
   - 📍 位置（X/Y展開可能）
   - 🔍 スケール
   - 🔄 回転
   - 👁️ 不透明度

2. **キーフレームインジケーター**
   - 💎 アイコンで状態表示
   - 設定済み: オレンジ色に光る
   - ワンクリック追加/削除

3. **値のプレビュー**
   - 現在値を常時表示
   - 展開せずに確認可能

---

## v2.0 (2025/11/14) - プロパティセクション開閉機能

### 🎯 実装内容

各プロパティセクションに開閉機能を追加。

#### ✨ 対応セクション
- 🎬 トランジション
- 🔊 音声
- 🔁 ループ
- 📐 トランスフォーム

---

## v1.0 (初回リリース)

### 🎯 基本機能

- キーフレームアニメーション
- 動画書き出し（予定）
- エフェクト機能
- トランジション機能
- 音声レイヤーのサポート

---

**Made with ❤️ by Ambrose Starlit VTuber**
**Target: After Effects Alternative for Browser! 🎯**
