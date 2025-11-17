// ========================================
// clipping.js - クリッピング機能モジュール
// ========================================

class ClippingManager {
    constructor(app) {
        this.app = app;
    }
    
    // クリップにclipSourceプロパティを初期化
    initClipProperties(clip) {
        if (!clip.clipSource) {
            clip.clipSource = null;
        }
    }
    
    // プロパティセクションの状態を初期化
    initPropertySectionStates() {
        if (!this.app.propertySectionStates.clipping) {
            this.app.propertySectionStates.clipping = false;
        }
    }
    
    // プロパティパネルにクリッピングセクションHTMLを生成（親子関係の直前に挿入）
    generateClippingHTML(clip) {
        // クリップソース名を取得
        let clipSourceName = 'なし';
        if (clip.clipSource) {
            const clipSourceClip = this.app.clips.find(c => c.id == clip.clipSource);
            if (clipSourceClip && clipSourceClip.asset) {
                clipSourceName = clipSourceClip.asset.name;
            }
        }
        
        return `
            <div class="property-section-header" onclick="app.togglePropertySection('clipping')">
                <span class="section-toggle-icon" id="clippingToggle">▶</span>
                ✂️ クリッピング
            </div>
            <div class="property-section-content collapsed" id="clippingContent">
                <div class="ae-property-group">
                    <div class="ae-property-header">
                        <span class="ae-property-name">🎯 クリップソース</span>
                        <span class="ae-property-value" style="font-size: 11px; color: ${clip.clipSource ? '#FFD700' : '#999'};">${clipSourceName}</span>
                    </div>
                    <div class="ae-property-content" style="padding: 10px; display: block;">
                        <select id="clipSourceSelect" class="property-slider" style="width: 100%; padding: 8px; margin-bottom: 8px; background: var(--chocolate-main); color: var(--biscuit-light); border: 1px solid var(--chocolate-dark); border-radius: 4px;">
                            <option value="">なし</option>
                        </select>
                        <button class="small-button" onclick="app.clippingManager.setClipSource()" style="width: 100%; margin-bottom: 4px; padding: 8px; background: var(--accent-orange); color: white; border: none; border-radius: 4px; cursor: pointer;">
                            ✂️ クリップソースを設定
                        </button>
                        <button class="small-button" onclick="app.clippingManager.removeClipSource()" style="width: 100%; padding: 8px; background: var(--chocolate-dark); color: white; border: none; border-radius: 4px; cursor: pointer;">
                            ❌ クリップソースを解除
                        </button>
                        <div style="background: rgba(210, 105, 30, 0.2); padding: 8px; margin-top: 8px; border-radius: 4px; font-size: 11px; line-height: 1.5; color: var(--biscuit-light);">
                            💡 クリップソースに指定した素材の不透明部分だけに、このクリップが表示されます。<br>
                            タイムライン上の任意のクリップを選択できます。
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // クリッピングセクションの選択肢を更新
    updateClipSourceSelect(clip) {
        const select = document.getElementById('clipSourceSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">なし</option>';
        
        // 自分以外の全てのクリップを選択肢に追加（トラック位置に関係なく）
        const availableClips = this.app.clips.filter(c => 
            c.id !== clip.id // 自分自身のみ除外
        );
        
        // トラック順にソート（上から順）
        availableClips.sort((a, b) => a.track - b.track);
        
        availableClips.forEach(c => {
            const asset = this.app.assets.find(a => a.id === c.asset.id);
            const option = document.createElement('option');
            option.value = c.id;
            
            // 見やすい表示名
            const assetName = asset ? asset.name : `Clip ${c.id}`;
            const trackName = this.app.trackNames[c.track] || `Track ${c.track + 1}`;
            option.textContent = `${assetName} (${trackName})`;
            
            if (clip.clipSource == c.id) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
    
    // クリップソースを設定
    setClipSource() {
        if (!this.app.selectedClip) return;
        
        const select = document.getElementById('clipSourceSelect');
        const value = select.value;
        
        if (value) {
            this.app.selectedClip.clipSource = value;
        } else {
            this.app.selectedClip.clipSource = null;
        }
        
        this.app.updatePropertiesPanel();
        this.app.updatePreview();
        this.app.saveHistory('クリップソース設定');
    }
    
    // クリップソースを解除
    removeClipSource() {
        if (!this.app.selectedClip) return;
        
        this.app.selectedClip.clipSource = null;
        this.app.updatePropertiesPanel();
        this.app.updatePreview();
        this.app.saveHistory('クリップソース解除');
    }
    
    // クリッピングを適用（メイン処理）
    // ctxは既にクリップが描画されているキャンバスのコンテキスト
    // clipは描画済みのクリップ（マスクされる側）
    applyClipping(ctx, clip, time) {
        if (!clip.clipSource) return false;
        
        const clipSourceClip = this.app.clips.find(c => c.id == clip.clipSource);
        if (!clipSourceClip || !this.isClipVisibleAtTime(clipSourceClip, time)) {
            return false;
        }
        
        // クリップソースをマスク用の一時キャンバスに描画
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = ctx.canvas.width;
        maskCanvas.height = ctx.canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        
        // 一時的にpreviewCtxを切り替えてクリップソースを描画
        const originalCtx = this.app.previewCtx;
        this.app.previewCtx = maskCtx;
        
        // クリップソースをそのまま描画（renderClipと同じ処理）
        // ※awaitを使わないため、同期的に描画可能な部分のみ実行
        const clipSourceLocalTime = time - clipSourceClip.startTime;
        
        // トランジション処理
        let effectiveLocalTime = clipSourceLocalTime;
        let transitionProgress = 1;
        
        if (clipSourceClip.transitionIn && clipSourceClip.transitionIn.type !== 'none' && clipSourceLocalTime < clipSourceClip.transitionIn.duration) {
            transitionProgress = clipSourceLocalTime / clipSourceClip.transitionIn.duration;
        }
        
        if (clipSourceClip.transitionOut && clipSourceClip.transitionOut.type !== 'none' && clipSourceLocalTime > clipSourceClip.duration - clipSourceClip.transitionOut.duration) {
            const timeInTransition = clipSourceClip.duration - clipSourceLocalTime;
            transitionProgress = timeInTransition / clipSourceClip.transitionOut.duration;
        }
        
        const x = this.app.getKeyframeValue(clipSourceClip, 'x', clipSourceLocalTime);
        const y = this.app.getKeyframeValue(clipSourceClip, 'y', clipSourceLocalTime);
        const rotation = this.app.getKeyframeValue(clipSourceClip, 'rotation', clipSourceLocalTime);
        const opacity = this.app.getKeyframeValue(clipSourceClip, 'opacity', clipSourceLocalTime);
        const scale = this.app.getKeyframeValue(clipSourceClip, 'scale', clipSourceLocalTime);
        
        const parentTransform = this.app.getParentTransform(clipSourceClip, clipSourceLocalTime);
        
        const finalRotation = parentTransform.rotation + rotation;
        const finalScale = parentTransform.scale * scale;
        
        const radians = (parentTransform.rotation * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const finalX = parentTransform.x + (x * cos - y * sin) * parentTransform.scale;
        const finalY = parentTransform.y + (x * sin + y * cos) * parentTransform.scale;
        
        maskCtx.save();
        
        const anchor = clipSourceClip.anchorPoint || { x: 0.5, y: 0.5 };
        
        maskCtx.translate(maskCanvas.width / 2 + finalX, maskCanvas.height / 2 + finalY);
        maskCtx.rotate(finalRotation * Math.PI / 180);
        maskCtx.scale(finalScale, finalScale);
        maskCtx.globalAlpha = opacity * transitionProgress;
        
        // 素材を描画（同期的に可能なもののみ）
        if (clipSourceClip.asset.type === 'image') {
            if (clipSourceClip.imageElement && clipSourceClip.imageElement.complete) {
                const img = clipSourceClip.imageElement;
                let drawWidth, drawHeight;
                
                if (clipSourceClip.useOriginalSize && clipSourceClip.originalWidth && clipSourceClip.originalHeight) {
                    drawWidth = clipSourceClip.originalWidth;
                    drawHeight = clipSourceClip.originalHeight;
                } else {
                    const aspectRatio = img.width / img.height;
                    const maxWidth = this.app.previewCanvas.width;
                    const maxHeight = this.app.previewCanvas.height;
                    
                    drawWidth = maxWidth;
                    drawHeight = maxWidth / aspectRatio;
                    
                    if (drawHeight > maxHeight) {
                        drawHeight = maxHeight;
                        drawWidth = maxHeight * aspectRatio;
                    }
                }
                
                const anchorX = -drawWidth * anchor.x;
                const anchorY = -drawHeight * anchor.y;
                
                maskCtx.drawImage(img, anchorX, anchorY, drawWidth, drawHeight);
            }
        } else if (clipSourceClip.asset.type === 'solid' || clipSourceClip.asset.type === 'gradient' || clipSourceClip.asset.type === 'stripe') {
            if (clipSourceClip.asset.element) {
                const drawWidth = 1920;
                const drawHeight = 1080;
                const anchorX = -drawWidth * anchor.x;
                const anchorY = -drawHeight * anchor.y;
                maskCtx.drawImage(clipSourceClip.asset.element, anchorX, anchorY, drawWidth, drawHeight);
            }
        }
        
        maskCtx.restore();
        
        // previewCtxを元に戻す
        this.app.previewCtx = originalCtx;
        
        // 既存の描画内容にマスクを適用
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        
        return true;
    }
    
    // 指定時刻でクリップが表示されているか判定
    isClipVisibleAtTime(clip, time) {
        return time >= clip.startTime && time < clip.startTime + clip.duration;
    }
    
    // プロジェクト保存時にクリップソースを含める
    serializeClipData(clip) {
        return {
            clipSource: clip.clipSource || null
        };
    }
    
    // プロジェクト読み込み時にクリップソースを復元
    deserializeClipData(clip, data) {
        if (data.clipSource !== undefined) {
            clip.clipSource = data.clipSource;
        }
    }
}
