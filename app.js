// アプリケーションクラス
class StarlitTimelineApp {
    constructor() {
        this.assets = [];
        this.clips = [];
        this.selectedClip = null;
        this.currentTime = 0;
        this.isPlaying = false;
        this.loopPlayback = false; // ループ再生フラグ
        this.zoom = 50; // px per second
        this.trackCount = 5;
        this.trackHeight = 80;
        this.fps = 30;
        this.duration = 30; // seconds
        
        // キャンバス
        this.previewCanvas = document.getElementById('previewCanvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.timelineCanvas = document.getElementById('timelineCanvas');
        this.timelineCtx = this.timelineCanvas.getContext('2d');
        this.rulerCanvas = document.getElementById('rulerCanvas');
        this.rulerCtx = this.rulerCanvas.getContext('2d');
        
        // エフェクト設定（enabled はプロジェクト依存、その他はグローバル設定）
        this.effects = {
            letterbox: {
                enabled: false, // プロジェクトファイルに保存
                height: 100,    // localStorage に保存
                color: '#000000' // localStorage に保存
            },
            gradient: {
                enabled: false, // プロジェクトファイルに保存
                top: {
                    color: '#FFFF00',      // localStorage に保存
                    height: 300,           // localStorage に保存
                    opacity: 50,           // localStorage に保存
                    blendMode: 'normal'    // localStorage に保存
                },
                bottom: {
                    color: '#0000FF',      // localStorage に保存
                    height: 300,           // localStorage に保存
                    opacity: 50,           // localStorage に保存
                    blendMode: 'normal'    // localStorage に保存
                }
            },
            diffusion: {
                enabled: false, // プロジェクトファイルに保存
                blur: 0,        // 0-300, localStorage に保存
                contrast: 0,    // -100 to 100, localStorage に保存
                brightness: 0,  // -100 to 100, localStorage に保存
                saturation: 0,  // -100 to 100, localStorage に保存
                opacity: 100,   // 0-100%, localStorage に保存
                // キーフレーム対応
                keyframes: []   // { time: number, blur, contrast, brightness, saturation, opacity }
            },
            colorKey: {
                enabled: false,        // プロジェクトファイルに保存
                color: '#00FF00',      // キー色（デフォルトはグリーン）
                tolerance: 30,         // 許容値 0-100
                invert: false,         // false: キー色を透過, true: キー色以外を透過
                feather: 5             // エッジのぼかし 0-50
            },
            normalize: {
                enabled: false,        // プロジェクトファイルに保存
                strength: 1            // スムージング強度 0-3
            }
        };
        
        // 音声コンテキスト
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioSources = [];
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.connect(this.audioContext.destination);
        
        // トランジション設定
        this.availableTransitions = [
            { id: 'none', name: 'なし' },
            { id: 'fade', name: 'フェード' },
            { id: 'dissolve', name: 'ディゾルブ' },
            { id: 'wipe_left', name: 'ワイプ(左)' },
            { id: 'wipe_right', name: 'ワイプ(右)' },
            { id: 'wipe_up', name: 'ワイプ(上)' },
            { id: 'wipe_down', name: 'ワイプ(下)' },
            { id: 'slide_left', name: 'スライド(左)' },
            { id: 'slide_right', name: 'スライド(右)' }
        ];
        
        // Undo/Redo
        this.history = [];
        this.historyIndex = -1;
        
        // 素材フィルター
        this.assetFilter = 'all'; // all, image, video, audio
        
        // プロパティセクションの開閉状態を保持
        this.propertySectionStates = {
            transform: false,
            transition: false,
            audio: false
        };
        
        // AEプロパティの開閉状態を保持
        this.aePropertyStates = {
            position: false,
            scale: false,
            rotation: false,
            opacity: false
        };
        
        // プロジェクト読み込み時の一時保存
        this.pendingProject = null;
        
        // プレビュードラッグ操作用
        this.isPreviewDragging = false;
        this.previewDragStart = null;
        this.previewDragMode = null; // 'position', 'rotation', 'scale'
        this.initialTransform = null;
        
        // プレビューズーム機能
        this.previewZoom = 100; // パーセント表示（100% = 原寸）
        
        // キーフレーム画像を読み込み
        this.keyframeImage = new Image();
        this.keyframeImage.src = 'key.png';
        
        // シークバー(プレイヘッド)画像を読み込み
        this.seekbarImage = new Image();
        this.seekbarImage.onload = () => {
            this.drawTimeline(); // 画像読み込み完了後に再描画
            this.drawRuler();    // ルーラーも再描画してくまを表示
        };
        this.seekbarImage.src = 'seekbar.png';
        
        // キーフレーム操作用
        this.isDraggingKeyframe = false;
        this.draggingKeyframe = null; // {clip, property, index}
        
        // スポイトモード
        this.eyedropperMode = false;
        
        // FFmpeg.wasm for MP4 export
        this.ffmpeg = null;
        this.ffmpegLoaded = false;
        
        this.init();
    }
    
    init() {
        // キャッシュから設定を復元
        this.loadSettingsFromCache();
        
        this.setupEventListeners();
        this.updateTimelineSize();
        this.drawTimeline();
        this.drawRuler();
        this.updatePreview();
        
        // ズームスライダー
        document.getElementById('zoomSlider').addEventListener('input', (e) => {
            this.zoom = parseInt(e.target.value);
            document.getElementById('zoomValue').textContent = `${this.zoom} px/秒`;
            this.updateTimelineSize();
            this.drawTimeline();
            this.drawRuler();
        });
        
        // プレビューズームスライダー
        document.getElementById('previewZoomSlider').addEventListener('input', (e) => {
            this.previewZoom = parseInt(e.target.value);
            document.getElementById('previewZoomValue').textContent = `${this.previewZoom}%`;
            this.updatePreviewZoom();
        });
        
        // エフェクトコントロール
        this.setupEffectControls();
        
        console.log('✨ エフェクト設定を復元しました');
    }
    
    setupEventListeners() {
        // タイムラインキャンバスイベント
        this.timelineCanvas.addEventListener('mousedown', (e) => this.handleTimelineMouseDown(e));
        
        // タイムラインキャンバスの右クリックメニューを無効化
        this.timelineCanvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        // mouseupとmousemoveはdocumentレベルで監視（ドラッグ中にキャンバス外に出ても対応）
        document.addEventListener('mousemove', (e) => this.handleTimelineMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleTimelineMouseUp(e));
        
        // 定規のクリック/ドラッグイベント
        this.rulerCanvas.addEventListener('mousedown', (e) => this.handleRulerMouseDown(e));
        
        // プレビューキャンバスでの直感的操作
        this.previewCanvas.addEventListener('mousedown', (e) => this.handlePreviewMouseDown(e));
        this.previewCanvas.addEventListener('mousemove', (e) => this.handlePreviewCanvasHover(e));
        document.addEventListener('mousemove', (e) => this.handlePreviewMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handlePreviewMouseUp(e));
        
        // タイムラインスクロールエリアのドラッグ&ドロップ（素材追加用）
        const timelineScroll = document.getElementById('timelineScroll');
        timelineScroll.addEventListener('drop', (e) => this.handleAssetDrop(e));
        timelineScroll.addEventListener('dragover', (e) => e.preventDefault());
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // 素材エクスプローラーのドラッグ&ドロップ
        document.getElementById('assetExplorer').addEventListener('drop', (e) => this.handleAssetDrop(e));
        document.getElementById('assetExplorer').addEventListener('dragover', (e) => e.preventDefault());
    }
    
    setupEffectControls() {
        // レターボックス - パラメーター変更時はキャッシュに保存
        document.getElementById('letterboxHeight').addEventListener('input', (e) => {
            this.effects.letterbox.height = parseInt(e.target.value);
            document.getElementById('letterboxHeightValue').textContent = `${e.target.value}px`;
            this.saveSettingsToCache();
            this.updatePreview();
        });
        
        document.getElementById('letterboxColor').addEventListener('change', (e) => {
            this.effects.letterbox.color = e.target.value;
            this.saveSettingsToCache();
            this.updatePreview();
        });
        
        // レターボックス有効/無効 - プロジェクト依存なのでキャッシュ保存しない
        document.getElementById('letterboxEnable').addEventListener('change', (e) => {
            this.effects.letterbox.enabled = e.target.checked;
            this.updatePreview();
        });
        
        // グラデーション有効/無効 - プロジェクト依存なのでキャッシュ保存しない
        document.getElementById('gradientEnable').addEventListener('change', (e) => {
            this.effects.gradient.enabled = e.target.checked;
            this.updatePreview();
        });
        
        // ディフュージョン有効/無効 - プロジェクト依存なのでキャッシュ保存しない
        document.getElementById('diffusionEnable').addEventListener('change', (e) => {
            this.effects.diffusion.enabled = e.target.checked;
            this.updatePreview();
        });
        
        // カラーキー有効/無効 - プロジェクト依存なのでキャッシュ保存しない
        document.getElementById('colorKeyEnable').addEventListener('change', (e) => {
            this.effects.colorKey.enabled = e.target.checked;
            this.updatePreview();
        });
        
        // ノーマライズ有効/無効 - プロジェクト依存なのでキャッシュ保存しない
        document.getElementById('normalizeEnable').addEventListener('change', (e) => {
            this.effects.normalize.enabled = e.target.checked;
            this.updatePreview();
        });
    }
    
    // グラデーションエフェクト更新（新規メソッド）
    updateGradientEffect() {
        // 上部
        this.effects.gradient.top.color = document.getElementById('gradientTopColor').value;
        this.effects.gradient.top.height = parseInt(document.getElementById('gradientTopHeight').value);
        this.effects.gradient.top.opacity = parseInt(document.getElementById('gradientTopOpacity').value);
        this.effects.gradient.top.blendMode = document.getElementById('gradientTopBlendMode').value;
        document.getElementById('gradientTopHeightValue').textContent = `${this.effects.gradient.top.height}px`;
        document.getElementById('gradientTopOpacityValue').textContent = `${this.effects.gradient.top.opacity}%`;
        
        // 下部
        this.effects.gradient.bottom.color = document.getElementById('gradientBottomColor').value;
        this.effects.gradient.bottom.height = parseInt(document.getElementById('gradientBottomHeight').value);
        this.effects.gradient.bottom.opacity = parseInt(document.getElementById('gradientBottomOpacity').value);
        this.effects.gradient.bottom.blendMode = document.getElementById('gradientBottomBlendMode').value;
        document.getElementById('gradientBottomHeightValue').textContent = `${this.effects.gradient.bottom.height}px`;
        document.getElementById('gradientBottomOpacityValue').textContent = `${this.effects.gradient.bottom.opacity}%`;
        
        // キャッシュに自動保存
        this.saveSettingsToCache();
        
        this.updatePreview();
    }
    
    updateDiffusionEffect() {
        // パラメータ取得
        this.effects.diffusion.blur = parseFloat(document.getElementById('diffusionBlur').value);
        this.effects.diffusion.contrast = parseFloat(document.getElementById('diffusionContrast').value);
        this.effects.diffusion.brightness = parseFloat(document.getElementById('diffusionBrightness').value);
        this.effects.diffusion.saturation = parseFloat(document.getElementById('diffusionSaturation').value);
        this.effects.diffusion.opacity = parseFloat(document.getElementById('diffusionOpacity').value);
        
        // 表示値更新
        document.getElementById('diffusionBlurValue').textContent = `${this.effects.diffusion.blur}`;
        document.getElementById('diffusionContrastValue').textContent = `${this.effects.diffusion.contrast}`;
        document.getElementById('diffusionBrightnessValue').textContent = `${this.effects.diffusion.brightness}`;
        document.getElementById('diffusionSaturationValue').textContent = `${this.effects.diffusion.saturation}`;
        document.getElementById('diffusionOpacityValue').textContent = `${this.effects.diffusion.opacity}%`;
        
        // キャッシュに自動保存
        this.saveSettingsToCache();
        
        this.updatePreview();
    }
    
    updateColorKeyEffect() {
        // パラメータ取得
        this.effects.colorKey.color = document.getElementById('colorKeyColor').value;
        this.effects.colorKey.tolerance = parseFloat(document.getElementById('colorKeyTolerance').value);
        this.effects.colorKey.feather = parseFloat(document.getElementById('colorKeyFeather').value);
        this.effects.colorKey.invert = document.getElementById('colorKeyInvert').checked;
        
        // 表示値更新
        document.getElementById('colorKeyToleranceValue').textContent = `${this.effects.colorKey.tolerance}`;
        document.getElementById('colorKeyFeatherValue').textContent = `${this.effects.colorKey.feather}`;
        
        // キャッシュに自動保存
        this.saveSettingsToCache();
        
        this.updatePreview();
    }
    
    updateNormalizeEffect() {
        // パラメータ取得
        this.effects.normalize.strength = parseInt(document.getElementById('normalizeStrength').value);
        
        // 表示値更新
        document.getElementById('normalizeStrengthValue').textContent = `${this.effects.normalize.strength}`;
        
        // キャッシュに自動保存
        this.saveSettingsToCache();
        
        this.updatePreview();
    }
    
    // スポイト機能（プレビューキャンバスから色を取得）
    pickColorFromCanvas() {
        // スポイトモードを有効化
        this.eyedropperMode = true;
        this.showNotification('💉 プレビュー画面をクリックして色を取得してください');
        
        // プレビューキャンバスのカーソルを変更
        this.previewCanvas.style.cursor = 'crosshair';
        
        // 一時的なクリックイベントリスナーを追加
        const eyedropperClick = (e) => {
            const rect = this.previewCanvas.getBoundingClientRect();
            
            // CSSピクセルからキャンバスピクセルに変換
            const scaleX = this.previewCanvas.width / rect.width;
            const scaleY = this.previewCanvas.height / rect.height;
            
            const canvasX = Math.floor((e.clientX - rect.left) * scaleX);
            const canvasY = Math.floor((e.clientY - rect.top) * scaleY);
            
            // ピクセルの色を取得
            const imageData = this.previewCtx.getImageData(canvasX, canvasY, 1, 1);
            const data = imageData.data;
            
            const r = data[0];
            const g = data[1];
            const b = data[2];
            
            // RGBをHEXに変換
            const hex = '#' + [r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
            
            // カラーピッカーに設定
            document.getElementById('colorKeyColor').value = hex;
            this.updateColorKeyEffect();
            
            this.showNotification(`🎨 色を取得しました: ${hex}`);
            
            // スポイトモードを終了
            this.eyedropperMode = false;
            this.previewCanvas.style.cursor = 'default';
            this.previewCanvas.removeEventListener('click', eyedropperClick);
        };
        
        this.previewCanvas.addEventListener('click', eyedropperClick, { once: true });
    }
    
    // プレビューズームを更新
    updatePreviewZoom() {
        const zoomFactor = this.previewZoom / 100;
        this.previewCanvas.style.transform = `scale(${zoomFactor})`;
        this.previewCanvas.style.transformOrigin = 'center center';
    }
    
    // ディフュージョンキーフレーム追加
    addDiffusionKeyframe() {
        const keyframe = {
            time: this.currentTime,
            blur: this.effects.diffusion.blur,
            contrast: this.effects.diffusion.contrast,
            brightness: this.effects.diffusion.brightness,
            saturation: this.effects.diffusion.saturation,
            opacity: this.effects.diffusion.opacity
        };
        
        // 既存のキーフレームを更新または追加
        const existingIndex = this.effects.diffusion.keyframes.findIndex(kf => Math.abs(kf.time - this.currentTime) < 0.01);
        if (existingIndex >= 0) {
            this.effects.diffusion.keyframes[existingIndex] = keyframe;
        } else {
            this.effects.diffusion.keyframes.push(keyframe);
        }
        
        this.updateDiffusionKeyframeList();
        this.saveHistory();
    }
    
    // ディフュージョンキーフレーム削除
    removeDiffusionKeyframe() {
        const keyframeIndex = this.effects.diffusion.keyframes.findIndex(kf => Math.abs(kf.time - this.currentTime) < 0.01);
        if (keyframeIndex >= 0) {
            this.effects.diffusion.keyframes.splice(keyframeIndex, 1);
            this.updateDiffusionKeyframeList();
            this.saveHistory();
        }
    }
    
    // ディフュージョンキーフレーム全削除
    clearDiffusionKeyframes() {
        if (confirm('すべてのディフュージョンキーフレームを削除しますか?')) {
            this.effects.diffusion.keyframes = [];
            this.updateDiffusionKeyframeList();
            this.saveHistory();
        }
    }
    
    // ディフュージョンキーフレームリスト更新
    updateDiffusionKeyframeList() {
        const list = document.getElementById('diffusionKeyframeList');
        if (!list) return;
        
        const keyframes = this.effects.diffusion.keyframes;
        
        if (keyframes.length === 0) {
            list.innerHTML = '<div class="empty-message">キーフレームなし</div>';
            return;
        }
        
        // 時刻順にソート
        keyframes.sort((a, b) => a.time - b.time);
        
        list.innerHTML = keyframes.map((kf, i) => {
            const timeStr = this.formatTime(kf.time);
            const isCurrent = Math.abs(kf.time - this.currentTime) < 0.01;
            return `
                <div class="keyframe-item ${isCurrent ? 'current' : ''}" onclick="app.seekToTime(${kf.time})">
                    <span class="keyframe-time">${timeStr}</span>
                    <span class="keyframe-values">B:${kf.blur.toFixed(0)} C:${kf.contrast.toFixed(0)} Br:${kf.brightness.toFixed(0)}</span>
                </div>
            `;
        }).join('');
    }
    
    // 時刻フォーマット関数
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    
    // 指定時刻にシーク
    seekToTime(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        this.updatePreview();
        this.drawTimeline();
        this.drawRuler();
    }
    
    // ファイル管理
    importMedia() {
        const input = document.getElementById('fileInput');
        const isSequence = document.getElementById('sequenceCheckbox').checked;
        
        if (isSequence) {
            // 連番の場合はフォルダ選択
            input.setAttribute('webkitdirectory', '');
            input.setAttribute('directory', '');
            input.removeAttribute('accept');
        } else {
            // 通常の場合はファイル選択
            input.removeAttribute('webkitdirectory');
            input.removeAttribute('directory');
            input.accept = 'image/*,video/*,audio/*,.mov,.MOV';
        }
        
        input.multiple = true;
        input.click();
    }
    
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        const isSequence = document.getElementById('sequenceCheckbox').checked;
        
        if (isSequence && files.length > 0) {
            // 連番画像として処理 - 画像ファイルのみフィルター
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            
            if (imageFiles.length > 0) {
                this.addSequenceAsset(imageFiles);
            } else {
                alert('画像ファイルが見つかりませんでした');
            }
        } else {
            // 通常の素材として処理
            for (let file of files) {
                this.addAsset(file);
            }
        }
        
        event.target.value = ''; // リセット
        document.getElementById('sequenceCheckbox').checked = false; // チェックを解除
    }
    
    // 連番画像素材を追加
    addSequenceAsset(files) {
        // ファイル名でソート
        files.sort((a, b) => a.name.localeCompare(b.name));
        
        // フォルダ名を取得
        const folderPath = files[0].webkitRelativePath || files[0].name;
        const folderName = folderPath.split('/')[0] || '連番';
        
        const asset = {
            id: Date.now() + Math.random(),
            name: `${folderName} (連番)`,
            type: 'sequence',
            files: files,
            urls: files.map(f => URL.createObjectURL(f)),
            frameCount: files.length
        };
        
        this.assets.push(asset);
        this.renderAssets();
    }
    
    addAsset(file) {
        // MOVファイルの判定（MIMEタイプが空の場合もあるので拡張子で判定）
        const fileName = file.name.toLowerCase();
        const isMOV = fileName.endsWith('.mov');
        
        let assetType = file.type.split('/')[0]; // image, video, audio
        
        // MOVファイルは動画として扱う
        if (isMOV || file.type === 'video/quicktime') {
            assetType = 'video';
        }
        
        const asset = {
            id: Date.now() + Math.random(),
            name: file.name,
            type: assetType,
            file: file,
            url: URL.createObjectURL(file)
        };
        
        this.assets.push(asset);
        this.renderAssets();
    }
    
    renderAssets() {
        const explorer = document.getElementById('assetExplorer');
        explorer.innerHTML = '';
        
        // フィルター適用
        const filteredAssets = this.assetFilter === 'all' 
            ? this.assets 
            : this.assets.filter(asset => asset.type === this.assetFilter);
        
        if (filteredAssets.length === 0) {
            const filterNames = {
                'all': '素材',
                'image': '画像',
                'video': '動画',
                'audio': '音声',
                'sequence': '連番'
            };
            const message = this.assetFilter === 'all' 
                ? '素材をドロップまたは➕ボタンで追加' 
                : `${filterNames[this.assetFilter]}素材がありません`;
            explorer.innerHTML = `<div class="empty-message">${message}</div>`;
            return;
        }
        
        filteredAssets.forEach(asset => {
            const item = document.createElement('div');
            item.className = 'asset-item';
            item.draggable = true;
            item.dataset.assetId = asset.id;
            
            const icon = {
                'image': '🖼️',
                'video': '🎬',
                'audio': '🎵',
                'sequence': '📹'
            }[asset.type] || '📄';
            
            const typeDisplay = asset.type === 'sequence' 
                ? `連番 (${asset.frameCount}枚)` 
                : asset.type;
            
            item.innerHTML = `
                <div class="asset-thumbnail">${icon}</div>
                <div class="asset-info">
                    <div class="asset-name">${asset.name}</div>
                    <div class="asset-type">${typeDisplay}</div>
                </div>
            `;
            
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('assetId', asset.id);
            });
            
            explorer.appendChild(item);
        });
    }
    
    // 素材フィルター設定
    setAssetFilter(filter) {
        this.assetFilter = filter;
        
        // ボタンのアクティブ状態を更新
        document.querySelectorAll('.filter-button').forEach(btn => {
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.renderAssets();
    }
    
    handleAssetDrop(event) {
        console.log('=== handleAssetDrop 呼び出し ===');
        console.log('isMovingClip:', this.isMovingClip);
        console.log('files:', event.dataTransfer.files.length);
        console.log('assetId:', event.dataTransfer.getData('assetId'));
        
        event.preventDefault();
        
        // クリップ移動中の場合は何もしない
        if (this.isMovingClip) {
            console.log('クリップ移動中のためスキップ');
            return;
        }
        
        const rect = event.target.getBoundingClientRect();
        const targetIsTimeline = event.target.id === 'timelineCanvas' || 
                                 event.target.closest('#timelineScroll');
        
        console.log('targetIsTimeline:', targetIsTimeline);
        
        // ファイルドロップ (素材エクスプローラーへ)
        if (event.dataTransfer.files.length > 0 && !targetIsTimeline) {
            console.log('ファイルドロップ処理');
            for (let file of event.dataTransfer.files) {
                this.addAsset(file);
            }
            return;
        }
        
        // タイムラインへのドロップ (素材エクスプローラーから)
        const assetId = event.dataTransfer.getData('assetId');
        if (assetId && targetIsTimeline) {
            console.log('タイムラインへクリップ追加:', assetId);
            console.log('追加前のクリップ数:', this.clips.length);
            
            // timelineCanvasの座標を取得
            const canvasRect = this.timelineCanvas.getBoundingClientRect();
            const scrollContainer = document.getElementById('timelineScroll');
            
            const x = event.clientX - canvasRect.left + scrollContainer.scrollLeft;
            const y = event.clientY - canvasRect.top + scrollContainer.scrollTop;
            
            const time = x / this.zoom;
            const track = Math.floor(y / this.trackHeight);
            
            this.addClipFromAsset(assetId, time, track);
            console.log('追加後のクリップ数:', this.clips.length);
        }
    }
    
    addClipFromAsset(assetId, startTime, track) {
        const asset = this.assets.find(a => a.id == assetId);
        if (!asset) return;
        
        const defaultDuration = 5; // デフォルト5秒
        
        const clip = {
            id: Date.now() + Math.random(),
            asset: asset,
            track: Math.max(0, Math.min(track, this.trackCount - 1)),
            startTime: Math.max(0, startTime),
            duration: defaultDuration,
            originalDuration: defaultDuration, // 元の長さを保存
            offset: 0, // オフセット（トリミング用）
            volume: 1.0, // 音量 (0.0 - 1.0)
            loopCount: 1, // ループ回数
            useOriginalSize: true, // 原寸表示フラグ
            transitionIn: {
                type: 'none',
                duration: 0.5
            },
            transitionOut: {
                type: 'none',
                duration: 0.5
            },
            keyframes: {
                x: [{time: 0, value: 0}],
                y: [{time: 0, value: 0}],
                rotation: [{time: 0, value: 0}],
                opacity: [{time: 0, value: 1}],
                scale: [{time: 0, value: 1}]
            }
        };
        
        // 連番アセットの場合
        if (asset.type === 'sequence') {
            clip.currentFrame = 0;
            clip.frameRate = 30; // デフォルト30fps
        }
        
        // 音声素材の場合、AudioElementを準備
        if (asset.type === 'audio') {
            this.prepareAudioClip(clip);
        }
        
        // 画像・動画の場合、原寸情報を取得
        if (asset.type === 'image' || asset.type === 'video') {
            this.loadAssetDimensions(clip);
        }
        
        this.clips.push(clip);
        this.drawTimeline();
        this.saveHistory();
    }
    
    // 素材の原寸情報を読み込み
    loadAssetDimensions(clip) {
        if (clip.asset.type === 'image') {
            const img = new Image();
            img.onload = () => {
                clip.originalWidth = img.width;
                clip.originalHeight = img.height;
            };
            img.src = clip.asset.url;
        } else if (clip.asset.type === 'video') {
            const video = document.createElement('video');
            video.onloadedmetadata = () => {
                clip.originalWidth = video.videoWidth;
                clip.originalHeight = video.videoHeight;
            };
            video.src = clip.asset.url;
        }
    }
    
    // 音声クリップの準備
    prepareAudioClip(clip) {
        clip.audioElement = new Audio(clip.asset.url);
        clip.audioElement.preload = 'auto';
    }
    
    // タイムライン描画
    updateTimelineSize() {
        const width = Math.max(3000, this.duration * this.zoom + 100);
        const height = this.trackCount * this.trackHeight;
        
        this.timelineCanvas.width = width;
        this.timelineCanvas.height = height;
        
        this.rulerCanvas.width = this.rulerCanvas.parentElement.clientWidth;
    }
    
    drawTimeline() {
        const ctx = this.timelineCtx;
        const width = this.timelineCanvas.width;
        const height = this.timelineCanvas.height;
        
        // 背景
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(0, 0, width, height);
        
        // トラックライン
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        for (let i = 0; i <= this.trackCount; i++) {
            const y = i * this.trackHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // 時間グリッド
        ctx.strokeStyle = '#B8956F';
        ctx.lineWidth = 1;
        for (let t = 0; t <= this.duration; t++) {
            const x = t * this.zoom;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // クリップ描画
        this.clips.forEach(clip => {
            this.drawClip(clip);
        });
        
        // 再生ヘッド
        this.drawPlayhead();
    }
    
    drawClip(clip) {
        const ctx = this.timelineCtx;
        const x = clip.startTime * this.zoom;
        const y = clip.track * this.trackHeight + 5;
        
        // offset を考慮した実際の表示幅を計算
        const visibleDuration = clip.duration - (clip.offset || 0);
        const width = visibleDuration * this.zoom;
        const height = this.trackHeight - 10;
        const radius = 8; // 角丸の半径
        
        // クリップ背景 - 音声クリップは異なる色
        if (clip.asset.type === 'audio') {
            ctx.fillStyle = clip === this.selectedClip ? '#D2691E' : '#8B6914';
        } else if (clip.asset.type === 'sequence') {
            ctx.fillStyle = clip === this.selectedClip ? '#D2691E' : '#6B5423';
        } else {
            ctx.fillStyle = clip === this.selectedClip ? '#D2691E' : '#6B4423';
        }
        
        // 角丸矩形を描画
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.arcTo(x + width, y, x + width, y + radius, radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
        ctx.lineTo(x + radius, y + height);
        ctx.arcTo(x, y + height, x, y + height - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
        ctx.fill();
        
        // ボーダー
        ctx.strokeStyle = '#5D3A1A';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // オフセットインジケーター（トリミングされている場合）
        if (clip.offset && clip.offset > 0) {
            // 左端にオレンジのトリミングマーク
            ctx.fillStyle = 'rgba(255, 140, 0, 0.7)';
            ctx.fillRect(x, y, 4, height);
            
            ctx.fillStyle = '#FF8C00';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('✂', x + 6, y + 15);
        }
        
        // アイコンとテキスト
        const icon = {
            'image': '🖼️',
            'video': '🎬',
            'audio': '🎵',
            'sequence': '📹'
        }[clip.asset.type] || '📄';
        
        ctx.fillStyle = '#F5DEB3';
        ctx.font = '16px sans-serif';
        ctx.fillText(icon, x + 5, y + 25);
        
        ctx.font = '12px sans-serif';
        const displayName = clip.asset.name.length > 20 ? clip.asset.name.substring(0, 20) + '...' : clip.asset.name;
        ctx.fillText(displayName, x + 25, y + 20);
        
        // トランジションインジケーター
        this.drawTransitionIndicators(clip, x, y, width, height);
        
        // キーフレームインジケーター
        if (clip.asset.type !== 'audio') {
            this.drawKeyframeIndicators(clip, x, y, height);
        }
        
        // 音声クリップの場合は波形表示
        if (clip.asset.type === 'audio') {
            this.drawAudioWaveform(clip, x, y, width, height);
        }
    }
    
    drawTransitionIndicators(clip, x, y, width, height) {
        const ctx = this.timelineCtx;
        
        // トランジションイン
        if (clip.transitionIn.type !== 'none') {
            const transWidth = clip.transitionIn.duration * this.zoom;
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fillRect(x, y, Math.min(transWidth, width), height);
            
            ctx.fillStyle = '#FFFF00';
            ctx.font = '10px sans-serif';
            ctx.fillText('IN', x + 2, y + 12);
        }
        
        // トランジションアウト
        if (clip.transitionOut.type !== 'none') {
            const transWidth = clip.transitionOut.duration * this.zoom;
            const startX = x + width - transWidth;
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fillRect(Math.max(startX, x), y, Math.min(transWidth, width), height);
            
            ctx.fillStyle = '#FFFF00';
            ctx.font = '10px sans-serif';
            ctx.fillText('OUT', x + width - 30, y + 12);
        }
    }
    
    drawAudioWaveform(clip, x, y, width, height) {
        const ctx = this.timelineCtx;
        const centerY = y + height / 2;
        
        // シンプルな波形表示
        ctx.strokeStyle = '#F5DEB3';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        
        ctx.beginPath();
        for (let i = 0; i < width; i += 5) {
            const waveHeight = Math.sin(i / 10) * (height / 4);
            if (i === 0) {
                ctx.moveTo(x + i, centerY + waveHeight);
            } else {
                ctx.lineTo(x + i, centerY + waveHeight);
            }
        }
        ctx.stroke();
        
        ctx.globalAlpha = 1;
    }
    
    drawKeyframeIndicators(clip, clipX, clipY, clipHeight) {
        const ctx = this.timelineCtx;
        const keyframeSize = 16; // くま画像のサイズ
        
        Object.keys(clip.keyframes).forEach(property => {
            const keyframes = clip.keyframes[property];
            keyframes.forEach(kf => {
                const x = clipX + (kf.time * this.zoom);
                const y = clipY + clipHeight - keyframeSize - 2;
                
                // くま画像が読み込まれていれば画像を描画、なければ黄色い丸
                if (this.keyframeImage && this.keyframeImage.complete) {
                    ctx.drawImage(
                        this.keyframeImage,
                        x - keyframeSize / 2,
                        y,
                        keyframeSize,
                        keyframeSize
                    );
                } else {
                    // フォールバック: 黄色い丸
                    ctx.fillStyle = '#FFFF00';
                    ctx.beginPath();
                    ctx.arc(x, y + keyframeSize / 2, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        });
    }
    
    drawPlayhead() {
        const ctx = this.timelineCtx;
        const x = this.currentTime * this.zoom;
        
        // 赤いライン(タイムラインキャンバスに描画)
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.timelineCanvas.height);
        ctx.stroke();
        
        // くまはルーラー側に描画するのでここでは描画しない
    }
    
    drawRuler() {
        const ctx = this.rulerCtx;
        const width = this.rulerCanvas.width;
        const height = 30;
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#5D3A1A';
        ctx.font = '10px sans-serif';
        
        const scrollLeft = document.getElementById('timelineScroll').scrollLeft;
        const startTime = Math.floor(scrollLeft / this.zoom);
        const endTime = Math.ceil((scrollLeft + width) / this.zoom);
        
        for (let t = startTime; t <= endTime; t++) {
            const x = t * this.zoom - scrollLeft;
            
            ctx.beginPath();
            ctx.moveTo(x, height - 10);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            const minutes = Math.floor(t / 60);
            const seconds = t % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            ctx.fillText(timeStr, x + 2, height - 12);
        }
        
        // シークバー(くま)をルーラー上に描画
        const playheadX = this.currentTime * this.zoom - scrollLeft;
        const bearSize = 36;
        
        if (this.seekbarImage && this.seekbarImage.complete) {
            ctx.drawImage(
                this.seekbarImage,
                playheadX - bearSize / 2,
                -6, // ルーラーの上に突き出す
                bearSize,
                bearSize
            );
        }
    }
    
    // タイムライン操作
    handleTimelineMouseDown(e) {
        console.log('=== mousedown ===');
        const rect = this.timelineCanvas.getBoundingClientRect();
        const scrollContainer = document.getElementById('timelineScroll');
        
        const x = e.clientX - rect.left + scrollContainer.scrollLeft;
        const y = e.clientY - rect.top + scrollContainer.scrollTop;
        
        console.log('座標:', x, y);
        
        // プレイヘッド(くま)のクリック判定(上部40pxの範囲)
        const playheadX = this.currentTime * this.zoom;
        const bearSize = 36;
        const hitArea = 25; // 当たり判定を広く
        
        if (y < 40 && Math.abs(x - playheadX) < hitArea) {
            console.log('プレイヘッドドラッグ開始');
            this.isSeekbarDragging = true;
            this.currentTime = x / this.zoom;
            this.updateTimeDisplay();
            this.updatePreview();
            this.drawTimeline();
            return;
        }
        
        // 右クリックの場合、キーフレーム削除をチェック
        if (e.button === 2) {
            const keyframe = this.getKeyframeAt(x, y);
            if (keyframe) {
                e.preventDefault();
                this.deleteKeyframe(keyframe.clip, keyframe.property, keyframe.index);
                return;
            }
        }
        
        // 左クリックの場合、キーフレームドラッグをチェック
        const keyframe = this.getKeyframeAt(x, y);
        if (keyframe) {
            this.isDraggingKeyframe = true;
            this.draggingKeyframe = keyframe;
            this.dragStartX = x;
            console.log('キーフレームドラッグ開始');
            return;
        }
        
        // クリップ選択
        const clickedClip = this.getClipAt(x, y);
        console.log('クリックしたクリップ:', clickedClip ? clickedClip.asset.name : 'なし');
        
        if (clickedClip) {
            this.selectedClip = clickedClip;
            this.isDragging = true;
            this.isMovingClip = true; // クリップ移動中フラグ
            this.dragStartX = x;
            this.dragStartY = y;
            
            // 初期位置を保存
            this.initialClipPosition = {
                startTime: clickedClip.startTime,
                track: clickedClip.track
            };
            
            console.log('ドラッグ開始 - isDragging:', this.isDragging);
            this.updatePropertiesPanel();
            this.drawTimeline();
            
            // ブラウザのドラッグ&ドロップを無効化
            e.preventDefault();
            return;
        }
        
        // プレイヘッド移動
        console.log('プレイヘッド移動');
        this.currentTime = x / this.zoom;
        this.updateTimeDisplay();
        this.updatePreview();
        this.drawTimeline();
    }
    
    // 定規のマウスダウン - シークバードラッグ
    handleRulerMouseDown(e) {
        this.isSeekbarDragging = true;
        this.updateSeekbar(e);
    }
    
    // シークバーの更新
    updateSeekbar(e) {
        const rect = this.rulerCanvas.getBoundingClientRect();
        const scrollContainer = document.getElementById('timelineScroll');
        const x = e.clientX - rect.left + scrollContainer.scrollLeft;
        
        this.currentTime = Math.max(0, x / this.zoom);
        this.updateTimeDisplay();
        this.updatePreview();
        this.drawTimeline();
        this.updatePropertiesPanel();
    }
    
    handleTimelineMouseMove(e) {
        // シークバードラッグ中
        if (this.isSeekbarDragging) {
            this.updateSeekbar(e);
            return;
        }
        
        // キーフレームドラッグ中
        if (this.isDraggingKeyframe && this.draggingKeyframe) {
            const rect = this.timelineCanvas.getBoundingClientRect();
            const scrollContainer = document.getElementById('timelineScroll');
            const x = e.clientX - rect.left + scrollContainer.scrollLeft;
            
            const deltaX = x - this.dragStartX;
            const newTime = this.draggingKeyframe.keyframe.time + (deltaX / this.zoom);
            
            // クリップの範囲内に制限
            const clip = this.draggingKeyframe.clip;
            const maxTime = clip.duration;
            this.draggingKeyframe.keyframe.time = Math.max(0, Math.min(newTime, maxTime));
            
            // キーフレームを時刻順にソート
            clip.keyframes[this.draggingKeyframe.property].sort((a, b) => a.time - b.time);
            
            this.drawTimeline();
            this.updatePreview();
            this.updatePropertiesPanel();
            return;
        }
        
        // クリップドラッグ中
        if (!this.isDragging || !this.selectedClip || !this.initialClipPosition) return;
        
        console.log('=== mousemove (dragging) ===');
        
        const rect = this.timelineCanvas.getBoundingClientRect();
        const scrollContainer = document.getElementById('timelineScroll');
        
        const x = e.clientX - rect.left + scrollContainer.scrollLeft;
        const y = e.clientY - rect.top + scrollContainer.scrollTop;
        
        // ドラッグ開始位置からの差分を計算
        const deltaX = x - this.dragStartX;
        const deltaY = y - this.dragStartY;
        
        console.log('移動量:', deltaX, deltaY);
        
        // 初期位置からの差分で新しい位置を計算
        const newStartTime = this.initialClipPosition.startTime + (deltaX / this.zoom);
        const newTrack = this.initialClipPosition.track + Math.round(deltaY / this.trackHeight);
        
        console.log('移動前:', this.selectedClip.startTime, this.selectedClip.track);
        console.log('移動後:', newStartTime, newTrack);
        
        // 新しい位置を設定（範囲制限あり）
        this.selectedClip.startTime = Math.max(0, newStartTime);
        this.selectedClip.track = Math.max(0, Math.min(newTrack, this.trackCount - 1));
        
        this.drawTimeline();
        this.updatePropertiesPanel();
    }
    
    handleTimelineMouseUp(e) {
        // console.log('=== mouseup ===');
        // console.log('isDragging:', this.isDragging);
        // console.log('isPreviewDragging:', this.isPreviewDragging);
        // console.log('クリップ数:', this.clips.length);
        
        // キーフレームドラッグ終了
        if (this.isDraggingKeyframe) {
            this.isDraggingKeyframe = false;
            this.draggingKeyframe = null;
            this.saveHistory();
            return;
        }
        
        // プレビューキャンバスでのドラッグ中は何もしない
        if (this.isPreviewDragging) {
            // console.log('プレビュードラッグ中なのでスキップ');
            return;
        }
        
        if (this.isDragging && this.isMovingClip && this.selectedClip) {
            // オートトリミング処理を実行
            this.autoTrimCollisions(this.selectedClip);
            this.saveHistory();
        }
        this.isDragging = false;
        this.isMovingClip = false; // フラグをリセット
        this.isSeekbarDragging = false; // シークバーフラグもリセット
        // console.log('ドラッグ終了');
    }
    
    getClipAt(x, y) {
        for (let clip of this.clips) {
            const clipX = clip.startTime * this.zoom;
            const clipY = clip.track * this.trackHeight;
            
            // offsetを考慮した実際の表示幅
            const visibleDuration = clip.duration - (clip.offset || 0);
            const clipWidth = visibleDuration * this.zoom;
            const clipHeight = this.trackHeight;
            
            if (x >= clipX && x <= clipX + clipWidth &&
                y >= clipY && y <= clipY + clipHeight) {
                return clip;
            }
        }
        return null;
    }
    
    getKeyframeAt(x, y) {
        const keyframeSize = 16;
        const hitArea = 12; // クリック判定を少し広げる
        
        for (let clip of this.clips) {
            const clipX = clip.startTime * this.zoom;
            const clipY = clip.track * this.trackHeight;
            const clipHeight = this.trackHeight;
            
            // クリップの範囲内か確認
            if (y < clipY || y > clipY + clipHeight) continue;
            
            // すべてのプロパティのキーフレームをチェック
            for (let property in clip.keyframes) {
                const keyframes = clip.keyframes[property];
                for (let i = 0; i < keyframes.length; i++) {
                    const kf = keyframes[i];
                    const kfX = clipX + (kf.time * this.zoom);
                    const kfY = clipY + clipHeight - keyframeSize - 2;
                    
                    // 当たり判定
                    if (Math.abs(x - kfX) < hitArea && 
                        y >= kfY && y <= kfY + keyframeSize) {
                        return {
                            clip: clip,
                            property: property,
                            index: i,
                            keyframe: kf
                        };
                    }
                }
            }
        }
        return null;
    }
    
    deleteKeyframe(clip, property, index) {
        if (confirm('このキーフレームを削除しますか?')) {
            clip.keyframes[property].splice(index, 1);
            this.drawTimeline();
            this.updatePreview();
            this.updatePropertiesPanel();
            this.saveHistory();
        }
    }
    
    // オートトリミング機能
    autoTrimCollisions(movedClip) {
        console.log('=== オートトリミング開始 ===');
        
        // 移動したクリップの範囲を計算
        const movedStart = movedClip.startTime;
        const movedEnd = movedClip.startTime + movedClip.duration - movedClip.offset;
        
        console.log(`移動クリップ: ${movedClip.asset.name}`);
        console.log(`移動クリップ範囲: ${movedStart.toFixed(2)}秒 ～ ${movedEnd.toFixed(2)}秒`);
        
        // 同じトラックの他のクリップをチェック
        for (let otherClip of this.clips) {
            // 自分自身はスキップ
            if (otherClip === movedClip) continue;
            
            // 別のトラックはスキップ
            if (otherClip.track !== movedClip.track) continue;
            
            // 他のクリップの範囲を計算
            const otherStart = otherClip.startTime;
            const otherEnd = otherClip.startTime + otherClip.duration - otherClip.offset;
            
            console.log(`チェック中: ${otherClip.asset.name} (${otherStart.toFixed(2)}秒 ～ ${otherEnd.toFixed(2)}秒)`);
            
            // パターン1: 移動クリップが左から押す（他のクリップの頭をトリミング）
            if (movedEnd > otherStart && movedEnd < otherEnd && movedStart < otherStart) {
                const overlap = movedEnd - otherStart;
                console.log(`前方衝突: ${otherClip.asset.name} の頭を ${overlap.toFixed(2)}秒 トリミング`);
                
                // 他のクリップの頭をカット
                otherClip.offset += overlap;
                otherClip.startTime = movedEnd;
                
                // 最小デュレーション確認
                const visibleDuration = otherClip.duration - otherClip.offset;
                if (visibleDuration < 0.1) {
                    otherClip.offset = otherClip.duration - 0.1;
                    otherClip.startTime = movedEnd;
                }
            }
            
            // パターン2: 移動クリップが右から押す（他のクリップの後ろをトリミング）
            else if (movedStart < otherEnd && movedStart > otherStart && movedEnd > otherEnd) {
                const overlap = otherEnd - movedStart;
                console.log(`後方衝突: ${otherClip.asset.name} の後ろを ${overlap.toFixed(2)}秒 トリミング`);
                
                // 他のクリップの後ろをカット
                const visibleDuration = otherClip.duration - otherClip.offset;
                const newVisibleDuration = visibleDuration - overlap;
                
                // 最小デュレーション確認
                if (newVisibleDuration < 0.1) {
                    otherClip.duration = otherClip.offset + 0.1;
                } else {
                    otherClip.duration = otherClip.offset + newVisibleDuration;
                }
            }
            
            // パターン3: 移動クリップが完全に覆う（他のクリップを後方へ移動）
            else if (movedStart <= otherStart && movedEnd >= otherEnd) {
                console.log(`完全衝突: ${otherClip.asset.name} が完全に覆われました`);
                
                // 他のクリップを後方へ移動
                otherClip.startTime = movedEnd;
                otherClip.offset = 0; // オフセットをリセット
            }
        }
        
        // タイムラインを再描画
        this.drawTimeline();
        this.updatePropertiesPanel();
        
        console.log('=== オートトリミング完了 ===');
    }
    
    // プロパティパネル
    updatePropertiesPanel() {
        const panel = document.getElementById('propertiesContent');
        
        if (!this.selectedClip) {
            panel.innerHTML = '<div class="empty-message">クリップを選択してください</div>';
            return;
        }
        
        const clip = this.selectedClip;
        const localTime = this.currentTime - clip.startTime;
        
        // 実際の表示時間を計算
        const visibleDuration = clip.duration - (clip.offset || 0);
        
        let propertiesHTML = `
            <div class="property-group">
                <div class="property-label">クリップ名</div>
                <div class="property-value">${clip.asset.name}</div>
            </div>
            
            <div class="property-group">
                <div class="property-label">開始時間: <span id="startTimeValue">${clip.startTime.toFixed(2)}秒</span></div>
                <input type="range" class="property-slider" value="${clip.startTime.toFixed(2)}" 
                    min="0" max="30" step="0.1"
                    oninput="app.updateClipProperty('startTime', parseFloat(this.value)); document.getElementById('startTimeValue').textContent = this.value + '秒'">
            </div>
            
            <div class="property-group">
                <div class="property-label">継続時間: <span id="durationValue">${clip.duration.toFixed(2)}秒</span></div>
                <input type="range" class="property-slider" value="${clip.duration.toFixed(2)}" 
                    min="0.1" max="30" step="0.1"
                    oninput="app.updateClipProperty('duration', parseFloat(this.value)); document.getElementById('durationValue').textContent = this.value + '秒'">
            </div>
        `;
        
        // オフセット表示（トリミングされている場合）
        if (clip.offset && clip.offset > 0) {
            propertiesHTML += `
                <div class="property-group" style="background-color: rgba(255, 140, 0, 0.1); padding: 8px; border-radius: 4px;">
                    <div class="property-label">✂ オフセット: <span style="color: #FF8C00; font-weight: bold;">${clip.offset.toFixed(2)}秒</span></div>
                    <div class="property-label" style="font-size: 11px; color: #666;">表示時間: ${visibleDuration.toFixed(2)}秒</div>
                </div>
            `;
        }
        
        // 連番アニメーションの場合はフレームレート設定
        if (clip.asset.type === 'sequence') {
            propertiesHTML += `
                <div class="property-group">
                    <div class="property-label">フレームレート: <span id="frameRateValue">${clip.frameRate || 30} fps</span></div>
                    <input type="range" class="property-slider" value="${clip.frameRate || 30}" 
                        min="1" max="60" step="1"
                        oninput="document.getElementById('frameRateValue').textContent = this.value + ' fps'"
                        onchange="app.updateClipProperty('frameRate', parseInt(this.value))">
                </div>
            `;
        }
        
        // 映像クリップの場合はトランスフォーム設定
        if (clip.asset.type === 'image' || clip.asset.type === 'video' || clip.asset.type === 'sequence') {
            const currentX = this.getKeyframeValue(clip, 'x', localTime);
            const currentY = this.getKeyframeValue(clip, 'y', localTime);
            const currentRotation = this.getKeyframeValue(clip, 'rotation', localTime);
            const currentOpacity = this.getKeyframeValue(clip, 'opacity', localTime);
            const currentScale = this.getKeyframeValue(clip, 'scale', localTime);
            
            propertiesHTML += `
                <div class="property-section-header" onclick="app.togglePropertySection('transform')">
                    <span class="section-toggle-icon" id="transformToggle">▼</span>
                    📐 トランスフォーム
                </div>
                <div class="property-section-content" id="transformContent">
                    <!-- 位置 -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('position')">
                            <span class="ae-property-icon" id="positionIcon">▶</span>
                            <span class="ae-property-name">📍 位置</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'x', localTime) || this.hasKeyframeAt(clip, 'y', localTime) ? 'active' : ''}" 
                                onclick="event.stopPropagation(); app.toggleKeyframe('x'); app.toggleKeyframe('y')">💎</button>
                        </div>
                        <div class="ae-property-content collapsed" id="positionContent">
                            <div class="ae-subproperty">
                                <label>X: <span id="xValue">${currentX.toFixed(0)}</span>px</label>
                                <input type="range" class="property-slider" value="${currentX.toFixed(0)}"
                                    min="-960" max="960" step="1"
                                    oninput="document.getElementById('xValue').textContent = this.value; app.setKeyframeValueLive('x', parseFloat(this.value))"
                                    onchange="app.setKeyframeValue('x', parseFloat(this.value))">
                            </div>
                            <div class="ae-subproperty">
                                <label>Y: <span id="yValue">${currentY.toFixed(0)}</span>px</label>
                                <input type="range" class="property-slider" value="${currentY.toFixed(0)}"
                                    min="-540" max="540" step="1"
                                    oninput="document.getElementById('yValue').textContent = this.value; app.setKeyframeValueLive('y', parseFloat(this.value))"
                                    onchange="app.setKeyframeValue('y', parseFloat(this.value))">
                            </div>
                        </div>
                    </div>
                    
                    <!-- スケール -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('scale')">
                            <span class="ae-property-icon" id="scaleIcon">▶</span>
                            <span class="ae-property-name">🔍 スケール</span>
                            <span class="ae-property-value">${(currentScale * 100).toFixed(0)}%</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'scale', localTime) ? 'active' : ''}" 
                                onclick="event.stopPropagation(); app.toggleKeyframe('scale')">💎</button>
                        </div>
                        <div class="ae-property-content collapsed" id="scaleContent">
                            <div class="ae-subproperty">
                                <input type="range" class="property-slider" value="${(currentScale * 100).toFixed(0)}" 
                                    min="10" max="300" step="1" id="scaleSlider"
                                    oninput="document.querySelector('#scaleContent').parentElement.querySelector('.ae-property-value').textContent = this.value + '%'; app.setKeyframeValueLive('scale', parseFloat(this.value) / 100)"
                                    onchange="app.setKeyframeValue('scale', parseFloat(this.value) / 100)">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 回転 -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('rotation')">
                            <span class="ae-property-icon" id="rotationIcon">▶</span>
                            <span class="ae-property-name">🔄 回転</span>
                            <span class="ae-property-value">${currentRotation.toFixed(0)}°</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'rotation', localTime) ? 'active' : ''}" 
                                onclick="event.stopPropagation(); app.toggleKeyframe('rotation')">💎</button>
                        </div>
                        <div class="ae-property-content collapsed" id="rotationContent">
                            <div class="ae-subproperty">
                                <input type="range" class="property-slider" value="${currentRotation.toFixed(0)}"
                                    min="-180" max="180" step="1" id="rotationSlider"
                                    oninput="document.querySelector('#rotationContent').parentElement.querySelector('.ae-property-value').textContent = this.value + '°'; app.setKeyframeValueLive('rotation', parseFloat(this.value))"
                                    onchange="app.setKeyframeValue('rotation', parseFloat(this.value))">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 不透明度 -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('opacity')">
                            <span class="ae-property-icon" id="opacityIcon">▶</span>
                            <span class="ae-property-name">👁️ 不透明度</span>
                            <span class="ae-property-value">${(currentOpacity * 100).toFixed(0)}%</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'opacity', localTime) ? 'active' : ''}" 
                                onclick="event.stopPropagation(); app.toggleKeyframe('opacity')">💎</button>
                        </div>
                        <div class="ae-property-content collapsed" id="opacityContent">
                            <div class="ae-subproperty">
                                <input type="range" class="property-slider" value="${(currentOpacity * 100).toFixed(0)}" 
                                    min="0" max="100" step="1" id="opacitySlider"
                                    oninput="document.querySelector('#opacityContent').parentElement.querySelector('.ae-property-value').textContent = this.value + '%'; app.setKeyframeValueLive('opacity', parseFloat(this.value) / 100)"
                                    onchange="app.setKeyframeValue('opacity', parseFloat(this.value) / 100)">
                            </div>
                        </div>
                    </div>
                    
                    <div class="property-group" style="margin-top: 10px;">
                        <div class="property-label">
                            <input type="checkbox" id="useOriginalSize" ${clip.useOriginalSize ? 'checked' : ''} 
                                onchange="app.updateClipProperty('useOriginalSize', this.checked)">
                            原寸表示
                        </div>
                    </div>
                </div>
            `;
        }
        
        propertiesHTML += `
            <!-- トランジション設定 -->
            <div class="property-section-header" onclick="app.togglePropertySection('transition')">
                <span class="section-toggle-icon" id="transitionToggle">▼</span>
                🎬 トランジション
            </div>
            <div class="property-section-content" id="transitionContent">
                <div class="property-group">
                    <div class="property-label">イン</div>
                    <select class="property-input" onchange="app.updateTransition('in', 'type', this.value)">
                        ${this.availableTransitions.map(t => 
                            `<option value="${t.id}" ${clip.transitionIn.type === t.id ? 'selected' : ''}>${t.name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="property-group">
                    <div class="property-label">イン時間: <span id="transInDurationValue">${clip.transitionIn.duration.toFixed(2)}秒</span></div>
                    <input type="range" class="property-slider" value="${clip.transitionIn.duration.toFixed(2)}" 
                        min="0.1" max="${clip.duration / 2}" step="0.1"
                        oninput="app.updateTransition('in', 'duration', parseFloat(this.value)); document.getElementById('transInDurationValue').textContent = this.value + '秒'">
                </div>
                
                <div class="property-group">
                    <div class="property-label">アウト</div>
                    <select class="property-input" onchange="app.updateTransition('out', 'type', this.value)">
                        ${this.availableTransitions.map(t => 
                            `<option value="${t.id}" ${clip.transitionOut.type === t.id ? 'selected' : ''}>${t.name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="property-group">
                    <div class="property-label">アウト時間: <span id="transOutDurationValue">${clip.transitionOut.duration.toFixed(2)}秒</span></div>
                    <input type="range" class="property-slider" value="${clip.transitionOut.duration.toFixed(2)}" 
                        min="0.1" max="${clip.duration / 2}" step="0.1"
                        oninput="app.updateTransition('out', 'duration', parseFloat(this.value)); document.getElementById('transOutDurationValue').textContent = this.value + '秒'">
                </div>
            </div>
        `;
        
        // 音声クリップの場合はボリューム設定
        if (clip.asset.type === 'audio' || clip.asset.type === 'video') {
            propertiesHTML += `
                <div class="property-section-header" onclick="app.togglePropertySection('audio')">
                    <span class="section-toggle-icon" id="audioToggle">▼</span>
                    🔊 音声
                </div>
                <div class="property-section-content" id="audioContent">
                    <div class="property-group">
                        <div class="property-label">音量: <span id="volumeValue">${(clip.volume * 100).toFixed(0)}%</span></div>
                        <input type="range" class="property-slider" value="${(clip.volume * 100).toFixed(0)}" 
                            min="0" max="100" step="1"
                            oninput="app.updateClipProperty('volume', parseFloat(this.value) / 100); document.getElementById('volumeValue').textContent = this.value + '%'">
                    </div>
                </div>
            `;
        }
        
        panel.innerHTML = propertiesHTML;
        
        // 保存された開閉状態を復元
        Object.keys(this.propertySectionStates).forEach(sectionName => {
            const content = document.getElementById(`${sectionName}Content`);
            const toggle = document.getElementById(`${sectionName}Toggle`);
            
            if (content && toggle) {
                const isOpen = this.propertySectionStates[sectionName];
                if (isOpen) {
                    content.classList.remove('collapsed');
                    toggle.classList.remove('collapsed');
                } else {
                    content.classList.add('collapsed');
                    toggle.classList.add('collapsed');
                }
            }
        });
        
        // AEプロパティの開閉状態を復元
        Object.keys(this.aePropertyStates).forEach(propertyName => {
            const content = document.getElementById(`${propertyName}Content`);
            const icon = document.getElementById(`${propertyName}Icon`);
            
            if (content && icon) {
                const isOpen = this.aePropertyStates[propertyName];
                if (isOpen) {
                    content.classList.remove('collapsed');
                    icon.classList.add('expanded');
                } else {
                    content.classList.add('collapsed');
                    icon.classList.remove('expanded');
                }
            }
        });
    }
    
    // トランジション更新
    updateTransition(direction, property, value) {
        if (!this.selectedClip) return;
        
        if (direction === 'in') {
            this.selectedClip.transitionIn[property] = value;
        } else {
            this.selectedClip.transitionOut[property] = value;
        }
        
        this.drawTimeline();
        this.updatePreview();
        this.saveHistory();
    }
    
    // プロパティセクションの折りたたみ
    togglePropertySection(header) {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.section-toggle-icon');
        
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            icon.textContent = '▼';
        } else {
            content.classList.add('collapsed');
            icon.textContent = '▶';
        }
    }
    
    updateClipProperty(property, value) {
        if (!this.selectedClip) return;
        
        // ループ回数を変更した場合、元の長さを保存
        if (property === 'loopCount') {
            // 初回の場合、現在の長さを元の長さとして保存
            if (!this.selectedClip.originalDuration) {
                this.selectedClip.originalDuration = this.selectedClip.duration;
            }
            
            this.selectedClip[property] = value;
            // クリップの長さをループ回数に合わせて変更
            this.selectedClip.duration = this.selectedClip.originalDuration * value;
            
            console.log('ループ回数変更:', value);
            console.log('元の長さ:', this.selectedClip.originalDuration);
            console.log('新しい長さ:', this.selectedClip.duration);
        } else {
            this.selectedClip[property] = value;
        }
        
        this.drawTimeline();
        this.updatePreview();
        this.saveHistory();
    }
    
    // キーフレーム管理
    getKeyframeValue(clip, property, localTime) {
        const keyframes = clip.keyframes[property];
        if (!keyframes || keyframes.length === 0) return 0;
        
        if (localTime <= keyframes[0].time) return keyframes[0].value;
        if (localTime >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;
        
        // 線形補間
        for (let i = 0; i < keyframes.length - 1; i++) {
            if (localTime >= keyframes[i].time && localTime <= keyframes[i + 1].time) {
                const t = (localTime - keyframes[i].time) / (keyframes[i + 1].time - keyframes[i].time);
                return keyframes[i].value + (keyframes[i + 1].value - keyframes[i].value) * t;
            }
        }
        
        return keyframes[0].value;
    }
    
    setKeyframeValue(property, value) {
        if (!this.selectedClip) return;
        
        const localTime = this.currentTime - this.selectedClip.startTime;
        const keyframes = this.selectedClip.keyframes[property];
        
        // 既存のキーフレームを更新または追加
        const existing = keyframes.find(kf => Math.abs(kf.time - localTime) < 0.05);
        if (existing) {
            existing.value = value;
        } else {
            keyframes.push({ time: localTime, value: value });
            keyframes.sort((a, b) => a.time - b.time);
        }
        
        this.updatePreview(); // リアルタイム更新
        this.drawTimeline();
        this.updatePropertiesPanel();
        this.saveHistory();
    }
    
    // ライブ更新用（履歴保存なし、プレビューのみ更新）
    setKeyframeValueLive(property, value) {
        if (!this.selectedClip) return;
        
        const localTime = this.currentTime - this.selectedClip.startTime;
        const keyframes = this.selectedClip.keyframes[property];
        
        // 既存のキーフレームを更新または追加
        const existing = keyframes.find(kf => Math.abs(kf.time - localTime) < 0.05);
        if (existing) {
            existing.value = value;
        } else {
            keyframes.push({ time: localTime, value: value });
            keyframes.sort((a, b) => a.time - b.time);
        }
        
        this.updatePreview(); // プレビューのみ更新
    }
    
    toggleKeyframe(property) {
        if (!this.selectedClip) return;
        
        const localTime = this.currentTime - this.selectedClip.startTime;
        const keyframes = this.selectedClip.keyframes[property];
        
        const existingIndex = keyframes.findIndex(kf => Math.abs(kf.time - localTime) < 0.05);
        
        if (existingIndex !== -1) {
            // 削除
            keyframes.splice(existingIndex, 1);
        } else {
            // 追加
            const currentValue = this.getKeyframeValue(this.selectedClip, property, localTime);
            keyframes.push({ time: localTime, value: currentValue });
            keyframes.sort((a, b) => a.time - b.time);
        }
        
        this.drawTimeline();
        this.updatePropertiesPanel();
        this.saveHistory();
    }
    
    hasKeyframeAt(clip, property, localTime) {
        const keyframes = clip.keyframes[property];
        return keyframes.some(kf => Math.abs(kf.time - localTime) < 0.05);
    }
    
    // プレビュー更新
    updatePreview() {
        const ctx = this.previewCtx;
        const width = this.previewCanvas.width;
        const height = this.previewCanvas.height;
        
        // 背景クリア
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        
        // アクティブなクリップを描画
        const activeClips = this.clips.filter(clip => 
            this.currentTime >= clip.startTime && 
            this.currentTime < clip.startTime + clip.duration
        ).sort((a, b) => a.track - b.track);
        
        // 範囲外の音声クリップを停止
        this.clips.forEach(clip => {
            if (clip.audioElement && !activeClips.includes(clip)) {
                if (!clip.audioElement.paused) {
                    clip.audioElement.pause();
                }
            }
        });
        
        activeClips.forEach(clip => {
            this.renderClip(clip);
        });
        
        // エフェクト適用
        this.applyEffects();
        
        // バウンディングボックスを描画（選択クリップがある場合）
        if (this.selectedClip && activeClips.includes(this.selectedClip)) {
            this.drawBoundingBox(this.selectedClip);
        }
    }
    
    async renderClip(clip) {
        const localTime = this.currentTime - clip.startTime;
        
        // ループ処理 - 継続時間内で素材を繰り返す
        let effectiveLocalTime = localTime;
        
        // 動画と連番画像のみループ処理を行う（画像と音声は除外）
        if ((clip.asset.type === 'video' || clip.asset.type === 'sequence') && clip.loopEnabled) {
            // 素材の実際の長さを取得
            let originalDuration;
            if (clip.asset.type === 'video' && clip.videoElement) {
                originalDuration = clip.videoElement.duration || 1;
            } else if (clip.asset.type === 'sequence') {
                const frameRate = clip.frameRate || 30;
                originalDuration = clip.asset.frameCount / frameRate;
            } else {
                originalDuration = clip.duration; // フォールバック
            }
            
            // trimStartを考慮したループ処理
            const trimStart = clip.trimStart || 0;
            const availableDuration = originalDuration - trimStart;
            
            // クリップ内での有効な再生位置を計算
            if (availableDuration > 0) {
                effectiveLocalTime = (localTime % availableDuration);
            }
        }
        
        // トランジション進行度を計算
        let transitionProgress = 1;
        
        // トランジションイン
        if (clip.transitionIn.type !== 'none' && localTime < clip.transitionIn.duration) {
            transitionProgress = localTime / clip.transitionIn.duration;
        }
        
        // トランジションアウト
        if (clip.transitionOut.type !== 'none' && localTime > clip.duration - clip.transitionOut.duration) {
            const timeInTransition = clip.duration - localTime;
            transitionProgress = timeInTransition / clip.transitionOut.duration;
        }
        
        const x = this.getKeyframeValue(clip, 'x', localTime);
        const y = this.getKeyframeValue(clip, 'y', localTime);
        const rotation = this.getKeyframeValue(clip, 'rotation', localTime);
        const opacity = this.getKeyframeValue(clip, 'opacity', localTime);
        const scale = this.getKeyframeValue(clip, 'scale', localTime);
        
        const ctx = this.previewCtx;
        
        // 音声クリップの場合は音声のみ再生
        if (clip.asset.type === 'audio') {
            this.playAudioClip(clip, effectiveLocalTime);
            return;
        }
        
        ctx.save();
        
        // トランジション効果を適用
        this.applyTransition(clip, localTime, transitionProgress);
        
        // 中心を基準に変形（キャンバスの実際のサイズを使用）
        ctx.translate(this.previewCanvas.width / 2 + x, this.previewCanvas.height / 2 + y);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.scale(scale, scale);
        ctx.globalAlpha = opacity * transitionProgress;
        
        // 素材を描画
        if (clip.asset.type === 'image') {
            await this.drawImage(clip);
        } else if (clip.asset.type === 'video') {
            await this.drawVideo(clip, effectiveLocalTime);
            this.playAudioClip(clip, effectiveLocalTime);
        } else if (clip.asset.type === 'sequence') {
            await this.drawSequence(clip, effectiveLocalTime);
        }
        
        ctx.restore();
    }
    
    // 連番アニメーションを描画
    async drawSequence(clip, localTime) {
        const frameRate = clip.frameRate || 30;
        
        // trimStartを考慮した実際の時間を計算
        const actualTime = localTime + (clip.trimStart || 0);
        const frameIndex = Math.floor(actualTime * frameRate) % clip.asset.frameCount;
        
        return new Promise((resolve) => {
            if (!clip.sequenceImages) {
                clip.sequenceImages = [];
                clip.asset.urls.forEach((url, idx) => {
                    const img = new Image();
                    img.src = url;
                    clip.sequenceImages[idx] = img;
                });
            }
            
            const img = clip.sequenceImages[frameIndex];
            if (img && img.complete) {
                this.drawSequenceFrame(clip, img);
            }
            resolve();
        });
    }
    
    drawSequenceFrame(clip, img) {
        const ctx = this.previewCtx;
        
        // 画像が完全に読み込まれているか確認
        if (!img || !img.complete || img.width === 0 || img.height === 0) {
            return; // 読み込み中は何も描画しない
        }
        
        let drawWidth, drawHeight;
        
        if (clip.useOriginalSize && img.width && img.height) {
            drawWidth = img.width;
            drawHeight = img.height;
        } else {
            const aspectRatio = img.width / img.height;
            const maxWidth = this.previewCanvas.width; // 1920
            const maxHeight = this.previewCanvas.height; // 1080
            
            drawWidth = maxWidth;
            drawHeight = maxWidth / aspectRatio;
            
            if (drawHeight > maxHeight) {
                drawHeight = maxHeight;
                drawWidth = maxHeight * aspectRatio;
            }
        }
        
        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    }
    
    // トランジション効果を適用
    applyTransition(clip, localTime, progress) {
        const ctx = this.previewCtx;
        // キャンバスの実際のサイズを使用
        const width = this.previewCanvas.width;
        const height = this.previewCanvas.height;
        
        let transitionType = 'none';
        
        // トランジションイン
        if (clip.transitionIn.type !== 'none' && localTime < clip.transitionIn.duration) {
            transitionType = clip.transitionIn.type;
        }
        
        // トランジションアウト
        if (clip.transitionOut.type !== 'none' && localTime > clip.duration - clip.transitionOut.duration) {
            transitionType = clip.transitionOut.type;
        }
        
        if (transitionType === 'none') return;
        
        ctx.save();
        
        switch (transitionType) {
            case 'fade':
            case 'dissolve':
                // フェード/ディゾルブは不透明度で処理済み
                break;
                
            case 'wipe_left':
                ctx.beginPath();
                ctx.rect(0, 0, width * progress, height);
                ctx.clip();
                break;
                
            case 'wipe_right':
                ctx.beginPath();
                ctx.rect(width * (1 - progress), 0, width * progress, height);
                ctx.clip();
                break;
                
            case 'wipe_up':
                ctx.beginPath();
                ctx.rect(0, 0, width, height * progress);
                ctx.clip();
                break;
                
            case 'wipe_down':
                ctx.beginPath();
                ctx.rect(0, height * (1 - progress), width, height * progress);
                ctx.clip();
                break;
                
            case 'slide_left':
                ctx.translate(-width * (1 - progress), 0);
                break;
                
            case 'slide_right':
                ctx.translate(width * (1 - progress), 0);
                break;
        }
        
        ctx.restore();
    }
    
    // 音声クリップ再生
    playAudioClip(clip, localTime) {
        if (!clip.audioElement) return;
        
        // trimStartを考慮した実際の再生位置を計算
        const actualTime = localTime + (clip.trimStart || 0);
        
        // クリップのdurationを超えている場合は停止
        if (localTime >= clip.duration || localTime < 0) {
            if (!clip.audioElement.paused) {
                clip.audioElement.pause();
            }
            return;
        }
        
        if (this.isPlaying) {
            if (clip.audioElement.paused) {
                clip.audioElement.currentTime = actualTime;
                clip.audioElement.volume = clip.volume || 1.0;
                clip.audioElement.play().catch(e => console.log('Audio play error:', e));
            }
        } else {
            if (!clip.audioElement.paused) {
                clip.audioElement.pause();
            }
        }
    }
    
    async drawImage(clip) {
        return new Promise((resolve) => {
            if (!clip.imageElement) {
                clip.imageElement = new Image();
                clip.imageElement.onload = () => {
                    this.drawImageOnCanvas(clip);
                    this.updatePreview(); // 読み込み完了後に再描画
                    resolve();
                };
                clip.imageElement.onerror = () => {
                    console.error('画像読み込みエラー:', clip.asset.name);
                    resolve();
                };
                clip.imageElement.src = clip.asset.url;
            } else if (clip.imageElement.complete) {
                this.drawImageOnCanvas(clip);
                resolve();
            } else {
                // 読み込み中の場合は待つ
                clip.imageElement.onload = () => {
                    this.drawImageOnCanvas(clip);
                    this.updatePreview();
                    resolve();
                };
            }
        });
    }
    
    drawImageOnCanvas(clip) {
        const img = clip.imageElement;
        const ctx = this.previewCtx;
        
        // 画像が完全に読み込まれているか確認
        if (!img || !img.complete || img.width === 0 || img.height === 0) {
            return; // 読み込み中は何も描画しない
        }
        
        let drawWidth, drawHeight;
        
        if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
            // 原寸表示
            drawWidth = clip.originalWidth;
            drawHeight = clip.originalHeight;
        } else {
            // アスペクト比を維持してフィット(キャンバスの実際のサイズに合わせる)
            const aspectRatio = img.width / img.height;
            const maxWidth = this.previewCanvas.width; // 1920
            const maxHeight = this.previewCanvas.height; // 1080
            
            drawWidth = maxWidth;
            drawHeight = maxWidth / aspectRatio;
            
            if (drawHeight > maxHeight) {
                drawHeight = maxHeight;
                drawWidth = maxHeight * aspectRatio;
            }
        }
        
        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    }
    
    async drawVideo(clip, localTime) {
        return new Promise((resolve) => {
            // trimStartを考慮した実際の再生位置を計算
            const actualTime = localTime + (clip.trimStart || 0);
            
            if (!clip.videoElement) {
                clip.videoElement = document.createElement('video');
                clip.videoElement.src = clip.asset.url;
                clip.videoElement.muted = true;
                clip.videoElement.preload = 'auto';
                clip.videoElement.crossOrigin = 'anonymous'; // CORS対応
                
                // MOVファイルなど、ブラウザがネイティブサポートしていないコーデックのための追加設定
                // ※ブラウザによっては H.264/AAC の MOV をサポート
                clip.videoElement.setAttribute('playsinline', 'true');
                
                // シーク中フラグを初期化
                clip.videoElement._isSeeking = false;
                
                clip.videoElement.onloadeddata = () => {
                    clip.videoElement.currentTime = actualTime;
                    clip.videoElement._isSeeking = true;
                };
                
                // シーク完了時に描画
                clip.videoElement.onseeked = () => {
                    clip.videoElement._isSeeking = false;
                    if (clip.videoElement.readyState >= 2) {
                        this.drawVideoOnCanvas(clip);
                    }
                    resolve();
                };
                
                // エラーハンドリング追加（MOVが読み込めない場合のログ）
                clip.videoElement.onerror = (e) => {
                    console.error('動画読み込みエラー:', clip.asset.name, e);
                    console.warn('MOVファイルはブラウザのコーデックサポートに依存します。H.264/AAC形式のMOVを推奨します。');
                    resolve();
                };
                
                // タイムアウト処理
                setTimeout(() => resolve(), 100);
            } else {
                // シーク中は処理をスキップ（点滅防止）
                if (clip.videoElement._isSeeking) {
                    resolve();
                    return;
                }
                
                // currentTimeを更新（閾値を0.1秒に設定して頻繁なシークを防止）
                const timeDiff = Math.abs(clip.videoElement.currentTime - actualTime);
                if (timeDiff > 0.1) {
                    clip.videoElement._isSeeking = true;
                    clip.videoElement.currentTime = actualTime;
                    
                    // シーク完了を待つ
                    const onSeeked = () => {
                        clip.videoElement._isSeeking = false;
                        if (clip.videoElement.readyState >= 2) {
                            this.drawVideoOnCanvas(clip);
                        }
                        clip.videoElement.removeEventListener('seeked', onSeeked);
                        resolve();
                    };
                    clip.videoElement.addEventListener('seeked', onSeeked);
                    
                    // タイムアウト（シークが完了しない場合）
                    setTimeout(() => {
                        clip.videoElement._isSeeking = false;
                        clip.videoElement.removeEventListener('seeked', onSeeked);
                        resolve();
                    }, 100);
                } else {
                    // readyStateが準備できていれば即座に描画
                    if (clip.videoElement.readyState >= 2) {
                        this.drawVideoOnCanvas(clip);
                    }
                    resolve();
                }
            }
        });
    }
    
    drawVideoOnCanvas(clip) {
        const video = clip.videoElement;
        const ctx = this.previewCtx;
        
        // 動画が十分に読み込まれているかチェック
        // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
        if (!video || video.readyState < 2) {
            return; // 準備できていなければ何も描画しない
        }
        
        let drawWidth, drawHeight;
        
        if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
            // 原寸表示
            drawWidth = clip.originalWidth;
            drawHeight = clip.originalHeight;
        } else {
            // アスペクト比を維持してフィット(キャンバスの実際のサイズに合わせる)
            const aspectRatio = video.videoWidth / video.videoHeight;
            
            if (!aspectRatio || !isFinite(aspectRatio)) {
                return; // アスペクト比が不正なら描画しない
            }
            
            const maxWidth = this.previewCanvas.width; // 1920
            const maxHeight = this.previewCanvas.height; // 1080
            
            drawWidth = maxWidth;
            drawHeight = maxWidth / aspectRatio;
            
            if (drawHeight > maxHeight) {
                drawHeight = maxHeight;
                drawWidth = maxHeight * aspectRatio;
            }
        }
        
        // 中央に描画（画像と同じ処理）
        ctx.drawImage(video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    }
    
    applyEffects() {
        const ctx = this.previewCtx;
        // キャンバスの実際のサイズを取得（HTML属性のwidth/height）
        const width = this.previewCanvas.width;   // 1920
        const height = this.previewCanvas.height; // 1080
        
        // 座標変換を完全にリセット（重要！）
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // グラデーション（先に描画 = レターボックスの下）
        if (this.effects.gradient.enabled) {
            // 上部グラデーション
            if (this.effects.gradient.top.height > 0) {
                // 上部専用のブレンドモード設定
                ctx.globalCompositeOperation = this.effects.gradient.top.blendMode;
                
                const topGradient = ctx.createLinearGradient(0, 0, 0, this.effects.gradient.top.height);
                const topOpacity = this.effects.gradient.top.opacity / 100;
                const topColor = this.hexToRgba(this.effects.gradient.top.color, topOpacity);
                const topTransparent = this.hexToRgba(this.effects.gradient.top.color, 0);
                
                topGradient.addColorStop(0, topColor);
                topGradient.addColorStop(1, topTransparent);
                
                ctx.fillStyle = topGradient;
                ctx.fillRect(0, 0, width, this.effects.gradient.top.height);
                
                // ブレンドモードをリセット
                ctx.globalCompositeOperation = 'source-over';
            }
            
            // 下部グラデーション
            if (this.effects.gradient.bottom.height > 0) {
                // 下部専用のブレンドモード設定
                ctx.globalCompositeOperation = this.effects.gradient.bottom.blendMode;
                
                const bottomGradient = ctx.createLinearGradient(
                    0, 
                    height - this.effects.gradient.bottom.height, 
                    0, 
                    height
                );
                const bottomOpacity = this.effects.gradient.bottom.opacity / 100;
                const bottomTransparent = this.hexToRgba(this.effects.gradient.bottom.color, 0);
                const bottomColor = this.hexToRgba(this.effects.gradient.bottom.color, bottomOpacity);
                
                bottomGradient.addColorStop(0, bottomTransparent);
                bottomGradient.addColorStop(1, bottomColor);
                
                ctx.fillStyle = bottomGradient;
                ctx.fillRect(0, height - this.effects.gradient.bottom.height, width, this.effects.gradient.bottom.height);
                
                // ブレンドモードをリセット
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        
        // レターボックス（後に描画 = グラデーションの上）
        if (this.effects.letterbox.enabled) {
            ctx.fillStyle = this.effects.letterbox.color;
            // 上部のレターボックス
            ctx.fillRect(0, 0, width, this.effects.letterbox.height);
            // 下部のレターボックス
            ctx.fillRect(0, height - this.effects.letterbox.height, width, this.effects.letterbox.height);
        }
        
        // ノーマライズ(スムージング)エフェクト（ディフュージョンより先に適用）
        if (this.effects.normalize.enabled) {
            this.applyNormalizeEffect(ctx, width, height);
        }
        
        // ディフュージョン撮影エフェクト
        if (this.effects.diffusion.enabled) {
            this.applyDiffusionEffect(ctx, width, height);
        }
        
        // カラーキーエフェクト（最後に適用して透過処理）
        if (this.effects.colorKey.enabled) {
            this.applyColorKeyEffect(ctx, width, height);
        }
    }
    
    // ディフュージョン撮影エフェクトの適用
    applyDiffusionEffect(ctx, width, height) {
        // 現在時刻のパラメータを取得（キーフレーム補間）
        const params = this.getDiffusionParamsAtTime(this.currentTime);
        
        // 元の画像データを保存（不透明度調整用）
        const originalImageData = ctx.getImageData(0, 0, width, height);
        
        // エフェクト適用用の画像データを取得
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // パラメータを適用
        // 1. ブラー効果（簡易実装: ぼかし半径に応じてピクセルを平均化）
        if (params.blur > 0) {
            this.applySimpleBlur(imageData, width, height, params.blur);
        }
        
        // 2. 明るさ、コントラスト、彩度調整
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // 明るさ調整 (-100 to 100)
            if (params.brightness !== 0) {
                const brightnessFactor = params.brightness * 2.55; // -255 to 255
                r = Math.max(0, Math.min(255, r + brightnessFactor));
                g = Math.max(0, Math.min(255, g + brightnessFactor));
                b = Math.max(0, Math.min(255, b + brightnessFactor));
            }
            
            // コントラスト調整 (-100 to 100)
            if (params.contrast !== 0) {
                const contrastFactor = (100 + params.contrast) / 100;
                r = Math.max(0, Math.min(255, ((r - 128) * contrastFactor) + 128));
                g = Math.max(0, Math.min(255, ((g - 128) * contrastFactor) + 128));
                b = Math.max(0, Math.min(255, ((b - 128) * contrastFactor) + 128));
            }
            
            // 彩度調整 (-100 to 100)
            if (params.saturation !== 0) {
                const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
                const saturationFactor = (100 + params.saturation) / 100;
                r = Math.max(0, Math.min(255, gray + (r - gray) * saturationFactor));
                g = Math.max(0, Math.min(255, gray + (g - gray) * saturationFactor));
                b = Math.max(0, Math.min(255, gray + (b - gray) * saturationFactor));
            }
            
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
        }
        
        // 3. 不透明度調整（元画像とエフェクト適用画像をブレンド）
        if (params.opacity < 100) {
            const opacityFactor = params.opacity / 100;
            const originalData = originalImageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // エフェクト適用画像と元画像をブレンド
                data[i] = originalData[i] * (1 - opacityFactor) + data[i] * opacityFactor;
                data[i + 1] = originalData[i + 1] * (1 - opacityFactor) + data[i + 1] * opacityFactor;
                data[i + 2] = originalData[i + 2] * (1 - opacityFactor) + data[i + 2] * opacityFactor;
                // アルファチャンネルはそのまま
            }
        }
        
        // 画像データを戻す
        ctx.putImageData(imageData, 0, 0);
    }
    
    // ガウシアンブラー実装（滑らかでふんわりとしたぼかし）
    applySimpleBlur(imageData, width, height, blurRadius) {
        const data = imageData.data;
        
        // ブラー半径を0-300から0-20ピクセル程度に変換
        let radius = Math.floor(blurRadius / 15);
        if (radius < 1) return;
        
        // 半径が大きすぎる場合は制限（パフォーマンス考慮）
        radius = Math.min(radius, 20);
        
        // ガウシアンカーネルを生成
        const kernel = this.generateGaussianKernel(radius);
        const kernelSize = kernel.length;
        const halfKernel = Math.floor(kernelSize / 2);
        
        const tempData = new Uint8ClampedArray(data);
        
        // 水平方向のガウシアンブラー
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0, totalWeight = 0;
                
                for (let i = 0; i < kernelSize; i++) {
                    const px = x + i - halfKernel;
                    if (px >= 0 && px < width) {
                        const idx = (y * width + px) * 4;
                        const weight = kernel[i];
                        r += tempData[idx] * weight;
                        g += tempData[idx + 1] * weight;
                        b += tempData[idx + 2] * weight;
                        a += tempData[idx + 3] * weight;
                        totalWeight += weight;
                    }
                }
                
                const idx = (y * width + x) * 4;
                data[idx] = r / totalWeight;
                data[idx + 1] = g / totalWeight;
                data[idx + 2] = b / totalWeight;
                data[idx + 3] = a / totalWeight;
            }
        }
        
        // 垂直方向のガウシアンブラー
        tempData.set(data);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0, totalWeight = 0;
                
                for (let i = 0; i < kernelSize; i++) {
                    const py = y + i - halfKernel;
                    if (py >= 0 && py < height) {
                        const idx = (py * width + x) * 4;
                        const weight = kernel[i];
                        r += tempData[idx] * weight;
                        g += tempData[idx + 1] * weight;
                        b += tempData[idx + 2] * weight;
                        a += tempData[idx + 3] * weight;
                        totalWeight += weight;
                    }
                }
                
                const idx = (y * width + x) * 4;
                data[idx] = r / totalWeight;
                data[idx + 1] = g / totalWeight;
                data[idx + 2] = b / totalWeight;
                data[idx + 3] = a / totalWeight;
            }
        }
    }
    
    // ガウシアンカーネルを生成
    generateGaussianKernel(radius) {
        // カーネルサイズ = 半径 × 2 + 1
        const size = radius * 2 + 1;
        const kernel = new Array(size);
        
        // 標準偏差（シグマ）は半径の1/3が一般的
        const sigma = radius / 3;
        const twoSigmaSquare = 2 * sigma * sigma;
        const sigmaRoot = Math.sqrt(twoSigmaSquare * Math.PI);
        
        let sum = 0;
        
        // ガウス分布の値を計算
        for (let i = 0; i < size; i++) {
            const x = i - radius;
            kernel[i] = Math.exp(-(x * x) / twoSigmaSquare) / sigmaRoot;
            sum += kernel[i];
        }
        
        // 正規化（合計が1になるように）
        for (let i = 0; i < size; i++) {
            kernel[i] /= sum;
        }
        
        return kernel;
    }
    
    // カラーキーエフェクトの適用
    applyColorKeyEffect(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // キー色をRGBに変換
        const keyColor = this.hexToRgb(this.effects.colorKey.color);
        const tolerance = this.effects.colorKey.tolerance;
        const invert = this.effects.colorKey.invert;
        const feather = this.effects.colorKey.feather;
        
        // 各ピクセルを処理
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // 色の距離を計算（ユークリッド距離）
            const distance = Math.sqrt(
                Math.pow(r - keyColor.r, 2) +
                Math.pow(g - keyColor.g, 2) +
                Math.pow(b - keyColor.b, 2)
            );
            
            // 最大距離（RGB空間での対角線）
            const maxDistance = Math.sqrt(255 * 255 * 3);
            
            // 正規化された距離（0-100）
            const normalizedDistance = (distance / maxDistance) * 100;
            
            // 許容値との比較
            let alpha = 255;
            
            if (normalizedDistance <= tolerance) {
                // キー色の範囲内
                if (feather > 0 && normalizedDistance > tolerance - feather) {
                    // フェザー範囲内 - グラデーション
                    const featherFactor = (normalizedDistance - (tolerance - feather)) / feather;
                    alpha = invert ? featherFactor * 255 : (1 - featherFactor) * 255;
                } else {
                    // 完全にキー色
                    alpha = invert ? 0 : 255;
                }
            } else {
                // キー色の範囲外
                alpha = invert ? 255 : 0;
            }
            
            data[i + 3] = alpha;
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    // ノーマライズ(スムージング)エフェクトの適用
    applyNormalizeEffect(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const tempData = new Uint8ClampedArray(data);
        
        const strength = Math.max(1, Math.min(3, this.effects.normalize.strength));
        
        // スムージング処理（強度に応じて複数回適用）
        for (let pass = 0; pass < strength; pass++) {
            tempData.set(data);
            
            // 各ピクセルを処理（エッジ部分のみスムージング）
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    
                    // 現在のピクセル
                    const r = tempData[idx];
                    const g = tempData[idx + 1];
                    const b = tempData[idx + 2];
                    
                    // 周囲8ピクセルの平均を計算
                    let sumR = 0, sumG = 0, sumB = 0;
                    let count = 0;
                    
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            
                            const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
                            const nr = tempData[neighborIdx];
                            const ng = tempData[neighborIdx + 1];
                            const nb = tempData[neighborIdx + 2];
                            
                            // 色の差が大きい場合のみ（エッジ検出）
                            const diff = Math.abs(r - nr) + Math.abs(g - ng) + Math.abs(b - nb);
                            
                            if (diff > 30) {  // エッジ閾値
                                sumR += nr;
                                sumG += ng;
                                sumB += nb;
                                count++;
                            }
                        }
                    }
                    
                    // エッジが検出された場合のみスムージング
                    if (count > 0) {
                        const avgR = sumR / count;
                        const avgG = sumG / count;
                        const avgB = sumB / count;
                        
                        // 元の色と平均をブレンド（50%）
                        data[idx] = (r + avgR) / 2;
                        data[idx + 1] = (g + avgG) / 2;
                        data[idx + 2] = (b + avgB) / 2;
                    }
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    // HEXカラーをRGBに変換
    hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }
    
    // 現在時刻におけるディフュージョンパラメータを取得（キーフレーム補間）
    getDiffusionParamsAtTime(time) {
        const keyframes = this.effects.diffusion.keyframes;
        
        // キーフレームが無い場合はデフォルト値を返す
        if (!keyframes || keyframes.length === 0) {
            return {
                blur: this.effects.diffusion.blur,
                contrast: this.effects.diffusion.contrast,
                brightness: this.effects.diffusion.brightness,
                saturation: this.effects.diffusion.saturation,
                opacity: this.effects.diffusion.opacity
            };
        }
        
        // キーフレームを時刻順にソート
        const sortedKeyframes = [...keyframes].sort((a, b) => a.time - b.time);
        
        // 現在時刻より前のキーフレームと後のキーフレームを見つける
        let beforeKf = null;
        let afterKf = null;
        
        for (let i = 0; i < sortedKeyframes.length; i++) {
            if (sortedKeyframes[i].time <= time) {
                beforeKf = sortedKeyframes[i];
            }
            if (sortedKeyframes[i].time > time && !afterKf) {
                afterKf = sortedKeyframes[i];
                break;
            }
        }
        
        // 補間なし（キーフレームが1つ以下、または範囲外）
        if (!beforeKf && !afterKf) {
            return {
                blur: this.effects.diffusion.blur,
                contrast: this.effects.diffusion.contrast,
                brightness: this.effects.diffusion.brightness,
                saturation: this.effects.diffusion.saturation,
                opacity: this.effects.diffusion.opacity
            };
        }
        
        if (beforeKf && !afterKf) {
            // 最後のキーフレーム以降
            return {
                blur: beforeKf.blur,
                contrast: beforeKf.contrast,
                brightness: beforeKf.brightness,
                saturation: beforeKf.saturation,
                opacity: beforeKf.opacity
            };
        }
        
        if (!beforeKf && afterKf) {
            // 最初のキーフレームより前
            return {
                blur: afterKf.blur,
                contrast: afterKf.contrast,
                brightness: afterKf.brightness,
                saturation: afterKf.saturation,
                opacity: afterKf.opacity
            };
        }
        
        // 線形補間
        const t = (time - beforeKf.time) / (afterKf.time - beforeKf.time);
        return {
            blur: beforeKf.blur + (afterKf.blur - beforeKf.blur) * t,
            contrast: beforeKf.contrast + (afterKf.contrast - beforeKf.contrast) * t,
            brightness: beforeKf.brightness + (afterKf.brightness - beforeKf.brightness) * t,
            saturation: beforeKf.saturation + (afterKf.saturation - beforeKf.saturation) * t,
            opacity: beforeKf.opacity + (afterKf.opacity - beforeKf.opacity) * t
        };
    }
    
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    // FFmpeg.wasmの初期化
    async loadFFmpeg() {
        if (this.ffmpegLoaded) return;
        
        try {
            const { FFmpeg } = FFmpegWASM;
            const { toBlobURL } = FFmpegUtil;
            
            this.ffmpeg = new FFmpeg();
            
            // jsdelivr CDN を使用（CORS対応）
            const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
            
            this.ffmpeg.on('log', ({ message }) => {
                console.log('[FFmpeg]', message);
            });
            
            // CORSエラーを回避するため、toBlobURLを使わずに直接読み込み
            await this.ffmpeg.load({
                coreURL: `${baseURL}/ffmpeg-core.js`,
                wasmURL: `${baseURL}/ffmpeg-core.wasm`,
            });
            
            this.ffmpegLoaded = true;
            console.log('✅ FFmpeg loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load FFmpeg:', error);
            throw error;
        }
    }
    
    // バウンディングボックスを描画
    drawBoundingBox(clip) {
        const ctx = this.previewCtx;
        const localTime = this.currentTime - clip.startTime;
        
        // クリップの現在の変形値を取得
        const x = this.getKeyframeValue(clip, 'x', localTime);
        const y = this.getKeyframeValue(clip, 'y', localTime);
        const rotation = this.getKeyframeValue(clip, 'rotation', localTime);
        const scale = this.getKeyframeValue(clip, 'scale', localTime);
        
        // クリップのサイズを取得(キャンバスの実際のサイズに合わせる)
        let clipWidth = this.previewCanvas.width; // 1920
        let clipHeight = this.previewCanvas.height; // 1080
        
        if (clip.asset.type === 'image' && clip.imageElement) {
            if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
                clipWidth = clip.originalWidth;
                clipHeight = clip.originalHeight;
            } else if (clip.imageElement.complete && clip.imageElement.width > 0 && clip.imageElement.height > 0) {
                const aspectRatio = clip.imageElement.width / clip.imageElement.height;
                clipWidth = this.previewCanvas.width;
                clipHeight = this.previewCanvas.width / aspectRatio;
                if (clipHeight > this.previewCanvas.height) {
                    clipHeight = this.previewCanvas.height;
                    clipWidth = this.previewCanvas.height * aspectRatio;
                }
            }
        } else if (clip.asset.type === 'video' && clip.videoElement) {
            if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
                clipWidth = clip.originalWidth;
                clipHeight = clip.originalHeight;
            } else if (clip.videoElement.readyState >= 2 && clip.videoElement.videoWidth > 0 && clip.videoElement.videoHeight > 0) {
                const aspectRatio = clip.videoElement.videoWidth / clip.videoElement.videoHeight;
                clipWidth = this.previewCanvas.width;
                clipHeight = this.previewCanvas.width / aspectRatio;
                if (clipHeight > this.previewCanvas.height) {
                    clipHeight = this.previewCanvas.height;
                    clipWidth = this.previewCanvas.height * aspectRatio;
                }
            }
        } else if (clip.asset.type === 'sequence' && clip.sequenceImages && clip.sequenceImages.length > 0) {
            const img = clip.sequenceImages[0];
            if (img && img.complete && img.width > 0 && img.height > 0) {
                if (clip.useOriginalSize && img.width && img.height) {
                    clipWidth = img.width;
                    clipHeight = img.height;
                } else {
                    const aspectRatio = img.width / img.height;
                    clipWidth = this.previewCanvas.width;
                    clipHeight = this.previewCanvas.width / aspectRatio;
                    if (clipHeight > this.previewCanvas.height) {
                        clipHeight = this.previewCanvas.height;
                        clipWidth = this.previewCanvas.height * aspectRatio;
                    }
                }
            }
        }
        
        // スケール適用
        const scaledWidth = clipWidth * scale;
        const scaledHeight = clipHeight * scale;
        
        ctx.save();
        
        // キャンバス中心を基準に変形を適用
        const centerX = this.previewCanvas.width / 2 + x;
        const centerY = this.previewCanvas.height / 2 + y;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation * Math.PI / 180);
        
        // バウンディングボックスを描画
        ctx.strokeStyle = '#00D9FF'; // 明るい青色
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(-scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        ctx.setLineDash([]);
        
        // ハンドルを描画
        const handleSize = 10;
        const handles = [
            { x: -scaledWidth / 2, y: -scaledHeight / 2, type: 'corner-tl' }, // 左上
            { x: scaledWidth / 2, y: -scaledHeight / 2, type: 'corner-tr' },  // 右上
            { x: scaledWidth / 2, y: scaledHeight / 2, type: 'corner-br' },   // 右下
            { x: -scaledWidth / 2, y: scaledHeight / 2, type: 'corner-bl' },  // 左下
            { x: 0, y: -scaledHeight / 2, type: 'edge-t' },                   // 上
            { x: scaledWidth / 2, y: 0, type: 'edge-r' },                     // 右
            { x: 0, y: scaledHeight / 2, type: 'edge-b' },                    // 下
            { x: -scaledWidth / 2, y: 0, type: 'edge-l' }                     // 左
        ];
        
        ctx.fillStyle = '#00D9FF';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        
        handles.forEach(handle => {
            ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
        });
        
        // 回転ハンドル（上部中央から少し離れた位置）
        const rotateHandleDistance = 30;
        const rotateX = 0;
        const rotateY = -scaledHeight / 2 - rotateHandleDistance;
        
        // 回転ハンドルへの線
        ctx.strokeStyle = '#00D9FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -scaledHeight / 2);
        ctx.lineTo(rotateX, rotateY);
        ctx.stroke();
        
        // 回転ハンドル（円形）
        ctx.fillStyle = '#00D9FF';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rotateX, rotateY, handleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
        
        // バウンディングボックス情報をキャッシュ（マウス操作で使用）
        this.boundingBoxCache = {
            centerX, centerY, rotation, scale,
            scaledWidth, scaledHeight,
            handles: handles.map(h => ({
                ...h,
                screenX: centerX + Math.cos(rotation * Math.PI / 180) * h.x - Math.sin(rotation * Math.PI / 180) * h.y,
                screenY: centerY + Math.sin(rotation * Math.PI / 180) * h.x + Math.cos(rotation * Math.PI / 180) * h.y
            })),
            rotateHandle: {
                type: 'rotate',
                screenX: centerX + Math.cos(rotation * Math.PI / 180) * rotateX - Math.sin(rotation * Math.PI / 180) * rotateY,
                screenY: centerY + Math.sin(rotation * Math.PI / 180) * rotateX + Math.cos(rotation * Math.PI / 180) * rotateY
            }
        };
    }
    
    // 再生コントロール
    play() {
        if (this.isPlaying) {
            this.pause();
            return;
        }
        
        // ループ再生チェックボックスの状態を取得
        this.loopPlayback = document.getElementById('loopPlaybackCheckbox').checked;
        
        this.isPlaying = true;
        const playButton = document.getElementById('playButton');
        playButton.innerHTML = '<img src="pause.png" alt="一時停止" class="button-icon">';
        playButton.title = '一時停止';
        
        const frameInterval = 1 / this.fps; // 1フレームあたりの秒数
        let lastFrameTime = performance.now();
        let accumulatedTime = 0;
        
        const playbackLoop = () => {
            if (!this.isPlaying) return;
            
            const now = performance.now();
            const deltaTime = (now - lastFrameTime) / 1000; // 経過時間（秒）
            lastFrameTime = now;
            
            accumulatedTime += deltaTime;
            
            // フレーム単位で進める
            if (accumulatedTime >= frameInterval) {
                const framesToAdvance = Math.floor(accumulatedTime / frameInterval);
                this.currentTime += framesToAdvance * frameInterval;
                accumulatedTime -= framesToAdvance * frameInterval;
                
                if (this.currentTime >= this.duration) {
                    if (this.loopPlayback) {
                        // ループ再生の場合は最初に戻る
                        this.currentTime = 0;
                        accumulatedTime = 0;
                    } else {
                        // ループしない場合は停止
                        this.stop();
                        return;
                    }
                }
                
                this.updateTimeDisplay();
                this.updatePreview();
                this.drawTimeline();
            }
            
            this.playbackAnimationFrame = requestAnimationFrame(playbackLoop);
        };
        
        this.playbackAnimationFrame = requestAnimationFrame(playbackLoop);
    }
    
    pause() {
        this.isPlaying = false;
        const playButton = document.getElementById('playButton');
        playButton.innerHTML = '<img src="play.png" alt="再生" class="button-icon">';
        playButton.title = '再生';
        
        if (this.playbackAnimationFrame) {
            cancelAnimationFrame(this.playbackAnimationFrame);
            this.playbackAnimationFrame = null;
        }
    }
    
    stop() {
        this.pause();
        this.currentTime = 0;
        
        // すべての音声を停止
        this.clips.forEach(clip => {
            if (clip.audioElement && !clip.audioElement.paused) {
                clip.audioElement.pause();
                clip.audioElement.currentTime = 0;
            }
        });
        
        this.updateTimeDisplay();
        this.updatePreview();
        this.drawTimeline();
    }
    
    updateTimeDisplay() {
        const totalSeconds = Math.floor(this.currentTime);
        const milliseconds = Math.floor((this.currentTime % 1) * 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
        document.getElementById('timeDisplay').textContent = timeStr;
    }
    
    // UI操作
    changeFPS(newFPS) {
        this.fps = parseInt(newFPS);
        console.log(`📹 FPSを${this.fps}に変更しました`);
        
        // 再生中の場合、フレームレートの変更を反映
        if (this.isPlaying) {
            this.pause();
            this.play();
        }
        
        this.showNotification(`📹 FPS: ${this.fps}`);
    }
    
    increaseTrackCount() {
        this.trackCount++;
        document.getElementById('trackCount').textContent = this.trackCount;
        this.updateTimelineSize();
        this.drawTimeline();
    }
    
    decreaseTrackCount() {
        if (this.trackCount > 1) {
            this.trackCount--;
            document.getElementById('trackCount').textContent = this.trackCount;
            this.updateTimelineSize();
            this.drawTimeline();
        }
    }
    
    deleteSelected() {
        if (!this.selectedClip) return;
        
        const index = this.clips.indexOf(this.selectedClip);
        if (index !== -1) {
            this.clips.splice(index, 1);
            this.selectedClip = null;
            this.updatePropertiesPanel();
            this.drawTimeline();
            this.updatePreview();
            this.saveHistory();
        }
    }
    
    togglePropertySection(sectionName) {
        const content = document.getElementById(`${sectionName}Content`);
        const toggle = document.getElementById(`${sectionName}Toggle`);
        
        if (content && toggle) {
            content.classList.toggle('collapsed');
            toggle.classList.toggle('collapsed');
            
            // 状態を保存
            this.propertySectionStates[sectionName] = !content.classList.contains('collapsed');
        }
    }
    
    toggleAEProperty(propertyName) {
        const content = document.getElementById(`${propertyName}Content`);
        const icon = document.getElementById(`${propertyName}Icon`);
        
        if (content && icon) {
            content.classList.toggle('collapsed');
            icon.classList.toggle('expanded');
            
            // 状態を保存
            this.aePropertyStates[propertyName] = !content.classList.contains('collapsed');
        }
    }
    
    toggleEffect(effectName) {
        const controls = document.getElementById(`${effectName}Controls`);
        if (controls.classList.contains('active')) {
            controls.classList.remove('active');
        } else {
            controls.classList.add('active');
        }
    }
    
    setExportRangeToAll() {
        document.getElementById('exportStart').value = 0;
        
        let maxEnd = 10;
        this.clips.forEach(clip => {
            const end = clip.startTime + clip.duration;
            if (end > maxEnd) maxEnd = end;
        });
        
        document.getElementById('exportEnd').value = maxEnd.toFixed(1);
    }
    
    setExportRangeToSelection() {
        if (!this.selectedClip) {
            alert('クリップを選択してください');
            return;
        }
        
        document.getElementById('exportStart').value = this.selectedClip.startTime.toFixed(2);
        document.getElementById('exportEnd').value = (this.selectedClip.startTime + this.selectedClip.duration).toFixed(2);
    }
    
    // キーボードショートカット
    handleKeyDown(e) {
        // Ctrl/Cmd判定（MacとWindowsの両対応）
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdKey = isMac ? e.metaKey : e.ctrlKey;
        
        if (e.key === 'Delete' && this.selectedClip) {
            this.deleteSelected();
        }
        
        // Ctrl/Cmd + Z: 元に戻す
        if (cmdKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
        }
        
        // Ctrl/Cmd + Y: やり直し
        if (cmdKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
        }
        
        // Ctrl/Cmd + S: プロジェクト保存
        if (cmdKey && e.key === 's') {
            e.preventDefault();
            this.saveProject();
        }
        
        // Ctrl/Cmd + O: プロジェクト読み込み
        if (cmdKey && e.key === 'o') {
            e.preventDefault();
            this.openProject();
        }
        
        // Ctrl/Cmd + E: 書き出しメニューを開く
        if (cmdKey && e.key === 'e') {
            e.preventDefault();
            this.openExportMenu();
        }
        
        if (e.key === ' ') {
            e.preventDefault();
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        }
    }
    
    // Undo/Redo
    saveHistory() {
        const state = JSON.stringify({
            clips: this.clips,
            effects: this.effects
        });
        
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
        
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadHistory();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadHistory();
        }
    }
    
    loadHistory() {
        const state = JSON.parse(this.history[this.historyIndex]);
        this.clips = state.clips;
        this.effects = state.effects;
        
        // クリップのDOM要素を再生成
        this.clips.forEach(clip => {
            // imageElement, videoElement, audioElement, sequenceImagesはJSONシリアライズで失われるため再生成
            if (clip.asset.type === 'image') {
                clip.imageElement = null; // 次回のrenderClipで再生成される
            } else if (clip.asset.type === 'video') {
                clip.videoElement = null; // 次回のrenderClipで再生成される
            } else if (clip.asset.type === 'audio') {
                this.prepareAudioClip(clip); // AudioElementを再生成
            } else if (clip.asset.type === 'sequence') {
                clip.sequenceImages = null; // 次回のrenderClipで再生成される
            }
        });
        
        this.drawTimeline();
        this.updatePreview();
        this.updatePropertiesPanel();
    }
    
    // プロジェクト保存/読み込み
    async saveProject() {
        // プロジェクト名を入力
        const projectName = prompt('プロジェクト名を入力してください:', 'starlit_project');
        if (!projectName) return; // キャンセルされた場合
        
        const project = {
            version: '1.0',
            projectName: projectName,
            clips: this.clips.map(clip => ({
                ...clip,
                asset: {
                    id: clip.asset.id,
                    name: clip.asset.name,
                    type: clip.asset.type,
                    // 連番の場合はフレーム数も保存
                    ...(clip.asset.type === 'sequence' ? { frameCount: clip.asset.frameCount } : {})
                }
            })),
            // エフェクトのenabledフラグのみ保存（パラメーターはlocalStorageに保存済み）
            effectsEnabled: {
                letterbox: this.effects.letterbox.enabled,
                gradient: this.effects.gradient.enabled,
                diffusion: this.effects.diffusion.enabled,
                colorKey: this.effects.colorKey.enabled,
                normalize: this.effects.normalize.enabled
            },
            // ディフュージョンキーフレームはプロジェクトに保存
            diffusionKeyframes: this.effects.diffusion.keyframes,
            settings: {
                fps: this.fps,
                duration: this.duration,
                resolution: {
                    width: this.previewCanvas.width,
                    height: this.previewCanvas.height
                }
            }
        };
        
        // プロジェクトJSONを保存
        const projectBlob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const projectUrl = URL.createObjectURL(projectBlob);
        const projectLink = document.createElement('a');
        projectLink.href = projectUrl;
        projectLink.download = `${projectName}.json`;
        projectLink.click();
        URL.revokeObjectURL(projectUrl);
        
        // 素材ZIPを生成して保存
        this.showNotification('📦 素材をZIPに圧縮中...');
        await this.saveAssetsZip(projectName);
        this.showNotification('✅ プロジェクトと素材を保存しました！');
    }
    
    // 素材をZIPで保存
    async saveAssetsZip(projectName) {
        if (this.assets.length === 0) {
            this.showNotification('⚠️ 保存する素材がありません');
            return;
        }
        
        const zip = new JSZip();
        const assetsFolder = zip.folder('assets');
        
        // 各素材をZIPに追加
        for (const asset of this.assets) {
            if (asset.type === 'sequence') {
                // 連番画像の場合、フォルダを作成
                const sequenceFolder = assetsFolder.folder(asset.name.replace(' (連番)', ''));
                for (let i = 0; i < asset.files.length; i++) {
                    const file = asset.files[i];
                    sequenceFolder.file(file.name, file);
                }
            } else {
                // 通常ファイル
                assetsFolder.file(asset.name, asset.file);
            }
        }
        
        // ZIPを生成してダウンロード
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipUrl = URL.createObjectURL(zipBlob);
        const zipLink = document.createElement('a');
        zipLink.href = zipUrl;
        zipLink.download = `${projectName}_assets.zip`;
        zipLink.click();
        URL.revokeObjectURL(zipUrl);
    }
    
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
                
                // プロジェクトデータを一時保存
                this.pendingProject = project;
                
                // 設定を復元
                if (project.settings) {
                    if (project.settings.fps) {
                        this.fps = project.settings.fps;
                        document.getElementById('fpsSelect').value = this.fps;
                    }
                }
                
                // エフェクトのenabledフラグのみ復元（パラメーターはlocalStorageから既に読み込み済み）
                if (project.effectsEnabled) {
                    this.effects.letterbox.enabled = project.effectsEnabled.letterbox || false;
                    this.effects.gradient.enabled = project.effectsEnabled.gradient || false;
                    this.effects.diffusion.enabled = project.effectsEnabled.diffusion || false;
                    this.effects.colorKey.enabled = project.effectsEnabled.colorKey || false;
                    this.effects.normalize.enabled = project.effectsEnabled.normalize || false;
                }
                
                // ディフュージョンキーフレームを復元
                if (project.diffusionKeyframes) {
                    this.effects.diffusion.keyframes = project.diffusionKeyframes;
                    this.updateDiffusionKeyframeList();
                }
                
                // UIを更新
                this.updateEffectUI();
                this.updatePreview();
                
                // 素材ZIP読み込みを促す
                const projectName = project.projectName || 'プロジェクト';
                if (confirm(`プロジェクト「${projectName}」を読み込みました。\n\n続いて素材ZIPファイル（${projectName}_assets.zip）を選択してください。`)) {
                    document.getElementById('assetsZipInput').click();
                } else {
                    this.showNotification('⚠️ 素材なしでプロジェクトを読み込みました');
                    this.pendingProject = null;
                }
                
            } catch (err) {
                alert('プロジェクトの読み込みに失敗しました:\n' + err.message);
            }
        };
        reader.readAsText(file);
    }
    
    // 素材ZIPを読み込み
    async handleAssetsZipLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            this.showNotification('📦 素材ZIPを展開中...');
            
            const zip = await JSZip.loadAsync(file);
            const assetsFolder = zip.folder('assets');
            
            if (!assetsFolder) {
                throw new Error('ZIPファイル内にassetsフォルダが見つかりません');
            }
            
            // 素材をクリア
            this.assets = [];
            
            // 連番画像を格納するマップ
            const sequenceFolders = new Map();
            
            // ZIPから素材を復元
            const filePromises = [];
            assetsFolder.forEach((relativePath, zipEntry) => {
                if (zipEntry.dir) return; // ディレクトリはスキップ
                
                const pathParts = relativePath.split('/');
                
                if (pathParts.length > 1) {
                    // 連番画像（フォルダ内のファイル）
                    const folderName = pathParts[0];
                    if (!sequenceFolders.has(folderName)) {
                        sequenceFolders.set(folderName, []);
                    }
                    
                    const promise = zipEntry.async('blob').then(blob => {
                        const fileName = pathParts[pathParts.length - 1];
                        const mimeType = this.getMimeTypeFromFileName(fileName);
                        const file = new File([blob], fileName, { type: mimeType });
                        sequenceFolders.get(folderName).push(file);
                    });
                    filePromises.push(promise);
                    
                } else {
                    // 通常ファイル
                    const fileName = pathParts[0];
                    const promise = zipEntry.async('blob').then(blob => {
                        const mimeType = this.getMimeTypeFromFileName(fileName);
                        const file = new File([blob], fileName, { type: mimeType });
                        this.addAsset(file);
                    });
                    filePromises.push(promise);
                }
            });
            
            // すべてのファイルを読み込み完了まで待つ
            await Promise.all(filePromises);
            
            // 連番画像を追加
            for (const [folderName, files] of sequenceFolders) {
                files.sort((a, b) => a.name.localeCompare(b.name));
                this.addSequenceAsset(files);
            }
            
            // プロジェクトデータからクリップを復元
            if (this.pendingProject) {
                await this.restoreClipsFromProject(this.pendingProject);
                this.pendingProject = null;
            }
            
            this.showNotification('✅ 素材を復元しました！');
            this.renderAssets();
            
        } catch (err) {
            alert('素材ZIPの読み込みに失敗しました:\n' + err.message);
        }
        
        // ファイル入力をリセット
        event.target.value = '';
    }
    
    // ファイル名からMIMEタイプを取得
    getMimeTypeFromFileName(fileName) {
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
    
    // プロジェクトデータからクリップを復元
    async restoreClipsFromProject(project) {
        // クリップをクリア
        this.clips = [];
        
        // クリップを復元
        for (const clipData of project.clips) {
            // 素材を名前で検索
            const asset = this.assets.find(a => a.name === clipData.asset.name);
            
            if (!asset) {
                console.warn(`素材が見つかりません: ${clipData.asset.name}`);
                continue;
            }
            
            // クリップを復元
            const clip = {
                ...clipData,
                asset: asset
            };
            
            // 音声素材の場合、AudioElementを準備
            if (asset.type === 'audio') {
                this.prepareAudioClip(clip);
            }
            
            this.clips.push(clip);
        }
        
        this.drawTimeline();
        this.updatePreview();
    }
    
    newProject() {
        if (confirm('新規プロジェクトを作成しますか?未保存の変更は失われます。')) {
            this.clips = [];
            this.selectedClip = null;
            this.currentTime = 0;
            
            // エフェクトのenabledフラグをリセット（パラメーターはlocalStorageに残る）
            this.effects.letterbox.enabled = false;
            this.effects.gradient.enabled = false;
            
            this.drawTimeline();
            this.updatePreview();
            this.updatePropertiesPanel();
            this.updateEffectUI(); // エフェクトUIも更新
        }
    }
    
    // エフェクト設定の保存・読込（ファイルとしてエクスポート/インポート用）
    saveEffectSettings() {
        const settings = {
            version: '1.0',
            type: 'effect_settings',
            timestamp: new Date().toISOString(),
            // パラメーターのみ（enabledフラグは含めない）
            effectParameters: {
                letterbox: {
                    height: this.effects.letterbox.height,
                    color: this.effects.letterbox.color
                },
                gradient: {
                    top: {
                        color: this.effects.gradient.top.color,
                        height: this.effects.gradient.top.height,
                        opacity: this.effects.gradient.top.opacity,
                        blendMode: this.effects.gradient.top.blendMode
                    },
                    bottom: {
                        color: this.effects.gradient.bottom.color,
                        height: this.effects.gradient.bottom.height,
                        opacity: this.effects.gradient.bottom.opacity,
                        blendMode: this.effects.gradient.bottom.blendMode
                    }
                },
                diffusion: {
                    blur: this.effects.diffusion.blur,
                    contrast: this.effects.diffusion.contrast,
                    brightness: this.effects.diffusion.brightness,
                    saturation: this.effects.diffusion.saturation,
                    opacity: this.effects.diffusion.opacity
                }
            }
        };
        
        // キャッシュに保存（自動）
        this.saveSettingsToCache();
        
        // ファイルとしても保存（バックアップ用）
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // タイムスタンプ付きファイル名
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `starlit_effect_settings_${dateStr}.json`;
        
        a.click();
        URL.revokeObjectURL(url);
        
        // 成功メッセージ
        this.showNotification('💾 エフェクトパラメーターを保存しました（ファイル + キャッシュ）');
    }
    
    loadEffectSettings() {
        document.getElementById('effectSettingsInput').click();
    }
    
    handleEffectSettingsLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                
                // バージョンチェック
                if (settings.type !== 'effect_settings') {
                    throw new Error('エフェクト設定ファイルではありません');
                }
                
                // パラメーターのみ復元（enabledフラグは触らない）
                if (settings.effectParameters) {
                    // レターボックスパラメーター
                    if (settings.effectParameters.letterbox) {
                        this.effects.letterbox.height = settings.effectParameters.letterbox.height;
                        this.effects.letterbox.color = settings.effectParameters.letterbox.color;
                    }
                    
                    // グラデーションパラメーター
                    if (settings.effectParameters.gradient) {
                        const grad = settings.effectParameters.gradient;
                        if (grad.top) {
                            this.effects.gradient.top.color = grad.top.color;
                            this.effects.gradient.top.height = grad.top.height;
                            this.effects.gradient.top.opacity = grad.top.opacity;
                            this.effects.gradient.top.blendMode = grad.top.blendMode || 'normal';
                        }
                        if (grad.bottom) {
                            this.effects.gradient.bottom.color = grad.bottom.color;
                            this.effects.gradient.bottom.height = grad.bottom.height;
                            this.effects.gradient.bottom.opacity = grad.bottom.opacity;
                            this.effects.gradient.bottom.blendMode = grad.bottom.blendMode || 'normal';
                        }
                    }
                    
                    // ディフュージョンパラメーター
                    if (settings.effectParameters.diffusion) {
                        const diff = settings.effectParameters.diffusion;
                        this.effects.diffusion.blur = diff.blur || 0;
                        this.effects.diffusion.contrast = diff.contrast || 0;
                        this.effects.diffusion.brightness = diff.brightness || 0;
                        this.effects.diffusion.saturation = diff.saturation || 0;
                        this.effects.diffusion.opacity = diff.opacity !== undefined ? diff.opacity : 100;
                    }
                }
                
                // UIを更新
                this.updateEffectUI();
                this.updatePreview();
                
                // キャッシュにも保存
                this.saveSettingsToCache();
                
                // 成功メッセージ
                this.showNotification('📂 エフェクトパラメーターを読み込みました');
                
            } catch (err) {
                alert('エフェクト設定の読み込みに失敗しました:\n' + err.message);
            }
        };
        reader.readAsText(file);
        
        // ファイル入力をリセット（同じファイルを再度選択可能にする）
        event.target.value = '';
    }
    
    // エフェクトUIを設定に合わせて更新
    updateEffectUI() {
        // レターボックス
        document.getElementById('letterboxEnable').checked = this.effects.letterbox.enabled;
        document.getElementById('letterboxHeight').value = this.effects.letterbox.height;
        document.getElementById('letterboxHeightValue').textContent = `${this.effects.letterbox.height}px`;
        document.getElementById('letterboxColor').value = this.effects.letterbox.color;
        
        // グラデーション
        document.getElementById('gradientEnable').checked = this.effects.gradient.enabled;
        
        // 上部
        document.getElementById('gradientTopColor').value = this.effects.gradient.top.color;
        document.getElementById('gradientTopHeight').value = this.effects.gradient.top.height;
        document.getElementById('gradientTopHeightValue').textContent = `${this.effects.gradient.top.height}px`;
        document.getElementById('gradientTopOpacity').value = this.effects.gradient.top.opacity;
        document.getElementById('gradientTopOpacityValue').textContent = `${this.effects.gradient.top.opacity}%`;
        document.getElementById('gradientTopBlendMode').value = this.effects.gradient.top.blendMode;
        
        // 下部
        document.getElementById('gradientBottomColor').value = this.effects.gradient.bottom.color;
        document.getElementById('gradientBottomHeight').value = this.effects.gradient.bottom.height;
        document.getElementById('gradientBottomHeightValue').textContent = `${this.effects.gradient.bottom.height}px`;
        document.getElementById('gradientBottomOpacity').value = this.effects.gradient.bottom.opacity;
        document.getElementById('gradientBottomOpacityValue').textContent = `${this.effects.gradient.bottom.opacity}%`;
        document.getElementById('gradientBottomBlendMode').value = this.effects.gradient.bottom.blendMode;
        
        // ディフュージョン
        document.getElementById('diffusionEnable').checked = this.effects.diffusion.enabled;
        document.getElementById('diffusionBlur').value = this.effects.diffusion.blur;
        document.getElementById('diffusionBlurValue').textContent = `${this.effects.diffusion.blur}`;
        document.getElementById('diffusionContrast').value = this.effects.diffusion.contrast;
        document.getElementById('diffusionContrastValue').textContent = `${this.effects.diffusion.contrast}`;
        document.getElementById('diffusionBrightness').value = this.effects.diffusion.brightness;
        document.getElementById('diffusionBrightnessValue').textContent = `${this.effects.diffusion.brightness}`;
        document.getElementById('diffusionSaturation').value = this.effects.diffusion.saturation;
        document.getElementById('diffusionSaturationValue').textContent = `${this.effects.diffusion.saturation}`;
        document.getElementById('diffusionOpacity').value = this.effects.diffusion.opacity;
        document.getElementById('diffusionOpacityValue').textContent = `${this.effects.diffusion.opacity}%`;
        
        // カラーキー
        document.getElementById('colorKeyEnable').checked = this.effects.colorKey.enabled;
        document.getElementById('colorKeyColor').value = this.effects.colorKey.color;
        document.getElementById('colorKeyTolerance').value = this.effects.colorKey.tolerance;
        document.getElementById('colorKeyToleranceValue').textContent = `${this.effects.colorKey.tolerance}`;
        document.getElementById('colorKeyFeather').value = this.effects.colorKey.feather;
        document.getElementById('colorKeyFeatherValue').textContent = `${this.effects.colorKey.feather}`;
        document.getElementById('colorKeyInvert').checked = this.effects.colorKey.invert;
        
        // ノーマライズ
        document.getElementById('normalizeEnable').checked = this.effects.normalize.enabled;
        document.getElementById('normalizeStrength').value = this.effects.normalize.strength;
        document.getElementById('normalizeStrengthValue').textContent = `${this.effects.normalize.strength}`;
        
        // キーフレームリスト更新
        this.updateDiffusionKeyframeList();
    }
    
    // 通知表示
    showNotification(message) {
        // 既存の通知があれば削除
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }
        
        // 通知要素を作成
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // フェードイン
        setTimeout(() => notification.classList.add('show'), 10);
        
        // 3秒後にフェードアウト
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // キャッシュ（localStorage）への保存・読込
    // パラメーターのみ保存、enabledフラグはプロジェクト依存
    saveSettingsToCache() {
        try {
            const settings = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                effectParameters: {
                    letterbox: {
                        height: this.effects.letterbox.height,
                        color: this.effects.letterbox.color
                    },
                    gradient: {
                        top: {
                            color: this.effects.gradient.top.color,
                            height: this.effects.gradient.top.height,
                            opacity: this.effects.gradient.top.opacity,
                            blendMode: this.effects.gradient.top.blendMode
                        },
                        bottom: {
                            color: this.effects.gradient.bottom.color,
                            height: this.effects.gradient.bottom.height,
                            opacity: this.effects.gradient.bottom.opacity,
                            blendMode: this.effects.gradient.bottom.blendMode
                        }
                    },
                    diffusion: {
                        blur: this.effects.diffusion.blur,
                        contrast: this.effects.diffusion.contrast,
                        brightness: this.effects.diffusion.brightness,
                        saturation: this.effects.diffusion.saturation,
                        opacity: this.effects.diffusion.opacity
                    },
                    colorKey: {
                        color: this.effects.colorKey.color,
                        tolerance: this.effects.colorKey.tolerance,
                        feather: this.effects.colorKey.feather,
                        invert: this.effects.colorKey.invert
                    },
                    normalize: {
                        strength: this.effects.normalize.strength
                    }
                }
            };
            localStorage.setItem('starlitEffectSettings', JSON.stringify(settings));
            console.log('💾 エフェクトパラメーターをキャッシュに保存しました');
        } catch (error) {
            console.error('キャッシュ保存エラー:', error);
        }
    }
    
    loadSettingsFromCache() {
        try {
            const cached = localStorage.getItem('starlitEffectSettings');
            if (cached) {
                const settings = JSON.parse(cached);
                
                // パラメーターのみ復元（enabledフラグはプロジェクト依存なので触らない）
                if (settings.effectParameters) {
                    // レターボックスパラメーター
                    if (settings.effectParameters.letterbox) {
                        this.effects.letterbox.height = settings.effectParameters.letterbox.height;
                        this.effects.letterbox.color = settings.effectParameters.letterbox.color;
                    }
                    
                    // グラデーションパラメーター
                    if (settings.effectParameters.gradient) {
                        const grad = settings.effectParameters.gradient;
                        if (grad.top) {
                            this.effects.gradient.top.color = grad.top.color;
                            this.effects.gradient.top.height = grad.top.height;
                            this.effects.gradient.top.opacity = grad.top.opacity;
                            this.effects.gradient.top.blendMode = grad.top.blendMode || 'normal';
                        }
                        if (grad.bottom) {
                            this.effects.gradient.bottom.color = grad.bottom.color;
                            this.effects.gradient.bottom.height = grad.bottom.height;
                            this.effects.gradient.bottom.opacity = grad.bottom.opacity;
                            this.effects.gradient.bottom.blendMode = grad.bottom.blendMode || 'normal';
                        }
                    }
                    
                    // ディフュージョンパラメーター
                    if (settings.effectParameters.diffusion) {
                        const diff = settings.effectParameters.diffusion;
                        this.effects.diffusion.blur = diff.blur || 0;
                        this.effects.diffusion.contrast = diff.contrast || 0;
                        this.effects.diffusion.brightness = diff.brightness || 0;
                        this.effects.diffusion.saturation = diff.saturation || 0;
                        this.effects.diffusion.opacity = diff.opacity !== undefined ? diff.opacity : 100;
                    }
                    
                    // カラーキーパラメーター
                    if (settings.effectParameters.colorKey) {
                        const ck = settings.effectParameters.colorKey;
                        this.effects.colorKey.color = ck.color || '#00FF00';
                        this.effects.colorKey.tolerance = ck.tolerance !== undefined ? ck.tolerance : 30;
                        this.effects.colorKey.feather = ck.feather !== undefined ? ck.feather : 5;
                        this.effects.colorKey.invert = ck.invert || false;
                    }
                    
                    // ノーマライズパラメーター
                    if (settings.effectParameters.normalize) {
                        const norm = settings.effectParameters.normalize;
                        this.effects.normalize.strength = norm.strength !== undefined ? norm.strength : 1;
                    }
                }
                
                // UIを更新（次のフレームで実行）
                setTimeout(() => {
                    this.updateEffectUI();
                }, 0);
                
                console.log('✨ キャッシュからエフェクトパラメーターを復元しました');
            } else {
                console.log('ℹ️ キャッシュに保存された設定がありません（初回起動）');
            }
        } catch (error) {
            console.error('キャッシュ読込エラー:', error);
        }
    }
    
    // プレビューキャンバスでのマウス操作
    handlePreviewCanvasHover(e) {
        if (this.isPreviewDragging || !this.selectedClip || !this.boundingBoxCache) {
            return;
        }
        
        const rect = this.previewCanvas.getBoundingClientRect();
        
        // プレビューズームを考慮した座標変換
        const zoomFactor = this.previewZoom / 100;
        
        // CSSピクセルからキャンバスピクセルに変換(ズーム考慮)
        const scaleX = this.previewCanvas.width / (rect.width / zoomFactor);
        const scaleY = this.previewCanvas.height / (rect.height / zoomFactor);
        
        // マウス座標をキャンバス中心からの相対座標に変換
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const relativeX = (e.clientX - centerX) / zoomFactor;
        const relativeY = (e.clientY - centerY) / zoomFactor;
        
        // キャンバス座標系に変換
        const mouseX = this.previewCanvas.width / 2 + relativeX * scaleX;
        const mouseY = this.previewCanvas.height / 2 + relativeY * scaleY;
        
        const handleHitArea = 15;
        
        // 回転ハンドルの判定
        const rotateHandle = this.boundingBoxCache.rotateHandle;
        const distToRotate = Math.sqrt(
            Math.pow(mouseX - rotateHandle.screenX, 2) + 
            Math.pow(mouseY - rotateHandle.screenY, 2)
        );
        
        if (distToRotate < handleHitArea) {
            this.previewCanvas.style.cursor = 'grab';
            // console.log('Hover: Rotate handle');
            return;
        }
        
        // 各ハンドルの判定
        for (let handle of this.boundingBoxCache.handles) {
            const dist = Math.sqrt(
                Math.pow(mouseX - handle.screenX, 2) + 
                Math.pow(mouseY - handle.screenY, 2)
            );
            
            if (dist < handleHitArea) {
                // console.log('Hover: Handle', handle.type);
                // ハンドルタイプに応じたカーソル
                if (handle.type.startsWith('corner-tl') || handle.type.startsWith('corner-br')) {
                    this.previewCanvas.style.cursor = 'nwse-resize';
                } else if (handle.type.startsWith('corner-tr') || handle.type.startsWith('corner-bl')) {
                    this.previewCanvas.style.cursor = 'nesw-resize';
                } else if (handle.type === 'edge-t' || handle.type === 'edge-b') {
                    this.previewCanvas.style.cursor = 'ns-resize';
                } else if (handle.type === 'edge-l' || handle.type === 'edge-r') {
                    this.previewCanvas.style.cursor = 'ew-resize';
                }
                return;
            }
        }
        
        // バウンディングボックス内の判定
        const bbox = this.boundingBoxCache;
        const cos = Math.cos(-bbox.rotation * Math.PI / 180);
        const sin = Math.sin(-bbox.rotation * Math.PI / 180);
        
        const localX = cos * (mouseX - bbox.centerX) - sin * (mouseY - bbox.centerY);
        const localY = sin * (mouseX - bbox.centerX) + cos * (mouseY - bbox.centerY);
        
        if (Math.abs(localX) < bbox.scaledWidth / 2 && Math.abs(localY) < bbox.scaledHeight / 2) {
            this.previewCanvas.style.cursor = 'move';
            // console.log('Hover: Inside bounding box');
        } else {
            this.previewCanvas.style.cursor = 'default';
        }
    }
    
    handlePreviewMouseDown(e) {
        // console.log('Preview mousedown triggered');
        if (!this.selectedClip || !this.boundingBoxCache) {
            // console.log('No selected clip or bounding box cache');
            return;
        }
        
        const rect = this.previewCanvas.getBoundingClientRect();
        
        // プレビューズームを考慮した座標変換
        const zoomFactor = this.previewZoom / 100;
        
        // CSSピクセルからキャンバスピクセルに変換(ズーム考慮)
        const scaleX = this.previewCanvas.width / (rect.width / zoomFactor);
        const scaleY = this.previewCanvas.height / (rect.height / zoomFactor);
        
        // マウス座標をキャンバス中心からの相対座標に変換
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const relativeX = (e.clientX - centerX) / zoomFactor;
        const relativeY = (e.clientY - centerY) / zoomFactor;
        
        // キャンバス座標系に変換
        const mouseX = this.previewCanvas.width / 2 + relativeX * scaleX;
        const mouseY = this.previewCanvas.height / 2 + relativeY * scaleY;
        
        const handleSize = 10;
        const handleHitArea = 15; // クリック判定を少し広げる
        
        // 回転ハンドルの判定
        const rotateHandle = this.boundingBoxCache.rotateHandle;
        const distToRotate = Math.sqrt(
            Math.pow(mouseX - rotateHandle.screenX, 2) + 
            Math.pow(mouseY - rotateHandle.screenY, 2)
        );
        
        if (distToRotate < handleHitArea) {
            // console.log('Clicked rotate handle');
            this.isPreviewDragging = true;
            this.previewDragStart = { x: mouseX, y: mouseY };
            this.previewDragMode = 'rotate';
            this.previewCanvas.style.cursor = 'grabbing';
            
            const localTime = this.currentTime - this.selectedClip.startTime;
            this.initialTransform = {
                x: this.getKeyframeValue(this.selectedClip, 'x', localTime),
                y: this.getKeyframeValue(this.selectedClip, 'y', localTime),
                rotation: this.getKeyframeValue(this.selectedClip, 'rotation', localTime),
                scale: this.getKeyframeValue(this.selectedClip, 'scale', localTime),
                centerX: this.boundingBoxCache.centerX,
                centerY: this.boundingBoxCache.centerY
            };
            e.preventDefault();
            return;
        }
        
        // 各ハンドルの判定
        for (let handle of this.boundingBoxCache.handles) {
            const dist = Math.sqrt(
                Math.pow(mouseX - handle.screenX, 2) + 
                Math.pow(mouseY - handle.screenY, 2)
            );
            
            if (dist < handleHitArea) {
                // console.log('Clicked handle:', handle.type);
                this.isPreviewDragging = true;
                this.previewDragStart = { x: mouseX, y: mouseY };
                this.previewDragMode = handle.type;
                this.activeHandle = handle;
                
                const localTime = this.currentTime - this.selectedClip.startTime;
                this.initialTransform = {
                    x: this.getKeyframeValue(this.selectedClip, 'x', localTime),
                    y: this.getKeyframeValue(this.selectedClip, 'y', localTime),
                    rotation: this.getKeyframeValue(this.selectedClip, 'rotation', localTime),
                    scale: this.getKeyframeValue(this.selectedClip, 'scale', localTime),
                    width: this.boundingBoxCache.scaledWidth,
                    height: this.boundingBoxCache.scaledHeight,
                    centerX: this.boundingBoxCache.centerX,
                    centerY: this.boundingBoxCache.centerY
                };
                e.preventDefault();
                return;
            }
        }
        
        // バウンディングボックス内のクリック判定(位置移動)
        const bbox = this.boundingBoxCache;
        const cos = Math.cos(-bbox.rotation * Math.PI / 180);
        const sin = Math.sin(-bbox.rotation * Math.PI / 180);
        
        // マウス座標を回転を考慮してローカル座標に変換
        const localX = cos * (mouseX - bbox.centerX) - sin * (mouseY - bbox.centerY);
        const localY = sin * (mouseX - bbox.centerX) + cos * (mouseY - bbox.centerY);
        
        if (Math.abs(localX) < bbox.scaledWidth / 2 && Math.abs(localY) < bbox.scaledHeight / 2) {
            // console.log('Clicked inside bounding box for move');
            this.isPreviewDragging = true;
            this.previewDragStart = { x: mouseX, y: mouseY };
            this.previewDragMode = 'move';
            
            const localTime = this.currentTime - this.selectedClip.startTime;
            this.initialTransform = {
                x: this.getKeyframeValue(this.selectedClip, 'x', localTime),
                y: this.getKeyframeValue(this.selectedClip, 'y', localTime),
                rotation: this.getKeyframeValue(this.selectedClip, 'rotation', localTime),
                scale: this.getKeyframeValue(this.selectedClip, 'scale', localTime)
            };
            // console.log('isPreviewDragging set to:', this.isPreviewDragging);
            // console.log('previewDragMode:', this.previewDragMode);
            e.preventDefault();
        }
    }
    
    handlePreviewMouseMove(e) {
        if (!this.isPreviewDragging || !this.selectedClip) {
            // console.log('Preview move skipped - isPreviewDragging:', this.isPreviewDragging, 'selectedClip:', !!this.selectedClip);
            return;
        }
        
        // console.log('Preview mouse move - mode:', this.previewDragMode);
        
        const rect = this.previewCanvas.getBoundingClientRect();
        
        // プレビューズームを考慮した座標変換
        const zoomFactor = this.previewZoom / 100;
        
        // CSSピクセルからキャンバスピクセルに変換(ズーム考慮)
        const scaleX = this.previewCanvas.width / (rect.width / zoomFactor);
        const scaleY = this.previewCanvas.height / (rect.height / zoomFactor);
        
        // マウス座標をキャンバス中心からの相対座標に変換
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const relativeX = (e.clientX - centerX) / zoomFactor;
        const relativeY = (e.clientY - centerY) / zoomFactor;
        
        // キャンバス座標系に変換
        const mouseX = this.previewCanvas.width / 2 + relativeX * scaleX;
        const mouseY = this.previewCanvas.height / 2 + relativeY * scaleY;
        
        const dx = mouseX - this.previewDragStart.x;
        const dy = mouseY - this.previewDragStart.y;
        
        if (this.previewDragMode === 'move') {
            // 位置移動
            const newX = this.initialTransform.x + dx;
            const newY = this.initialTransform.y + dy;
            // console.log('Moving to:', newX, newY);
            this.setKeyframeValueLive('x', newX);
            this.setKeyframeValueLive('y', newY);
            
        } else if (this.previewDragMode === 'rotate') {
            // 回転
            const centerX = this.initialTransform.centerX;
            const centerY = this.initialTransform.centerY;
            
            // 開始角度
            const startAngle = Math.atan2(
                this.previewDragStart.y - centerY,
                this.previewDragStart.x - centerX
            );
            
            // 現在の角度
            const currentAngle = Math.atan2(
                mouseY - centerY,
                mouseX - centerX
            );
            
            // 角度差(度)
            const angleDelta = (currentAngle - startAngle) * 180 / Math.PI;
            const newRotation = this.initialTransform.rotation + angleDelta;
            // console.log('Rotating to:', newRotation);
            
            this.setKeyframeValueLive('rotation', newRotation);
            
        } else if (this.previewDragMode.startsWith('corner-')) {
            // コーナーハンドル: 均等スケール(アスペクト比維持)
            // 中心からの距離の変化でスケールを計算
            const initialDist = Math.sqrt(
                Math.pow(this.previewDragStart.x - this.initialTransform.centerX, 2) +
                Math.pow(this.previewDragStart.y - this.initialTransform.centerY, 2)
            );
            const currentDist = Math.sqrt(
                Math.pow(mouseX - this.initialTransform.centerX, 2) +
                Math.pow(mouseY - this.initialTransform.centerY, 2)
            );
            
            // スケール比率を計算
            const scaleRatio = initialDist > 0 ? currentDist / initialDist : 1;
            const newScale = Math.max(0.1, this.initialTransform.scale * scaleRatio);
            // console.log('Scaling to:', newScale, 'ratio:', scaleRatio);
            
            this.setKeyframeValueLive('scale', newScale);
            
        } else if (this.previewDragMode.startsWith('edge-')) {
            // エッジハンドル: 方向に応じた均等スケール
            let scaleRatio = 1;
            
            if (this.previewDragMode === 'edge-r' || this.previewDragMode === 'edge-l') {
                // 左右エッジ: X方向の変化
                const initialDistX = Math.abs(this.previewDragStart.x - this.initialTransform.centerX);
                const currentDistX = Math.abs(mouseX - this.initialTransform.centerX);
                scaleRatio = initialDistX > 0 ? currentDistX / initialDistX : 1;
            } else if (this.previewDragMode === 'edge-t' || this.previewDragMode === 'edge-b') {
                // 上下エッジ: Y方向の変化
                const initialDistY = Math.abs(this.previewDragStart.y - this.initialTransform.centerY);
                const currentDistY = Math.abs(mouseY - this.initialTransform.centerY);
                scaleRatio = initialDistY > 0 ? currentDistY / initialDistY : 1;
            }
            
            const newScale = Math.max(0.1, this.initialTransform.scale * scaleRatio);
            // console.log('Scaling to:', newScale, 'ratio:', scaleRatio);
            
            this.setKeyframeValueLive('scale', newScale);
        }
        
        this.updatePropertiesPanel();
        
        e.preventDefault();
    }
    
    handlePreviewMouseUp(e) {
        if (this.isPreviewDragging) {
            // console.log('Preview drag ended');
            this.isPreviewDragging = false;
            this.previewDragStart = null;
            this.previewDragMode = null;
            this.initialTransform = null;
            this.activeHandle = null;
            this.previewCanvas.style.cursor = 'default';
            
            // タイムラインとプロパティパネルを更新して履歴を保存
            this.drawTimeline();
            this.saveHistory();
        }
    }
    
    // 書き出しメニューを開く
    openExportMenu() {
        // 書き出しダイアログを表示
        const choice = prompt(
            '書き出し形式を選択してください:\n\n' +
            '1: WebM動画 (透過対応・高速)\n' +
            '2: 連番PNG (高品質・MP4変換用)\n' +
            '3: キャンセル',
            '1'
        );
        
        if (choice === '1') {
            this.exportWebM();
        } else if (choice === '2') {
            this.exportSequence();
        }
    }
    
    // 書き出し機能
    async exportVideo() {
        const startTime = parseFloat(document.getElementById('exportStart').value);
        const endTime = parseFloat(document.getElementById('exportEnd').value);
        
        if (startTime >= endTime) {
            alert('書き出し範囲が不正です');
            return;
        }
        
        const duration = endTime - startTime;
        const frames = Math.ceil(duration * this.fps);
        
        if (!confirm(`MP4動画を書き出しますか?\n\n長さ: ${duration.toFixed(2)}秒\nフレーム数: ${frames}\nFPS: ${this.fps}`)) {
            return;
        }
        
        // 進捗表示用の要素を作成
        const progressDiv = document.createElement('div');
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 10px;
            z-index: 10000;
            font-family: 'JK Maru Gothic M', sans-serif;
            text-align: center;
            min-width: 400px;
        `;
        progressDiv.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">MP4書き出し中...</h3>
            <div id="exportProgress" style="margin: 10px 0;">FFmpegを読み込み中...</div>
            <div id="exportDetail" style="font-size: 12px; color: #999; margin-top: 10px;">準備中...</div>
        `;
        document.body.appendChild(progressDiv);
        
        const updateProgress = (message, detail = '') => {
            const progressEl = document.getElementById('exportProgress');
            const detailEl = document.getElementById('exportDetail');
            if (progressEl) progressEl.textContent = message;
            if (detailEl) detailEl.textContent = detail;
        };
        
        const originalTime = this.currentTime;
        
        try {
            // FFmpegを初期化
            updateProgress('FFmpegを読み込み中...', '初回のみ時間がかかります');
            await this.loadFFmpeg();
            
            updateProgress('フレームを生成中...', `0/${frames} フレーム`);
            
            const { fetchFile } = FFmpegUtil;
            
            // 各フレームをPNG画像として生成
            for (let i = 0; i < frames; i++) {
                this.currentTime = startTime + (i / this.fps);
                this.updatePreview();
                
                // キャンバスをBlobに変換
                const blob = await new Promise(resolve => {
                    this.previewCanvas.toBlob(resolve, 'image/png');
                });
                
                // FFmpegのファイルシステムに書き込み
                const fileName = `frame${i.toString().padStart(5, '0')}.png`;
                await this.ffmpeg.writeFile(fileName, await fetchFile(blob));
                
                updateProgress(
                    `フレームを生成中...`,
                    `${i + 1}/${frames} フレーム (${Math.floor((i + 1) / frames * 100)}%)`
                );
            }
            
            updateProgress('MP4にエンコード中...', 'FFmpegで変換しています');
            
            // FFmpegでMP4に変換
            await this.ffmpeg.exec([
                '-framerate', this.fps.toString(),
                '-i', 'frame%05d.png',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'medium',
                '-crf', '18',
                'output.mp4'
            ]);
            
            updateProgress('ファイルを生成中...', 'ダウンロード準備中');
            
            // 生成されたMP4を読み込み
            const data = await this.ffmpeg.readFile('output.mp4');
            
            // Blobを作成してダウンロード
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `starlit_timeline_export_${Date.now()}.mp4`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            // 一時ファイルをクリーンアップ
            updateProgress('クリーンアップ中...', 'ファイルを削除しています');
            for (let i = 0; i < frames; i++) {
                const fileName = `frame${i.toString().padStart(5, '0')}.png`;
                try {
                    await this.ffmpeg.deleteFile(fileName);
                } catch (e) {
                    // ファイルが存在しない場合は無視
                }
            }
            await this.ffmpeg.deleteFile('output.mp4');
            
            // 進捗表示を削除
            document.body.removeChild(progressDiv);
            
            // 元の時間に戻す
            this.currentTime = originalTime;
            this.updatePreview();
            this.drawTimeline();
            
            alert('✅ MP4書き出しが完了しました!');
            
        } catch (error) {
            console.error('Export error:', error);
            if (progressDiv.parentNode) {
                document.body.removeChild(progressDiv);
            }
            
            this.currentTime = originalTime;
            this.updatePreview();
            this.drawTimeline();
            
            alert('❌ 書き出しに失敗しました:\n' + error.message);
        }
    }
    
    async exportWebM() {
        const startTime = parseFloat(document.getElementById('exportStart').value);
        const endTime = parseFloat(document.getElementById('exportEnd').value);
        
        if (startTime >= endTime) {
            alert('書き出し範囲が不正です');
            return;
        }
        
        const duration = endTime - startTime;
        const frames = Math.ceil(duration * this.fps);
        
        if (!confirm(`WebM動画を書き出しますか?\n\n長さ: ${duration.toFixed(2)}秒\nフレーム数: ${frames}\nFPS: ${this.fps}\n\n※WebMは透過（アルファチャンネル）に対応しています`)) {
            return;
        }
        
        // 進捗表示用の要素を作成
        const progressDiv = document.createElement('div');
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 10px;
            z-index: 10000;
            font-family: 'JK Maru Gothic M', sans-serif;
            text-align: center;
            min-width: 300px;
        `;
        progressDiv.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">WebM書き出し中...</h3>
            <div id="exportProgress" style="margin: 10px 0;">準備中...</div>
            <div style="font-size: 12px; color: #999; margin-top: 10px;">しばらくお待ちください</div>
        `;
        document.body.appendChild(progressDiv);
        
        const updateProgress = (message) => {
            const progressEl = document.getElementById('exportProgress');
            if (progressEl) progressEl.textContent = message;
        };
        
        try {
            // MediaRecorderのセットアップ
            const stream = this.previewCanvas.captureStream(this.fps);
            
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                ? 'video/webm;codecs=vp8'
                : 'video/webm';
            
            updateProgress(`エンコーダー: ${mimeType}`);
            
            const recorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: 8000000 // 8Mbps
            });
            
            const chunks = [];
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            recorder.onstop = async () => {
                updateProgress('ファイルを生成中...');
                
                const blob = new Blob(chunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                
                // ダウンロード
                const a = document.createElement('a');
                a.href = url;
                a.download = `starlit_timeline_export_${Date.now()}.webm`;
                a.click();
                
                URL.revokeObjectURL(url);
                
                // 進捗表示を削除
                document.body.removeChild(progressDiv);
                
                // 元の時間に戻す
                this.currentTime = originalTime;
                this.updatePreview();
                this.drawTimeline();
                
                alert('✅ WebM書き出しが完了しました!\n\nWebM形式で保存されています。\n透過（アルファチャンネル）に対応しています。');
            };
            
            recorder.onerror = (e) => {
                console.error('Recording error:', e);
                document.body.removeChild(progressDiv);
                alert('❌ 書き出し中にエラーが発生しました');
            };
            
            // 録画開始
            recorder.start();
            updateProgress('録画開始...');
            
            const originalTime = this.currentTime;
            const originalSelectedClip = this.selectedClip; // 選択状態を保存
            
            // 書き出し中は選択を解除してバウンディングボックスを非表示
            this.selectedClip = null;
            
            const frameInterval = 1000 / this.fps; // ミリ秒
            let currentFrame = 0;
            
            // フレームごとにプレビューを更新
            const renderFrame = () => {
                if (currentFrame >= frames) {
                    // 録画停止
                    updateProgress('エンコード中...');
                    setTimeout(() => {
                        recorder.stop();
                        // 選択状態を復元
                        this.selectedClip = originalSelectedClip;
                    }, 500); // 最後のフレームを確実にキャプチャ
                    return;
                }
                
                this.currentTime = startTime + (currentFrame / this.fps);
                this.updatePreview();
                this.drawTimeline();
                
                currentFrame++;
                updateProgress(`録画中: ${currentFrame}/${frames} フレーム (${Math.floor(currentFrame / frames * 100)}%)`);
                
                // 次のフレームをスケジュール
                setTimeout(renderFrame, frameInterval);
            };
            
            // レンダリング開始
            renderFrame();
            
        } catch (error) {
            console.error('Export error:', error);
            if (progressDiv.parentNode) {
                document.body.removeChild(progressDiv);
            }
            alert('❌ 書き出しに失敗しました: ' + error.message);
        }
    }
    
    async exportSequence() {
        const startTime = parseFloat(document.getElementById('exportStart').value);
        const endTime = parseFloat(document.getElementById('exportEnd').value);
        
        if (startTime >= endTime) {
            alert('書き出し範囲が不正です');
            return;
        }
        
        const frames = Math.ceil((endTime - startTime) * this.fps);
        
        if (!confirm(`${frames}フレームを連番PNG (ZIP圧縮) で書き出しますか?`)) {
            return;
        }
        
        // 進捗表示用の要素を作成
        const progressDiv = document.createElement('div');
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 10px;
            z-index: 10000;
            font-family: 'JK Maru Gothic M', sans-serif;
            text-align: center;
            min-width: 400px;
        `;
        progressDiv.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">連番PNG書き出し中...</h3>
            <div id="sequenceProgress" style="margin: 10px 0;">0 / ${frames} フレーム</div>
            <div style="font-size: 12px; color: #999; margin-top: 10px;">しばらくお待ちください...</div>
        `;
        document.body.appendChild(progressDiv);
        
        const originalTime = this.currentTime;
        const originalSelectedClip = this.selectedClip; // 選択状態を保存
        
        // 書き出し中は選択を解除してバウンディングボックスを非表示
        this.selectedClip = null;
        
        // JSZipライブラリを動的に読み込み
        if (typeof JSZip === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        const zip = new JSZip();
        const folder = zip.folder('sequence');
        
        for (let i = 0; i < frames; i++) {
            this.currentTime = startTime + (i / this.fps);
            this.updatePreview();
            
            // フレームを画像として取得
            const dataUrl = this.previewCanvas.toDataURL('image/png');
            const base64Data = dataUrl.split(',')[1];
            
            // ZIPに追加
            folder.file(`frame_${i.toString().padStart(5, '0')}.png`, base64Data, {base64: true});
            
            // 進捗更新
            document.getElementById('sequenceProgress').textContent = `${i + 1} / ${frames} フレーム`;
            
            // UIの更新を待つ
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // 元の状態に戻す
        this.currentTime = originalTime;
        this.selectedClip = originalSelectedClip; // 選択状態を復元
        this.updatePreview();
        
        // ZIP圧縮
        document.getElementById('sequenceProgress').textContent = 'ZIP圧縮中...';
        const blob = await zip.generateAsync({type: 'blob'});
        
        // ダウンロード
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `sequence_${frames}frames.zip`;
        a.click();
        
        // クリーンアップ
        URL.revokeObjectURL(a.href);
        document.body.removeChild(progressDiv);
        
        alert(`連番PNG書き出しが完了しました!\n${frames}フレームをZIPファイルにまとめました。`);
    }
    
    async exportAudio() {
        alert('音声書き出し機能は開発中です');
    }
}

// アプリケーション初期化
const app = new StarlitTimelineApp();
