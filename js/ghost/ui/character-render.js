// js/ghost/ui/character-render.js
import { showCharacterCreationWizard, openImportDialog, bindCharacterCardButtons as bindButtons } from '../modules/character.js';
import { showWorldSelection } from '../modules/world.js';

// 渲染角色选择界面
export function renderCharacterSelection(existingCharacters, currentWorld = null) {
    let worldHtml = '';
    if (currentWorld) {
        worldHtml = `
            <div class="world-info" style="background: #1a1a2a; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="color: #ffaa66;">🌍 当前世界：</span>
                    <span style="color: #88ffaa;">${escapeHtml(currentWorld.name || currentWorld.id)}</span>
                    <span style="font-size: 0.75rem; color: #888; margin-left: 8px;">(${escapeHtml(currentWorld.id)})</span>
                </div>
                <button id="switchWorldBtn" style="background: #4a4a6a; border: none; color: white; padding: 4px 12px; border-radius: 16px; cursor: pointer;">🔄 切换世界</button>
            </div>
        `;
    }
    
    if (!existingCharacters || existingCharacters.length === 0) {
        return `
            ${worldHtml}
            <div style="text-align: center; padding: 20px; color: #888;">暂无角色</div>
            <div style="margin-top: 16px; display: flex; justify-content: center; gap: 16px;">
                <button id="createFirstCharacterBtn" class="action-btn" style="background: #2a6a2a; padding: 10px 24px; border-radius: 24px; border: none; color: white; cursor: pointer;">✨ 创建第一个角色</button>
                <button id="importPlayerBtn" class="action-btn" style="background: #4a4a6a; padding: 10px 24px; border-radius: 24px; border: none; color: white; cursor: pointer;">📥 导入玩家角色</button>
                <button id="importNpcBtn" class="action-btn" style="background: #4a6a4a; padding: 10px 24px; border-radius: 24px; border: none; color: white; cursor: pointer;">👤 导入NPC</button>
            </div>
        `;
    }
    
    let html = worldHtml;
    html += '<div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">';
    
    for (const char of existingCharacters) {
        const profile = char.profile || {};
        const isDead = char.is_dead === true;
        const characterId = char.character_id;
        
        html += `<div class="character-card ${isDead ? 'dead' : 'alive'}" data-character-id="${characterId}" data-is-dead="${isDead}" style="background: ${isDead ? '#2a1a1a' : '#1a1a2a'}; border-radius: 12px; padding: 12px 16px; border: 1px solid ${isDead ? '#5a3a3a' : '#3a3a5a'}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: ${isDead ? '#886666' : '#ffaa66'};">${isDead ? '💀 ' : ''}${escapeHtml(profile.name || '未命名')}</div>
                        <div style="font-size: 0.75rem; color: ${isDead ? '#886666' : '#aaa'};">${escapeHtml(profile.identity || '旅行者')}</div>
                        <div style="font-size: 0.7rem; color: #888; margin-top: 4px;">📍 ${escapeHtml(char.current_scene || '未知')}</div>
                        ${isDead ? '<div style="font-size: 0.65rem; color: #884444; margin-top: 2px;">已死亡（点击回顾）</div>' : ''}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="character-play-btn" data-character-id="${characterId}" style="background: #2a6a2a; border: none; color: white; padding: 6px 12px; border-radius: 16px; font-size: 0.75rem; cursor: pointer;">▶ 继续游戏</button>
                        <button class="character-delete-btn" data-character-id="${characterId}" style="background: #6a4a4a; border: none; color: white; padding: 6px 12px; border-radius: 16px; font-size: 0.75rem; cursor: pointer;">🗑️ 删除</button>
                        <button class="character-export-btn" data-character-id="${characterId}" style="background: #4a4a6a; border: none; color: white; padding: 6px 12px; border-radius: 16px; font-size: 0.75rem; cursor: pointer;">📤 导出</button>
                        <button class="character-to-npc-btn" data-character-id="${characterId}" style="background: #4a6a4a; border: none; color: white; padding: 6px 12px; border-radius: 16px; font-size: 0.75rem; cursor: pointer;">👤 转为NPC</button>
                    </div>
                </div>`;
    }
    html += '</div>';
    
    html += `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #3a3a5a; display: flex; justify-content: center; gap: 16px;">
                <button id="createNewCharacterBtn" class="action-btn" style="background: #2a4a4a; padding: 10px 24px; border-radius: 24px; border: none; color: white; cursor: pointer;">✨ 创建新角色</button>
                <button id="importPlayerBtn" class="action-btn" style="background: #4a4a6a; padding: 10px 24px; border-radius: 24px; border: none; color: white; cursor: pointer;">📥 导入玩家角色</button>
                <button id="importNpcBtn" class="action-btn" style="background: #4a6a4a; padding: 10px 24px; border-radius: 24px; border: none; color: white; cursor: pointer;">👤 导入NPC</button>
            </div>`;
    
    // 延迟绑定按钮事件，确保 DOM 已渲染
    setTimeout(() => {
        console.log('绑定角色界面按钮事件...');
        //bindActionButtons();
    }, 100);
    
    return html;
}

// 绑定所有操作按钮
function bindActionButtons() {
    //console.log('bindActionButtons 被调用');
    
    // 绑定角色卡片按钮
    try {
        bindButtons();
        //console.log('角色卡片按钮绑定成功');
    } catch (err) {
        console.error('绑定角色卡片按钮失败:', err);
    }
    
    // 创建角色按钮
    const createBtns = document.querySelectorAll('#createFirstCharacterBtn, #createNewCharacterBtn');
    //console.log('找到创建角色按钮数量:', createBtns.length);
    createBtns.forEach(btn => {
        // 移除旧事件避免重复
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            //console.log('创建角色按钮被点击');
            showCharacterCreationWizard();
        });
    });
    
    // 导入玩家角色按钮
    const importPlayerBtns = document.querySelectorAll('#importPlayerBtn');
    //console.log('找到导入玩家按钮数量:', importPlayerBtns.length);
    importPlayerBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            //console.log('导入玩家角色按钮被点击');
            openImportDialog('player');
        });
    });
    
    // 导入NPC按钮
    const importNpcBtns = document.querySelectorAll('#importNpcBtn');
    //console.log('找到导入NPC按钮数量:', importNpcBtns.length);
    importNpcBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            //console.log('导入NPC按钮被点击');
            openImportDialog('npc');
        });
    });
    
    // 切换世界按钮
    const switchWorldBtn = document.getElementById('switchWorldBtn');
    if (switchWorldBtn) {
        const newBtn = switchWorldBtn.cloneNode(true);
        switchWorldBtn.parentNode.replaceChild(newBtn, switchWorldBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            //console.log('切换世界按钮被点击');
            showWorldSelection();
        });
    }
}

// 绑定角色卡片按钮（供外部调用）
export function bindCharacterCardButtons() {
    bindButtons();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}