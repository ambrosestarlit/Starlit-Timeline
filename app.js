// アプリケーションクラス
class StarlitTimelineApp {
    constructor() {
        this.assets = [];
        this.clips = [];
        this.selectedClip = null;
        this.currentTime = 0;
        this.isPlaying = false;
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
        
        // エフェクト設定
        this.effects = {
            letterbox: {
                enabled: false,
                height: 100,
                color: '#000000'
            },
            gradient: {
                enabled: false,
                topColor: '#FFFF00',
                bottomColor: '#0000FF',
                opacity: 50
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
        
        this.init();
    }
    
    init() {
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
        
        // エフェクトコントロール
        this.setupEffectControls();
    }
    
    setupEventListeners() {
        // タイムラインキャンバスイベント
        this.timelineCanvas.addEventListener('mousedown', (e) => this.handleTimelineMouseDown(e));
        this.timelineCanvas.addEventListener('mousemove', (e) => this.handleTimelineMouseMove(e));
        this.timelineCanvas.addEventListener('mouseup', (e) => this.handleTimelineMouseUp(e));
        
        // タイムラインのドラッグ&ドロップ
        const timelineScroll = document.getElementById('timelineScroll');
        timelineScroll.addEventListener('drop', (e) => this.handleAssetDrop(e));
        timelineScroll.addEventListener('dragover', (e) => e.preventDefault());
        
        this.timelineCanvas.addEventListener('drop', (e) => this.handleAssetDrop(e));
        this.timelineCanvas.addEventListener('dragover', (e) => e.preventDefault());
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // 素材エクスプローラーのドラッグ&ドロップ
        document.getElementById('assetExplorer').addEventListener('drop', (e) => this.handleAssetDrop(e));
        document.getElementById('assetExplorer').addEventListener('dragover', (e) => e.preventDefault());
    }
    
    setupEffectControls() {
        // レターボックス
        document.getElementById('letterboxHeight').addEventListener('input', (e) => {
            this.effects.letterbox.height = parseInt(e.target.value);
            document.getElementById('letterboxHeightValue').textContent = `${e.target.value}px`;
            this.updatePreview();
        });
        
        document.getElementById('letterboxColor').addEventListener('change', (e) => {
            this.effects.letterbox.color = e.target.value;
            this.updatePreview();
        });
        
        document.getElementById('letterboxEnable').addEventListener('change', (e) => {
            this.effects.letterbox.enabled = e.target.checked;
            this.updatePreview();
        });
        
        // グラデーション
        document.getElementById('gradientTopColor').addEventListener('change', (e) => {
            this.effects.gradient.topColor = e.target.value;
            this.updatePreview();
        });
        
        document.getElementById('gradientBottomColor').addEventListener('change', (e) => {
            this.effects.gradient.bottomColor = e.target.value;
            this.updatePreview();
        });
        
        document.getElementById('gradientOpacity').addEventListener('input', (e) => {
            this.effects.gradient.opacity = parseInt(e.target.value);
            document.getElementById('gradientOpacityValue').textContent = `${e.target.value}%`;
            this.updatePreview();
        });
        
        document.getElementById('gradientEnable').addEventListener('change', (e) => {
            this.effects.gradient.enabled = e.target.checked;
            this.updatePreview();
        });
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
            input.accept = 'image/*,video/*,audio/*';
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
        const asset = {
            id: Date.now() + Math.random(),
            name: file.name,
            type: file.type.split('/')[0], // image, video, audio
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
        event.preventDefault();
        
        const rect = event.target.getBoundingClientRect();
        const targetIsTimeline = event.target.id === 'timelineCanvas' || 
                                 event.target.closest('#timelineScroll');
        
        // ファイルドロップ (素材エクスプローラーへ)
        if (event.dataTransfer.files.length > 0 && !targetIsTimeline) {
            for (let file of event.dataTransfer.files) {
                this.addAsset(file);
            }
            return;
        }
        
        // タイムラインへのドロップ (素材エクスプローラーから)
        const assetId = event.dataTransfer.getData('assetId');
        if (assetId && targetIsTimeline) {
            // timelineCanvasの座標を取得
            const canvasRect = this.timelineCanvas.getBoundingClientRect();
            const scrollContainer = document.getElementById('timelineScroll');
            
            const x = event.clientX - canvasRect.left + scrollContainer.scrollLeft;
            const y = event.clientY - canvasRect.top + scrollContainer.scrollTop;
            
            const time = x / this.zoom;
            const track = Math.floor(y / this.trackHeight);
            
            this.addClipFromAsset(assetId, time, track);
        }
    }
    
    addClipFromAsset(assetId, startTime, track) {
        const asset = this.assets.find(a => a.id == assetId);
        if (!asset) return;
        
        const clip = {
            id: Date.now() + Math.random(),
            asset: asset,
            track: Math.max(0, Math.min(track, this.trackCount - 1)),
            startTime: Math.max(0, startTime),
            duration: 5, // デフォルト5秒
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
        const width = clip.duration * this.zoom;
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
        
        // ループインジケーター
        if ((clip.asset.type === 'video' || clip.asset.type === 'sequence') && clip.loopCount > 1) {
            ctx.fillStyle = '#00FF00';
            ctx.font = '10px sans-serif';
            ctx.fillText(`×${clip.loopCount}`, x + 25, y + 35);
        }
        
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
        
        Object.keys(clip.keyframes).forEach(property => {
            const keyframes = clip.keyframes[property];
            keyframes.forEach(kf => {
                const x = clipX + (kf.time * this.zoom);
                const y = clipY + clipHeight - 5;
                
                ctx.fillStyle = '#FFFF00';
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        });
    }
    
    drawPlayhead() {
        const ctx = this.timelineCtx;
        const x = this.currentTime * this.zoom;
        
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.timelineCanvas.height);
        ctx.stroke();
        
        // プレイヘッドトップ
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.moveTo(x - 8, 0);
        ctx.lineTo(x + 8, 0);
        ctx.lineTo(x, 12);
        ctx.closePath();
        ctx.fill();
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
    }
    
    // タイムライン操作
    handleTimelineMouseDown(e) {
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left + this.timelineCanvas.parentElement.scrollLeft;
        const y = e.clientY - rect.top + this.timelineCanvas.parentElement.scrollTop;
        
        // クリップ選択
        const clickedClip = this.getClipAt(x, y);
        if (clickedClip) {
            this.selectedClip = clickedClip;
            this.isDragging = true;
            this.dragStartX = x;
            this.dragStartY = y;
            this.updatePropertiesPanel();
            this.drawTimeline();
            return;
        }
        
        // プレイヘッド移動
        this.currentTime = x / this.zoom;
        this.updateTimeDisplay();
        this.updatePreview();
        this.drawTimeline();
    }
    
    handleTimelineMouseMove(e) {
        if (!this.isDragging || !this.selectedClip) return;
        
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left + this.timelineCanvas.parentElement.scrollLeft;
        const y = e.clientY - rect.top + this.timelineCanvas.parentElement.scrollTop;
        
        const deltaX = x - this.dragStartX;
        const deltaY = y - this.dragStartY;
        
        this.selectedClip.startTime += deltaX / this.zoom;
        this.selectedClip.track += Math.floor(deltaY / this.trackHeight);
        
        this.selectedClip.startTime = Math.max(0, this.selectedClip.startTime);
        this.selectedClip.track = Math.max(0, Math.min(this.selectedClip.track, this.trackCount - 1));
        
        this.dragStartX = x;
        this.dragStartY = y;
        
        this.drawTimeline();
        this.updatePropertiesPanel();
    }
    
    handleTimelineMouseUp(e) {
        if (this.isDragging) {
            this.saveHistory();
        }
        this.isDragging = false;
    }
    
    getClipAt(x, y) {
        for (let clip of this.clips) {
            const clipX = clip.startTime * this.zoom;
            const clipY = clip.track * this.trackHeight;
            const clipWidth = clip.duration * this.zoom;
            const clipHeight = this.trackHeight;
            
            if (x >= clipX && x <= clipX + clipWidth &&
                y >= clipY && y <= clipY + clipHeight) {
                return clip;
            }
        }
        return null;
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
            
            <!-- トランジション設定 -->
            <div class="property-section-header">🎬 トランジション</div>
            
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
        `;
        
        // 音声クリップの場合はボリューム設定
        if (clip.asset.type === 'audio' || clip.asset.type === 'video') {
            propertiesHTML += `
                <div class="property-section-header">🔊 音声</div>
                
                <div class="property-group">
                    <div class="property-label">音量: <span id="volumeValue">${(clip.volume * 100).toFixed(0)}%</span></div>
                    <input type="range" class="property-slider" value="${(clip.volume * 100).toFixed(0)}" 
                        min="0" max="100" step="1"
                        oninput="app.updateClipProperty('volume', parseFloat(this.value) / 100); document.getElementById('volumeValue').textContent = this.value + '%'">
                </div>
            `;
        }
        
        // 動画・連番アニメーションの場合はループ設定
        if (clip.asset.type === 'video' || clip.asset.type === 'sequence') {
            propertiesHTML += `
                <div class="property-section-header">🔁 ループ</div>
                
                <div class="property-group">
                    <div class="property-label">ループ回数: <span id="loopCountValue">${clip.loopCount}</span></div>
                    <input type="range" class="property-slider" value="${clip.loopCount}" 
                        min="1" max="10" step="1"
                        oninput="app.updateClipProperty('loopCount', parseInt(this.value)); document.getElementById('loopCountValue').textContent = this.value">
                </div>
            `;
            
            // 連番の場合はフレームレート設定
            if (clip.asset.type === 'sequence') {
                propertiesHTML += `
                    <div class="property-group">
                        <div class="property-label">フレームレート: <span id="frameRateValue">${clip.frameRate || 30} fps</span></div>
                        <input type="range" class="property-slider" value="${clip.frameRate || 30}" 
                            min="1" max="60" step="1"
                            oninput="app.updateClipProperty('frameRate', parseInt(this.value)); document.getElementById('frameRateValue').textContent = this.value + ' fps'">
                    </div>
                `;
            }
        }
        
        // 映像クリップの場合はトランスフォーム設定
        if (clip.asset.type === 'image' || clip.asset.type === 'video' || clip.asset.type === 'sequence') {
            const currentX = this.getKeyframeValue(clip, 'x', localTime);
            const currentY = this.getKeyframeValue(clip, 'y', localTime);
            const currentRotation = this.getKeyframeValue(clip, 'rotation', localTime);
            const currentOpacity = this.getKeyframeValue(clip, 'opacity', localTime);
            const currentScale = this.getKeyframeValue(clip, 'scale', localTime);
            
            propertiesHTML += `
                <div class="property-section-header">📐 トランスフォーム</div>
                
                <div class="property-group">
                    <div class="property-label">X位置: <span id="xValue">${currentX.toFixed(0)}px</span></div>
                    <input type="range" class="property-slider" value="${currentX.toFixed(0)}"
                        min="-960" max="960" step="1"
                        oninput="app.setKeyframeValue('x', parseFloat(this.value)); document.getElementById('xValue').textContent = this.value + 'px'">
                    <div class="keyframe-controls">
                        <button class="keyframe-button ${this.hasKeyframeAt(clip, 'x', localTime) ? 'active' : ''}" 
                            onclick="app.toggleKeyframe('x')">💎 キーフレーム</button>
                    </div>
                </div>
                
                <div class="property-group">
                    <div class="property-label">Y位置: <span id="yValue">${currentY.toFixed(0)}px</span></div>
                    <input type="range" class="property-slider" value="${currentY.toFixed(0)}"
                        min="-540" max="540" step="1"
                        oninput="app.setKeyframeValue('y', parseFloat(this.value)); document.getElementById('yValue').textContent = this.value + 'px'">
                    <div class="keyframe-controls">
                        <button class="keyframe-button ${this.hasKeyframeAt(clip, 'y', localTime) ? 'active' : ''}" 
                            onclick="app.toggleKeyframe('y')">💎 キーフレーム</button>
                    </div>
                </div>
                
                <div class="property-group">
                    <div class="property-label">回転: <span id="rotationValue">${currentRotation.toFixed(0)}°</span></div>
                    <input type="range" class="property-slider" value="${currentRotation.toFixed(0)}"
                        min="-180" max="180" step="1"
                        oninput="app.setKeyframeValue('rotation', parseFloat(this.value)); document.getElementById('rotationValue').textContent = this.value + '°'">
                    <div class="keyframe-controls">
                        <button class="keyframe-button ${this.hasKeyframeAt(clip, 'rotation', localTime) ? 'active' : ''}" 
                            onclick="app.toggleKeyframe('rotation')">💎 キーフレーム</button>
                    </div>
                </div>
                
                <div class="property-group">
                    <div class="property-label">不透明度: <span id="opacityValue">${(currentOpacity * 100).toFixed(0)}%</span></div>
                    <input type="range" class="property-slider" value="${(currentOpacity * 100).toFixed(0)}" 
                        min="0" max="100" step="1"
                        oninput="app.setKeyframeValue('opacity', parseFloat(this.value) / 100); document.getElementById('opacityValue').textContent = this.value + '%'">
                    <div class="keyframe-controls">
                        <button class="keyframe-button ${this.hasKeyframeAt(clip, 'opacity', localTime) ? 'active' : ''}" 
                            onclick="app.toggleKeyframe('opacity')">💎 キーフレーム</button>
                    </div>
                </div>
                
                <div class="property-group">
                    <div class="property-label">スケール: <span id="scaleValue">${(currentScale * 100).toFixed(0)}%</span></div>
                    <input type="range" class="property-slider" value="${(currentScale * 100).toFixed(0)}" 
                        min="10" max="300" step="1"
                        oninput="app.setKeyframeValue('scale', parseFloat(this.value) / 100); document.getElementById('scaleValue').textContent = this.value + '%'">
                    <div class="keyframe-controls">
                        <button class="keyframe-button ${this.hasKeyframeAt(clip, 'scale', localTime) ? 'active' : ''}" 
                            onclick="app.toggleKeyframe('scale')">💎 キーフレーム</button>
                    </div>
                </div>
                
                <div class="property-group">
                    <div class="property-label">
                        <input type="checkbox" id="useOriginalSize" ${clip.useOriginalSize ? 'checked' : ''} 
                            onchange="app.updateClipProperty('useOriginalSize', this.checked)">
                        原寸表示
                    </div>
                </div>
            `;
        }
        
        panel.innerHTML = propertiesHTML;
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
    
    updateClipProperty(property, value) {
        if (!this.selectedClip) return;
        this.selectedClip[property] = value;
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
        
        this.updatePreview();
        this.drawTimeline();
        this.updatePropertiesPanel();
        this.saveHistory();
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
        
        activeClips.forEach(clip => {
            this.renderClip(clip);
        });
        
        // エフェクト適用
        this.applyEffects();
    }
    
    async renderClip(clip) {
        const localTime = this.currentTime - clip.startTime;
        
        // ループ処理
        let effectiveLocalTime = localTime;
        if (clip.loopCount > 1 && (clip.asset.type === 'video' || clip.asset.type === 'sequence')) {
            // ビデオまたは連番の実際の長さを計算
            let actualDuration = clip.duration / clip.loopCount;
            effectiveLocalTime = localTime % actualDuration;
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
            this.playAudioClip(clip, localTime);
            return;
        }
        
        ctx.save();
        
        // トランジション効果を適用
        this.applyTransition(clip, localTime, transitionProgress);
        
        // 中心を基準に変形
        ctx.translate(this.previewCanvas.width / 2 + x, this.previewCanvas.height / 2 + y);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.scale(scale, scale);
        ctx.globalAlpha = opacity * transitionProgress;
        
        // 素材を描画
        if (clip.asset.type === 'image') {
            await this.drawImage(clip);
        } else if (clip.asset.type === 'video') {
            await this.drawVideo(clip, effectiveLocalTime);
            this.playAudioClip(clip, localTime);
        } else if (clip.asset.type === 'sequence') {
            await this.drawSequence(clip, effectiveLocalTime);
        }
        
        ctx.restore();
    }
    
    // 連番アニメーションを描画
    async drawSequence(clip, localTime) {
        const frameRate = clip.frameRate || 30;
        const frameIndex = Math.floor(localTime * frameRate) % clip.asset.frameCount;
        
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
        
        let drawWidth, drawHeight;
        
        if (clip.useOriginalSize && img.width && img.height) {
            drawWidth = img.width;
            drawHeight = img.height;
        } else {
            const aspectRatio = img.width / img.height;
            const maxWidth = 800;
            const maxHeight = 600;
            
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
        
        if (this.isPlaying) {
            if (clip.audioElement.paused) {
                clip.audioElement.currentTime = localTime;
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
                    resolve();
                };
                clip.imageElement.src = clip.asset.url;
            } else {
                this.drawImageOnCanvas(clip);
                resolve();
            }
        });
    }
    
    drawImageOnCanvas(clip) {
        const img = clip.imageElement;
        const ctx = this.previewCtx;
        
        let drawWidth, drawHeight;
        
        if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
            // 原寸表示
            drawWidth = clip.originalWidth;
            drawHeight = clip.originalHeight;
        } else {
            // アスペクト比を維持してフィット
            const aspectRatio = img.width / img.height;
            const maxWidth = 800;
            const maxHeight = 600;
            
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
            if (!clip.videoElement) {
                clip.videoElement = document.createElement('video');
                clip.videoElement.src = clip.asset.url;
                clip.videoElement.muted = true;
                clip.videoElement.onloadeddata = () => {
                    clip.videoElement.currentTime = localTime;
                };
            } else {
                if (Math.abs(clip.videoElement.currentTime - localTime) > 0.1) {
                    clip.videoElement.currentTime = localTime;
                }
            }
            
            setTimeout(() => {
                this.drawVideoOnCanvas(clip);
                resolve();
            }, 50);
        });
    }
    
    drawVideoOnCanvas(clip) {
        const video = clip.videoElement;
        const ctx = this.previewCtx;
        
        if (video.readyState >= 2) {
            let drawWidth, drawHeight;
            
            if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
                // 原寸表示
                drawWidth = clip.originalWidth;
                drawHeight = clip.originalHeight;
            } else {
                // アスペクト比を維持してフィット
                const aspectRatio = video.videoWidth / video.videoHeight;
                const maxWidth = 800;
                const maxHeight = 600;
                
                drawWidth = maxWidth;
                drawHeight = maxWidth / aspectRatio;
                
                if (drawHeight > maxHeight) {
                    drawHeight = maxHeight;
                    drawWidth = maxHeight * aspectRatio;
                }
            }
            
            ctx.drawImage(video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        }
    }
    
    applyEffects() {
        const ctx = this.previewCtx;
        const width = this.previewCanvas.width;
        const height = this.previewCanvas.height;
        
        // レターボックス
        if (this.effects.letterbox.enabled) {
            ctx.fillStyle = this.effects.letterbox.color;
            ctx.fillRect(0, 0, width, this.effects.letterbox.height);
            ctx.fillRect(0, height - this.effects.letterbox.height, width, this.effects.letterbox.height);
        }
        
        // グラデーション
        if (this.effects.gradient.enabled) {
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            
            const opacity = this.effects.gradient.opacity / 100;
            const topColor = this.hexToRgba(this.effects.gradient.topColor, opacity);
            const bottomColor = this.hexToRgba(this.effects.gradient.bottomColor, opacity);
            
            gradient.addColorStop(0, topColor);
            gradient.addColorStop(1, bottomColor);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        }
    }
    
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    // 再生コントロール
    play() {
        if (this.isPlaying) {
            this.pause();
            return;
        }
        
        this.isPlaying = true;
        document.getElementById('playButton').textContent = '⏸️ 一時停止';
        
        const startTime = Date.now();
        const startFrame = this.currentTime;
        
        this.playInterval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            this.currentTime = startFrame + elapsed;
            
            if (this.currentTime >= this.duration) {
                this.stop();
                return;
            }
            
            this.updateTimeDisplay();
            this.updatePreview();
            this.drawTimeline();
        }, 1000 / this.fps);
    }
    
    pause() {
        this.isPlaying = false;
        document.getElementById('playButton').textContent = '▶️ 再生';
        if (this.playInterval) {
            clearInterval(this.playInterval);
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
    
    splitClip() {
        if (!this.selectedClip) return;
        
        const localTime = this.currentTime - this.selectedClip.startTime;
        
        if (localTime <= 0 || localTime >= this.selectedClip.duration) {
            alert('クリップの範囲内で分割してください');
            return;
        }
        
        // 新しいクリップを作成
        const newClip = JSON.parse(JSON.stringify(this.selectedClip));
        newClip.id = Date.now() + Math.random();
        newClip.startTime = this.selectedClip.startTime + localTime;
        newClip.duration = this.selectedClip.duration - localTime;
        
        // キーフレームを調整
        Object.keys(newClip.keyframes).forEach(property => {
            newClip.keyframes[property] = newClip.keyframes[property]
                .filter(kf => kf.time >= localTime)
                .map(kf => ({ time: kf.time - localTime, value: kf.value }));
        });
        
        // 元のクリップの長さを調整
        this.selectedClip.duration = localTime;
        Object.keys(this.selectedClip.keyframes).forEach(property => {
            this.selectedClip.keyframes[property] = this.selectedClip.keyframes[property]
                .filter(kf => kf.time <= localTime);
        });
        
        this.clips.push(newClip);
        this.drawTimeline();
        this.saveHistory();
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
        if (e.key === 'Delete' && this.selectedClip) {
            this.deleteSelected();
        }
        
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
        }
        
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
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
        
        this.drawTimeline();
        this.updatePreview();
        this.updatePropertiesPanel();
    }
    
    // プロジェクト保存/読み込み
    saveProject() {
        const project = {
            version: '1.0',
            clips: this.clips.map(clip => ({
                ...clip,
                asset: {
                    id: clip.asset.id,
                    name: clip.asset.name,
                    type: clip.asset.type
                }
            })),
            effects: this.effects,
            settings: {
                fps: this.fps,
                duration: this.duration,
                resolution: {
                    width: this.previewCanvas.width,
                    height: this.previewCanvas.height
                }
            }
        };
        
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'starlit_project.json';
        a.click();
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
                // プロジェクト読み込みロジック
                alert('プロジェクトを読み込みました(素材は再インポートが必要です)');
            } catch (err) {
                alert('プロジェクトの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);
    }
    
    newProject() {
        if (confirm('新規プロジェクトを作成しますか?未保存の変更は失われます。')) {
            this.clips = [];
            this.selectedClip = null;
            this.currentTime = 0;
            this.drawTimeline();
            this.updatePreview();
            this.updatePropertiesPanel();
        }
    }
    
    // 書き出し機能
    async exportVideo() {
        alert('MP4書き出し機能は開発中です。現在はブラウザの制限により、連番PNG書き出しをご利用ください。');
    }
    
    async exportSequence() {
        const startTime = parseFloat(document.getElementById('exportStart').value);
        const endTime = parseFloat(document.getElementById('exportEnd').value);
        
        if (startTime >= endTime) {
            alert('書き出し範囲が不正です');
            return;
        }
        
        const frames = Math.ceil((endTime - startTime) * this.fps);
        
        if (!confirm(`${frames}フレームを書き出しますか?`)) {
            return;
        }
        
        const originalTime = this.currentTime;
        
        for (let i = 0; i < frames; i++) {
            this.currentTime = startTime + (i / this.fps);
            this.updatePreview();
            
            // フレームを画像として保存
            const dataUrl = this.previewCanvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `frame_${i.toString().padStart(5, '0')}.png`;
            a.click();
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.currentTime = originalTime;
        this.updatePreview();
        
        alert('連番PNG書き出しが完了しました!');
    }
    
    async exportAudio() {
        alert('音声書き出し機能は開発中です');
    }
}

// アプリケーション初期化
const app = new StarlitTimelineApp();
