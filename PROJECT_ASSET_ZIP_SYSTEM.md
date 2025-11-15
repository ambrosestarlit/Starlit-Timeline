# プロジェクト保存 & 素材ZIP システム 📦

ブラウザベースアプリケーション向けのプロジェクト保存・復元システムの実装ガイド

## 📋 目次

1. [概要](#概要)
2. [システム構成](#システム構成)
3. [保存フロー](#保存フロー)
4. [読み込みフロー](#読み込みフロー)
5. [実装詳細](#実装詳細)
6. [コード例](#コード例)
7. [注意点とベストプラクティス](#注意点とベストプラクティス)

---

## 概要

### 目的
ブラウザベースアプリケーションで、プロジェクトデータと素材ファイルを分離して保存・復元するシステム。

### 特徴
- ✅ プロジェクトデータ（JSON）と素材（ZIP）を分離
- ✅ 素材本体はBase64エンコード不要（サイズ削減）
- ✅ 自動的に2ファイルをダウンロード
- ✅ 読み込み時にユーザーガイド付き
- ✅ 完全な復元が可能

### 構成ファイル
```
保存時に生成されるファイル:
├── ProjectName.json          # プロジェクトデータ
└── ProjectName_assets.zip    # 素材ファイル一式
```

---

## システム構成

### 1. 必要なライブラリ

#### JSZip
ZIPファイルの生成・展開に使用

```html
<!-- CDNから読み込み -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

### 2. データ構造

#### プロジェクトJSONの構造
```json
{
  "version": "1.0",
  "projectName": "MyProject",
  "clips": [
    {
      "id": 123456789,
      "asset": {
        "id": 987654321,
        "name": "image.png",
        "type": "image"
      },
      "startTime": 0,
      "duration": 5,
      "...": "その他のクリップ情報"
    }
  ],
  "effectsEnabled": {
    "letterbox": true,
    "gradient": false
  },
  "settings": {
    "fps": 30,
    "duration": 30,
    "resolution": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

**ポイント:**
- 素材は参照のみ（`name`と`type`のみ保存）
- 素材本体（`file`、`url`、`blob`など）は保存しない

#### 素材ZIPの構造
```
ProjectName_assets.zip
└── assets/
    ├── image1.png           # 通常ファイル
    ├── video1.mp4           # 通常ファイル
    ├── audio1.mp3           # 通常ファイル
    └── sequence_folder/     # 連番画像フォルダ
        ├── frame_001.png
        ├── frame_002.png
        └── frame_003.png
```

---

## 保存フロー

### 全体の流れ
```
1. ユーザーが「プロジェクト保存」をクリック
   ↓
2. プロジェクト名を入力（プロンプト）
   ↓
3. プロジェクトJSONを生成・ダウンロード
   ↓
4. 素材ZIPを生成・ダウンロード（自動）
   ↓
5. 完了通知
```

### 実装手順

#### Step 1: プロジェクト名の取得
```javascript
const projectName = prompt('プロジェクト名を入力してください:', 'my_project');
if (!projectName) return; // キャンセル時
```

#### Step 2: プロジェクトJSON生成
```javascript
const project = {
    version: '1.0',
    projectName: projectName,
    // データ構造（素材は参照のみ）
    items: this.items.map(item => ({
        ...item,
        asset: {
            id: item.asset.id,
            name: item.asset.name,
            type: item.asset.type
            // file, url, blob は含めない
        }
    })),
    settings: { /* 設定 */ }
};
```

#### Step 3: JSONファイルのダウンロード
```javascript
const projectBlob = new Blob([JSON.stringify(project, null, 2)], { 
    type: 'application/json' 
});
const projectUrl = URL.createObjectURL(projectBlob);
const projectLink = document.createElement('a');
projectLink.href = projectUrl;
projectLink.download = `${projectName}.json`;
projectLink.click();
URL.revokeObjectURL(projectUrl);
```

#### Step 4: 素材ZIP生成
```javascript
async function saveAssetsZip(projectName) {
    if (this.assets.length === 0) return;
    
    const zip = new JSZip();
    const assetsFolder = zip.folder('assets');
    
    for (const asset of this.assets) {
        if (asset.type === 'sequence') {
            // 連番画像: フォルダを作成
            const sequenceFolder = assetsFolder.folder(asset.name);
            for (let i = 0; i < asset.files.length; i++) {
                sequenceFolder.file(asset.files[i].name, asset.files[i]);
            }
        } else {
            // 通常ファイル
            assetsFolder.file(asset.name, asset.file);
        }
    }
    
    // ZIPを生成
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);
    const zipLink = document.createElement('a');
    zipLink.href = zipUrl;
    zipLink.download = `${projectName}_assets.zip`;
    zipLink.click();
    URL.revokeObjectURL(zipUrl);
}
```

---

## 読み込みフロー

### 全体の流れ
```
1. ユーザーが「プロジェクト読み込み」をクリック
   ↓
2. プロジェクトJSONを選択
   ↓
3. プロジェクトデータを一時保存
   ↓
4. 確認ダイアログ表示:
   「続いて素材ZIPを選択してください」
   ↓
5. 素材ZIPを選択
   ↓
6. ZIPを展開して素材を復元
   ↓
7. プロジェクトデータから項目を復元
   ↓
8. 完了
```

### 実装手順

#### Step 1: プロジェクトJSON読み込み
```javascript
handleProjectLoad(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const project = JSON.parse(e.target.result);
            
            // 一時保存
            this.pendingProject = project;
            
            // 設定を復元
            this.restoreSettings(project.settings);
            
            // 素材ZIP読み込みを促す
            const projectName = project.projectName || 'プロジェクト';
            if (confirm(
                `プロジェクト「${projectName}」を読み込みました。\n\n` +
                `続いて素材ZIPファイル（${projectName}_assets.zip）を選択してください。`
            )) {
                document.getElementById('assetsZipInput').click();
            }
        } catch (err) {
            alert('プロジェクトの読み込みに失敗しました');
        }
    };
    reader.readAsText(file);
}
```

#### Step 2: 素材ZIP読み込み
```javascript
async handleAssetsZipLoad(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const zip = await JSZip.loadAsync(file);
        const assetsFolder = zip.folder('assets');
        
        if (!assetsFolder) {
            throw new Error('ZIPファイル内にassetsフォルダが見つかりません');
        }
        
        // 素材をクリア
        this.assets = [];
        
        // 連番画像用のマップ
        const sequenceFolders = new Map();
        
        // ZIPから素材を抽出
        const filePromises = [];
        assetsFolder.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) return;
            
            const pathParts = relativePath.split('/');
            
            if (pathParts.length > 1) {
                // 連番画像（フォルダ内）
                const folderName = pathParts[0];
                if (!sequenceFolders.has(folderName)) {
                    sequenceFolders.set(folderName, []);
                }
                
                const promise = zipEntry.async('blob').then(blob => {
                    const fileName = pathParts[pathParts.length - 1];
                    const mimeType = getMimeTypeFromFileName(fileName);
                    const file = new File([blob], fileName, { type: mimeType });
                    sequenceFolders.get(folderName).push(file);
                });
                filePromises.push(promise);
                
            } else {
                // 通常ファイル
                const fileName = pathParts[0];
                const promise = zipEntry.async('blob').then(blob => {
                    const mimeType = getMimeTypeFromFileName(fileName);
                    const file = new File([blob], fileName, { type: mimeType });
                    this.addAsset(file);
                });
                filePromises.push(promise);
            }
        });
        
        await Promise.all(filePromises);
        
        // 連番画像を追加
        for (const [folderName, files] of sequenceFolders) {
            files.sort((a, b) => a.name.localeCompare(b.name));
            this.addSequenceAsset(files);
        }
        
        // プロジェクトデータから項目を復元
        if (this.pendingProject) {
            await this.restoreItemsFromProject(this.pendingProject);
            this.pendingProject = null;
        }
        
    } catch (err) {
        alert('素材ZIPの読み込みに失敗しました');
    }
}
```

#### Step 3: MIMEタイプの推測
```javascript
function getMimeTypeFromFileName(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    
    const mimeTypes = {
        // 画像
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml',
        
        // 動画
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        
        // 音声
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac',
        'm4a': 'audio/mp4'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
}
```

**重要:** ZIPから展開したBlobは`type`が空の場合があるため、ファイル名から推測する必要がある。

#### Step 4: プロジェクトデータから項目を復元
```javascript
async restoreItemsFromProject(project) {
    this.items = [];
    
    for (const itemData of project.items) {
        // 素材を名前で検索
        const asset = this.assets.find(a => a.name === itemData.asset.name);
        
        if (!asset) {
            console.warn(`素材が見つかりません: ${itemData.asset.name}`);
            continue;
        }
        
        // 項目を復元
        const item = {
            ...itemData,
            asset: asset  // 実際の素材オブジェクトに置き換え
        };
        
        // 必要に応じて追加処理
        if (asset.type === 'audio') {
            this.prepareAudioItem(item);
        }
        
        this.items.push(item);
    }
    
    this.render();
}
```

---

## 実装詳細

### HTML構造

```html
<!-- ファイル入力（非表示） -->
<input type="file" 
       id="projectInput" 
       accept=".json" 
       style="display: none;" 
       onchange="app.handleProjectLoad(event)">

<input type="file" 
       id="assetsZipInput" 
       accept=".zip" 
       style="display: none;" 
       onchange="app.handleAssetsZipLoad(event)">

<!-- JSZip ライブラリ -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

### JavaScript構造

```javascript
class MyApp {
    constructor() {
        this.assets = [];      // 素材リスト
        this.items = [];       // プロジェクト内の項目
        this.pendingProject = null;  // プロジェクト読み込み時の一時保存
    }
    
    // 保存
    async saveProject() { /* ... */ }
    async saveAssetsZip(projectName) { /* ... */ }
    
    // 読み込み
    handleProjectLoad(event) { /* ... */ }
    async handleAssetsZipLoad(event) { /* ... */ }
    getMimeTypeFromFileName(fileName) { /* ... */ }
    async restoreItemsFromProject(project) { /* ... */ }
}
```

---

## コード例

### 完全な実装例

```javascript
class ProjectAssetSystem {
    constructor() {
        this.assets = [];
        this.items = [];
        this.pendingProject = null;
    }
    
    // ========== 保存 ==========
    
    async saveProject() {
        const projectName = prompt('プロジェクト名:', 'my_project');
        if (!projectName) return;
        
        // プロジェクトJSON生成
        const project = {
            version: '1.0',
            projectName: projectName,
            items: this.items.map(item => ({
                ...item,
                asset: {
                    id: item.asset.id,
                    name: item.asset.name,
                    type: item.asset.type
                }
            })),
            settings: this.getSettings()
        };
        
        // JSONダウンロード
        this.downloadJSON(project, `${projectName}.json`);
        
        // 素材ZIPダウンロード
        await this.saveAssetsZip(projectName);
        
        this.showNotification('保存完了！');
    }
    
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    async saveAssetsZip(projectName) {
        if (this.assets.length === 0) return;
        
        const zip = new JSZip();
        const assetsFolder = zip.folder('assets');
        
        for (const asset of this.assets) {
            if (asset.type === 'sequence') {
                const folder = assetsFolder.folder(asset.name);
                for (const file of asset.files) {
                    folder.file(file.name, file);
                }
            } else {
                assetsFolder.file(asset.name, asset.file);
            }
        }
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName}_assets.zip`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // ========== 読み込み ==========
    
    openProject() {
        document.getElementById('projectInput').click();
    }
    
    handleProjectLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const project = JSON.parse(e.target.result);
                this.pendingProject = project;
                
                this.applySettings(project.settings);
                
                const name = project.projectName || 'プロジェクト';
                if (confirm(
                    `プロジェクト「${name}」を読み込みました。\n` +
                    `続いて素材ZIP（${name}_assets.zip）を選択してください。`
                )) {
                    document.getElementById('assetsZipInput').click();
                }
            } catch (err) {
                alert('プロジェクトの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
    
    async handleAssetsZipLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const zip = await JSZip.loadAsync(file);
            const assetsFolder = zip.folder('assets');
            
            if (!assetsFolder) {
                throw new Error('assetsフォルダが見つかりません');
            }
            
            this.assets = [];
            const sequences = new Map();
            const promises = [];
            
            assetsFolder.forEach((path, entry) => {
                if (entry.dir) return;
                
                const parts = path.split('/');
                
                if (parts.length > 1) {
                    // 連番
                    const folder = parts[0];
                    if (!sequences.has(folder)) {
                        sequences.set(folder, []);
                    }
                    promises.push(
                        entry.async('blob').then(blob => {
                            const name = parts[parts.length - 1];
                            const type = this.getMimeType(name);
                            sequences.get(folder).push(
                                new File([blob], name, { type })
                            );
                        })
                    );
                } else {
                    // 通常
                    promises.push(
                        entry.async('blob').then(blob => {
                            const name = parts[0];
                            const type = this.getMimeType(name);
                            this.addAsset(new File([blob], name, { type }));
                        })
                    );
                }
            });
            
            await Promise.all(promises);
            
            for (const [name, files] of sequences) {
                files.sort((a, b) => a.name.localeCompare(b.name));
                this.addSequence(files);
            }
            
            if (this.pendingProject) {
                await this.restoreItems(this.pendingProject);
                this.pendingProject = null;
            }
            
            this.showNotification('復元完了！');
            
        } catch (err) {
            alert('素材ZIPの読み込みに失敗しました');
        }
        
        event.target.value = '';
    }
    
    getMimeType(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const types = {
            'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'gif': 'image/gif', 'webp': 'image/webp',
            'mp4': 'video/mp4', 'webm': 'video/webm',
            'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg'
        };
        return types[ext] || 'application/octet-stream';
    }
    
    async restoreItems(project) {
        this.items = [];
        
        for (const data of project.items) {
            const asset = this.assets.find(a => a.name === data.asset.name);
            if (!asset) {
                console.warn(`素材が見つかりません: ${data.asset.name}`);
                continue;
            }
            
            this.items.push({ ...data, asset });
        }
        
        this.render();
    }
    
    // ========== ユーティリティ ==========
    
    showNotification(message) {
        console.log(message);
        // 実際の通知実装
    }
    
    getSettings() {
        return { /* 設定 */ };
    }
    
    applySettings(settings) {
        // 設定を適用
    }
    
    addAsset(file) {
        // 素材を追加
    }
    
    addSequence(files) {
        // 連番を追加
    }
    
    render() {
        // 描画
    }
}
```

---

## 注意点とベストプラクティス

### ⚠️ 注意点

#### 1. MIMEタイプの取得
```javascript
// ❌ NG: ZIPから展開したBlobのtypeは空の場合がある
const file = new File([blob], fileName, { type: blob.type });

// ✅ OK: ファイル名から推測
const mimeType = getMimeTypeFromFileName(fileName);
const file = new File([blob], fileName, { type: mimeType });
```

#### 2. 非同期処理の待機
```javascript
// ❌ NG: forEachは非同期を待たない
assetsFolder.forEach(async (path, entry) => {
    await entry.async('blob'); // 待たれない
});

// ✅ OK: Promise.allで待機
const promises = [];
assetsFolder.forEach((path, entry) => {
    promises.push(entry.async('blob').then(...));
});
await Promise.all(promises);
```

#### 3. ファイル入力のリセット
```javascript
// 同じファイルを再度選択可能にする
handleLoad(event) {
    // 処理...
    event.target.value = ''; // リセット
}
```

#### 4. エラーハンドリング
```javascript
try {
    const zip = await JSZip.loadAsync(file);
    // 処理...
} catch (err) {
    alert('読み込みに失敗しました:\n' + err.message);
}
```

### 💡 ベストプラクティス

#### 1. プロジェクト名の検証
```javascript
const projectName = prompt('プロジェクト名:', 'my_project');
if (!projectName) return;

// ファイル名として使えない文字を除去
const safeName = projectName.replace(/[<>:"/\\|?*]/g, '_');
```

#### 2. バージョン管理
```javascript
const project = {
    version: '1.0',  // バージョンを記録
    // ...
};

// 読み込み時にバージョンチェック
if (project.version !== '1.0') {
    console.warn('異なるバージョンのプロジェクトです');
}
```

#### 3. 進捗表示
```javascript
async saveAssetsZip(projectName) {
    this.showNotification('📦 素材をZIPに圧縮中...');
    // ZIP生成...
    this.showNotification('✅ 保存完了！');
}
```

#### 4. 素材の存在チェック
```javascript
async restoreItems(project) {
    const missingAssets = [];
    
    for (const data of project.items) {
        const asset = this.assets.find(a => a.name === data.asset.name);
        if (!asset) {
            missingAssets.push(data.asset.name);
            continue;
        }
        this.items.push({ ...data, asset });
    }
    
    if (missingAssets.length > 0) {
        console.warn('見つからない素材:', missingAssets);
    }
}
```

#### 5. 連番画像のソート
```javascript
// ファイル名でソート（数値順）
files.sort((a, b) => a.name.localeCompare(b.name, undefined, { 
    numeric: true, 
    sensitivity: 'base' 
}));
```

---

## 拡張アイデア

### 1. 複数プロジェクトのバッチ保存
```javascript
async saveMultipleProjects(projects) {
    const zip = new JSZip();
    
    for (const project of projects) {
        const folder = zip.folder(project.name);
        folder.file('project.json', JSON.stringify(project));
        
        const assetsFolder = folder.folder('assets');
        for (const asset of project.assets) {
            assetsFolder.file(asset.name, asset.file);
        }
    }
    
    const blob = await zip.generateAsync({ type: 'blob' });
    this.downloadBlob(blob, 'all_projects.zip');
}
```

### 2. 自動バックアップ
```javascript
class AutoSaveSystem {
    constructor(app) {
        this.app = app;
        this.autoSaveInterval = 5 * 60 * 1000; // 5分
        this.startAutoSave();
    }
    
    startAutoSave() {
        setInterval(() => {
            this.saveToLocalStorage();
        }, this.autoSaveInterval);
    }
    
    saveToLocalStorage() {
        const project = this.app.getProjectData();
        localStorage.setItem('autosave', JSON.stringify(project));
        console.log('自動保存しました');
    }
    
    restoreFromLocalStorage() {
        const data = localStorage.getItem('autosave');
        if (data) {
            return JSON.parse(data);
        }
        return null;
    }
}
```

### 3. クラウドストレージ連携
```javascript
async saveToCloud(project, assetsZip) {
    const formData = new FormData();
    formData.append('project', new Blob([JSON.stringify(project)]));
    formData.append('assets', assetsZip);
    
    const response = await fetch('/api/projects/save', {
        method: 'POST',
        body: formData
    });
    
    if (response.ok) {
        const { projectId } = await response.json();
        return projectId;
    }
}
```

---

## トラブルシューティング

### 問題: 素材がドキュメントアイコンになる
**原因:** MIMEタイプが正しく設定されていない

**解決策:**
```javascript
// ファイル名から推測する
const mimeType = getMimeTypeFromFileName(fileName);
const file = new File([blob], fileName, { type: mimeType });
```

### 問題: ZIPが壊れている
**原因:** 非同期処理が完了する前にZIPを生成

**解決策:**
```javascript
// すべてのファイル追加を待つ
await Promise.all(filePromises);

// その後にZIP生成
const zipBlob = await zip.generateAsync({ type: 'blob' });
```

### 問題: 連番画像の順序がおかしい
**原因:** 文字列ソートで数値順になっていない

**解決策:**
```javascript
// 数値を考慮したソート
files.sort((a, b) => a.name.localeCompare(b.name, undefined, { 
    numeric: true 
}));
```

---

## まとめ

このシステムの利点:
- ✅ Base64エンコード不要でファイルサイズが小さい
- ✅ プロジェクトデータと素材を分離管理
- ✅ ユーザーに分かりやすいファイル構成
- ✅ 完全な復元が可能
- ✅ 他のソフトウェアに容易に移植可能

再利用時のチェックリスト:
- [ ] JSZipライブラリの読み込み
- [ ] ファイル入力要素の追加
- [ ] MIMEタイプ推測関数の実装
- [ ] プロジェクトデータ構造の定義
- [ ] 保存・読み込みメソッドの実装
- [ ] エラーハンドリングの実装
- [ ] ユーザー通知の実装

---

**作成者:** アンブローズ・スターリット (Ambrose Starlit)  
**バージョン:** 1.0  
**最終更新:** 2025/11/15
