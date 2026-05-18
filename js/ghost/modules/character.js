// js/ghost/modules/character.js
import { state } from '../core/state.js';
import { events, Events } from '../core/events.js';
import { showLoading, hideLoading, showToast } from '../ui/components.js';
import { renderCharacterSelection as renderCharSelect } from '../ui/character-render.js';

import { 
    listCharacters, 
    validateCharacter as apiValidateCharacter,
    createCharacter as apiCreateCharacter,
    deleteCharacter as apiDeleteCharacter,
    exportCharacter as apiExportCharacter,
    importCharacter as apiImportCharacter,
    convertToNPC as apiConvertToNPC
} from '../../api.js';
import { loadAndEnterGhostMode } from '../core/session.js';

// 显示角色创建向导
async function showCharacterCreationWizard() {
    state.isCreatingCharacter = true;
    const panel = document.getElementById('ghostPanel');
    if (!panel) return;
    
    panel.innerHTML = `
        <div class="ghost-header">
            <h2>✨ 创建新角色</h2>
            <div><button class="exit-ghost-btn" id="backToMenuBtn">返回</button></div>
        </div>
        <div class="ghost-content" style="overflow-y: auto;">
            <div class="creation-container">
                <div class="creation-step">
                    <div>🎭 描述你想扮演的角色</div>
                    <textarea id="characterDescInput" rows="6" style="width: 100%; background: #1a1a2a; border: 1px solid #4a4a6a; color: white; padding: 12px; border-radius: 12px; margin-top: 12px;" placeholder="例如：我是一个云游四方的散修，男性，性格豪爽，擅长剑法..."></textarea>
                    <button id="validateCharacterBtn" style="margin-top: 16px; background: #4a8a8a; padding: 8px 20px; border-radius: 24px; border: none; color: white; cursor: pointer;">🤖 AI帮我生成</button>
                    <button id="manualCreateBtn" style="margin-top: 16px; margin-left: 12px; background: #4a4a6a; padding: 8px 20px; border-radius: 24px; border: none; color: white; cursor: pointer;">✏️ 手动填写</button>
                </div>
            </div>
        </div>
    `;
    
    const backBtn = document.getElementById('backToMenuBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            state.isCreatingCharacter = false;
            // 使用动态导入避免循环依赖
            import('./world.js').then(module => {
                module.showGhostModeMenu();
            });
        });
    }
    
    document.getElementById('validateCharacterBtn')?.addEventListener('click', async () => {
        const userInput = document.getElementById('characterDescInput').value;
        if (!userInput.trim()) {
            showToast('请描述你想扮演的角色', 2000);
            return;
        }
        state.tempCharacterInput = userInput;
        await validateAndShowSuggestions();
    });
    
    document.getElementById('manualCreateBtn')?.addEventListener('click', showManualCharacterCreation);
}

// 手动创建角色表单
async function showManualCharacterCreation() {
    const panel = document.getElementById('ghostPanel');
    if (!panel) return;
    
    panel.innerHTML = `
        <div class="ghost-header">
            <h2>✏️ 手动创建角色</h2>
            <div><button class="exit-ghost-btn" id="backToWizardBtn">返回</button></div>
        </div>
        <div class="ghost-content" style="overflow-y: auto;">
            <div class="creation-container">
                <form id="manualCharacterForm" style="display: flex; flex-direction: column; gap: 16px;">
                    <div><label style="color: #ffaa66;">角色名 *</label><input type="text" id="charName" style="width: 100%; background: #1a1a2a; border: 1px solid #4a4a6a; color: white; padding: 8px; border-radius: 8px;" required></div>
                    <div><label style="color: #ffaa66;">性别</label><select id="charGender" style="width: 100%; background: #1a1a2a; border: 1px solid #4a4a6a; color: white; padding: 8px; border-radius: 8px;"><option value="男">男</option><option value="女">女</option><option value="未知">未知</option></select></div>
                    <div><label style="color: #ffaa66;">身份</label><input type="text" id="charIdentity" style="width: 100%; background: #1a1a2a; border: 1px solid #4a4a6a; color: white; padding: 8px; border-radius: 8px;" placeholder="如：散修、药童"></div>
                    <div><label style="color: #ffaa66;">外貌描述</label><textarea id="charAppearance" rows="2" style="width: 100%; background: #1a1a2a; border: 1px solid #4a4a6a; color: white; padding: 8px; border-radius: 8px;"></textarea></div>
                    <div><label style="color: #ffaa66;">性格特点</label><textarea id="charPersonality" rows="2" style="width: 100%; background: #1a1a2a; border: 1px solid #4a4a6a; color: white; padding: 8px; border-radius: 8px;"></textarea></div>
                    <div><label style="color: #ffaa66;">背景故事</label><textarea id="charBackground" rows="3" style="width: 100%; background: #1a1a2a; border: 1px solid #4a4a6a; color: white; padding: 8px; border-radius: 8px;"></textarea></div>
                    <button type="submit" style="background: #2a6a2a; padding: 10px; border-radius: 24px; border: none; color: white; cursor: pointer;">创建角色</button>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('backToWizardBtn')?.addEventListener('click', showCharacterCreationWizard);
    
    document.getElementById('manualCharacterForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const profile = {
            name: document.getElementById('charName').value,
            gender: document.getElementById('charGender').value,
            identity: document.getElementById('charIdentity').value,
            appearance: document.getElementById('charAppearance').value,
            personality: document.getElementById('charPersonality').value,
            background: document.getElementById('charBackground').value
        };
        
        if (!profile.name) {
            showToast('请填写角色名', 2000);
            return;
        }
        
        state.tempCharacterProfile = profile;
        await createCustomCharacter();
    });
}

// AI验证并显示建议
async function validateAndShowSuggestions() {
    showLoading('AI正在生成角色设定...');
    try {
        const result = await apiValidateCharacter(state.tempCharacterInput, window.currentChapterIndex || 1);
        hideLoading();
        state.tempCharacterProfile = result.suggested_profile;
        
        const panel = document.getElementById('ghostPanel');
        if (!panel) return;
        
        if (result.valid) {
            panel.innerHTML = `
                <div class="ghost-header">
                    <h2>✅ 角色设定有效</h2>
                    <div><button class="exit-ghost-btn" id="backToValidateBtn">返回修改</button><button class="exit-ghost-btn" id="confirmCharacterBtn" style="background: #2a6a2a;">确认创建</button></div>
                </div>
                <div class="ghost-content">
                    <div class="creation-container">
                        <div>📋 AI整理的角色设定</div>
                        <div style="margin-top: 12px; background: #0a0a12; padding: 16px; border-radius: 12px;">${renderCharacterProfile(state.tempCharacterProfile)}</div>
                    </div>
                </div>
            `;
            document.getElementById('backToValidateBtn')?.addEventListener('click', showCharacterCreationWizard);
            document.getElementById('confirmCharacterBtn')?.addEventListener('click', createCustomCharacter);
        } else {
            panel.innerHTML = `
                <div class="ghost-header">
                    <h2>⚠️ 角色设定需要调整</h2>
                    <div><button class="exit-ghost-btn" id="backToValidateBtn">返回修改</button></div>
                </div>
                <div class="ghost-content">
                    <div class="creation-container">
                        <div>❌ 问题说明</div>
                        <div style="padding: 12px; background: #2a1a1a; border-radius: 8px; color: #ff8888;">${escapeHtml(result.message || '角色设定不符合世界观')}</div>
                        <div style="margin-top: 16px;">📋 AI建议的修正版本</div>
                        <div style="margin-top: 8px; background: #0a0a12; padding: 16px; border-radius: 12px;">${renderCharacterProfile(state.tempCharacterProfile)}</div>
                        <div style="margin-top: 16px;">
                            <textarea id="revisedCharacterInput" rows="4" style="width: 100%; background: #1a1a2a; border: 1px solid #4a4a6a; color: white; padding: 12px; border-radius: 12px;" placeholder="根据建议修改你的角色描述...">${escapeHtml(state.tempCharacterInput)}</textarea>
                            <button id="revalidateBtn" style="margin-top: 12px; background: #4a8a8a; padding: 8px 20px; border-radius: 24px; border: none; color: white; cursor: pointer;">重新验证</button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('backToValidateBtn')?.addEventListener('click', showCharacterCreationWizard);
            document.getElementById('revalidateBtn')?.addEventListener('click', async () => {
                const revisedInput = document.getElementById('revisedCharacterInput').value;
                if (revisedInput.trim()) {
                    state.tempCharacterInput = revisedInput;
                    await validateAndShowSuggestions();
                }
            });
        }
    } catch (err) {
        hideLoading();
        showToast('验证失败，请重试', 3000, 'error');
    }
}

// 创建自定义角色
async function createCustomCharacter() {
    showLoading('创建角色中...');
    try {
        const result = await apiCreateCharacter(state.tempCharacterProfile, window.currentChapterIndex || 1);
        hideLoading();
        showToast(`角色「${state.tempCharacterProfile.name}」创建成功！`, 2000, 'success');
        
        state.isCreatingCharacter = false;
        state.tempCharacterInput = "";
        state.tempCharacterProfile = null;
        
        // 自动选择起始地点
        let startScene = "百草阁";
        try {
            const locationsRes = await fetch('/api/ghost/locations/all');
            if (locationsRes.ok) {
                const locationsData = await locationsRes.json();
                const scenes = locationsData.locations || [];
                if (scenes.length > 0) {
                    const validScene = scenes.find(s => s.parent) || scenes[0];
                    startScene = validScene.name;
                }
            }
        } catch (err) {
            console.warn('获取地点列表失败:', err);
        }
        
        await loadAndEnterGhostMode(result.character_id, startScene);
    } catch (err) {
        hideLoading();
        showToast('创建失败，请重试', 3000, 'error');
    }
}

// 刷新角色列表
async function refreshCharacterList() {
    try {
        const result = await listCharacters();
        const existingCharacters = result.characters || [];
        
        const characterSelectArea = document.getElementById('characterSelectArea');
        if (characterSelectArea) {
            // 获取当前世界信息
            let currentWorld = null;
            try {
                const worldRes = await fetch('/api/world/current');
                if (worldRes.ok) {
                    const data = await worldRes.json();
                    const worldsRes = await fetch('/api/worlds/list');
                    if (worldsRes.ok) {
                        const worldsData = await worldsRes.json();
                        const worldInfo = worldsData.worlds.find(w => w.id === data.world_id);
                        currentWorld = { id: data.world_id, name: worldInfo?.name || data.world_id };
                    }
                }
            } catch (err) {
                console.warn('获取世界信息失败:', err);
            }
            
            // 重新渲染
            characterSelectArea.innerHTML = renderCharSelect(existingCharacters, currentWorld);
            
            // 重新绑定按钮事件
            await bindCharacterButtons();
        }
    } catch (err) {
        console.error('刷新角色列表失败:', err);
    }
}

// 重新绑定所有按钮
async function bindCharacterButtons() {
    
    // 导入必要的函数
    const { loadAndEnterGhostMode } = await import('../core/session.js');
    
    // 检查按钮是否存在
    const createBtns = document.querySelectorAll('#createFirstCharacterBtn, #createNewCharacterBtn');
    //console.log('找到创建角色按钮:', createBtns.length);
    
    const importPlayerBtns = document.querySelectorAll('#importPlayerBtn');
    //console.log('找到导入玩家按钮:', importPlayerBtns.length);
    
    const importNpcBtns = document.querySelectorAll('#importNpcBtn');
    //console.log('找到导入NPC按钮:', importNpcBtns.length);
    
    // 绑定创建角色按钮
    createBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = () => showCharacterCreationWizard();
    });
    
    // 绑定导入玩家按钮
    importPlayerBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = () => openImportDialog('player');
    });
    
    // 绑定导入NPC按钮
    importNpcBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = () => openImportDialog('npc');
    });
    
    // 绑定继续游戏按钮
    document.querySelectorAll('.character-play-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = async (e) => {
            e.preventDefault();
            const characterId = newBtn.dataset.characterId;
            if (characterId) {
                await loadAndEnterGhostMode(characterId, null);
            }
        };
    });
    
    // 绑定删除按钮
    document.querySelectorAll('.character-delete-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = async (e) => {
            e.preventDefault();
            const characterId = newBtn.dataset.characterId;
            if (confirm('确定要删除这个角色吗？')) {
                try {
                    const response = await fetch('/api/ghost/delete_character', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ character_id: characterId })
                    });
                    if (response.ok) {
                        alert('✅ 角色已删除');
                        await refreshCharacterList();
                    } else {
                        alert('❌ 删除失败');
                    }
                } catch (err) {
                    alert('❌ 删除失败: ' + err.message);
                }
            }
        };
    });
    
    // 绑定导出按钮
    document.querySelectorAll('.character-export-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = async (e) => {
            e.preventDefault();
            const characterId = newBtn.dataset.characterId;
            await exportCharacterToPNG(characterId);
        };
    });
    
    // 绑定转为NPC按钮
    document.querySelectorAll('.character-to-npc-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = async (e) => {
            e.preventDefault();
            const characterId = newBtn.dataset.characterId;
            await convertCharacterToNPC(characterId);
        };
    });
    
    // 绑定切换世界按钮 - 修复 require 问题
    const switchWorldBtn = document.getElementById('switchWorldBtn');
    if (switchWorldBtn) {
        const newBtn = switchWorldBtn.cloneNode(true);
        switchWorldBtn.parentNode.replaceChild(newBtn, switchWorldBtn);
        newBtn.onclick = async () => {
            const { showWorldSelection } = await import('./world.js');
            showWorldSelection();
        };
    }
}

// 转换角色为NPC（带地点选择）
async function convertCharacterToNPC(characterId) {
    try {
        // 获取角色信息
        const charResponse = await fetch(`/api/ghost/export_character/${characterId}`);
        if (!charResponse.ok) throw new Error('获取角色信息失败');
        const character = await charResponse.json();
        const characterName = character.profile?.name || '未知角色';
        
        // 获取所有可用地点
        const locationsRes = await fetch('/api/ghost/locations/all');
        if (!locationsRes.ok) throw new Error('获取地点列表失败');
        const locationsData = await locationsRes.json();
        const locations = locationsData.locations || [];
        
        if (locations.length === 0) {
            alert('没有可用地点，无法转换NPC');
            return;
        }
        
        // 显示地点选择对话框
        const selectedLocation = await showLocationSelectorDialog(characterName, locations);
        if (!selectedLocation) return;
        
        if (confirm(`确定要将角色「${characterName}」转换为NPC吗？\n\n将出现在：${selectedLocation.name}\n\n转换后角色将被删除，成为游戏中的NPC。`)) {
            const response = await fetch('/api/ghost/convert_to_npc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    character_id: characterId,
                    location_id: selectedLocation.id,
                    location_name: selectedLocation.name
                })
            });
            const result = await response.json();
            if (response.ok) {
                alert(`✅ ${result.message}`);
                await refreshCharacterList();
            } else {
                alert('❌ 转换失败: ' + (result.detail || '未知错误'));
            }
        }
    } catch (err) {
        console.error('转换失败:', err);
        alert('❌ 转换失败: ' + err.message);
    }
}

// 地点选择对话框（new）
// 地点选择对话框 - 只保留这一个
function showLocationSelectorDialog(characterName, locations) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'location-selector-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            max-width: 90%;
            background: #1a1a2a;
            border: 1px solid #4a4a6a;
            border-radius: 16px;
            z-index: 20001;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        dialog.innerHTML = `
            <div class="dialog-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #2a2a44; border-radius: 16px 16px 0 0;">
                <span>📍 选择 NPC 出现地点</span>
                <button class="dialog-close-btn" style="background: none; border: none; color: #aaa; font-size: 1.2rem; cursor: pointer;">✕</button>
            </div>
            <div class="dialog-content" style="padding: 16px;">
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: block; color: #ffaa66; margin-bottom: 8px;">角色「${escapeHtml(characterName)}」将出现在哪里？</label>
                    <select id="locationSelect" class="location-select" style="width: 100%; background: #0a0a12; border: 1px solid #4a4a6a; color: white; padding: 8px 12px; border-radius: 8px;">
                        ${locations.map(loc => `<option value="${escapeHtml(loc.id)}" data-name="${escapeHtml(loc.name)}">${escapeHtml(loc.name)} (${escapeHtml(loc.parent || '无区域')})</option>`).join('')}
                    </select>
                </div>
                <div class="dialog-buttons" style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                    <button id="confirmLocationBtn" class="confirm-btn" style="background: #2a6a2a; border: none; color: white; padding: 8px 20px; border-radius: 20px; cursor: pointer;">确认导入</button>
                    <button id="cancelLocationBtn" class="cancel-btn" style="background: #4a4a6a; border: none; color: white; padding: 8px 20px; border-radius: 20px; cursor: pointer;">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        
        const selectEl = dialog.querySelector('#locationSelect');
        
        dialog.querySelector('.dialog-close-btn').addEventListener('click', () => {
            dialog.remove();
            resolve(null);
        });
        
        dialog.querySelector('#cancelLocationBtn').addEventListener('click', () => {
            dialog.remove();
            resolve(null);
        });
        
        dialog.querySelector('#confirmLocationBtn').addEventListener('click', () => {
            const selectedId = selectEl.value;
            const selectedName = selectEl.options[selectEl.selectedIndex].getAttribute('data-name');
            dialog.remove();
            resolve({ id: selectedId, name: selectedName });
        });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 绑定角色卡片按钮
function bindCharacterCardButtons() {
    // 继续游戏按钮
    document.querySelectorAll('.character-play-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const characterId = btn.dataset.characterId;
            await loadAndEnterGhostMode(characterId, null);
        });
    });
    
    // 删除按钮
    document.querySelectorAll('.character-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const characterId = btn.dataset.characterId;
            if (!confirm('确定要删除这个角色吗？')) return;
            
            showLoading('删除角色中...');
            try {
                await apiDeleteCharacter(characterId);
                showToast('✅ 角色已删除', 2000, 'success');
                await refreshCharacterList();
            } catch (err) {
                showToast('❌ 删除失败: ' + err.message, 3000, 'error');
            } finally {
                hideLoading();
            }
        });
    });
    
    // 导出按钮
    document.querySelectorAll('.character-export-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const characterId = btn.dataset.characterId;
            await exportCharacterToPNG(characterId);
        });
    });
    
    // 转为NPC按钮
    document.querySelectorAll('.character-to-npc-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const characterId = btn.dataset.characterId;
            if (!confirm('确定要将这个角色转为NPC吗？')) return;
            
            showLoading('转换为NPC中...');
            try {
                const result = await apiConvertToNPC(characterId);
                showToast(`✅ ${result.message}`, 2000, 'success');
                await refreshCharacterList();
            } catch (err) {
                showToast('❌ 转换失败: ' + err.message, 3000, 'error');
            } finally {
                hideLoading();
            }
        });
    });
}

// 导出角色为PNG
async function exportCharacterToPNG(characterId) {
    showLoading('导出角色中...');
    try {
        const characterData = await apiExportCharacter(characterId);
        const characterName = characterData.profile?.name || characterId;
        const jsonStr = JSON.stringify(characterData, null, 2);
        
        const pngBlob = await createPngWithTextData(jsonStr, characterName);
        
        const url = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `character_${characterName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`✅ 角色「${characterName}」已导出为PNG`, 3000, 'success');
    } catch (err) {
        showToast('❌ 导出失败: ' + err.message, 3000, 'error');
    } finally {
        hideLoading();
    }
}

// 导入角色对话框
function openImportDialog(importType = 'player') {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,application/json,.txt';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        showLoading(`${importType === 'npc' ? 'AI导入NPC' : 'AI导入角色'}中...`);
        
        try {
            let characterDescription = '';
            
            if (file.type === 'image/png') {
                characterDescription = await readPngTextData(file);
            } else {
                characterDescription = await file.text();
            }
            
            if (!characterDescription?.trim()) throw new Error('未能从文件中读取到角色信息');
            
            if (importType === 'npc') {
                await createNPCFromDescription(characterDescription);
                showToast('✅ NPC导入成功！', 2000, 'success');
            } else {
                const result = await createCharacterFromDescription(characterDescription);
                showToast(`✅ 角色「${result.character_name}」导入成功！`, 2000, 'success');
            }
            
            await refreshCharacterList();
        } catch (err) {
            showToast(`❌ 导入失败：${err.message}`, 3000, 'error');
        } finally {
            hideLoading();
            document.body.removeChild(fileInput);
        }
    });
    
    document.body.appendChild(fileInput);
    fileInput.click();
}

// 从描述创建角色
async function createCharacterFromDescription(description) {
    const result = await apiValidateCharacter(description, window.currentChapterIndex || 1);
    if (!result.suggested_profile) throw new Error('AI无法解析角色信息');
    
    const createResult = await apiCreateCharacter(result.suggested_profile, window.currentChapterIndex || 1);
    return { character_id: createResult.character_id, character_name: result.suggested_profile.name, profile: result.suggested_profile };
}

// 从描述创建NPC
async function createNPCFromDescription(description) {
    const result = await apiValidateCharacter(description, window.currentChapterIndex || 1);
    if (!result.suggested_profile) throw new Error('AI无法解析角色信息');
    
    const profile = result.suggested_profile;
    
    const locationsRes = await fetch('/api/ghost/locations/all');
    let locations = [];
    if (locationsRes.ok) {
        const data = await locationsRes.json();
        locations = data.locations || [];
    }
    
    if (locations.length === 0) throw new Error('没有可用地点');
    
    const selectedLocation = await showLocationSelectorDialog(profile.name, locations.map(l => l.name));
    if (!selectedLocation) throw new Error('用户取消');
    
    const locationObj = locations.find(l => l.name === selectedLocation);
    const locationId = locationObj ? locationObj.id : selectedLocation;
    
    const npcData = {
        id: `npc_imported_${Date.now()}_${profile.name}`,
        name: profile.name,
        gender: profile.gender || '未知',
        profile: {
            identity: profile.identity || '旅行者',
            description: `外貌：${profile.appearance || '未知'}\n性格：${profile.personality || '未知'}`,
            personality_traits: profile.personality ? profile.personality.split(/[，,]/) : [],
            background: profile.background || '来历不明',
            imported_from: 'external'
        },
        location_id: locationId,
        active: true,
        dead: false
    };
    
    const response = await fetch('/api/ghost/add_npc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npc: npcData })
    });
    
    if (!response.ok) throw new Error('创建NPC失败');
    return npcData;
}

// PNG工具函数
async function createPngWithTextData(textData, characterName) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffaa66';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.fillStyle = '#ffaa66';
    ctx.font = 'bold 20px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.fillText(`角色: ${characterName}`, canvas.width / 2, 80);
    ctx.fillStyle = '#88ffaa';
    ctx.font = '14px "Microsoft YaHei"';
    ctx.fillText('互动叙事系统角色存档', canvas.width / 2, 130);
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText('此图片包含角色数据，可用于导入', canvas.width / 2, 165);
    
    const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const arrayBuffer = await pngBlob.arrayBuffer();
    const pngWithText = await injectTextChunk(arrayBuffer, 'CharacterData', textData);
    return new Blob([pngWithText], { type: 'image/png' });
}

async function readPngTextData(file) {
    const arrayBuffer = await file.arrayBuffer();
    const dataView = new DataView(arrayBuffer);
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    
    for (let i = 0; i < 8; i++) {
        if (dataView.getUint8(i) !== pngSignature[i]) throw new Error('不是有效的PNG文件');
    }
    
    let pos = 8;
    let allTextData = [];
    
    while (pos < arrayBuffer.byteLength) {
        const length = dataView.getUint32(pos);
        const typeBytes = new Uint8Array(arrayBuffer, pos + 4, 4);
        const type = new TextDecoder().decode(typeBytes);
        
        if (type === 'tEXt') {
            const dataBytes = new Uint8Array(arrayBuffer, pos + 8, length);
            let nullPos = 0;
            while (nullPos < dataBytes.length && dataBytes[nullPos] !== 0) nullPos++;
            const keyword = new TextDecoder().decode(dataBytes.slice(0, nullPos));
            const text = new TextDecoder().decode(dataBytes.slice(nullPos + 1));
            allTextData.push({ keyword, text });
        }
        pos += 4 + 4 + length + 4;
    }
    
    const characterBlock = allTextData.find(b => b.keyword === 'CharacterData');
    if (!characterBlock) throw new Error('PNG文件中未找到角色数据');
    return characterBlock.text;
}

async function injectTextChunk(pngBuffer, keyword, text) {
    const dataView = new DataView(pngBuffer);
    const textEncoder = new TextEncoder();
    const keywordBytes = textEncoder.encode(keyword);
    const textBytes = textEncoder.encode(text);
    const chunkData = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
    chunkData.set(keywordBytes, 0);
    chunkData[keywordBytes.length] = 0;
    chunkData.set(textBytes, keywordBytes.length + 1);
    
    const chunkLength = chunkData.length;
    const chunkType = textEncoder.encode('tEXt');
    const crc = calculateCRC32(chunkType, chunkData);
    
    const chunk = new Uint8Array(4 + 4 + chunkLength + 4);
    new DataView(chunk.buffer).setUint32(0, chunkLength);
    chunk.set(chunkType, 4);
    chunk.set(chunkData, 8);
    new DataView(chunk.buffer).setUint32(8 + chunkLength, crc);
    
    let iendPos = -1;
    let pos = 8;
    while (pos < pngBuffer.byteLength) {
        const length = dataView.getUint32(pos);
        const typeBytes = new Uint8Array(pngBuffer, pos + 4, 4);
        const type = new TextDecoder().decode(typeBytes);
        if (type === 'IEND') { iendPos = pos; break; }
        pos += 4 + 4 + length + 4;
    }
    
    if (iendPos === -1) throw new Error('找不到IEND块');
    
    const newPng = new Uint8Array(pngBuffer.byteLength + chunk.length);
    newPng.set(new Uint8Array(pngBuffer.slice(0, iendPos)), 0);
    newPng.set(chunk, iendPos);
    newPng.set(new Uint8Array(pngBuffer.slice(iendPos)), iendPos + chunk.length);
    return newPng.buffer;
}

function calculateCRC32(type, data) {
    let crc = 0xFFFFFFFF;
    const table = generateCRCTable();
    for (let i = 0; i < type.length; i++) crc = table[(crc ^ type[i]) & 0xFF] ^ (crc >>> 8);
    for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return crc ^ 0xFFFFFFFF;
}

function generateCRCTable() {
    const table = new Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c;
    }
    return table;
}

// 渲染角色资料
function renderCharacterProfile(profile) {
    if (!profile) return '<div>无数据</div>';
    return `<div style="display: grid; gap: 8px;">
        <div><span style="color: #ffaa66;">姓名：</span>${escapeHtml(profile.name || '未设置')}</div>
        <div><span style="color: #ffaa66;">性别：</span>${escapeHtml(profile.gender || '未设置')}</div>
        <div><span style="color: #ffaa66;">身份：</span>${escapeHtml(profile.identity || '未设置')}</div>
        <div><span style="color: #ffaa66;">外貌：</span>${escapeHtml(profile.appearance || '未设置')}</div>
        <div><span style="color: #ffaa66;">性格：</span>${escapeHtml(profile.personality || '未设置')}</div>
        <div><span style="color: #ffaa66;">背景：</span>${escapeHtml(profile.background || '未设置')}</div>
    </div>`;
}

// 导出公共接口
export { 
    showCharacterCreationWizard, 
    openImportDialog, 
    bindCharacterCardButtons,
    bindCharacterButtons,
    refreshCharacterList,
    loadAndEnterGhostMode,  // 添加
    exportCharacterToPNG,   // 添加
};