// js/ghost/modules/chat.js
import { state } from '../core/state.js';
import { events, Events } from '../core/events.js';
import { elements, scrollChatToBottom, updateInputsDisabled } from '../ui/dom.js';
import { renderChatHistory, refreshTasksPanel, updateTimeDisplay, refreshNPCList } from '../ui/render.js';
import { showToast } from '../ui/components.js';
import { appendToConversationHistory, environmentInteract } from '../../api.js';
import { refreshCharacterTime } from '../core/session.js';
import { switchScene } from './location.js';

// 发送消息
export async function handleSendMessage() {
    if (state.isWaitingForAI) {
        showToast('请等待上一条消息处理完成', 1500);
        return;
    }
    
    if (state.currentSession.isDead) {
        showToast('角色已死亡，无法互动', 2000);
        return;
    }
    
    const action = elements.actionInput?.value?.trim() || '';
    const speech = elements.speechInput?.value?.trim() || '';
    
    if (!action && !speech) {
        showToast('请填写动作或语言', 2000);
        return;
    }
    
    // 对话模式
    if (state.isInDialogue && state.currentDialogueNPC && speech) {
        await sendDialogueMessage(action, speech);
        return;
    }
    
    // 对话模式但有动作无语言
    if (state.isInDialogue && state.currentDialogueNPC && action && !speech) {
        showToast('请填写想对 NPC 说的话', 2000);
        return;
    }
    
    // 环境交互
    await sendEnvironmentMessage(action, speech);
}

// 发送环境交互消息
async function sendEnvironmentMessage(action, speech) {
    let displayContent = '';
    let storageContent = '';
    
    if (action && speech) {
        displayContent = `（${action}）"${speech}"`;
        storageContent = `${action}\n${speech}`;
    } else if (action) {
        displayContent = `（${action}）`;
        storageContent = action;
    } else if (speech) {
        displayContent = `"${speech}"`;
        storageContent = speech;
    }
    
    // 添加用户消息
    const userMsg = {
        role: 'user',
        speaker: state.currentSession.profile?.name || '我',
        content: displayContent,
        timestamp: Date.now(),
        isDead: false
    };
    state.addChatMessage(userMsg);
    
    await appendToConversationHistory(
        state.currentSession.characterId,
        state.currentSession.profile?.name || '我',
        storageContent,
        state.currentSession.currentScene,
        false
    );
    
    renderChatHistory();
    scrollChatToBottom();
    
    // 清空输入框
    if (elements.actionInput) elements.actionInput.value = '';
    if (elements.speechInput) elements.speechInput.value = '';
    
    // 调用AI
    await callAIAndRespond({ action, speech });
}

// 发送对话消息
async function sendDialogueMessage(action, speech) {
    // 构建显示内容和存储内容
    let displayContent = '';
    let storageContent = '';
    
    if (action && speech) {
        displayContent = `（${action}）"${speech}"`;
        storageContent = `${action}\n${speech}`;
    } else if (action) {
        displayContent = `（${action}）`;
        storageContent = action;
    } else if (speech) {
        displayContent = `"${speech}"`;
        storageContent = speech;
    }
    
    const userMsg = {
        role: 'user',
        speaker: state.currentSession.profile?.name || '我',
        content: displayContent,
        timestamp: Date.now(),
        isDead: false
    };
    state.addChatMessage(userMsg);
    
    await appendToConversationHistory(
        state.currentSession.characterId,
        state.currentSession.profile?.name || '我',
        storageContent,
        state.currentSession.currentScene,
        false
    );
    
    renderChatHistory();
    scrollChatToBottom();
    
    if (elements.speechInput) elements.speechInput.value = '';
    if (elements.actionInput) elements.actionInput.value = '';
    
    // 传递 action 和 speech
    const { callAIForDialogue } = await import('./dialogue.js');
    await callAIForDialogue(action, speech, false);
}

// 调用AI并响应
export async function callAIAndRespond(userInput) {
    state.isWaitingForAI = true;
    renderChatHistory();
    updateInputsDisabled(true);
    
    // 显示加载指示器
    const loadingIndicator = showLoadingIndicator();
    
    try {
        const historyForAI = state.chatHistory.slice(-10).map(msg => ({
            speaker: msg.speaker,
            content: msg.content,
            role: msg.role
        }));
        
        const response = await environmentInteract(
            state.currentSession.characterId,
            window.currentChapterIndex || 1,
            state.currentSession.currentScene,
            state.currentSession.profile?.name || '我',
            { action: userInput.action, speech: userInput.speech },
            historyForAI,
            state.currentSceneNPCs
        );
        
        removeLoadingIndicator(loadingIndicator);
        
        const description = response.description || '世界没有给出回应。';
        const isDead = response.is_dead === true;
        const newLocation = response.new_location;
        
        // 处理时间变化
        if (response.time_cost !== undefined && response.time_cost > 0) {
            await refreshCharacterTime();
            updateTimeDisplay();
        }
        
        if (response.new_energy_state && state.currentSession.time) {
            state.currentSession.time.energy_state = response.new_energy_state;
            updateTimeDisplay();
        }
        
        // 添加AI回应
        const assistantMsg = {
            role: 'assistant',
            speaker: '旁白',
            content: description,
            timestamp: Date.now(),
            isDead: isDead,
            continueDisabled: false
        };
        state.addChatMessage(assistantMsg);
        
        await appendToConversationHistory(
            state.currentSession.characterId,
            '旁白',
            description,
            state.currentSession.currentScene,
            isDead
        );
        
        // 处理死亡
        if (isDead) {
            state.currentSession.isDead = true;
            showToast('💀 角色死亡，无法继续互动', 5000);
            updateInputsDisabled(true);
        }
        
        // 处理场景切换
        if (newLocation && newLocation !== state.currentSession.currentScene) {
            await switchScene(newLocation);
        } else {
            renderChatHistory();
            scrollChatToBottom();
        }
        
        await refreshNPCList();
        
        // 刷新任务面板（因为 AI 可能更新了任务）
        await refreshTasksPanel();
        
    } catch (err) {
        console.error('AI调用失败:', err);
        removeLoadingIndicator(loadingIndicator);
        
        const errorMsg = {
            role: 'assistant',
            speaker: '系统',
            content: `错误：${err.message}`,
            timestamp: Date.now(),
            isDead: false
        };
        state.addChatMessage(errorMsg);
        renderChatHistory();
        scrollChatToBottom();
        showToast('AI调用失败，请重试', 3000, 'error');
    } finally {
        state.isWaitingForAI = false;
        updateInputsDisabled(state.currentSession.isDead);
        const { renderPartyList } = await import('../ui/render.js');
        await renderPartyList();
        // 刷新任务面板
        const { refreshTasksPanel } = await import('../ui/render.js');
        await refreshTasksPanel();
    }
}

// 继续按钮处理
export async function handleContinue() {
    if (state.isWaitingForAI) {
        showToast('请等待上一条消息处理完成', 1500);
        return;
    }
    
    if (state.currentSession.isDead) {
        showToast('角色已死亡，无法继续', 2000);
        return;
    }
    
    await callAIAndRespond({ action: '继续', speech: '' });
}

// 删除历史
export async function handleDeleteHistory(fromIndex) {
    const deletedCount = state.chatHistory.length - fromIndex;
    state.chatHistory = state.chatHistory.slice(0, fromIndex);
    
    const { deleteHistory } = await import('../../api.js');
    await deleteHistory(state.currentSession.characterId, fromIndex);
    
    if (state.currentSession.isDead) {
        state.currentSession.isDead = false;
        updateInputsDisabled(false);
        showToast('已复活，可以继续游戏', 2000);
    }
    
    renderChatHistory();
    scrollChatToBottom();
    const { renderCharacterInfo } = await import('../ui/render.js');
    renderCharacterInfo();
    
    showToast(`已删除 ${deletedCount} 条消息`, 2000);
}

// 测试AI连接
export async function testAIConnection() {
    console.log('testAIConnection 被调用');
    
    try {
        const response = await fetch('/api/ghost/test_ai');
        const data = await response.json();
        
        console.log('test_ai 响应:', data);
        
        if (data.success) {
            if (window.showTempMessage) {
                window.showTempMessage('✅ AI连接正常！', 2000);
            } else {
                alert('✅ AI连接正常！');
            }
        } else {
            if (window.showTempMessage) {
                window.showTempMessage('⚠️ ' + data.message, 3000);
            } else {
                alert('⚠️ ' + data.message);
            }
        }
    } catch (err) {
        console.error('测试AI失败:', err);
        if (window.showTempMessage) {
            window.showTempMessage('❌ 连接失败: ' + err.message, 3000);
        } else {
            alert('❌ 连接失败: ' + err.message);
        }
    }
}

// 辅助函数
function showLoadingIndicator() {
    const container = elements.chatMessages;
    if (!container) return null;
    
    const indicator = document.createElement('div');
    indicator.id = 'aiLoadingIndicator';
    indicator.className = 'chat-message assistant-message';
    indicator.innerHTML = '<div class="chat-speaker">📖 旁白</div><div class="chat-content"><span class="loading-dots">思考中</span></div>';
    container.appendChild(indicator);
    scrollChatToBottom();
    return indicator;
}

function removeLoadingIndicator(indicator) {
    if (indicator) indicator.remove();
}