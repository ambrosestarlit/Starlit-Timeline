# FFmpeg.wasmの高速化ガイド 🚀

## 現在の問題

FFmpeg.wasmはCDN（unpkg.com）から読み込んでいるため、初回起動が遅いです。

## 解決方法: ローカルホスティング

FFmpeg.wasmのファイルをローカルに配置することで、読み込みを高速化できます。

### 手順

#### 1. 必要なファイルをダウンロード

以下のURLから2つのファイルをダウンロード：

```
https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js
https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm
```

#### 2. プロジェクトフォルダに配置

ダウンロードしたファイルを、このHTMLファイルと同じフォルダに配置：

```
StarlitTimelineEditor/
├── index.html
├── app.js
├── styles.css
├── ffmpeg-core.js      ← 追加
├── ffmpeg-core.wasm    ← 追加
└── ...
```

#### 3. app.jsを修正

`loadFFmpeg()`関数内のbaseURLを変更：

**変更前:**
```javascript
const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
```

**変更後:**
```javascript
const baseURL = './';  // 同じフォルダから読み込み
```

### 効果

- **初回読み込み**: 10-20秒 → 1-2秒
- **2回目以降**: キャッシュされるので変わらず

---

## 注意事項

### ブラウザ版FFmpegについて

- `.exe`ファイル（Windows版FFmpeg）はブラウザでは使用できません
- ブラウザで動画エンコードを行うには**FFmpeg.wasm**が必要です
- FFmpeg.wasmはWebAssembly版のFFmpegで、ブラウザ内で動作します

### なぜ遅いのか

FFmpeg.wasmは約31MBのwasmファイルをダウンロードする必要があり、初回は時間がかかります。

### 代替案

もし非常に高速な書き出しが必要な場合は：

1. **連番PNG書き出し** → ローカルのFFmpegで変換
2. **WebM書き出し** → MediaRecorderを使用（高速だが透過のみ）

---

## トラブルシューティング

### CORSエラーが出る場合

ローカルHTMLファイルを直接開くと、CORSエラーが発生する可能性があります。

**解決方法:**
1. ローカルサーバーを起動
2. GitHub Pagesにデプロイ

**ローカルサーバーの起動例:**
```bash
# Python 3
python -m http.server 8000

# Node.js (http-serverをインストール済みの場合)
npx http-server

# VS Code Live Server拡張機能を使用
```

### ファイルが見つからないエラー

`ffmpeg-core.js`と`ffmpeg-core.wasm`が同じフォルダにあることを確認してください。

---

**Starlit Timeline Editor**  
アンブローズ・スターリット
