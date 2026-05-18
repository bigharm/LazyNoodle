// js/ghost/modules/helper.js
import { state } from '../core/state.js';
import { showToast } from '../ui/components.js';

let isSystemHelperDialogOpen = false;

// 打开系统助手对话框
export function openSystemHelperDialog() {
    if (isSystemHelperDialogOpen) return;
    isSystemHelperDialogOpen = true;
    
    const dialog = document.createElement('div');
    dialog.id = 'systemHelperDialog';
    dialog.className = 'system-helper-dialog';
    dialog.innerHTML = `
        <div class="dialog-header">
            <span>🤖 系统助手</span>
            <button class="dialog-close-btn">✕</button>
        </div>
        <div class="dialog-content">
            <div class="helper-options">
                <button class="helper-option" data-command="status">📊 查看状态</button>
                <button class="helper-option" data-command="task">📋 安排任务</button>
                <button class="helper-option" data-command="hint">💡 获取提示</button>
            </div>
            <div class="helper-custom-input">
                <textarea id="helperCustomQuestion" rows="3" placeholder="输入你的问题..."></textarea>
                <button id="helperSendBtn">发送</button>
            </div>
            <div class="helper-response" id="helperResponse">
                <div class="helper-message system">💡 你好！我是系统助手，可以帮助你：</div>
                <div class="helper-message system">• 查看角色状态</div>
                <div class="helper-message system">• 查看任务进度</div>
                <div class="helper-message system">• 安排新任务</div>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    dialog.querySelector('.dialog-close-btn').addEventListener('click', () => {
        dialog.remove();
        isSystemHelperDialogOpen = false;
    });
    
    dialog.querySelectorAll('.helper-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const command = btn.dataset.command;
            const responseDiv = document.getElementById('helperResponse');
            
            let query = '';
            switch (command) {
                case 'status': query = '查看我的状态'; break;
                case 'task': query = '给我安排一个任务'; break;
                case 'hint': query = '给我一些游戏提示'; break;
            }
            
            if (query) {
                responseDiv.innerHTML = '<div class="helper-message system">🤖 思考中...</div>';
                await sendSystemHelperQuery(query, responseDiv);
            }
        });
    });
    
    const sendBtn = document.getElementById('helperSendBtn');
    const customQuestion = document.getElementById('helperCustomQuestion');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', async () => {
            const query = customQuestion.value.trim();
            if (!query) {
                showToast('请输入问题', 1500);
                return;
            }
            const responseDiv = document.getElementById('helperResponse');
            responseDiv.innerHTML = '<div class="helper-message system">🤖 思考中...</div>';
            await sendSystemHelperQuery(query, responseDiv);
            customQuestion.value = '';
        });
    }
    
    if (customQuestion) {
        customQuestion.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                sendBtn?.click();
            }
        });
    }
}

// 发送系统助手查询
async function sendSystemHelperQuery(query, responseDiv) {
    try {
        const profile = state.currentSession.profile || {};
        const globalUnlocked = getGlobalUnlockedLocations();
        
        let worldview = '';
        try {
            const worldviewRes = await fetch('/api/world/current');
            if (worldviewRes.ok) {
                const data = await worldviewRes.json();
                const fullRes = await fetch('/api/world/worldview');
                if (fullRes.ok) {
                    const fullData = await fullRes.json();
                    worldview = fullData.content || '';
                }
            }
        } catch (err) {
            console.warn('获取世界观失败:', err);
        }
        
        let allLocations = { regions: [], locations: [] };
        try {
            const locationsRes = await fetch('/api/ghost/locations/all');
            if (locationsRes.ok) allLocations = await locationsRes.json();
        } catch (err) {
            console.warn('获取地点信息失败:', err);
        }
        
        let allNpcs = [];
        try {
            const npcsRes = await fetch('/api/ghost/npcs/all');
            if (npcsRes.ok) {
                const data = await npcsRes.json();
                allNpcs = data.npcs || [];
            }
        } catch (err) {
            console.warn('获取NPC信息失败:', err);
        }
        
        // 获取当前任务
        let activeTasksText = "（无活跃任务）";
        if (state.tasks.active && state.tasks.active.length > 0) {
            const taskList = state.tasks.active.map(t => `- [${t.name}] ${t.description}`).join('\n');
            activeTasksText = taskList;
        }
        
        // 获取关系信息
        let relationshipsText = "";
        if (state.currentSession.relationships_history && state.currentSession.relationships_history.length > 0) {
            const latest = state.currentSession.relationships_history[state.currentSession.relationships_history.length - 1];
            relationshipsText = latest.content || "";
        }
        
        const allInfo = {
            name: profile.name || '玩家',
            identity: profile.identity || '旅行者',
            current_scene: state.currentSession.currentScene,
            resources: state.currentSession.resources || {},
            reputation: state.currentSession.reputation || {},
            unlocked_locations: Object.keys(globalUnlocked),
            current_goals: state.currentSession.currentGoals || [],
            active_tasks: activeTasksText,
            relationships: relationshipsText,
            extra: {
                chapter_index: window.currentChapterIndex,
                available_scenes: [],
                is_dead: state.currentSession.isDead
            }
        };
        
        const response = await fetch('/api/ghost/system_helper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                character_id: state.currentSession.characterId,
                query: query,
                player_name: profile.name || '玩家',
                player_identity: profile.identity || '旅行者',
                current_scene: state.currentSession.currentScene,
                resources: state.currentSession.resources || {},
                reputation: state.currentSession.reputation || {},
                unlocked_locations: Object.keys(globalUnlocked),
                current_goals: state.currentSession.currentGoals || [],
                active_tasks: state.currentSession.activeTasks || [],
                history: [],
                extra_context: {
                    chapter_index: window.currentChapterIndex,
                    available_scenes: [],
                    is_dead: state.currentSession.isDead,
                    worldview: worldview,
                    locations: allLocations,
                    npcs: allNpcs
                }
            })
        });
        
        const data = await response.json();

        // 调试：打印返回数据
        //console.log('系统助手返回数据:', data);

        const description = data.description || '系统助手无法理解你的问题。';
        const taskData = data.task || data.task_data;
        const taskGenerated = data.task_generated;

        // 根据是否生成任务来决定显示内容
        let htmlContent = '';

        if (taskGenerated && taskData) {
            // 任务生成时，显示中性提示，不显示 AI 的"已添加"文本
            htmlContent = '✨ 系统助手为你生成了一个新任务，请确认是否接受：';
        } else {
            // 正常显示 AI 回复
            if (typeof marked !== 'undefined') {
                htmlContent = await marked.parse(description);
            } else {
                htmlContent = escapeHtml(description)
                    .replace(/\n/g, '<br>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/^- (.*?)(?:\n|$)/gm, '<li>$1</li>')
                    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
            }
        }

        responseDiv.innerHTML = `<div class="helper-message assistant">${htmlContent}</div>`;
        
        // 处理任务生成（需要玩家确认）
        //console.log('task_generated:', data.task_generated);
        //console.log('task_data:', data.task_data);  // 后端返回了 task_data
        
        if (data.task_generated && data.task_data) {
            const task = data.task_data;
            const taskName = task.name || "新任务";
            const taskDescription = task.description || "";
            
            // 在面板内显示任务确认组件（而不是 alert）
            const taskConfirmDiv = document.createElement('div');
            taskConfirmDiv.className = 'task-confirm-card';
            taskConfirmDiv.innerHTML = `
                <div class="task-confirm-icon">✨</div>
                <div class="task-confirm-title">发现新任务：${escapeHtml(taskName)}</div>
                <div class="task-confirm-description">${escapeHtml(taskDescription)}</div>
                <div class="task-confirm-buttons">
                    <button class="task-confirm-accept">✅ 接受任务</button>
                    <button class="task-confirm-reject">❌ 拒绝</button>
                </div>
            `;
            
            // 插入到响应内容之后
            responseDiv.appendChild(taskConfirmDiv);
            
            // 绑定接受按钮事件
            const acceptBtn = taskConfirmDiv.querySelector('.task-confirm-accept');
            const rejectBtn = taskConfirmDiv.querySelector('.task-confirm-reject');
            
            acceptBtn.addEventListener('click', async () => {
                taskConfirmDiv.innerHTML = '<div class="task-confirm-loading">⏳ 接受任务中...</div>';
                
                try {
                    const saveResponse = await fetch('/api/ghost/add_task', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            character_id: state.currentSession.characterId,
                            task: {
                                name: taskName,
                                description: taskDescription,
                                source: "system_helper"
                            }
                        })
                    });
                    
                    if (saveResponse.ok) {
                        taskConfirmDiv.innerHTML = '<div class="task-confirm-success">✅ 任务已接受！祝你好运！</div>';
                        showToast('✅ 任务已接受！', 2000);
                        // 刷新任务面板
                        const { refreshTasksPanel } = await import('../ui/render.js');
                        await refreshTasksPanel();
                        
                        // 3秒后移除确认卡片
                        setTimeout(() => {
                            taskConfirmDiv.remove();
                        }, 3000);
                    } else {
                        const error = await saveResponse.json();
                        taskConfirmDiv.innerHTML = `<div class="task-confirm-error">❌ 接受失败：${error.detail || '未知错误'}</div>`;
                        setTimeout(() => {
                            taskConfirmDiv.remove();
                        }, 3000);
                    }
                } catch (err) {
                    console.error('保存任务失败:', err);
                    taskConfirmDiv.innerHTML = `<div class="task-confirm-error">❌ 接受失败：${err.message}</div>`;
                    setTimeout(() => {
                        taskConfirmDiv.remove();
                    }, 3000);
                }
            });
            
            rejectBtn.addEventListener('click', () => {
                taskConfirmDiv.innerHTML = '<div class="task-confirm-rejected">⏸ 任务已取消</div>';
                showToast('已取消任务', 1500);
                setTimeout(() => {
                    taskConfirmDiv.remove();
                }, 2000);
            });
        }
        
    } catch (err) {
        console.error('系统助手调用失败:', err);
        responseDiv.innerHTML = `<div class="helper-message error">❌ 调用失败：${err.message}</div>`;
    }
}

function getGlobalUnlockedLocations() {
    return JSON.parse(localStorage.getItem('global_unlocked_locations') || '{}');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}