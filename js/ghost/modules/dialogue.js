// js/ghost/modules/dialogue.js
import { state } from '../core/state.js';
import { events, Events } from '../core/events.js';
import { elements, scrollChatToBottom, updateInputsDisabled } from '../ui/dom.js';
import { renderChatHistory, refreshNPCList } from '../ui/render.js';
import { showToast } from '../ui/components.js';
import { appendToConversationHistory } from '../../api.js';
import { callAIAndRespond } from './chat.js';

// 开始NPC对话
export async function startNPCDialogue(npcId, npcName) {
    if (state.isWaitingForAI) {
        showToast('请等待上一条消息处理完成', 1500);
        return;
    }
    
    if (state.currentSession.isDead) {
        showToast('角色已死亡，无法对话', 2000);
        return;
    }
    
    state.currentDialogueNPC = { id: npcId, name: npcName };
    state.isInDialogue = true;
    
    // 添加系统消息
    const systemMsg = {
        role: 'system',
        speaker: '系统',
        content: `你开始与 ${npcName} 对话。`,
        timestamp: Date.now(),
        isDead: false
    };
    state.addChatMessage(systemMsg);
    
    await appendToConversationHistory(
        state.currentSession.characterId,
        '系统',
        `你开始与 ${npcName} 对话。`,
        state.currentSession.currentScene,
        false
    );
    
    renderChatHistory();
    scrollChatToBottom();
    
    // 不再自动触发NPC问候
    // 等待玩家输入第一句话
    showToast(`现在可以对 ${npcName} 说话了`, 2000);
}

// 继续对话（不说话，让NPC继续说）
export async function continueDialogue(npcId, npcName) {
    if (state.isWaitingForAI) {
        showToast('请等待上一条消息处理完成', 1500);
        return;
    }
    
    if (state.currentSession.isDead) {
        showToast('角色已死亡，无法继续对话', 2000);
        return;
    }
    
    await callAIForDialogue('', '', false, true);
}

// 结束对话
export async function endDialogue() {
    if (!state.isInDialogue) return;
    
    const npcName = state.currentDialogueNPC?.name || 'NPC';
    
    const systemMsg = {
        role: 'system',
        speaker: '系统',
        content: `你结束了与 ${npcName} 的对话。`,
        timestamp: Date.now(),
        isDead: false
    };
    state.addChatMessage(systemMsg);
    
    await appendToConversationHistory(
        state.currentSession.characterId,
        '系统',
        `你结束了与 ${npcName} 的对话。`,
        state.currentSession.currentScene,
        false
    );
    
    state.currentDialogueNPC = null;
    state.isInDialogue = false;
    
    renderChatHistory();
    scrollChatToBottom();
    showToast(`已结束与 ${npcName} 的对话`, 2000);
}

// 观察NPC
export async function observeNPC(npcId, npcName) {
    if (state.isWaitingForAI) {
        showToast('请等待上一条消息处理完成', 1500);
        return;
    }
    
    if (state.currentSession.isDead) {
        showToast('角色已死亡，无法观察', 2000);
        return;
    }
    
    // 显示加载状态
    const loadingMsg = {
        role: 'assistant',
        speaker: '旁白',
        content: '🔍 观察中...',
        timestamp: Date.now(),
        isDead: false,
        isTemporary: true
    };
    state.addChatMessage(loadingMsg);
    renderChatHistory();
    scrollChatToBottom();
    
    try {
        const response = await fetch('/api/ghost/observe_npc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                character_id: state.currentSession.characterId,
                npc_name: npcName,
                scene: state.currentSession.currentScene
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // 移除临时的加载消息
        state.chatHistory = state.chatHistory.filter(msg => !msg.isTemporary);
        
        const observeMsg = {
            role: 'assistant',
            speaker: '旁白',
            content: data.description,
            timestamp: Date.now(),
            isDead: false
        };
        state.addChatMessage(observeMsg);
        
        await appendToConversationHistory(
            state.currentSession.characterId,
            '旁白',
            data.description,
            state.currentSession.currentScene,
            false
        );
        
        renderChatHistory();
        scrollChatToBottom();
        
    } catch (err) {
        console.error('观察失败:', err);
        // 移除临时的加载消息
        state.chatHistory = state.chatHistory.filter(msg => !msg.isTemporary);
        
        const errorMsg = {
            role: 'assistant',
            speaker: '旁白',
            content: '你试图观察，但什么也没发现。',
            timestamp: Date.now(),
            isDead: false
        };
        state.addChatMessage(errorMsg);
        renderChatHistory();
        scrollChatToBottom();
        showToast('观察失败，请重试', 2000, 'error');
    }
}

// 调用NPC对话AI
export async function callAIForDialogue(action, speech, isGreeting = false, isContinue = false) {
    state.isWaitingForAI = true;
    renderChatHistory();
    updateInputsDisabled(true);
    
    const loadingIndicator = showLoadingIndicator();
    
    try {
        const historyForAI = state.chatHistory.slice(-15).map(msg => ({
            speaker: msg.speaker,
            content: msg.content,
            role: msg.role
        }));
        
        // 构建用户输入文本（包含动作和语言）
        let userInputText = '';
        if (isGreeting) {
            userInputText = '';
        } else if (isContinue) {
            userInputText = '[玩家没有说话，等待NPC继续]';
        } else {
            if (action && speech) {
                userInputText = `【动作】${action}\n【语言】"${speech}"`;
            } else if (action) {
                userInputText = `【动作】${action}`;
            } else if (speech) {
                userInputText = `【语言】"${speech}"`;
            }
        }
        
        const requestBody = {
            character_id: state.currentSession.characterId,
            chapter_index: window.currentChapterIndex || 1,
            scene: state.currentSession.currentScene,
            player_name: state.currentSession.profile?.name || '玩家',
            npc_id: state.currentDialogueNPC.id,
            npc_name: state.currentDialogueNPC.name,
            user_input: userInputText,
            is_greeting: isGreeting,
            is_continue: isContinue,
            history: historyForAI,
            scene_npcs: state.currentSceneNPCs
        };
        
        //console.log('发送给后端的数据:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch('/api/ghost/npc_dialogue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP 错误:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        removeLoadingIndicator(loadingIndicator);
        
        let npcResponse = '';
        let exitDialogue = false;
        
        if (typeof data === 'object') {
            npcResponse = data.description || data.message || `${state.currentDialogueNPC.name} 没有回应。`;
            exitDialogue = data.exit_dialogue === true;
        } else if (typeof data === 'string') {
            npcResponse = data;
        } else {
            npcResponse = `${state.currentDialogueNPC.name} 没有回应。`;
        }
        
        const assistantMsg = {
            role: 'assistant',
            speaker: state.currentDialogueNPC.name,
            content: npcResponse,
            timestamp: Date.now(),
            isDead: false,
            isDialogue: true
        };
        state.addChatMessage(assistantMsg);
        
        await appendToConversationHistory(
            state.currentSession.characterId,
            state.currentDialogueNPC.name,
            npcResponse,
            state.currentSession.currentScene,
            false
        );
        
        if (exitDialogue) {
            const exitMsg = {
                role: 'system',
                speaker: '系统',
                content: `⚠️ 由于事态升级，你被迫结束了与 ${state.currentDialogueNPC.name} 的对话。`,
                timestamp: Date.now(),
                isDead: false
            };
            state.addChatMessage(exitMsg);
            
            await appendToConversationHistory(
                state.currentSession.characterId,
                '系统',
                `⚠️ 由于事态升级，你被迫结束了与 ${state.currentDialogueNPC.name} 的对话。`,
                state.currentSession.currentScene,
                false
            );
            
            state.currentDialogueNPC = null;
            state.isInDialogue = false;
            
            renderChatHistory();
            scrollChatToBottom();
            await callAIAndRespond({ action: '', speech: '' });
        } else {
            renderChatHistory();
            scrollChatToBottom();
        }
        
        // 刷新任务面板
        const { refreshTasksPanel } = await import('../ui/render.js');
        await refreshTasksPanel();
        
    } catch (err) {
        console.error('NPC对话失败:', err);
        removeLoadingIndicator(loadingIndicator);
        
        const errorMsg = {
            role: 'assistant',
            speaker: '系统',
            content: `对话失败：${err.message}`,
            timestamp: Date.now(),
            isDead: false
        };
        state.addChatMessage(errorMsg);
        renderChatHistory();
        scrollChatToBottom();
        showToast('对话失败，请重试', 3000, 'error');
    } finally {
        state.isWaitingForAI = false;
        updateInputsDisabled(state.currentSession.isDead);
        // 移除加载指示器
        if (loadingIndicator) loadingIndicator.remove();
        
        // 关键：重新渲染聊天区域，更新按钮状态
        renderChatHistory();  // 确保这行存在
        
        // 刷新任务面板
        const { refreshTasksPanel } = await import('../ui/render.js');
        await refreshTasksPanel();

        const { renderPartyList } = await import('../ui/render.js');
        await renderPartyList();
    }
}

function showLoadingIndicator() {
    const container = elements.chatMessages;
    if (!container) return null;
    
    const indicator = document.createElement('div');
    indicator.id = 'aiLoadingIndicator';
    indicator.className = 'chat-message assistant-message';
    indicator.innerHTML = '<div class="chat-speaker">💬 对话中</div><div class="chat-content"><span class="loading-dots">思考中</span></div>';
    container.appendChild(indicator);
    scrollChatToBottom();
    return indicator;
}

function removeLoadingIndicator(indicator) {
    if (indicator) indicator.remove();
}