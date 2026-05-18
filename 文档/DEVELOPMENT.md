# 🍜 LazyNoodle · 懒得面 - 项目开发文档

**版本**: v1.0.0 (Beta)  
**最后更新**: 2026-05-18  
**项目状态**: 核心功能已完成，准备进行优化和扩展  
**GitHub**: https://github.com/bigharm/LazyNoodle

---

## 一、项目概述

### 1.1 定位

AI驱动的自由叙事游戏引擎。用户扮演自定义角色，在一个由AI动态生成的世界中进行自由探索、对话和执行任务。

### 1.2 核心特点

| 特点 | 说明 |
|------|------|
| **完全AI驱动** | 世界观、NPC、任务、剧情走向均由AI动态生成 |
| **自由角色扮演** | 用户可自由创建角色，AI围绕其背景展开叙事 |
| **动态任务系统** | 任务由AI生成，并可随玩家行为自动更新进度 |
| **沉浸式交互** | 通过"动作+语言"的自然语言方式与游戏世界互动 |
| **模块化设计** | 前后端分离，易于二次开发 |

### 1.3 名称寓意

"懒得面" (LazyNoodle) —— 用户可以慵懒、随性地沉浸在故事中，像一碗面一样简单又温暖。

---

## 二、已完成功能

### 2.1 核心系统

- ✅ **多世界支持**：创建、选择、切换、删除世界
- ✅ **角色系统**：创建（AI辅助/手动）、选择、删除、导出为PNG、从PNG/JSON导入
- ✅ **AI驱动环境交互**：用户输入"动作+语言"，AI生成世界反馈
- ✅ **NPC系统**：智能对话、态度变化、静默观察
- ✅ **系统助手**：查看状态、获取提示、生成任务
- ✅ **时间系统**：AI驱动时间流逝、精力状态变化
- ✅ **地点系统**：动态解锁、树形展示、场景切换
- ✅ **关系系统**：AI返回态度更新，按时间戳存储历史（20条），支持删除回滚

### 2.2 任务系统 (T3)

| 功能 | 状态 | 说明 |
|------|------|------|
| 任务数据结构 | ✅ | active_tasks, completed_tasks, removed_tasks |
| AI任务生成 | ✅ | 系统助手请求 → AI生成 → 用户确认 → 添加 |
| 任务进度追踪 | ✅ | 环境交互时AI自动检测进度并更新描述 |
| 任务UI面板 | ✅ | 侧边栏显示，按优先级排序，支持折叠 |
| 任务优先级 | ✅ | 1-1000数值，越小越优先 |
| 任务删除 | ✅ | 移动到 removed_tasks |
| NPC对话任务更新 | ✅ | 与NPC对话也可推进任务 |

### 2.3 前端/用户体验

- ✅ 全局名称统一为 "LazyNoodle / 懒得面"
- ✅ 项目形象图片 (`lazynoodle.png`) 集成
- ✅ API Key设置面板（LocalStorage存储）
- ✅ 对话模式优化：固定底部"结束对话"按钮
- ✅ 静默观察NPC功能
- ✅ 侧边栏添加NPC功能（AI生成 + 文件导入）
- ✅ 任务卡片删除按钮

### 2.4 打包与分发

- ✅ PyInstaller打包为独立exe（解压即玩）
- ✅ 启动/停止脚本
- ✅ 环境配置说明

---

## 三、技术架构

### 3.1 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | HTML5/CSS3/JavaScript (原生ES6+ 模块化) |
| **后端** | FastAPI (Python 3.10+) |
| **AI集成** | DeepSeek API |
| **数据存储** | JSON文件系统 (世界目录结构) |
| **打包** | PyInstaller |

### 3.2 目录结构
LazyNoodle/
├── backend/ # 后端代码
│ ├── api.py # 主入口
│ ├── config.py # 配置管理
│ ├── world_manager.py # 世界/角色/任务数据管理
│ ├── world_generator.py # AI生成世界数据
│ ├── location_manager.py # 地点管理
│ ├── routes/ # API路由
│ ├── services/ # 业务服务
│ └── utils/ # 工具函数
├── js/ # 前端代码 (ES6 模块)
│ ├── api.js
│ ├── main.js
│ └── ghost/ # 幽灵模式模块
│ ├── core/ # 核心状态
│ ├── modules/ # 功能模块
│ └── ui/ # UI渲染
├── css/ # 样式文件
├── prompts/ # AI Prompt模板
├── worlds/ # 世界数据目录
├── index.html # 入口页面
├── lazynoodle.png # 项目图标
├── .env.example # 环境变量模板
├── requirements.txt # Python依赖
├── LazyNoodle.spec # PyInstaller配置
└── 启动LazyNoodle.bat # 启动脚本

text

---

## 四、数据结构

### 4.1 角色 JSON (`{uuid}.json`)

```json
{
  "character_id": "uuid",
  "world_id": "world_id",
  "profile": {
    "name": "角色名",
    "identity": "身份",
    "appearance": "外貌描述",
    "personality": "性格",
    "background": "背景故事"
  },
  "status": {
    "is_dead": false,
    "current_scene": "场景名",
    "health": 100
  },
  "time": {
    "current_day": 1,
    "current_hour": 8,
    "energy_state": "精力充沛",
    "chapter_time_remaining": 72
  },
  "conversation_history": [
    {"speaker": "玩家/NPC/旁白", "content": "内容", "game_hour": 8.5, "timestamp": "ISO时间"}
  ],
  "relationships_history": [
    {"hour": 8.5, "content": "NPC1:态度,NPC2:态度..."}
  ],
  "unlocked_locations": {},
  "system_helper_history": [],
  "resources": {"灵石": 0, "药材": [], "道具": []},
  "active_tasks": [],
  "completed_tasks": [],
  "removed_tasks": []
}
4.2 任务数据 ({uuid}_tasks.json)
json
{
  "active_tasks": [
    {
      "id": "task_xxx",
      "name": "任务名称",
      "description": "任务描述（自然语言，包含进度）",
      "priority": 100,
      "created_at": "ISO时间",
      "source": "system_helper"
    }
  ],
  "completed_tasks": [],
  "removed_tasks": [],
  "version": "1.1",
  "last_updated": "ISO时间"
}
4.3 NPC索引 (npcs/npc_index.json)
json
{
  "npcs": [
    {
      "id": "npc_xxx",
      "name": "名称",
      "profile": {
        "identity": "身份",
        "description": "描述"
      },
      "location_id": "地点ID",
      "active": true
    }
  ],
  "generated_chapters": []
}
五、API 端点
端点	方法	说明
/api/worlds/list	GET	获取世界列表
/api/world/select	POST	选择世界
/api/world/init	POST	初始化世界（AI生成地点/NPC/时间线）
/api/world/create	POST	创建新世界
/api/world/delete	POST	删除世界
/api/ghost/list_characters	GET	获取角色列表
/api/ghost/create_character	POST	创建角色
/api/ghost/load_character	POST	加载角色
/api/ghost/environment_interact	POST	环境交互（核心）
/api/ghost/npc_dialogue	POST	NPC对话
/api/ghost/system_helper	POST	系统助手
/api/ghost/observe_npc	POST	静默观察NPC
/api/ghost/add_npc	POST	添加NPC
/api/ghost/delete_task	POST	删除任务
/api/ghost/tasks	GET	获取任务数据
/api/ghost/test_ai_with_key	POST	测试API Key
六、待开发功能
优先级	功能	说明
高	任务系统深化	支持任务链、分支任务、奖励发放
高	多周目继承	通关后继承部分数据重开
中	设置界面优化	支持更多AI参数调节
中	战斗系统	简单的战斗判定与AI描述
低	模组/Mod支持	用户自定义世界、NPC、任务模板
低	云端存档	多设备同步
七、AI Prompt 模板清单
文件名	用途
validate_character.txt	验证/生成角色设定
environment_interact.txt	环境交互（核心）
npc_dialogue.txt	NPC对话
system_helper.txt	系统助手
observe_npc.txt	静默观察NPC
generate_locations.txt	生成地点库（世界初始化）
generate_npcs.txt	生成NPC（世界初始化）
generate_timeline.txt	生成时间线（世界初始化）
八、开发日志
日期	内容
2026-05-16	项目拆分重构（前后端模块化）
2026-05-17	幽灵模式独立、命名统一为 LazyNoodle
2026-05-18	任务系统完整实现、UI优化、打包分发
九、快速启动
源码运行
bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 启动
uvicorn backend.api:app --reload
打包版本
下载 LazyNoodle_v1.0.zip

解压到任意文件夹

复制 .env.example 为 .env，填入 API Key

双击 启动LazyNoodle.bat