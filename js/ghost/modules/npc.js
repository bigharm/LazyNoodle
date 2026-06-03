// js/ghost/modules/npc.js
import { state } from '../core/state.js';
import { showToast, showLoading, hideLoading } from '../ui/components.js';
import { refreshNPCList } from '../ui/render.js';

// 打开NPC创建对话框
export async function openNPCCreationDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'npc-create-dialog';
    dialog.innerHTML = `
        <div class="dialog-header">
            <span>✨ 创建新NPC</span>
            <button class="dialog-close-btn" style="background: none; border: none; color: #aaa; font-size: 1.2rem; cursor: pointer;">✕</button>
        </div>
        <div class="dialog-content">
            <div class="form-group">
                <label>🎭 描述你想创建的NPC</label>
                <textarea id="npcDescInput" rows="5" placeholder="例如：一个喜欢喝酒的矮人铁匠，脾气暴躁但手艺精湛..."></textarea>
            </div>
            <div class="dialog-buttons" style="display: flex; justify-content: center; gap: 12px; margin-bottom: 16px;">
                <button id="createNPCBtn" class="confirm-btn" style="background: #2a6a2a;">✨ AI生成</button>
                <button id="importNPCBtn" class="confirm-btn" style="background: #4a4a6a;">📥 导入</button>
            </div>
            <div style="text-align: center; color: #666; font-size: 0.75rem; border-top: 1px solid #2a2a44; padding-top: 12px;">
                提示：可以通过描述让AI生成，或从PNG/JSON文件导入
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    // 关闭按钮
    dialog.querySelector('.dialog-close-btn').addEventListener('click', () => {
        dialog.remove();
    });
    
    // AI生成按钮
    dialog.querySelector('#createNPCBtn').addEventListener('click', async () => {
        const description = dialog.querySelector('#npcDescInput').value.trim();
        if (!description) {
            showToast('请描述你想创建的NPC', 2000);
            return;
        }
        
        showLoading('AI正在生成NPC...');
        
        try {
            const validateResult = await fetch('/api/ghost/validate_character', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_input: description,
                    chapter_index: window.currentChapterIndex || 1
                })
            });
            
            const validateData = await validateResult.json();
            const profile = validateData.suggested_profile;
            
            if (!profile) {
                throw new Error('AI无法解析NPC信息');
            }
            
            showNPCConfirmDialog(profile, description, dialog);
            
        } catch (err) {
            hideLoading();
            showToast('创建失败: ' + err.message, 3000, 'error');
        }
    });
    
    // 导入按钮
    dialog.querySelector('#importNPCBtn').addEventListener('click', () => {
        dialog.remove();
        importNPCFromFile();
    });
}

// 显示NPC确认界面
async function showNPCConfirmDialog(profile, originalDescription, parentDialog) {
    parentDialog.innerHTML = `
        <div class="dialog-header">
            <span>✅ 确认NPC信息</span>
            <button class="dialog-close-btn" style="background: none; border: none; color: #aaa; font-size: 1.2rem; cursor: pointer;">✕</button>
        </div>
        <div class="dialog-content">
            <div class="form-group">
                <label>📋 AI整理的角色设定</label>
                <div style="background: #0a0a12; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <div><span style="color: #ffaa66;">姓名：</span>${escapeHtml(profile.name || '未设置')}</div>
                    <div><span style="color: #ffaa66;">性别：</span>${escapeHtml(profile.gender || '未设置')}</div>
                    <div><span style="color: #ffaa66;">身份：</span>${escapeHtml(profile.identity || '未设置')}</div>
                    <div><span style="color: #ffaa66;">外貌：</span>${escapeHtml(profile.appearance || '未设置')}</div>
                    <div><span style="color: #ffaa66;">性格：</span>${escapeHtml(profile.personality || '未设置')}</div>
                    <div><span style="color: #ffaa66;">背景：</span>${escapeHtml(profile.background || '未设置')}</div>
                </div>
            </div>
            <div class="form-group">
                <label>📍 出现地点</label>
                <input type="text" id="npcLocation" value="${escapeHtml(state.currentSession.currentScene)}" placeholder="NPC出现的地点">
                <div class="form-hint" style="font-size: 0.7rem; color: #888;">默认为当前位置</div>
            </div>
            <div class="dialog-buttons">
                <button id="confirmCreateNPCBtn" class="confirm-btn" style="background: #2a6a2a;">✅ 确认创建</button>
                <button id="backToEditBtn" class="cancel-btn">返回修改</button>
            </div>
        </div>
    `;
    
    // 关闭按钮
    parentDialog.querySelector('.dialog-close-btn').addEventListener('click', () => {
        parentDialog.remove();
        hideLoading();
    });
    
    // 返回修改
    parentDialog.querySelector('#backToEditBtn').addEventListener('click', () => {
        // 重新显示创建界面
        openNPCCreationDialog();
        parentDialog.remove();
    });
    
    // 确认创建
    parentDialog.querySelector('#confirmCreateNPCBtn').addEventListener('click', async () => {
        const locationName = parentDialog.querySelector('#npcLocation').value.trim();
        if (!locationName) {
            showToast('请填写出现地点', 2000);
            return;
        }
        
        // 获取地点ID
        let locationId = locationName;
        try {
            const locRes = await fetch(`/api/ghost/locations/by_name/${encodeURIComponent(locationName)}`);
            if (locRes.ok) {
                const locData = await locRes.json();
                locationId = locData.id || locationName;
            }
        } catch (err) {
            console.warn('获取地点ID失败:', err);
        }
        
        // 生成唯一ID
        const npcId = `npc_${Date.now()}`;
        
        const npcData = {
            id: npcId,
            name: profile.name,
            gender: profile.gender || '未知',
            profile: {
                identity: profile.identity || '旅行者',
                description: `外貌：${profile.appearance || '未知'}\n性格：${profile.personality || '未知'}`,
                personality_traits: profile.personality ? profile.personality.split(/[，,]/) : [],
                background: profile.background || '来历不明',
                created_by: 'player',
                created_at: new Date().toISOString()
            },
            location_id: locationId,
            active: true,
            dead: false
        };
        
        showLoading('创建NPC中...');
        
        try {
            const response = await fetch('/api/ghost/add_npc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ npc: npcData })
            });
            
            if (response.ok) {
                showToast(`✅ NPC「${profile.name}」创建成功！`, 2000, 'success');
                parentDialog.remove();
                // 刷新NPC列表
                await refreshNPCList();
            } else {
                const error = await response.json();
                throw new Error(error.detail || '创建失败');
            }
        } catch (err) {
            showToast('❌ 创建失败: ' + err.message, 3000, 'error');
        } finally {
            hideLoading();
        }
    });
}

// 从文件导入NPC
async function importNPCFromFile() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,application/json,.txt';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        showLoading('导入NPC中...');
        
        try {
            let content = '';
            if (file.type === 'image/png') {
                content = await readPngTextData(file);
            } else {
                content = await file.text();
            }
            
            if (!content.trim()) {
                throw new Error('未能从文件中读取到角色信息');
            }
            
            let profile;
            try {
                const data = JSON.parse(content);
                profile = data.profile || data;
            } catch {
                // 如果不是JSON，通过AI解析
                const validateResult = await fetch('/api/ghost/validate_character', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_input: content,
                        chapter_index: window.currentChapterIndex || 1
                    })
                });
                const validateData = await validateResult.json();
                profile = validateData.suggested_profile;
            }
            
            if (!profile || !profile.name) {
                throw new Error('无法解析NPC信息');
            }
            
            // 显示确认对话框
            const dialog = document.createElement('div');
            dialog.className = 'npc-create-dialog';
            dialog.innerHTML = `
                <div class="dialog-header">
                    <span>✅ 确认导入NPC</span>
                    <button class="dialog-close-btn" style="background: none; border: none; color: #aaa; font-size: 1.2rem; cursor: pointer;">✕</button>
                </div>
                <div class="dialog-content">
                    <div class="form-group">
                        <label>📋 角色信息</label>
                        <div style="background: #0a0a12; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                            <div><span style="color: #ffaa66;">姓名：</span>${escapeHtml(profile.name || '未设置')}</div>
                            <div><span style="color: #ffaa66;">身份：</span>${escapeHtml(profile.identity || '未设置')}</div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>📍 出现地点</label>
                        <input type="text" id="npcLocation" value="${escapeHtml(state.currentSession.currentScene)}">
                    </div>
                    <div class="dialog-buttons">
                        <button id="confirmImportBtn" class="confirm-btn">✅ 确认导入</button>
                        <button id="cancelBtn" class="cancel-btn">取消</button>
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);
            
            dialog.querySelector('.dialog-close-btn').addEventListener('click', () => dialog.remove());
            dialog.querySelector('#cancelBtn').addEventListener('click', () => dialog.remove());
            
            dialog.querySelector('#confirmImportBtn').addEventListener('click', async () => {
                const locationName = dialog.querySelector('#npcLocation').value.trim();
                let locationId = locationName;
                try {
                    const locRes = await fetch(`/api/ghost/locations/by_name/${encodeURIComponent(locationName)}`);
                    if (locRes.ok) {
                        const locData = await locRes.json();
                        locationId = locData.id || locationName;
                    }
                } catch (err) {}
                
                const npcId = `npc_${Date.now()}`;
                const npcData = {
                    id: npcId,
                    name: profile.name,
                    gender: profile.gender || '未知',
                    profile: {
                        identity: profile.identity || '旅行者',
                        description: `外貌：${profile.appearance || '未知'}\n性格：${profile.personality || '未知'}`,
                        background: profile.background || '来历不明',
                        imported_from: 'file'
                    },
                    location_id: locationId,
                    active: true,
                    dead: false
                };
                
                const response = await fetch('/api/ghost/add_npc', {
                    method: 'POST',
                    body: JSON.stringify({ npc: npcData }),
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    showToast(`✅ NPC「${profile.name}」导入成功！`, 2000, 'success');
                    dialog.remove();
                    await refreshNPCList();
                } else {
                    throw new Error('导入失败');
                }
            });
            
        } catch (err) {
            showToast('❌ 导入失败：' + err.message, 3000, 'error');
        } finally {
            hideLoading();
            document.body.removeChild(fileInput);
        }
    });
    
    document.body.appendChild(fileInput);
    fileInput.click();
}

// PNG 读取函数
async function readPngTextData(file) {
    const arrayBuffer = await file.arrayBuffer();
    const dataView = new DataView(arrayBuffer);
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    
    for (let i = 0; i < 8; i++) {
        if (dataView.getUint8(i) !== pngSignature[i]) {
            throw new Error('不是有效的PNG文件');
        }
    }
    
    let pos = 8;
    let textData = '';
    
    while (pos < arrayBuffer.byteLength) {
        const length = dataView.getUint32(pos);
        const typeBytes = new Uint8Array(arrayBuffer, pos + 4, 4);
        const type = new TextDecoder().decode(typeBytes);
        
        if (type === 'tEXt') {
            const dataBytes = new Uint8Array(arrayBuffer, pos + 8, length);
            let nullPos = 0;
            while (nullPos < dataBytes.length && dataBytes[nullPos] !== 0) {
                nullPos++;
            }
            const text = new TextDecoder().decode(dataBytes.slice(nullPos + 1));
            if (text) {
                textData = text;
                break;
            }
        }
        pos += 4 + 4 + length + 4;
    }
    
    if (!textData) {
        throw new Error('PNG文件中未找到角色数据');
    }
    return textData;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}