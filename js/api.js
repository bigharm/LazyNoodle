// ========================= API 调用模块 =========================
// 文件: js/api.js
// 版本: v4.0 - 完整 ES6 模块导出

// ========== 基础 API 调用函数 ==========
async function apiCall(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    };
    
    if (mergedOptions.body && typeof mergedOptions.body !== 'string') {
        mergedOptions.body = JSON.stringify(mergedOptions.body);
    }
    
    try {
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                // 忽略 JSON 解析错误
            }
            throw new Error(errorMessage);
        }
        
        if (response.status === 204) {
            return null;
        }
        
        return await response.json();
    } catch (err) {
        console.error(`API 调用失败 [${endpoint}]:`, err);
        throw err;
    }
}

// ========== 主线相关 API ==========
async function fetchChapters() {
    return await apiCall('/chapters');
}

async function fetchChapter(index) {
    return await apiCall(`/chapter/${index}`);
}

async function fetchChapterBridge(chapterIndex) {
    return await apiCall(`/chapter/${chapterIndex}/bridge`);
}

async function saveProgress(progressData) {
    return await apiCall('/save', {
        method: 'POST',
        body: progressData
    });
}

async function loadProgress(sessionId) {
    return await apiCall(`/load/${sessionId}`);
}

// ========== 幽灵模式相关 API ==========

// 初始化 NPC 池（基于章节内容）
async function initNPCPool(chapterIndex, locations) {
    return await apiCall('/ghost/init_npc_pool', {
        method: 'POST',
        body: {
            chapter_index: chapterIndex,
            locations: locations
        }
    });
}

// 验证角色设定是否符合世界观
async function validateCharacter(userInput, chapterIndex) {
    return await apiCall('/ghost/validate_character', {
        method: 'POST',
        body: {
            user_input: userInput,
            chapter_index: chapterIndex
        }
    });
}

// 创建自定义角色
async function createCharacter(profile, chapterIndex) {
    return await apiCall('/ghost/create_character', {
        method: 'POST',
        body: {
            profile: profile,
            chapter_index: chapterIndex
        }
    });
}

// 加载角色进入幽灵模式
async function loadCharacter(characterId, chapterIndex, scene = null) {
    //console.log('loadCharacter API call:', { characterId, chapterIndex, scene });
    const result = await apiCall('/ghost/load_character', {
        method: 'POST',
        body: {
            character_id: characterId,
            chapter_index: chapterIndex,
            scene: scene
        }
    });
    //console.log('loadCharacter API response:', result);
    return result;
}

// 获取所有角色列表
async function listCharacters() {
    return await apiCall('/ghost/list_characters');
}

// 环境交互
async function environmentInteract(characterId, chapterIndex, scene, playerName, userInput, history, sceneNPCs) {
    return await apiCall('/ghost/environment_interact', {
        method: 'POST',
        body: {
            character_id: characterId,
            chapter_index: chapterIndex,
            scene: scene,
            player_name: playerName,
            user_input: userInput,
            history: history || [],
            scene_npcs: sceneNPCs || []
        }
    });
}

// 获取指定场景的 NPC 列表
async function getNPCsByScene(sceneName) {
    return await apiCall(`/ghost/npcs/by_scene/${encodeURIComponent(sceneName)}`);
}

// 兼容旧名称
async function getNPCsByLocation(locationName) {
    return getNPCsByScene(locationName);
}

// 更新角色当前场景
async function updateCharacterScene(characterId, scene, chapterIndex) {
    return await apiCall('/ghost/update_scene', {
        method: 'POST',
        body: {
            character_id: characterId,
            scene: scene,
            chapter_index: chapterIndex
        }
    });
}

// 添加对话记录到历史
async function appendToConversationHistory(characterId, speaker, content, scene, isDead = false) {
    return await apiCall('/ghost/append_conversation', {
        method: 'POST',
        body: {
            character_id: characterId,
            speaker: speaker,
            content: content,
            scene: scene,
            is_dead: isDead
        }
    });
}

// 删除历史记录
async function deleteHistory(characterId, fromIndex) {
    return await apiCall('/ghost/delete_history', {
        method: 'POST',
        body: {
            character_id: characterId,
            from_index: fromIndex
        }
    });
}

// 获取地点树（已解锁地点）
async function getLocationsTree(characterId) {
    if (!characterId || characterId === 'null' || characterId === 'undefined') {
        return { tree: [] };
    }
    return await apiCall(`/ghost/locations/tree?character_id=${encodeURIComponent(characterId)}`);
}

// 解锁新地点
async function unlockLocation(locationName, status = 'entered') {
    return await apiCall('/locations/discover', {
        method: 'POST',
        body: {
            location_name: locationName,
            status: status
        }
    });
}

// 根据名称获取地点信息
async function getLocationByName(locationName) {
    return await apiCall(`/ghost/locations/by_name/${encodeURIComponent(locationName)}`);
}

// 更新地点状态
async function updateLocationStatus(locationId, status) {
    return await apiCall('/ghost/locations/update', {
        method: 'POST',
        body: {
            location_id: locationId,
            status: status
        }
    });
}

// 结束幽灵会话
async function endGhostSession(characterId = null) {
    const id = characterId || (window.currentGhostSession ? window.currentGhostSession.characterId : null);
    if (!id) {
        return { status: 'ok', message: '无活跃会话' };
    }
    return await apiCall('/ghost/end_session', {
        method: 'POST',
        body: {
            character_id: id
        }
    });
}

// 删除角色
async function deleteCharacter(characterId) {
    return await apiCall('/ghost/delete_character', {
        method: 'POST',
        body: {
            character_id: characterId
        }
    });
}

// 复活角色
async function resurrectCharacter(characterId, newScene = null) {
    return await apiCall('/ghost/resurrect_character', {
        method: 'POST',
        body: {
            character_id: characterId,
            new_scene: newScene
        }
    });
}

// 获取角色存档大小
async function getCharacterStorageInfo() {
    return await apiCall('/ghost/storage_info');
}

// 归档旧角色
async function archiveCharacter(characterId) {
    return await apiCall('/ghost/archive_character', {
        method: 'POST',
        body: {
            character_id: characterId
        }
    });
}

// 导出角色数据
async function exportCharacter(characterId) {
    return await apiCall(`/ghost/export_character/${encodeURIComponent(characterId)}`);
}

// 导入角色数据
async function importCharacter(characterData) {
    return await apiCall('/ghost/import_character', {
        method: 'POST',
        body: characterData
    });
}

// ========== 新增缺失的 API 函数 ==========

// NPC 对话
async function npcDialogue(characterId, chapterIndex, scene, playerName, npcId, npcName, userInput, isGreeting, isContinue, history, sceneNPCs) {
    return await apiCall('/ghost/npc_dialogue', {
        method: 'POST',
        body: {
            character_id: characterId,
            chapter_index: chapterIndex || 1,
            scene: scene,
            player_name: playerName,
            npc_id: npcId,
            npc_name: npcName,
            user_input: userInput,
            is_greeting: isGreeting || false,
            is_continue: isContinue || false,
            history: history || [],
            scene_npcs: sceneNPCs || []
        }
    });
}

// 系统助手
async function systemHelper(characterId, query, playerName, playerIdentity, currentScene, resources, reputation, unlockedLocations, currentGoals, activeTasks, history, extraContext) {
    return await apiCall('/ghost/system_helper', {
        method: 'POST',
        body: {
            character_id: characterId,
            query: query,
            player_name: playerName,
            player_identity: playerIdentity,
            current_scene: currentScene,
            resources: resources || {},
            reputation: reputation || {},
            unlocked_locations: unlockedLocations || [],
            current_goals: currentGoals || [],
            active_tasks: activeTasks || [],
            history: history || [],
            extra_context: extraContext || {}
        }
    });
}

// 角色转NPC
async function convertToNPC(characterId) {
    return await apiCall('/ghost/convert_to_npc', {
        method: 'POST',
        body: {
            character_id: characterId
        }
    });
}

// 获取所有地点
async function getAllLocations() {
    return await apiCall('/ghost/locations/all');
}

// 获取所有NPC
async function getAllNPCs() {
    return await apiCall('/ghost/npcs/all');
}

// 添加NPC
async function addNPC(npcData) {
    return await apiCall('/ghost/add_npc', {
        method: 'POST',
        body: { npc: npcData }
    });
}

// 测试AI连接
async function testAI() {
    return await apiCall('/ghost/test_ai');
}

// ========== 辅助函数 ==========
function showLoading(message = '加载中...') {
    let loadingEl = document.getElementById('globalLoading');
    if (!loadingEl) {
        loadingEl = document.createElement('div');
        loadingEl.id = 'globalLoading';
        loadingEl.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            color: white;
            font-size: 1.2rem;
        `;
        loadingEl.innerHTML = `
            <div style="text-align: center;">
                <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
                <div id="loadingMessage">${message}</div>
            </div>
        `;
        document.body.appendChild(loadingEl);
    } else {
        const msgEl = document.getElementById('loadingMessage');
        if (msgEl) msgEl.textContent = message;
        loadingEl.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingEl = document.getElementById('globalLoading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

function showTempMessage(message, duration = 3000) {
    let toastEl = document.getElementById('tempToast');
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.id = 'tempToast';
        toastEl.style.cssText = `
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
        document.body.appendChild(toastEl);
    }
    
    toastEl.textContent = message;
    toastEl.style.opacity = '1';
    
    setTimeout(() => {
        toastEl.style.opacity = '0';
    }, duration);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== 任务相关 API ==========

async function loadTasks(characterId) {
    if (!characterId) {
        return { active_tasks: [], completed_tasks: [] };
    }
    return await apiCall(`/ghost/tasks?character_id=${encodeURIComponent(characterId)}`);
}

async function refreshTasks(characterId) {
    // 刷新任务面板的便捷函数
    return await loadTasks(characterId);
}

// ========== 导出到全局（兼容旧代码）==========
window.apiCall = apiCall;
window.fetchChapters = fetchChapters;
window.fetchChapter = fetchChapter;
window.fetchChapterBridge = fetchChapterBridge;
window.saveProgress = saveProgress;
window.loadProgress = loadProgress;
window.initNPCPool = initNPCPool;
window.validateCharacter = validateCharacter;
window.createCharacter = createCharacter;
window.loadCharacter = loadCharacter;
window.listCharacters = listCharacters;
window.environmentInteract = environmentInteract;
window.getNPCsByScene = getNPCsByScene;
window.getNPCsByLocation = getNPCsByLocation;
window.updateCharacterScene = updateCharacterScene;
window.appendToConversationHistory = appendToConversationHistory;
window.getLocationsTree = getLocationsTree;
window.unlockLocation = unlockLocation;
window.getLocationByName = getLocationByName;
window.updateLocationStatus = updateLocationStatus;
window.endGhostSession = endGhostSession;
window.deleteCharacter = deleteCharacter;
window.resurrectCharacter = resurrectCharacter;
window.deleteHistory = deleteHistory;
window.getCharacterStorageInfo = getCharacterStorageInfo;
window.archiveCharacter = archiveCharacter;
window.exportCharacter = exportCharacter;
window.importCharacter = importCharacter;
window.npcDialogue = npcDialogue;
window.systemHelper = systemHelper;
window.convertToNPC = convertToNPC;
window.getAllLocations = getAllLocations;
window.getAllNPCs = getAllNPCs;
window.addNPC = addNPC;
window.testAI = testAI;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showTempMessage = showTempMessage;
window.escapeHtml = escapeHtml;
window.loadTasks = loadTasks;
window.refreshTasks = refreshTasks;

// ========== ES6 模块导出（兼容模块化导入）==========
export {
    apiCall,
    fetchChapters,
    fetchChapter,
    fetchChapterBridge,
    saveProgress,
    loadProgress,
    initNPCPool,
    validateCharacter,
    createCharacter,
    loadCharacter,
    listCharacters,
    environmentInteract,
    getNPCsByScene,
    getNPCsByLocation,
    updateCharacterScene,
    appendToConversationHistory,
    getLocationsTree,
    unlockLocation,
    getLocationByName,
    updateLocationStatus,
    endGhostSession,
    deleteCharacter,
    resurrectCharacter,
    deleteHistory,
    getCharacterStorageInfo,
    archiveCharacter,
    exportCharacter,
    importCharacter,
    npcDialogue,
    systemHelper,
    convertToNPC,
    getAllLocations,
    getAllNPCs,
    addNPC,
    testAI,
    showLoading,
    hideLoading,
    showTempMessage,
    escapeHtml,
    loadTasks,
    refreshTasks
};