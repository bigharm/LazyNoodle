// js/ghost/ui/components.js
import { events, Events } from '../core/events.js';

// 显示加载提示
let loadingElement = null;

export function showLoading(message = '加载中...') {
    if (loadingElement) {
        const msgEl = document.getElementById('ghostLoadingMessage');
        if (msgEl) msgEl.textContent = message;
        loadingElement.style.display = 'flex';
        return;
    }
    
    loadingElement = document.createElement('div');
    loadingElement.id = 'ghostLoading';
    loadingElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        color: white;
        font-size: 1.2rem;
    `;
    loadingElement.innerHTML = `
        <div style="text-align: center;">
            <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
            <div id="ghostLoadingMessage">${message}</div>
        </div>
    `;
    document.body.appendChild(loadingElement);
}

export function hideLoading() {
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// 显示临时消息
let toastElement = null;

export function showToast(message, duration = 3000, type = 'info') {
    if (!toastElement) {
        toastElement = document.createElement('div');
        toastElement.id = 'ghostToast';
        toastElement.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #2a2a44;
            color: white;
            padding: 8px 16px;
            border-radius: 24px;
            font-size: 0.85rem;
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
            white-space: nowrap;
        `;
        document.body.appendChild(toastElement);
    }
    
    let bgColor = '#2a2a44';
    if (type === 'error') bgColor = '#6a4a4a';
    if (type === 'success') bgColor = '#2a6a2a';
    toastElement.style.background = bgColor;
    
    toastElement.textContent = message;
    toastElement.style.opacity = '1';
    
    setTimeout(() => {
        toastElement.style.opacity = '0';
    }, duration);
}

// 世界初始化进度对话框
let initDialog = null;
let initInterval = null;

export function showWorldInitDialog() {
    if (initDialog) initDialog.remove();
    
    initDialog = document.createElement('div');
    initDialog.id = 'worldInitDialog';
    initDialog.className = 'world-init-dialog';
    initDialog.innerHTML = `
        <div class="init-container">
            <div class="loading-spinner"></div>
            <div class="init-title">🌍 正在生成世界</div>
            <div class="init-message" id="initMessage">AI 正在根据世界观创建地点...</div>
            <div class="init-progress" id="initProgress">
                <div class="progress-step" id="step1">📍 生成地点库...</div>
                <div class="progress-step" id="step2">👤 生成 NPC...</div>
                <div class="progress-step" id="step3">⏰ 生成时间线...</div>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" id="progressBar" style="width: 0%"></div>
            </div>
            <div class="init-note">首次启动需要生成世界数据，请稍候...</div>
        </div>
    `;
    document.body.appendChild(initDialog);
    
    let progress = 0;
    let currentStep = 1;
    
    initInterval = setInterval(() => {
        progress += 2;
        
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = Math.min(progress, 98) + '%';
        
        if (progress >= 25 && currentStep === 1) {
            currentStep = 2;
            const step1 = document.getElementById('step1');
            if (step1) step1.classList.add('completed');
            const msg = document.getElementById('initMessage');
            if (msg) msg.textContent = '🤖 AI 正在生成 NPC...';
        }
        
        if (progress >= 60 && currentStep === 2) {
            currentStep = 3;
            const step2 = document.getElementById('step2');
            if (step2) step2.classList.add('completed');
            const msg = document.getElementById('initMessage');
            if (msg) msg.textContent = '⏰ AI 正在生成时间线...';
        }
        
        if (progress >= 95) clearInterval(initInterval);
    }, 800);
}

export function hideWorldInitDialog() {
    if (initDialog) {
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = '100%';
        const step3 = document.getElementById('step3');
        if (step3) step3.classList.add('completed');
        const msg = document.getElementById('initMessage');
        if (msg) msg.textContent = '✅ 世界生成完成！';
        
        setTimeout(() => {
            initDialog?.remove();
            initDialog = null;
        }, 1000);
    }
    if (initInterval) clearInterval(initInterval);
}

// 注册全局事件监听
export function registerGlobalUIEvents() {
    events.on(Events.LOADING_START, showLoading);
    events.on(Events.LOADING_END, hideLoading);
    events.on(Events.TOAST, ({ message, type, duration }) => showToast(message, duration, type));
}