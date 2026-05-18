// js/ghost/index.js
// 幽灵模式主入口

import { state } from './core/state.js';
import { events, Events } from './core/events.js';
import { showWorldSelection } from './modules/world.js';
import { loadAndEnterGhostMode, exitGhostMode, saveGhostSessionToStorage } from './core/session.js';
import { registerGlobalUIEvents } from './ui/components.js';

// 注册全局UI事件
registerGlobalUIEvents();

// 全局测试AI函数 - 供所有界面的按钮使用
window.testAIConnection = async function() {
    console.log('全局测试AI被调用');
    try {
        const response = await fetch('/api/ghost/test_ai');
        const data = await response.json();
        
        if (data.success) {
            if (window.showTempMessage) {
                window.showTempMessage('✅ AI连接正常！', 2000);
            } else {
                alert('✅ AI连接正常！');
            }
        } else {
            const msg = data.message || 'AI响应异常';
            if (window.showTempMessage) {
                window.showTempMessage('⚠️ ' + msg, 3000);
            } else {
                alert('⚠️ ' + msg);
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
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.showWorldSelection = showWorldSelection;
    window.loadAndEnterGhostMode = loadAndEnterGhostMode;
    window.exitGhostMode = exitGhostMode;
    window.GhostEvents = Events;
    
    // 导出常用函数供调试
    window.GhostState = state;
    window.GhostEventsBus = events;
}

// 导出模块
export { state, events, showWorldSelection, loadAndEnterGhostMode, exitGhostMode, saveGhostSessionToStorage };