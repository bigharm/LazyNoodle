// js/ghost/ui/dom.js
import { state } from '../core/state.js';
import { events, Events } from '../core/events.js';
import { handleSendMessage } from '../modules/chat.js';
import { openNPCCreationDialog } from '../modules/npc.js';
import { showToast } from './components.js';

// DOM元素引用
export const elements = {
    panel: null,
    chatMessages: null,
    actionInput: null,
    speechInput: null,
    sendBtn: null,
    locationsList: null,
    npcList: null,
    tasksList: null,
    charName: null,
    charIdentity: null,
    charScene: null,
    charStatus: null,
    timeDisplay: null,
    partyInfo: null,
    addNPCBtn: null,
    contextLengthSelect: null
};

// 创建幽灵模式面板
export function createGhostPanel() {
    const existingPanel = document.getElementById('ghostPanel');
    if (existingPanel) existingPanel.remove();
    
    const panel = document.createElement('div');
    panel.id = 'ghostPanel';
    panel.className = 'ghost-panel';
    panel.innerHTML = `
        <div class="ghost-header">
            <div class="char-info">
                <span class="char-name" id="charName"></span>
                <span class="char-identity" id="charIdentity"></span>
                <span class="char-scene" id="charScene"></span>
                <span class="char-status" id="charStatus"></span>
            </div>
            <div class="time-info" id="timeDisplay"></div>
            <div class="header-buttons">
                <button id="testAIBtn" class="ghost-btn test-ai-btn">🔧 测试AI</button>
                <button id="exitGhostChatBtn" class="ghost-btn">👋 退出</button>
            </div>
        </div>
        
        <div class="ghost-main">
            <div class="chat-area">
                <div class="chat-messages" id="ghostChatMessages"></div>
                <div class="input-area">
                    <textarea id="ghostActionInput" rows="2" placeholder="动作（如：走到柜台前、四处张望）..."></textarea>
                    <textarea id="ghostSpeechInput" rows="2" placeholder="语言（如：您好，请问...）..."></textarea>
                    <button class="send-btn" id="sendGhostBtn">执行</button>
                </div>
            </div>
            
            <div class="sidebar">
                <div class="sidebar-section">
                    <div class="section-title">📍 已解锁地点</div>
                    <div class="locations-list" id="locationsList"></div>
                </div>
                <div class="sidebar-section">
                    <div class="section-title">👥 周围的人</div>
                    <div class="npc-list" id="npcList"></div>
                </div>
                <div class="sidebar-section">
                    <div class="section-title">👥 我的队伍</div>
                    <div class="party-info" id="partyInfo">暂无队友</div>
                </div>
                <div class="sidebar-section">
                    <div class="section-title">🤖 系统助手</div>
                    <div class="npc-list" style="margin-bottom: 8px;">
                        <div class="npc-item system-helper-item" data-npc-id="system_helper" data-npc-name="系统助手">
                            <div class="npc-icon">🤖</div>
                            <div class="npc-info">
                                <div class="npc-name">系统助手</div>
                                <div class="npc-identity">游戏助手 / 帮助菜单</div>
                            </div>
                            <div class="npc-actions">
                                <button class="system-helper-btn">💬 对话</button>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right; margin-top: 4px;">
                        <button id="addNPCBtn" class="sidebar-action-btn" title="创建新NPC">➕</button>
                    </div>
                </div>
                <div class="sidebar-section">
                    <div class="section-title">📋 当前任务</div>
                    <div class="tasks-list" id="tasksList"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // 更新元素引用
    elements.panel = panel;
    elements.chatMessages = document.getElementById('ghostChatMessages');
    elements.actionInput = document.getElementById('ghostActionInput');
    elements.speechInput = document.getElementById('ghostSpeechInput');
    elements.sendBtn = document.getElementById('sendGhostBtn');
    elements.locationsList = document.getElementById('locationsList');
    elements.npcList = document.getElementById('npcList');
    elements.tasksList = document.getElementById('tasksList');
    elements.charName = document.getElementById('charName');
    elements.charIdentity = document.getElementById('charIdentity');
    elements.charScene = document.getElementById('charScene');
    elements.charStatus = document.getElementById('charStatus');
    elements.timeDisplay = document.getElementById('timeDisplay');
    elements.partyInfo = document.getElementById('partyInfo');
    elements.addNPCBtn = document.getElementById('addNPCBtn');
    elements.contextLengthSelect = document.getElementById('contextLengthSelect');
    
    return panel;
}

// 绑定面板事件
export async function bindPanelEvents() {
    if (elements.sendBtn) {
        elements.sendBtn.addEventListener('click', handleSendMessage);
    }
    
    // 上下文长度选择器
    if (elements.contextLengthSelect) {
        elements.contextLengthSelect.value = state.contextLength;
        elements.contextLengthSelect.addEventListener('change', (e) => {
            const newLength = parseInt(e.target.value);
            state.setContextLength(newLength);
            showToast(`AI记忆已调整为 ${newLength} 条`, 1500);
        });
    }
    
    // 测试AI按钮
    const testBtn = document.getElementById('testAIBtn');
    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            console.log('聊天界面测试AI按钮被点击');
            if (window.testAIConnection) {
                await window.testAIConnection();
            }
        });
    }
    
    // 退出按钮
    const exitBtn = document.getElementById('exitGhostChatBtn');
    if (exitBtn) {
        exitBtn.addEventListener('click', async () => {
            const { exitGhostMode } = await import('../core/session.js');
            await exitGhostMode();
        });
    }
    
    // 添加NPC按钮
    if (elements.addNPCBtn) {
        elements.addNPCBtn.addEventListener('click', () => {
            openNPCCreationDialog();
        });
    }
    
    // 系统助手按钮
    const systemHelperBtn = document.querySelector('.system-helper-btn');
    if (systemHelperBtn) {
        systemHelperBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const { openSystemHelperDialog } = await import('../modules/helper.js');
            openSystemHelperDialog();
        });
    }
    
    // 快捷键
    if (elements.actionInput) {
        elements.actionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                elements.sendBtn?.click();
            }
        });
    }
    
    if (elements.speechInput) {
        elements.speechInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                elements.sendBtn?.click();
            }
        });
    }
}

// 滚动聊天到底部
export function scrollChatToBottom() {
    if (elements.chatMessages) {
        setTimeout(() => {
            elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        }, 50);
    }
}

// 更新输入框禁用状态
export function updateInputsDisabled(disabled) {
    if (elements.actionInput) elements.actionInput.disabled = disabled;
    if (elements.speechInput) elements.speechInput.disabled = disabled;
    if (elements.sendBtn) elements.sendBtn.disabled = disabled;
}