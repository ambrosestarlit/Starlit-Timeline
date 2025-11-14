// ========================================
// Starlit Timeline Editor Pro - JK丸ゴシック版
// ========================================
// メインアプリケーションクラス
// ========================================

class StarlitTimelineEditor {
    constructor() {
        // キャンバス設定
        this.canvas = document.getElementById('previewCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // プロジェクト設定
        this.fps = 30;
        this.duration = 30; // 秒
        this.currentTime = 0;
        this.isPlaying = false;
        this.zoom = 100; // パーセント
        
        // データ
        this.assets = [];
        this.tracks = [
            { id: 1, name: 'ビデオトラック 1', type: 'video', clips: [] },
            { id: 2, name: 'ビデオトラック 2', type: 'video', clips: [] },
            { id: 3, name: 'オーディオトラック 1', type: 'audio', clips: [] }
        ];
        this.selectedClip = null;
        this.currentFilter = 'all';
        
        // ドラッグ＆ドロップ状態
        this.draggedAsset = null;
        this.draggedClip = null;
        this.resizingClip = null;
        this.resizeMode = null;
        
        // プロパティセクション開閉状態
        this.sectionStates = {
            transition: true,
            audio: true,
            loop: true,
            transform: true
        };
        
        // AEプロパティ開閉状態
        this.aePropertyStates = {
            position: false,
            scale: false,
            rotation: false,
            opacity: false
        };
        
        // 初期化
        this.init();
    }
    
    // ========================================
    // 初期化
    // ========================================
    init() {
        this.setupEventListeners();
        this.updateTimelineRuler();
        this.renderTracks();
        this.renderAssetList();
        this.updateTimeDisplay();
        this.render();
        
        console.log('🎬 Starlit Timeline Editor Pro 起動完了！');
    }
    
    // ========================================
    // イベントリスナー設定
    // ========================================
    setupEventListeners() {
        // 素材リストのドラッグ開始
        document.getElementById('assetList').addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('asset-item')) {
                const assetId = parseInt(e.target.dataset.id);
                this.draggedAsset = this.assets.find(a => a.id === assetId);
            }
        });
        
        // トラックへのドロップ
        document.getElementById('tracks').addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.getElementById('tracks').addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedAsset) {
                this.addClipToTrack(e);
            }
        });
        
        // クリップクリック
        document.getElementById('tracks').addEventListener('click', (e) => {
            if (e.target.closest('.clip')) {
                const clipElement = e.target.closest('.clip');
                const trackId = parseInt(clipElement.dataset.trackId);
                const clipId = parseInt(clipElement.dataset.clipId);
                this.selectClip(trackId, clipId);
            }
        });
        
        // 再生ヘッドのドラッグ
        const playheadHandle = document.querySelector('.playhead-handle');
        let isDraggingPlayhead = false;
        
        playheadHandle.addEventListener('mousedown', (e) => {
            isDraggingPlayhead = true;
            this.isPlaying = false;
            this.updatePlayPauseButton();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDraggingPlayhead) {
                const timelineArea = document.getElementById('timelineArea');
                const rect = timelineArea.getBoundingClientRect();
                const x = e.clientX - rect.left + timelineArea.scrollLeft;
                const pixelsPerSecond = (this.zoom / 100) * 100;
                this.currentTime = Math.max(0, Math.min(this.duration, x / pixelsPerSecond));
                this.updatePlayhead();
                this.updateTimeDisplay();
                this.render();
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDraggingPlayhead = false;
        });
    }
    
    // ========================================
    // 素材管理
    // ========================================
    importAsset() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,video/*,audio/*';
        
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            
            for (const file of files) {
                const asset = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: this.getFileType(file),
                    file: file,
                    url: URL.createObjectURL(file)
                };
                
                // 画像・動画の場合は読み込み
                if (asset.type === 'image' || asset.type === 'video') {
                    await this.loadMediaAsset(asset);
                }
                
                this.assets.push(asset);
            }
            
            this.renderAssetList();
        };
        
        input.click();
    }
    
    getFileType(file) {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        return 'unknown';
    }
    
    async loadMediaAsset(asset) {
        return new Promise((resolve) => {
            if (asset.type === 'image') {
                const img = new Image();
                img.onload = () => {
                    asset.element = img;
                    asset.width = img.width;
                    asset.height = img.height;
                    asset.duration = 5; // デフォルト5秒
                    resolve();
                };
                img.src = asset.url;
            } else if (asset.type === 'video') {
                const video = document.createElement('video');
                video.onloadedmetadata = () => {
                    asset.element = video;
                    asset.width = video.videoWidth;
                    asset.height = video.videoHeight;
                    asset.duration = video.duration;
                    resolve();
                };
                video.src = asset.url;
            }
        });
    }
    
    filterAssets(type) {
        this.currentFilter = type;
        
        // タブのアクティブ状態更新
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        this.renderAssetList();
    }
    
    renderAssetList() {
        const assetList = document.getElementById('assetList');
        const filteredAssets = this.currentFilter === 'all' 
            ? this.assets 
            : this.assets.filter(a => a.type === this.currentFilter);
        
        assetList.innerHTML = filteredAssets.map(asset => `
            <div class="asset-item" draggable="true" data-id="${asset.id}">
                <div class="asset-name">${asset.name}</div>
                <div class="asset-type">
                    ${asset.type === 'image' ? '🖼️ 画像' : 
                      asset.type === 'video' ? '🎥 動画' : 
                      asset.type === 'audio' ? '🎵 音声' : '❓ 不明'}
                </div>
            </div>
        `).join('');
    }
    
    // ========================================
    // トラック＆クリップ管理
    // ========================================
    addClipToTrack(e) {
        const tracksElement = document.getElementById('tracks');
        const rect = tracksElement.getBoundingClientRect();
        const y = e.clientY - rect.top;
        
        // どのトラックか判定
        const trackHeight = 80;
        const trackIndex = Math.floor(y / trackHeight);
        
        if (trackIndex >= 0 && trackIndex < this.tracks.length) {
            const track = this.tracks[trackIndex];
            
            // トラックタイプと素材タイプの互換性チェック
            if (track.type === 'audio' && this.draggedAsset.type !== 'audio') {
                alert('⚠️ オーディオトラックには音声ファイルのみ追加できます');
                return;
            }
            if (track.type === 'video' && this.draggedAsset.type === 'audio') {
                alert('⚠️ ビデオトラックには音声ファイルを追加できません');
                return;
            }
            
            // クリップ位置計算
            const x = e.clientX - rect.left + document.getElementById('timelineArea').scrollLeft;
            const pixelsPerSecond = (this.zoom / 100) * 100;
            const startTime = x / pixelsPerSecond;
            
            const clip = {
                id: Date.now(),
                asset: this.draggedAsset,
                startTime: Math.max(0, startTime),
                duration: this.draggedAsset.duration || 5,
                trimStart: 0,
                trimEnd: this.draggedAsset.duration || 5,
                // トランスフォームプロパティ
                transform: {
                    x: 0,
                    y: 0,
                    scale: 100,
                    rotation: 0,
                    opacity: 100
                },
                keyframes: {
                    x: [],
                    y: [],
                    scale: [],
                    rotation: [],
                    opacity: []
                },
                // トランジション
                transition: {
                    in: { type: 'none', duration: 0 },
                    out: { type: 'none', duration: 0 }
                },
                // 音声設定
                volume: 100,
                // ループ設定
                loop: false
            };
            
            track.clips.push(clip);
            this.renderTracks();
            this.selectClip(track.id, clip.id);
        }
        
        this.draggedAsset = null;
    }
    
    selectClip(trackId, clipId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            this.selectedClip = track.clips.find(c => c.id === clipId);
            this.renderTracks();
            this.updatePropertiesPanel();
        }
    }
    
    renderTracks() {
        const tracksElement = document.getElementById('tracks');
        
        tracksElement.innerHTML = this.tracks.map(track => {
            const clipsHTML = track.clips.map(clip => {
                const pixelsPerSecond = (this.zoom / 100) * 100;
                const left = clip.startTime * pixelsPerSecond;
                const width = clip.duration * pixelsPerSecond;
                const isSelected = this.selectedClip && this.selectedClip.id === clip.id;
                
                return `
                    <div class="clip ${isSelected ? 'selected' : ''}" 
                         data-track-id="${track.id}"
                         data-clip-id="${clip.id}"
                         style="left: ${left}px; width: ${width}px;">
                        <div class="clip-resize-handle left"></div>
                        <div class="clip-content">${clip.asset.name}</div>
                        <div class="clip-resize-handle right"></div>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="track">
                    <div class="track-header">${track.name}</div>
                    ${clipsHTML}
                </div>
            `;
        }).join('');
    }
    
    // ========================================
    // プロパティパネル
    // ========================================
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
                <div class="property-label">デュレーション: <span id="durationValue">${clip.duration.toFixed(2)}秒</span></div>
                <input type="range" class="property-slider" value="${clip.duration.toFixed(2)}" 
                    min="0.1" max="30" step="0.1"
                    oninput="app.updateClipProperty('duration', parseFloat(this.value)); document.getElementById('durationValue').textContent = this.value + '秒'">
            </div>
        `;
        
        // トランジション設定
        propertiesHTML += `
            <div class="property-section-header" onclick="app.togglePropertySection('transition')">
                <span class="section-toggle-icon" id="transitionToggle">${this.sectionStates.transition ? '▼' : '▶'}</span>
                🎬 トランジション
            </div>
            <div class="property-section-content ${this.sectionStates.transition ? '' : 'collapsed'}" id="transitionContent">
                <div class="property-group">
                    <div class="property-label">イン</div>
                    <select class="property-slider" onchange="app.updateTransition('in', 'type', this.value)">
                        <option value="none" ${clip.transition.in.type === 'none' ? 'selected' : ''}>なし</option>
                        <option value="fade" ${clip.transition.in.type === 'fade' ? 'selected' : ''}>フェード</option>
                        <option value="slide" ${clip.transition.in.type === 'slide' ? 'selected' : ''}>スライド</option>
                    </select>
                </div>
                
                <div class="property-group">
                    <div class="property-label">アウト</div>
                    <select class="property-slider" onchange="app.updateTransition('out', 'type', this.value)">
                        <option value="none" ${clip.transition.out.type === 'none' ? 'selected' : ''}>なし</option>
                        <option value="fade" ${clip.transition.out.type === 'fade' ? 'selected' : ''}>フェード</option>
                        <option value="slide" ${clip.transition.out.type === 'slide' ? 'selected' : ''}>スライド</option>
                    </select>
                </div>
            </div>
        `;
        
        // 音声設定（オーディオクリップの場合）
        if (clip.asset.type === 'audio' || clip.asset.type === 'video') {
            propertiesHTML += `
                <div class="property-section-header" onclick="app.togglePropertySection('audio')">
                    <span class="section-toggle-icon" id="audioToggle">${this.sectionStates.audio ? '▼' : '▶'}</span>
                    🔊 音声
                </div>
                <div class="property-section-content ${this.sectionStates.audio ? '' : 'collapsed'}" id="audioContent">
                    <div class="property-group">
                        <div class="property-label">音量: <span id="volumeValue">${clip.volume}%</span></div>
                        <input type="range" class="property-slider" value="${clip.volume}" 
                            min="0" max="200" step="1"
                            oninput="app.updateClipProperty('volume', parseInt(this.value)); document.getElementById('volumeValue').textContent = this.value + '%'">
                    </div>
                </div>
            `;
        }
        
        // ループ設定
        propertiesHTML += `
            <div class="property-section-header" onclick="app.togglePropertySection('loop')">
                <span class="section-toggle-icon" id="loopToggle">${this.sectionStates.loop ? '▼' : '▶'}</span>
                🔁 ループ
            </div>
            <div class="property-section-content ${this.sectionStates.loop ? '' : 'collapsed'}" id="loopContent">
                <div class="property-group">
                    <label>
                        <input type="checkbox" ${clip.loop ? 'checked' : ''} 
                               onchange="app.updateClipProperty('loop', this.checked)">
                        ループ再生を有効にする
                    </label>
                </div>
            </div>
        `;
        
        // 映像クリップの場合はトランスフォーム設定
        if (clip.asset.type === 'image' || clip.asset.type === 'video' || clip.asset.type === 'sequence') {
            const currentX = this.getKeyframeValue(clip, 'x', localTime);
            const currentY = this.getKeyframeValue(clip, 'y', localTime);
            const currentRotation = this.getKeyframeValue(clip, 'rotation', localTime);
            const currentOpacity = this.getKeyframeValue(clip, 'opacity', localTime);
            const currentScale = this.getKeyframeValue(clip, 'scale', localTime);
            
            propertiesHTML += `
                <div class="property-section-header" onclick="app.togglePropertySection('transform')">
                    <span class="section-toggle-icon" id="transformToggle">${this.sectionStates.transform ? '▼' : '▶'}</span>
                    📐 トランスフォーム
                </div>
                <div class="property-section-content ${this.sectionStates.transform ? '' : 'collapsed'}" id="transformContent">
                    <!-- 位置 -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('position')">
                            <span class="ae-property-icon" id="positionIcon">${this.aePropertyStates.position ? '▼' : '▶'}</span>
                            <span class="ae-property-name">📍 位置</span>
                            <span class="ae-property-value">${currentX.toFixed(0)}, ${currentY.toFixed(0)}</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'x', localTime) || this.hasKeyframeAt(clip, 'y', localTime) ? 'active' : ''}"
                                    onclick="app.toggleKeyframe('x'); app.toggleKeyframe('y'); event.stopPropagation();">💎</button>
                        </div>
                        <div class="ae-property-content ${this.aePropertyStates.position ? 'expanded' : ''}" id="positionContent">
                            <div class="ae-subproperty">
                                <span class="ae-subproperty-label">X:</span>
                                <input type="range" class="ae-subproperty-slider" value="${currentX}" 
                                    min="-1920" max="1920" step="1"
                                    oninput="app.updateTransformProperty('x', parseFloat(this.value))">
                            </div>
                            <div class="ae-subproperty">
                                <span class="ae-subproperty-label">Y:</span>
                                <input type="range" class="ae-subproperty-slider" value="${currentY}" 
                                    min="-1080" max="1080" step="1"
                                    oninput="app.updateTransformProperty('y', parseFloat(this.value))">
                            </div>
                        </div>
                    </div>
                    
                    <!-- スケール -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('scale')">
                            <span class="ae-property-icon" id="scaleIcon">${this.aePropertyStates.scale ? '▼' : '▶'}</span>
                            <span class="ae-property-name">🔍 スケール</span>
                            <span class="ae-property-value">${currentScale.toFixed(0)}%</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'scale', localTime) ? 'active' : ''}"
                                    onclick="app.toggleKeyframe('scale'); event.stopPropagation();">💎</button>
                        </div>
                        <div class="ae-property-content ${this.aePropertyStates.scale ? 'expanded' : ''}" id="scaleContent">
                            <div class="ae-subproperty">
                                <input type="range" class="ae-subproperty-slider" value="${currentScale}" 
                                    min="1" max="500" step="1"
                                    oninput="app.updateTransformProperty('scale', parseFloat(this.value))">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 回転 -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('rotation')">
                            <span class="ae-property-icon" id="rotationIcon">${this.aePropertyStates.rotation ? '▼' : '▶'}</span>
                            <span class="ae-property-name">🔄 回転</span>
                            <span class="ae-property-value">${currentRotation.toFixed(0)}°</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'rotation', localTime) ? 'active' : ''}"
                                    onclick="app.toggleKeyframe('rotation'); event.stopPropagation();">💎</button>
                        </div>
                        <div class="ae-property-content ${this.aePropertyStates.rotation ? 'expanded' : ''}" id="rotationContent">
                            <div class="ae-subproperty">
                                <input type="range" class="ae-subproperty-slider" value="${currentRotation}" 
                                    min="0" max="360" step="1"
                                    oninput="app.updateTransformProperty('rotation', parseFloat(this.value))">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 不透明度 -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('opacity')">
                            <span class="ae-property-icon" id="opacityIcon">${this.aePropertyStates.opacity ? '▼' : '▶'}</span>
                            <span class="ae-property-name">👁️ 不透明度</span>
                            <span class="ae-property-value">${currentOpacity.toFixed(0)}%</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'opacity', localTime) ? 'active' : ''}"
                                    onclick="app.toggleKeyframe('opacity'); event.stopPropagation();">💎</button>
                        </div>
                        <div class="ae-property-content ${this.aePropertyStates.opacity ? 'expanded' : ''}" id="opacityContent">
                            <div class="ae-subproperty">
                                <input type="range" class="ae-subproperty-slider" value="${currentOpacity}" 
                                    min="0" max="100" step="1"
                                    oninput="app.updateTransformProperty('opacity', parseFloat(this.value))">
                            </div>
                        </div>
                    </div>
                    
                    <!-- キーフレームリスト -->
                    ${this.renderKeyframeManager(clip)}
                </div>
            `;
        }
        
        panel.innerHTML = propertiesHTML;
    }
    
    // セクション開閉
    togglePropertySection(sectionName) {
        this.sectionStates[sectionName] = !this.sectionStates[sectionName];
        const content = document.getElementById(sectionName + 'Content');
        const toggle = document.getElementById(sectionName + 'Toggle');
        
        if (this.sectionStates[sectionName]) {
            content.classList.remove('collapsed');
            toggle.textContent = '▼';
        } else {
            content.classList.add('collapsed');
            toggle.textContent = '▶';
        }
    }
    
    // AE風プロパティ開閉
    toggleAEProperty(propertyName) {
        this.aePropertyStates[propertyName] = !this.aePropertyStates[propertyName];
        const content = document.getElementById(propertyName + 'Content');
        const icon = document.getElementById(propertyName + 'Icon');
        
        if (this.aePropertyStates[propertyName]) {
            content.classList.add('expanded');
            icon.textContent = '▼';
        } else {
            content.classList.remove('expanded');
            icon.textContent = '▶';
        }
    }
    
    renderKeyframeManager(clip) {
        const localTime = this.currentTime - clip.startTime;
        let html = '<div class="keyframe-manager">';
        html += '<div class="keyframe-list-header">⏱️ キーフレーム一覧</div>';
        
        const properties = ['x', 'y', 'scale', 'rotation', 'opacity'];
        const propertyNames = {
            x: 'X位置',
            y: 'Y位置',
            scale: 'スケール',
            rotation: '回転',
            opacity: '不透明度'
        };
        
        for (const prop of properties) {
            if (clip.keyframes[prop] && clip.keyframes[prop].length > 0) {
                clip.keyframes[prop].forEach((kf, index) => {
                    html += `
                        <div class="keyframe-item">
                            <span class="keyframe-time">${kf.time.toFixed(2)}秒</span>
                            <span class="keyframe-value">${propertyNames[prop]}: ${kf.value.toFixed(1)}</span>
                            <button class="btn-delete-keyframe" 
                                    onclick="app.deleteKeyframe('${prop}', ${index})">🗑️</button>
                        </div>
                    `;
                });
            }
        }
        
        html += '</div>';
        return html;
    }
    
    // ========================================
    // キーフレーム管理
    // ========================================
    toggleKeyframe(property) {
        if (!this.selectedClip) return;
        
        const clip = this.selectedClip;
        const localTime = this.currentTime - clip.startTime;
        
        if (localTime < 0 || localTime > clip.duration) {
            alert('⚠️ 現在の時間がクリップの範囲外です');
            return;
        }
        
        const existingIndex = clip.keyframes[property].findIndex(
            kf => Math.abs(kf.time - localTime) < 0.01
        );
        
        if (existingIndex >= 0) {
            // 既存のキーフレームを削除
            clip.keyframes[property].splice(existingIndex, 1);
        } else {
            // 新しいキーフレームを追加
            const currentValue = this.getKeyframeValue(clip, property, localTime);
            clip.keyframes[property].push({
                time: localTime,
                value: currentValue
            });
            clip.keyframes[property].sort((a, b) => a.time - b.time);
        }
        
        this.updatePropertiesPanel();
    }
    
    deleteKeyframe(property, index) {
        if (!this.selectedClip) return;
        this.selectedClip.keyframes[property].splice(index, 1);
        this.updatePropertiesPanel();
    }
    
    hasKeyframeAt(clip, property, time) {
        return clip.keyframes[property].some(
            kf => Math.abs(kf.time - time) < 0.01
        );
    }
    
    getKeyframeValue(clip, property, time) {
        const keyframes = clip.keyframes[property];
        
        if (keyframes.length === 0) {
            return clip.transform[property];
        }
        
        // 最初のキーフレームより前
        if (time <= keyframes[0].time) {
            return keyframes[0].value;
        }
        
        // 最後のキーフレームより後
        if (time >= keyframes[keyframes.length - 1].time) {
            return keyframes[keyframes.length - 1].value;
        }
        
        // 線形補間
        for (let i = 0; i < keyframes.length - 1; i++) {
            const kf1 = keyframes[i];
            const kf2 = keyframes[i + 1];
            
            if (time >= kf1.time && time <= kf2.time) {
                const t = (time - kf1.time) / (kf2.time - kf1.time);
                return kf1.value + (kf2.value - kf1.value) * t;
            }
        }
        
        return clip.transform[property];
    }
    
    updateTransformProperty(property, value) {
        if (!this.selectedClip) return;
        
        const clip = this.selectedClip;
        const localTime = this.currentTime - clip.startTime;
        
        // キーフレームが存在する場合は更新
        const existingIndex = clip.keyframes[property].findIndex(
            kf => Math.abs(kf.time - localTime) < 0.01
        );
        
        if (existingIndex >= 0) {
            clip.keyframes[property][existingIndex].value = value;
        } else {
            clip.transform[property] = value;
        }
        
        this.updatePropertiesPanel();
        this.render();
    }
    
    updateTransition(direction, key, value) {
        if (!this.selectedClip) return;
        this.selectedClip.transition[direction][key] = value;
        this.updatePropertiesPanel();
    }
    
    updateClipProperty(property, value) {
        if (!this.selectedClip) return;
        this.selectedClip[property] = value;
        this.renderTracks();
        this.render();
    }
    
    // ========================================
    // タイムライン表示
    // ========================================
    updateTimelineRuler() {
        const ruler = document.getElementById('timelineRuler');
        const pixelsPerSecond = (this.zoom / 100) * 100;
        const totalWidth = this.duration * pixelsPerSecond;
        
        let html = '';
        for (let i = 0; i <= this.duration; i++) {
            const x = i * pixelsPerSecond;
            html += `
                <div class="ruler-mark" style="left: ${x}px;"></div>
                <div class="ruler-label" style="left: ${x}px;">${i}s</div>
            `;
        }
        
        ruler.innerHTML = html;
        ruler.style.width = totalWidth + 'px';
        document.getElementById('tracks').style.width = totalWidth + 'px';
    }
    
    updatePlayhead() {
        const pixelsPerSecond = (this.zoom / 100) * 100;
        const x = this.currentTime * pixelsPerSecond;
        document.getElementById('playhead').style.left = x + 'px';
    }
    
    updateTimeDisplay() {
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = Math.floor(this.currentTime % 60);
        const milliseconds = Math.floor((this.currentTime % 1) * 1000);
        
        document.getElementById('timeDisplay').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
    
    updateTimelineZoom(value) {
        this.zoom = parseInt(value);
        this.updateTimelineRuler();
        this.renderTracks();
        this.updatePlayhead();
    }
    
    // ========================================
    // 再生コントロール
    // ========================================
    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        this.updatePlayPauseButton();
        
        if (this.isPlaying) {
            this.play();
        }
    }
    
    updatePlayPauseButton() {
        const btn = document.getElementById('playPauseBtn');
        btn.textContent = this.isPlaying ? '⏸️' : '▶️';
    }
    
    play() {
        const startTime = Date.now();
        const startCurrentTime = this.currentTime;
        
        const animate = () => {
            if (!this.isPlaying) return;
            
            const elapsed = (Date.now() - startTime) / 1000;
            this.currentTime = startCurrentTime + elapsed;
            
            if (this.currentTime >= this.duration) {
                this.currentTime = this.duration;
                this.isPlaying = false;
                this.updatePlayPauseButton();
            }
            
            this.updatePlayhead();
            this.updateTimeDisplay();
            this.render();
            
            if (this.isPlaying) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    skipToStart() {
        this.currentTime = 0;
        this.updatePlayhead();
        this.updateTimeDisplay();
        this.render();
    }
    
    skipToEnd() {
        this.currentTime = this.duration;
        this.updatePlayhead();
        this.updateTimeDisplay();
        this.render();
    }
    
    // ========================================
    // レンダリング
    // ========================================
    render() {
        // キャンバスクリア
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 各トラックのクリップをレンダリング
        for (const track of this.tracks) {
            if (track.type === 'video') {
                for (const clip of track.clips) {
                    if (this.currentTime >= clip.startTime && 
                        this.currentTime < clip.startTime + clip.duration) {
                        this.renderClip(clip);
                    }
                }
            }
        }
    }
    
    renderClip(clip) {
        const localTime = this.currentTime - clip.startTime;
        const element = clip.asset.element;
        
        if (!element) return;
        
        // トランスフォーム値取得
        const x = this.getKeyframeValue(clip, 'x', localTime);
        const y = this.getKeyframeValue(clip, 'y', localTime);
        const scale = this.getKeyframeValue(clip, 'scale', localTime) / 100;
        const rotation = this.getKeyframeValue(clip, 'rotation', localTime);
        const opacity = this.getKeyframeValue(clip, 'opacity', localTime) / 100;
        
        // トランジション適用
        let transitionOpacity = 1;
        if (clip.transition.in.type === 'fade' && localTime < clip.transition.in.duration) {
            transitionOpacity = localTime / clip.transition.in.duration;
        }
        if (clip.transition.out.type === 'fade' && localTime > clip.duration - clip.transition.out.duration) {
            const fadeOutTime = clip.duration - localTime;
            transitionOpacity = fadeOutTime / clip.transition.out.duration;
        }
        
        this.ctx.save();
        
        // 中心を基準に変換
        this.ctx.translate(this.canvas.width / 2 + x, this.canvas.height / 2 + y);
        this.ctx.rotate(rotation * Math.PI / 180);
        this.ctx.scale(scale, scale);
        this.ctx.globalAlpha = opacity * transitionOpacity;
        
        // 画像を描画
        const width = clip.asset.width;
        const height = clip.asset.height;
        this.ctx.drawImage(element, -width / 2, -height / 2, width, height);
        
        this.ctx.restore();
    }
    
    // ========================================
    // プロジェクト保存/読込
    // ========================================
    saveProject() {
        const project = {
            duration: this.duration,
            tracks: this.tracks.map(track => ({
                ...track,
                clips: track.clips.map(clip => ({
                    ...clip,
                    asset: {
                        id: clip.asset.id,
                        name: clip.asset.name,
                        type: clip.asset.type
                    }
                }))
            }))
        };
        
        const json = JSON.stringify(project, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'starlit-project.json';
        a.click();
        
        console.log('💾 プロジェクト保存完了！');
    }
    
    loadProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const project = JSON.parse(event.target.result);
                this.duration = project.duration;
                this.tracks = project.tracks;
                this.renderTracks();
                this.updateTimelineRuler();
                console.log('📂 プロジェクト読込完了！');
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    // ========================================
    // 動画書き出し
    // ========================================
    async exportVideo() {
        alert('🎬 動画書き出し機能は開発中です！\n現在はプレビューのみ対応しています。');
    }
}

// ========================================
// アプリケーション起動
// ========================================
const app = new StarlitTimelineEditor();
