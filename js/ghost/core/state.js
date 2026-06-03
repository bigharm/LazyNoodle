// js/ghost/core/state.js
// 幽灵模式全局状态管理

export const GhostState = {
    // 当前会话
    currentSession: {
        characterId: null,
        profile: null,
        currentScene: null,
        conversationHistory: [],
        isDead: false,
        time: null,
        resources: {},
        reputation: {},
        currentGoals: [],
        activeTasks: [],
        party: []
    },
    
    // 聊天历史
    chatHistory: [],
    
    // UI状态
    isWaitingForAI: false,
    isCreatingCharacter: false,
    isInDialogue: false,
    currentDialogueNPC: null,
    
    // 场景数据
    currentSceneNPCs: [],
    
    // 任务数据
    tasks: {
        active: [],
        completed: []
    },
    
    // 临时数据
    tempCharacterInput: "",
    tempCharacterProfile: null,
    
    // 上下文长度配置
    contextLength: 200,
    contextLengthOptions: [50, 100, 200, 300, 500],
    
    // 方法
    reset() {
        this.currentSession = {
            characterId: null,
            profile: null,
            currentScene: null,
            conversationHistory: [],
            isDead: false,
            time: null,
            resources: {},
            reputation: {},
            currentGoals: [],
            activeTasks: [],
            party: []
        };
        this.chatHistory = [];
        this.isWaitingForAI = false;
        this.isInDialogue = false;
        this.currentDialogueNPC = null;
        this.currentSceneNPCs = [];
        this.tempCharacterInput = "";
        this.tempCharacterProfile = null;
        this.resetTasks();
        // 注意：不要在这里调用 loadContextLength，改为在初始化后手动调用
    },
    
    // 初始化配置（需要在 reset 后单独调用）
    initConfig() {
        this.loadContextLength();
    },
    
    updateSession(data) {
        Object.assign(this.currentSession, data);
    },
    
    addChatMessage(msg) {
        this.chatHistory.push(msg);
    },
    
    clearChatHistory() {
        this.chatHistory = [];
    },
    
    // 任务相关方法
    updateTasks(tasksData) {
        this.tasks = {
            active: tasksData.active_tasks || [],
            completed: tasksData.completed_tasks || []
        };
    },
    
    resetTasks() {
        this.tasks = {
            active: [],
            completed: []
        };
    },
    
    addActiveTask(task) {
        this.tasks.active.push(task);
    },
    
    completeTask(taskId) {
        const index = this.tasks.active.findIndex(t => t.id === taskId);
        if (index !== -1) {
            const completedTask = this.tasks.active[index];
            completedTask.completed_at = new Date().toISOString();
            this.tasks.completed.push(completedTask);
            this.tasks.active.splice(index, 1);
        }
    },
    
    updateTaskDescription(taskId, newDescription) {
        const task = this.tasks.active.find(t => t.id === taskId);
        if (task) {
            task.description = newDescription;
        }
    },
    
    // 上下文长度相关方法
    setContextLength(length) {
        if (this.contextLengthOptions.includes(length)) {
            this.contextLength = length;
            localStorage.setItem('lazynoodle_context_length', length);
            console.log(`📝 上下文长度已设置为: ${length} 条`);
        }
    },
    
    loadContextLength() {
        const saved = localStorage.getItem('lazynoodle_context_length');
        if (saved && this.contextLengthOptions.includes(parseInt(saved))) {
            this.contextLength = parseInt(saved);
        }
        return this.contextLength;
    }
};

// 导出单例，并初始化配置
export const state = GhostState;
state.loadContextLength();  // 在导出后立即初始化