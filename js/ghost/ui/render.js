// js/ghost/ui/render.js
import { state } from '../core/state.js';
import { events, Events } from '../core/events.js';
import { elements, scrollChatToBottom } from './dom.js';
import { buildLocationTree, switchScene } from '../modules/location.js';
import { getNPCsByScene } from '../../api.js';
import { callAIAndRespond } from '../modules/chat.js';
import { startNPCDialogue, observeNPC, endDialogue, continueDialogue } from '../modules/dialogue.js';
import { openSystemHelperDialog } from '../modules/helper.js';
import { createGhostPanel, bindPanelEvents } from './dom.js';
import { saveGhostSessionToStorage } from '../core/session.js';
import { showToast } from './components.js';  

// 渲染聊天历史
export function renderChatHistory() {
    if (!elements.chatMessages) return;
    
    const history = state.chatHistory;
    
    if (history.length === 0) {
        elements.chatMessages.innerHTML = '<div style="text-align: center; padding: 40px; color: #888;">暂无对话记录</div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < history.length; i++) {
        const msg = history[i];
        const isDead = msg.isDead === true;
        
        if (msg.role === 'user') {
            let displayContent = msg.content;
            // 清理存储格式的标记
            displayContent = displayContent.replace(/^【语言】/, '');
            displayContent = displayContent.replace(/^【动作】/, '');
            
            html += `
                <div class="chat-message user-message" data-index="${i}">
                    <div class="chat-speaker">🎮 ${escapeHtml(msg.speaker)}</div>
                    <div class="chat-content">${escapeHtml(displayContent)}</div>
                    <button class="delete-msg-btn" data-index="${i}" title="删除此条及之后所有消息">🗑️</button>
                </div>
            `;
        } else if (msg.role === 'assistant') {
            const isDialogue = msg.isDialogue === true;
            const isSystemSpeaker = msg.speaker === '系统';
            
            // 只有在对话模式下，且是最后一条NPC消息时，才考虑显示"不说话，让TA继续"按钮
            // 并且只在等待AI时显示（让玩家可以选择不说话）
            const isLastNPCMessage = isDialogue && i === history.length - 1 && state.isInDialogue && !isSystemSpeaker;
            
            html += `
                <div class="chat-message assistant-message ${isDead ? 'dead-message' : ''} ${isDialogue ? 'dialogue-message' : ''}" data-index="${i}">
                    <div class="chat-speaker">${isDead ? '💀' : (isDialogue ? '💬' : '📖')} ${escapeHtml(msg.speaker)}</div>
                    <div class="chat-content">${escapeHtml(msg.content)}</div>
                    ${isLastNPCMessage && !state.isWaitingForAI ? `
                        <div class="dialogue-buttons">
                            <button class="dialogue-continue-btn" data-npc-id="${state.currentDialogueNPC?.id || ''}" data-npc-name="${escapeHtml(state.currentDialogueNPC?.name || '')}">⏸ 不说话，让TA继续</button>
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (msg.role === 'system') {
            html += `
                <div class="chat-message system-message">
                    <div class="chat-speaker">📌 ${escapeHtml(msg.speaker)}</div>
                    <div class="chat-content">${escapeHtml(msg.content)}</div>
                </div>
            `;
        }
    }
    
    // 如果在对话模式下，在聊天区域底部添加固定的"结束对话"按钮
    // 只有不在等待AI时，才显示按钮
    if (state.isInDialogue && state.currentDialogueNPC && !state.isWaitingForAI) {
        html += `
            <div class="chat-footer">
                <button class="end-dialogue-footer-btn">✕ 结束对话</button>
            </div>
        `;
    } 
    
    elements.chatMessages.innerHTML = html;
    
    // 绑定删除按钮事件
    bindDeleteButtons();
    // 绑定对话继续按钮
    bindDialogueButtons();
    // 绑定结束对话按钮
    bindEndDialogueButton();
    
    scrollChatToBottom();
}

// 绑定结束对话按钮
function bindEndDialogueButton() {
    const endBtn = document.querySelector('.end-dialogue-footer-btn');
    if (endBtn) {
        endBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('执行结束对话');
            const { endDialogue } = await import('../modules/dialogue.js');
            await endDialogue();
        });
    }
}

// 渲染侧边栏地点
export async function renderSidebarLocations() {
    if (!elements.locationsList) return;
    
    const locationTree = await buildLocationTree();
    
    if (!locationTree || locationTree.length === 0) {
        elements.locationsList.innerHTML = '<div style="color: #888; padding: 12px; text-align: center;">暂无已解锁地点</div>';
        return;
    }
    
    let html = '';
    for (const region of locationTree) {
        html += `<div class="location-region">
                    <div class="region-name">${region.icon || '📁'} ${escapeHtml(region.name)}</div>`;
        for (const location of region.locations) {
            const isCurrent = location.name === state.currentSession.currentScene;
            html += `<div class="location-item ${isCurrent ? 'current' : ''}" data-location-name="${escapeHtml(location.name)}">
                        <span class="location-icon">${location.icon || '📍'}</span>
                        <span class="location-name">${escapeHtml(location.name)}</span>
                        ${isCurrent ? '<span class="current-badge">当前</span>' : ''}
                    </div>`;
        }
        html += `</div>`;
    }
    
    elements.locationsList.innerHTML = html;
    
    // 绑定地点点击事件
    document.querySelectorAll('.location-item').forEach(item => {
        item.addEventListener('click', async () => {
            const locationName = item.dataset.locationName;
            if (locationName && locationName !== state.currentSession.currentScene) {
                if (confirm(`确定要前往「${locationName}」吗？`)) {
                    await switchScene(locationName);
                }
            }
        });
    });
}

// 渲染侧边栏NPC
export async function renderSidebarNPCs() {
    if (!elements.npcList) return;
    
    let html = '';
    
    // 系统助手
    html += `<div class="npc-item system-helper-item" data-npc-id="system_helper" data-npc-name="系统助手">
                <div class="npc-icon">🤖</div>
                <div class="npc-info">
                    <div class="npc-name">系统助手</div>
                    <div class="npc-identity">游戏助手 / 帮助菜单</div>
                </div>
                <div class="npc-actions">
                    <button class="system-helper-btn">💬 对话</button>
                </div>
            </div>`;
    
    // 其他NPC
    for (const npc of state.currentSceneNPCs) {
        const profile = npc.profile || {};
        html += `<div class="npc-item" data-npc-id="${npc.id}" data-npc-name="${escapeHtml(npc.name)}">
                    <div class="npc-icon">👤</div>
                    <div class="npc-info">
                        <div class="npc-name">${escapeHtml(npc.name)}</div>
                        <div class="npc-identity">${escapeHtml(profile.identity || '普通人')}</div>
                    </div>
                    <div class="npc-actions">
                        <button class="npc-observe-btn">🔍 观察</button>
                        <button class="npc-talk-btn">💬 对话</button>
                    </div>
                </div>`;
    }
    
    elements.npcList.innerHTML = html;
    
    // 绑定系统助手
    const systemHelperBtn = document.querySelector('.system-helper-btn');
    if (systemHelperBtn) {
        systemHelperBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSystemHelperDialog();
        });
    }
    
    // 绑定NPC按钮
    bindNPCButtons();
}

// 渲染角色信息
export function renderCharacterInfo() {
    const profile = state.currentSession.profile || {};
    const isDead = state.currentSession.isDead;
    
    if (elements.charName) elements.charName.textContent = profile.name || '未知';
    if (elements.charIdentity) elements.charIdentity.textContent = profile.identity || '旅行者';
    if (elements.charScene) elements.charScene.textContent = state.currentSession.currentScene || '未知';
    if (elements.charStatus) {
        if (isDead) {
            elements.charStatus.innerHTML = '💀 死亡';
            elements.charStatus.style.color = '#ff6666';
        } else {
            elements.charStatus.innerHTML = '❤️ 存活';
            elements.charStatus.style.color = '#66ff66';
        }
    }
}

// 更新时间显示
export function updateTimeDisplay() {
    if (!elements.timeDisplay) return;
    
    const timeInfo = state.currentSession.time || {};
    const day = timeInfo.current_day || 1;
    const rawHour = timeInfo.current_hour || 8;
    const hour = Math.floor(rawHour);
    const minute = Math.round((rawHour - hour) * 60);
    const minuteStr = minute.toString().padStart(2, '0');
    const energy = timeInfo.energy_state || '精力充沛';
    let remaining = timeInfo.chapter_time_remaining || 72;
    const nodeName = timeInfo.chapter_node_name || '下个节点';
    
    // 修复小数显示：四舍五入取整
    remaining = Math.round(remaining);
    
    let energyIcon = '⚡';
    if (energy.includes('疲惫')) energyIcon = '😫';
    if (energy.includes('枯竭')) energyIcon = '💀';
    
    elements.timeDisplay.innerHTML = `📅 第${day}天 ${hour}:${minuteStr} ${energyIcon} ${energy} | ⏰ 距${nodeName}: ${remaining}小时`;
}

// 渲染任务面板
export async function renderTasksPanel() {
    if (!elements.tasksList) return;
    
    try {
        let activeTasks = [];
        let completedTasks = [];
        
        // 优先使用 state 中的缓存
        if (state.tasks && state.tasks.active && state.tasks.active.length > 0) {
            activeTasks = [...state.tasks.active];
            completedTasks = state.tasks.completed;
        } else {
            const response = await fetch(`/api/ghost/tasks?character_id=${state.currentSession.characterId}`);
            if (!response.ok) {
                throw new Error('加载任务失败');
            }
            const tasksData = await response.json();
            activeTasks = tasksData.active_tasks || [];
            completedTasks = tasksData.completed_tasks || [];
            state.updateTasks(tasksData);
        }
        
        // 按优先级排序（优先级数值越小越靠上）
        activeTasks.sort((a, b) => {
            const priorityA = a.priority ?? 100;
            const priorityB = b.priority ?? 100;
            return priorityA - priorityB;
        });
        
        if (activeTasks.length === 0) {
            elements.tasksList.innerHTML = '<div style="color: #888; padding: 12px; text-align: center;">暂无任务</div>';
            return;
        }
        
        let html = '';
        for (const task of activeTasks) {
            const priority = task.priority ?? 100;
            let priorityIcon = '📌';
            let priorityClass = '';
            if (priority <= 30) {
                priorityIcon = '🔥';
                priorityClass = 'priority-high';
            } else if (priority <= 70) {
                priorityIcon = '⭐';
                priorityClass = 'priority-medium';
            } else {
                priorityIcon = '📋';
                priorityClass = 'priority-normal';
            }
            
            html += `
                <div class="task-item ${priorityClass}" data-task-id="${escapeHtml(task.id)}">
                    <div class="task-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="task-name" style="flex: 1;">${priorityIcon} ${escapeHtml(task.name)}</div>
                        <button class="task-delete-btn" data-task-id="${escapeHtml(task.id)}" data-task-name="${escapeHtml(task.name)}" title="删除任务" style="background: none; border: none; color: #aa6666; cursor: pointer; font-size: 1rem; padding: 0 4px; opacity: 0.5; transition: opacity 0.2s;">🗑️</button>
                    </div>
                    <div class="task-description">${escapeHtml(task.description)}</div>
                    <div class="task-meta">
                        <span class="task-source">📅 ${escapeHtml(task.source || '系统')}</span>
                        <span class="task-priority">🎯 优先级: ${priority}</span>
                    </div>
                </div>
            `;
        }
        
        // 如果有已完成任务，添加可折叠区域
        if (completedTasks.length > 0) {
            html += `
                <div class="completed-tasks-section">
                    <div class="completed-header" id="completedTasksHeader" style="cursor: pointer; margin-top: 12px; padding: 8px 0; color: #888; border-top: 1px solid #2a2a44;">
                        📜 已完成任务 (${completedTasks.length}) <span id="completedToggleIcon">▶</span>
                    </div>
                    <div class="completed-tasks-list" id="completedTasksList" style="display: none;">
            `;
            for (const task of completedTasks.slice(-10)) {
                html += `
                    <div class="task-item completed">
                        <div class="task-name">✅ ${escapeHtml(task.name)}</div>
                        <div class="task-description">${escapeHtml(task.description)}</div>
                    </div>
                `;
            }
            html += `
                    </div>
                </div>
            `;
        }
        
        elements.tasksList.innerHTML = html;
        
        // 绑定删除按钮事件
        document.querySelectorAll('.task-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taskId = btn.dataset.taskId;
                const taskName = btn.dataset.taskName;
                if (confirm(`确定要删除任务「${taskName}」吗？\n\n删除后可以在后台恢复。`)) {
                    await deleteTask(taskId);
                }
            });
        });
        
        // 绑定已完成任务折叠功能
        const completedHeader = document.getElementById('completedTasksHeader');
        if (completedHeader) {
            completedHeader.addEventListener('click', () => {
                const completedList = document.getElementById('completedTasksList');
                const toggleIcon = document.getElementById('completedToggleIcon');
                if (completedList.style.display === 'none') {
                    completedList.style.display = 'block';
                    toggleIcon.textContent = '▼';
                } else {
                    completedList.style.display = 'none';
                    toggleIcon.textContent = '▶';
                }
            });
        }
        
    } catch (err) {
        console.error('渲染任务面板失败:', err);
        elements.tasksList.innerHTML = '<div style="color: #888; padding: 12px; text-align: center;">加载任务失败</div>';
    }
}

// 删除任务
async function deleteTask(taskId) {
    try {
        const response = await fetch('/api/ghost/delete_task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                character_id: state.currentSession.characterId,
                task_id: taskId
            })
        });
        
        if (response.ok) {
            showToast('✅ 任务已删除', 2000, 'success');
            // 刷新任务面板
            await refreshTasksPanel();
        } else {
            const error = await response.json();
            showToast('❌ 删除失败: ' + (error.detail || '未知错误'), 3000, 'error');
        }
    } catch (err) {
        console.error('删除任务失败:', err);
        showToast('❌ 删除失败: ' + err.message, 3000, 'error');
    }
}

// 刷新任务面板（强制从后端加载）
export async function refreshTasksPanel() {
    if (!elements.tasksList) return;
    
    try {
        const response = await fetch(`/api/ghost/tasks?character_id=${state.currentSession.characterId}`);
        if (!response.ok) {
            throw new Error('加载任务失败');
        }
        const tasksData = await response.json();
        state.updateTasks(tasksData);
        events.emit(Events.TASKS_UPDATED, { tasks: state.tasks });
        await renderTasksPanel();  // 重新渲染时会自动包含删除按钮
    } catch (err) {
        console.error('刷新任务面板失败:', err);
    }
}

// 显示幽灵模式聊天界面
export async function showGhostChatInterface() {
    createGhostPanel();
    bindPanelEvents();
    
    await renderSidebarLocations();
    await refreshNPCList();
    await renderTasksPanel();
    renderCharacterInfo();
    updateTimeDisplay();
    
    if (state.chatHistory.length > 0) {
        renderChatHistory();
    } else {
        await callAIAndRespond({ action: '', speech: '' });
    }
    
    saveGhostSessionToStorage();
}

// 刷新NPC列表
export async function refreshNPCList() {
    try {
        const result = await getNPCsByScene(state.currentSession.currentScene);
        state.currentSceneNPCs = result.npcs || [];
        await renderSidebarNPCs();
    } catch (err) {
        console.error('刷新NPC列表失败:', err);
    }
}

// 绑定NPC按钮
function bindNPCButtons() {
    document.querySelectorAll('.npc-observe-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const npcItem = btn.closest('.npc-item');
            const npcId = npcItem.dataset.npcId;
            const npcName = npcItem.dataset.npcName;
            await observeNPC(npcId, npcName);
        });
    });
    
    document.querySelectorAll('.npc-talk-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const npcItem = btn.closest('.npc-item');
            const npcId = npcItem.dataset.npcId;
            const npcName = npcItem.dataset.npcName;
            await startNPCDialogue(npcId, npcName);
        });
    });
}

// 绑定删除按钮
function bindDeleteButtons() {
    document.querySelectorAll('.delete-msg-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            if (confirm('删除此条及之后所有消息？')) {
                const { handleDeleteHistory } = await import('../modules/chat.js');
                await handleDeleteHistory(index);
            }
        });
    });
}

function bindDialogueButtons() {
    // 绑定"不说话，让TA继续"按钮
    document.querySelectorAll('.dialogue-continue-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const npcId = btn.dataset.npcId;
            const npcName = btn.dataset.npcName;
            const { continueDialogue } = await import('../modules/dialogue.js');
            await continueDialogue(npcId, npcName);
        });
    });
}

// 辅助函数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}