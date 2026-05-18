// js/ghost/modules/world.js
import { state } from '../core/state.js';
import { events, Events } from '../core/events.js';
import { showWorldInitDialog, hideWorldInitDialog, showToast } from '../ui/components.js';
import { renderCharacterSelection } from '../ui/character-render.js';

// 显示世界选择界面
export async function showWorldSelection() {
    const existingPanel = document.getElementById('ghostPanel');
    if (existingPanel) existingPanel.remove();
    
    let worlds = [];
    let currentWorldId = null;
    
    try {
        const worldsRes = await fetch('/api/worlds/list');
        if (worldsRes.ok) {
            const data = await worldsRes.json();
            worlds = data.worlds || [];
            currentWorldId = data.current_world;
        }
    } catch (err) {
        console.warn('获取世界列表失败:', err);
    }
    
    if (worlds.length === 0) {
        worlds = [{ id: 'default', name: '默认世界', description: '默认游戏世界' }];
    }
    
    const panel = document.createElement('div');
    panel.id = 'ghostPanel';
    panel.className = 'ghost-panel';
    panel.innerHTML = `
        <div class="ghost-header">
            <h2>🌍 选择世界</h2>
            <div style="display: flex; gap: 8px;">
                <button id="testAIBtnMenu" class="ghost-btn test-ai-btn" style="background: #3a6a3a;">🔧 测试AI</button>
            </div>
        </div>
        <div class="ghost-content">
            <div class="step-container">
                <div class="step">
                    <div class="step-title">🌍 选择一个世界</div>
                    <div id="worldListArea" style="display: flex; flex-direction: column; gap: 12px;">
                        ${renderWorldList(worlds, currentWorldId)}
                    </div>
                    <div style="margin-top: 20px; text-align: center;">
                        <button id="createWorldBtn" style="background: #2a4a4a; padding: 8px 20px; border-radius: 24px; border: none; color: white; cursor: pointer;">✨ 创建新世界</button>
                        <button id="scanWorldsBtn" style="background: #4a4a6a; padding: 8px 20px; border-radius: 24px; border: none; color: white; cursor: pointer;">🔄 更新列表</button>
                    </div>
                    <!-- 添加项目形象图片 -->
                    <div style="margin-top: 40px; text-align: center; opacity: 0.7;">
                        <img src="/static/lazynoodle.png" alt="LazyNoodle" style="max-width: 400px; border-radius: 16px;">
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    const testBtn = document.getElementById('testAIBtnMenu');
    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            if (window.testAIConnection) {
                await window.testAIConnection();
            }
        });
    }
    
    // 绑定事件
    bindWorldSelectionEvents(panel, worlds);
}

// 选择世界
export async function selectWorld(worldId) {
    events.emit(Events.LOADING_START, '进入世界中...');
    
    try {
        const response = await fetch('/api/world/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ world_id: worldId })
        });
        
        if (!response.ok) throw new Error('选择失败');
        
        await showGhostModeMenu();
        
    } catch (err) {
        console.error('选择世界失败:', err);
        events.emit(Events.TOAST, { message: '选择世界失败: ' + err.message, type: 'error' });
    } finally {
        events.emit(Events.LOADING_END);
    }
}

// 检查并初始化世界
export async function checkAndInitWorld() {
    try {
        const statusRes = await fetch('/api/world/status');
        const status = await statusRes.json();
        
        if (!status.initialized) {
            console.log('🌍 世界未初始化，开始生成...');
            showWorldInitDialog();
            
            const initRes = await fetch('/api/world/init', { method: 'POST' });
            const initResult = await initRes.json();
            
            hideWorldInitDialog();
            
            if (initResult.status === 'ok' || initResult.status === 'warning') {
                let message = `世界初始化完成！`;
                if (initResult.locations_count) message += ` 生成了 ${initResult.locations_count} 个地点`;
                if (initResult.npcs_count) message += ` 和 ${initResult.npcs_count} 个 NPC`;
                events.emit(Events.TOAST, { message, duration: 4000 });
                return true;
            }
            throw new Error(initResult.message || '初始化失败');
        }
        return true;
    } catch (err) {
        console.error('世界初始化失败:', err);
        hideWorldInitDialog();
        events.emit(Events.TOAST, { message: '世界初始化失败，请检查网络后重试', type: 'error', duration: 5000 });
        return false;
    }
}

// 显示幽灵模式菜单（角色选择）
// 在 showGhostModeMenu 函数末尾，直接调用，不需要 setTimeout
export async function showGhostModeMenu() {
    const initialized = await checkAndInitWorld();
    if (!initialized) return;
    
    const existingPanel = document.getElementById('ghostPanel');
    if (existingPanel) existingPanel.remove();
    
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
    
    // 获取角色列表
    let existingCharacters = [];
    try {
        const { listCharacters } = await import('../../api.js');
        const result = await listCharacters();
        existingCharacters = result.characters || [];
    } catch (err) {
        console.warn('获取角色列表失败:', err);
    }
    
    const panel = document.createElement('div');
    panel.id = 'ghostPanel';
    panel.className = 'ghost-panel';
    panel.innerHTML = `
        <div class="ghost-header">
            <h2>🍜 角色</h2>
            <div style="display: flex; gap: 8px;">
                <button id="backToWorldBtn" class="ghost-btn" style="background: #4a4a6a;">🌍 切换世界</button>
                <button id="testAIBtnMenu" class="ghost-btn test-ai-btn" style="background: #3a6a3a;">🔧 测试AI</button>
            </div>
        </div>
        <div class="ghost-content">
            <div class="step-container">
                <div class="step">
                    <div class="step-title">👤 选择或创建角色</div>
                    <div id="characterSelectArea">
                        ${renderCharacterSelection(existingCharacters, currentWorld)}
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    
    // 绑定菜单界面的测试AI按钮
    const testBtn = document.getElementById('testAIBtnMenu');
    if (testBtn) {
        testBtn.onclick = async () => {
            if (window.testAIConnection) {
                await window.testAIConnection();
            }
        };
    }
    
    // 绑定返回世界按钮
    const backBtn = document.getElementById('backToWorldBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            showWorldSelection();
        };
    }
    
    // 直接调用 refreshCharacterList（不使用 setTimeout）
    const { refreshCharacterList } = await import('../modules/character.js');
    //console.log('调用 refreshCharacterList');
    await refreshCharacterList();
}

// 地点选择对话框函数
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

// 辅助渲染函数
function renderWorldList(worlds, currentWorldId) {
    let html = '';
    for (const world of worlds) {
        const isCurrent = world.id === currentWorldId;
        html += `
            <div class="world-card" data-world-id="${world.id}" style="background: ${isCurrent ? '#2a4a4a' : '#1a1a2a'}; border-radius: 12px; padding: 16px; border: 1px solid ${isCurrent ? '#6aaa6a' : '#3a3a5a'}; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: #ffaa66;">${escapeHtml(world.name)}</div>
                        <div style="font-size: 0.75rem; color: #888;">ID: ${escapeHtml(world.id)}</div>
                        ${world.description ? `<div style="font-size: 0.8rem; color: #aaa;">${escapeHtml(world.description)}</div>` : ''}
                    </div>
                    <div>
                        <button class="delete-world-btn" data-world-id="${world.id}" data-world-name="${escapeHtml(world.name)}" style="background: #6a4a4a; border: none; color: white; padding: 4px 10px; border-radius: 16px; font-size: 0.7rem; cursor: pointer;">🗑️ 删除</button>
                    </div>
                </div>
            </div>
        `;
    }
    return html;
}

// 绑定事件（简化版，完整实现需要更多代码）
function bindWorldSelectionEvents(panel, worlds) {
    // 世界卡片点击
    document.querySelectorAll('.world-card').forEach(card => {
        card.addEventListener('click', async () => {
            const worldId = card.dataset.worldId;
            await selectWorld(worldId);
        });
    });
    
    // 删除按钮
    document.querySelectorAll('.delete-world-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const worldId = btn.dataset.worldId;
            const worldName = btn.dataset.worldName;
            if (confirm(`确定要删除世界「${worldName}」吗？`)) {
                await deleteWorld(worldId);
            }
        });
    });
    
    // 创建世界按钮
    const createBtn = document.getElementById('createWorldBtn');
    if (createBtn) createBtn.addEventListener('click', openCreateWorldDialog);
    
    // 扫描按钮
    const scanBtn = document.getElementById('scanWorldsBtn');
    if (scanBtn) scanBtn.addEventListener('click', scanAndUpdateWorlds);
}

async function deleteWorld(worldId) {
    events.emit(Events.LOADING_START, '删除世界中...');
    try {
        const response = await fetch('/api/world/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ world_id: worldId })
        });
        
        if (!response.ok) throw new Error('删除失败');
        
        const result = await response.json();
        events.emit(Events.TOAST, { message: `世界「${result.world_name}」已删除` });
        await showWorldSelection();
    } catch (err) {
        events.emit(Events.TOAST, { message: '删除失败: ' + err.message, type: 'error' });
    } finally {
        events.emit(Events.LOADING_END);
    }
}

async function scanAndUpdateWorlds() {
    events.emit(Events.LOADING_START, '扫描世界中...');
    try {
        const response = await fetch('/api/world/scan', { method: 'POST' });
        if (!response.ok) throw new Error('扫描失败');
        const result = await response.json();
        events.emit(Events.TOAST, { message: `扫描完成！发现 ${result.new_worlds_count} 个新世界` });
        await showWorldSelection();
    } catch (err) {
        events.emit(Events.TOAST, { message: '扫描失败: ' + err.message, type: 'error' });
    } finally {
        events.emit(Events.LOADING_END);
    }
}


function openCreateWorldDialog() {
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'create-world-dialog';
    dialog.innerHTML = `
        <div class="dialog-header">
            <span>✨ 创建新世界</span>
            <button class="dialog-close-btn">✕</button>
        </div>
        <div class="dialog-content">
            <div class="form-group">
                <label>世界名称</label>
                <input type="text" id="newWorldName" placeholder="例如: 西幻世界">
                <div class="form-hint">起个好名字</div>
            </div>
            <div class="form-group">
                <label>世界观文件</label>
                <div class="file-select-area">
                    <input type="file" id="worldviewFile" accept=".txt">
                    <div class="file-info" id="fileInfo">未选择文件</div>
                </div>
            </div>
            <div class="dialog-buttons">
                <button id="confirmCreateWorldBtn" class="confirm-btn">创建世界</button>
                <button id="cancelCreateWorldBtn" class="cancel-btn">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    // 绑定关闭按钮
    dialog.querySelector('.dialog-close-btn').addEventListener('click', () => {
        dialog.remove();
    });
    
    // 绑定取消按钮
    dialog.querySelector('#cancelCreateWorldBtn').addEventListener('click', () => {
        dialog.remove();
    });
    
    // 绑定文件选择
    const fileInput = dialog.querySelector('#worldviewFile');
    const fileInfo = dialog.querySelector('#fileInfo');
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileInfo.textContent = e.target.files[0].name;
            fileInfo.style.color = '#88ffaa';
        } else {
            fileInfo.textContent = '未选择文件';
            fileInfo.style.color = '#888';
        }
    });
    
    // 绑定创建按钮
    dialog.querySelector('#confirmCreateWorldBtn').addEventListener('click', async () => {
        const worldName = dialog.querySelector('#newWorldName').value.trim();
        const file = fileInput.files[0];
        
        if (!worldName) {
            events.emit(Events.TOAST, { message: '请输入世界名称', duration: 2000 });
            return;
        }
        if (!file) {
            events.emit(Events.TOAST, { message: '请选择世界观文件', duration: 2000 });
            return;
        }
        
        // 自动生成世界 ID
        let worldId = worldName
            .toLowerCase()
            .replace(/[^a-z\u4e00-\u9fa5]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        
        if (/[\u4e00-\u9fa5]/.test(worldId)) {
            worldId = `world_${Date.now()}`;
        }
        
        events.emit(Events.LOADING_START, '创建世界中...');
        
        try {
            const content = await file.text();
            
            const response = await fetch('/api/world/create_with_worldview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    world_id: worldId,
                    world_name: worldName,
                    description: '',
                    worldview_content: content
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '创建失败');
            }
            
            events.emit(Events.TOAST, { message: `世界「${worldName}」创建成功！`, duration: 3000 });
            dialog.remove();
            
            // 刷新世界列表
            await showWorldSelection();
            
        } catch (err) {
            console.error('创建世界失败:', err);
            events.emit(Events.TOAST, { message: '创建失败: ' + err.message, type: 'error', duration: 3000 });
        } finally {
            events.emit(Events.LOADING_END);
        }
    });
}

function bindGhostModeMenuEvents(panel) {
    const backBtn = document.getElementById('backToWorldBtn');
    if (backBtn) backBtn.addEventListener('click', showWorldSelection);
    
    // 导入、创建等按钮事件绑定（调用 character 模块）
}