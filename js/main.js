// js/main.js
// 简化的入口文件 - 启动幽灵模式并支持会话恢复

import('./ghost/index.js').then(module => {
    console.log('幽灵模式模块加载完成');
    
    const start = async () => {
        // 检查是否有保存的幽灵模式会话
        const ghostModeActive = sessionStorage.getItem('ghost_mode_active');
        const characterId = sessionStorage.getItem('ghost_character_id');
        const currentScene = sessionStorage.getItem('ghost_current_scene');
        
        if (ghostModeActive === 'true' && characterId) {
            console.log('检测到未完成的幽灵模式会话，正在恢复...', characterId);
            if (module.loadAndEnterGhostMode) {
                await module.loadAndEnterGhostMode(characterId, currentScene);
                return;
            }
        }
        
        // 没有会话或恢复失败，显示世界选择
        if (typeof module.showWorldSelection === 'function') {
            module.showWorldSelection();
        } else {
            console.error('showWorldSelection 未定义');
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
}).catch(err => {
    console.error('加载幽灵模式模块失败:', err);
});