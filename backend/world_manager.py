# backend/world_manager.py

import os
import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Any

# ========== 配置 ==========
BASE_DIR = Path(__file__).parent.parent
WORLDS_DIR = BASE_DIR / "worlds"
WORLDS_INDEX_FILE = WORLDS_DIR / "worlds_index.json"

# 默认世界 ID
DEFAULT_WORLD_ID = "default"


# ========== 世界数据结构 ==========

def get_worlds_dir() -> Path:
    """获取世界根目录"""
    WORLDS_DIR.mkdir(parents=True, exist_ok=True)
    return WORLDS_DIR


def get_world_path(world_id: str = DEFAULT_WORLD_ID) -> Path:
    """获取指定世界的目录路径"""
    world_path = WORLDS_DIR / world_id
    world_path.mkdir(parents=True, exist_ok=True)
    return world_path


def get_world_index() -> Dict:
    """获取世界索引"""
    if WORLDS_INDEX_FILE.exists():
        with open(WORLDS_INDEX_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    return {
        "worlds": [],
        "current_world": DEFAULT_WORLD_ID,
        "version": "1.0"
    }


def save_world_index(index: Dict):
    """保存世界索引"""
    with open(WORLDS_INDEX_FILE, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


def register_world(world_id: str, world_name: str, description: str = ""):
    """注册新世界"""
    index = get_world_index()
    
    for w in index["worlds"]:
        if w["id"] == world_id:
            return False
    
    index["worlds"].append({
        "id": world_id,
        "name": world_name,
        "description": description,
        "created_at": datetime.now().isoformat(),
        "last_played": None
    })
    save_world_index(index)
    return True


def set_current_world(world_id: str) -> bool:
    """切换当前世界"""
    index = get_world_index()
    
    world_exists = False
    for w in index["worlds"]:
        if w["id"] == world_id:
            world_exists = True
            break
    
    if not world_exists:
        register_world(world_id, world_id)
    
    index["current_world"] = world_id
    save_world_index(index)
    return True


def get_current_world() -> str:
    """获取当前世界 ID"""
    index = get_world_index()
    return index.get("current_world", DEFAULT_WORLD_ID)


def get_current_world_path() -> Path:
    """获取当前世界的目录路径"""
    return get_world_path(get_current_world())


# ========== 世界初始化检测 ==========

def is_world_initialized(world_id: str = None) -> bool:
    """检查世界是否已初始化（有地点库、NPC、时间线）"""
    world_path = get_world_path(world_id) if world_id else get_current_world_path()
    
    locations_base = world_path / "locations" / "location_base.json"
    npc_index = world_path / "npcs" / "npc_index.json"
    timeline = world_path / "timeline.json"
    
    # 三个文件都必须存在才算初始化
    print(f"🔍 检查世界初始化: {world_path}")
    return locations_base.exists() and npc_index.exists() and timeline.exists()


def get_world_worldview(world_id: str = None) -> str:
    """获取世界观设定"""
    world_path = get_world_path(world_id) if world_id else get_current_world_path()
    worldview_path = world_path / "worldview.txt"
    
    if worldview_path.exists():
        with open(worldview_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    return """一个修仙世界，修士可以修炼法术、炼制丹药、驯养灵兽。世界中有多个势力：药王谷（炼丹）、御剑门（剑修）、散修联盟（自由修士）。"""


def save_world_worldview(content: str, world_id: str = None):
    """保存世界观设定"""
    world_path = get_world_path(world_id) if world_id else get_current_world_path()
    worldview_path = world_path / "worldview.txt"
    
    with open(worldview_path, 'w', encoding='utf-8') as f:
        f.write(content)


# ========== 世界数据访问 ==========

def get_locations_dir(world_id: str = None) -> Path:
    """获取地点目录"""
    world_path = get_world_path(world_id) if world_id else get_current_world_path()
    locations_dir = world_path / "locations"
    locations_dir.mkdir(parents=True, exist_ok=True)
    return locations_dir


def get_npcs_dir(world_id: str = None) -> Path:
    """获取 NPC 目录"""
    world_path = get_world_path(world_id) if world_id else get_current_world_path()
    npcs_dir = world_path / "npcs"
    npcs_dir.mkdir(parents=True, exist_ok=True)
    return npcs_dir


def get_sessions_dir(world_id: str = None) -> Path:
    """获取会话目录"""
    world_path = get_world_path(world_id) if world_id else get_current_world_path()
    sessions_dir = world_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    return sessions_dir


def get_characters_dir(world_id: str = None) -> Path:
    """获取角色目录"""
    sessions_dir = get_sessions_dir(world_id)
    characters_dir = sessions_dir / "characters"
    characters_dir.mkdir(parents=True, exist_ok=True)
    return characters_dir


def get_timeline_path(world_id: str = None) -> Path:
    """获取时间线文件路径"""
    world_path = get_world_path(world_id) if world_id else get_current_world_path()
    return world_path / "timeline.json"


def load_timeline(world_id: str = None) -> Dict:
    """加载时间线"""
    timeline_path = get_timeline_path(world_id)
    if timeline_path.exists():
        with open(timeline_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    return {
        "version": "1.0",
        "milestones": [
            {
                "id": "milestone_1",
                "name": "初入江湖",
                "order": 1,
                "description": "玩家初入世界的阶段",
                "default_time_remaining": 72
            }
        ],
        "current_milestone": "milestone_1"
    }


def save_timeline(timeline: Dict, world_id: str = None):
    """保存时间线"""
    timeline_path = get_timeline_path(world_id)
    with open(timeline_path, 'w', encoding='utf-8') as f:
        json.dump(timeline, f, ensure_ascii=False, indent=2)


# ========== 默认数据（fallback） ==========

def get_default_locations() -> Dict:
    """获取默认地点数据（AI 生成失败时的 fallback）"""
    return {
        "regions": [
            {
                "id": "bai_cao_gu",
                "name": "百草谷",
                "description": "药草繁茂的山谷",
                "icon": "🌿"
            },
            {
                "id": "yun_xiao_cheng",
                "name": "云霄城",
                "description": "修士聚集的城市",
                "icon": "🏛️"
            }
        ],
        "locations": [
            {
                "id": "bai_cao_ge",
                "name": "百草阁",
                "parent": "bai_cao_gu",
                "description": "药材交易中心",
                "icon": "🏥"
            },
            {
                "id": "lian_qi_fang",
                "name": "炼器坊",
                "parent": "yun_xiao_cheng",
                "description": "法宝锻造工坊",
                "icon": "🔧"
            },
            {
                "id": "zui_xian_ju",
                "name": "醉仙居",
                "parent": "yun_xiao_cheng",
                "description": "修士酒楼",
                "icon": "🍶"
            }
        ]
    }


def get_default_npcs() -> Dict:
    """获取默认 NPC 数据（AI 生成失败时的 fallback）"""
    return {
        "npcs": [
            {
                "id": "npc_bai_cao_ge_1",
                "name": "赵铁秤",
                "gender": "男",
                "profile": {
                    "identity": "百草阁执事",
                    "description": "五十多岁，面容清癯，不苟言笑",
                    "personality_traits": ["严苛", "务实"],
                    "background": "在百草阁工作三十年"
                },
                "location_id": "bai_cao_ge",
                "active": True,
                "dead": False
            },
            {
                "id": "npc_zui_xian_ju_1",
                "name": "柳青鸾",
                "gender": "女",
                "profile": {
                    "identity": "醉仙居老板娘",
                    "description": "三十来岁，风韵犹存，八面玲珑",
                    "personality_traits": ["精明", "热心"],
                    "background": "修仙界散修，经营酒楼多年"
                },
                "location_id": "zui_xian_ju",
                "active": True,
                "dead": False
            }
        ]
    }


def get_default_timeline() -> Dict:
    """获取默认时间线（AI 生成失败时的 fallback）"""
    return {
        "version": "1.0",
        "milestones": [
            {
                "id": "milestone_1",
                "name": "初入江湖",
                "order": 1,
                "description": "刚刚踏入修仙世界",
                "default_time_remaining": 72
            },
            {
                "id": "milestone_2",
                "name": "崭露头角",
                "order": 2,
                "description": "小有名气，结识各方势力",
                "default_time_remaining": 120
            },
            {
                "id": "milestone_3",
                "name": "名动一方",
                "order": 3,
                "description": "成为修仙界知名人物",
                "default_time_remaining": 168
            }
        ],
        "current_milestone": "milestone_1"
    }


# ========== 迁移 V3 数据 ==========

def migrate_v3_data():
    """将 V3 数据迁移到 default 世界"""
    print("📦 开始迁移 V3 数据...")
    
    default_path = get_world_path(DEFAULT_WORLD_ID)
    
    # 迁移 worldview
    old_worldview = BASE_DIR / "worldview_setting.txt"
    if old_worldview.exists():
        new_worldview = default_path / "worldview.txt"
        shutil.copy(old_worldview, new_worldview)
        print(f"  ✅ 迁移 worldview.txt")
    
    # 迁移 chapters
    old_chapters = BASE_DIR / "chapters"
    if old_chapters.exists():
        new_chapters = default_path / "chapters"
        if new_chapters.exists():
            shutil.rmtree(new_chapters)
        shutil.copytree(old_chapters, new_chapters)
        print(f"  ✅ 迁移 chapters/")
    
    # 迁移 locations
    old_locations = BASE_DIR / "locations"
    if old_locations.exists():
        new_locations = default_path / "locations"
        new_locations.mkdir(parents=True, exist_ok=True)
        
        for file in ["location_base.json", "location_dynamic.json"]:
            old_file = old_locations / file
            if old_file.exists():
                shutil.copy(old_file, new_locations / file)
                print(f"  ✅ 迁移 locations/{file}")
    
    # 迁移 npcs
    old_npcs = BASE_DIR / "npcs"
    if old_npcs.exists():
        new_npcs = default_path / "npcs"
        new_npcs.mkdir(parents=True, exist_ok=True)
        
        old_npc_index = old_npcs / "npc_index.json"
        if old_npc_index.exists():
            shutil.copy(old_npc_index, new_npcs / "npc_index.json")
            print(f"  ✅ 迁移 npcs/npc_index.json")
    
    # 迁移角色存档
    old_characters = BASE_DIR / "sessions" / "ghost" / "characters"
    if old_characters.exists():
        new_characters = default_path / "sessions" / "characters"
        new_characters.mkdir(parents=True, exist_ok=True)
        
        for file in old_characters.iterdir():
            if file.suffix == '.json':
                shutil.copy(file, new_characters / file.name)
        print(f"  ✅ 迁移 sessions/characters/")
    
    register_world(DEFAULT_WORLD_ID, "默认世界", "V3 迁移的默认世界")
    
    print("📦 V3 数据迁移完成！")

# ========== 角色管理函数（从 api.py 迁移） ==========

def ensure_character_fields(character: Dict) -> Dict:
    """确保角色 JSON 包含所有必要字段（向前兼容）"""
    
    if "status" not in character:
        character["status"] = {
            "is_dead": False,
            "death_cause": None,
            "health": 100,
            "current_scene": "unknown"
        }
    else:
        if "is_dead" not in character["status"]:
            character["status"]["is_dead"] = False
        if "death_cause" not in character["status"]:
            character["status"]["death_cause"] = None
        if "health" not in character["status"]:
            character["status"]["health"] = 100
        if "current_scene" not in character["status"]:
            character["status"]["current_scene"] = "unknown"
    
    if "unlocked_locations" not in character:
        character["unlocked_locations"] = {}
    
    if "relationships" not in character:
        character["relationships"] = {}
    
    if "inventory" not in character:
        character["inventory"] = []
    
    if "conversation_history" not in character:
        character["conversation_history"] = []
    
    # 时间系统字段
    if "time" not in character:
        character["time"] = {
            "current_day": 1,
            "current_hour": 8,
            "energy_state": "精力充沛",
            "chapter_time_remaining": 72,
            "chapter_node_name": "下个关键节点",
            "last_rest_day": 1,
            "last_rest_hour": 20
        }
    else:
        if "current_day" not in character["time"]:
            character["time"]["current_day"] = 1
        if "current_hour" not in character["time"]:
            character["time"]["current_hour"] = 8
        if "energy_state" not in character["time"]:
            character["time"]["energy_state"] = "精力充沛"
        if "chapter_time_remaining" not in character["time"]:
            character["time"]["chapter_time_remaining"] = 72
    
    # T3 预留字段
    if "system_helper_history" not in character:
        character["system_helper_history"] = []
    
    if "resources" not in character:
        character["resources"] = {
            "灵石": 0,
            "药材": [],
            "道具": []
        }
    
    if "reputation" not in character:
        character["reputation"] = {}
    
    if "current_goals" not in character:
        character["current_goals"] = []
    
    if "active_tasks" not in character:
        character["active_tasks"] = []
    
    if "completed_tasks" not in character:
        character["completed_tasks"] = []
    
    # 关系历史字段
    if "relationships_history" not in character:
        character["relationships_history"] = []
    
    # 组队字段
    if "party" not in character:
        character["party"] = []
    elif not isinstance(character["party"], list):
        character["party"] = []
    
    return character


def load_character(character_id: str, world_id: str = None) -> Optional[Dict]:
    """加载角色数据（自动补全缺失字段）"""
    characters_dir = get_characters_dir(world_id)
    char_path = characters_dir / f"{character_id}.json"
    
    if char_path.exists():
        with open(char_path, 'r', encoding='utf-8') as f:
            character = json.load(f)
            # 验证是否为有效的角色数据
            if (character.get("character_id") and 
                character.get("world_id") and 
                character.get("profile")):
                return ensure_character_fields(character)
            else:
                print(f"⚠️ 文件 {char_path.name} 不是有效的角色数据")
                return None
    
    # 兼容旧格式：遍历查找（如果直接路径不存在）
    for filename in characters_dir.iterdir():
        if filename.suffix == '.json' and filename.stem == character_id:
            with open(filename, 'r', encoding='utf-8') as f:
                character = json.load(f)
                if (character.get("character_id") and 
                    character.get("world_id") and 
                    character.get("profile")):
                    return ensure_character_fields(character)
            break
    
    return None

def save_character(character_id: str, data: Dict, world_id: str = None):
    """保存角色数据（确保是有效的角色数据）"""
    characters_dir = get_characters_dir(world_id)
    
    # 验证必要字段
    if not data.get("character_id") or not data.get("profile"):
        print(f"警告：尝试保存无效的角色数据 {character_id}")
        return
    
    char_path = characters_dir / f"{character_id}.json"
    with open(char_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_all_characters(world_id: str = None) -> List[Dict]:
    """获取所有角色列表（通过验证数据结构识别角色文件）"""
    characters_dir = get_characters_dir(world_id)
    print("🔍 加载get_all_characters")
    characters = []
    if characters_dir.exists():
        for filename in characters_dir.iterdir():
            if filename.suffix == '.json' and not filename.name.startswith('_'):
                try:
                    with open(filename, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        # 验证是否为有效的角色数据（必须包含 character_id, world_id, profile）
                        if (data.get("character_id") and 
                            data.get("world_id") and 
                            data.get("profile") and
                            isinstance(data.get("profile"), dict)):
                            print(f"🔍 data.get('character_id'): {data.get('character_id')}")
                            characters.append({
                                "character_id": data.get("character_id"),
                                "profile": data.get("profile", {}),
                                "current_scene": data.get("status", {}).get("current_scene", "unknown"),
                                "is_dead": data.get("status", {}).get("is_dead", False),
                                "last_played": data.get("last_played"),
                                "unlocked_locations": data.get("unlocked_locations", {})
                            })
                        else:
                            # 可选：打印跳过的文件（调试用）
                            print(f"⏭️ 跳过非角色文件: {filename.name}")
                except Exception as e:
                    print(f"读取文件失败 {filename}: {e}")
    return characters

# ========== 任务数据管理 ==========

def get_tasks_path(character_id: str, world_id: str = None) -> Path:
    """获取任务文件路径"""
    characters_dir = get_characters_dir(world_id)
    return characters_dir / f"{character_id}_tasks.json"


def load_tasks(character_id: str, world_id: str = None) -> Dict:
    """加载任务数据"""
    tasks_path = get_tasks_path(character_id, world_id)
    
    if tasks_path.exists():
        with open(tasks_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    return get_default_tasks()


def save_tasks(character_id: str, data: Dict, world_id: str = None):
    """保存任务数据"""
    tasks_path = get_tasks_path(character_id, world_id)
    
    # 添加更新时间
    data["last_updated"] = datetime.now().isoformat()
    
    with open(tasks_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_default_tasks() -> Dict:
    """返回默认任务数据结构"""
    return {
        "active_tasks": [],
        "completed_tasks": [],
        "removed_tasks": [],
        "version": "1.0",
        "last_updated": None
    }

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "migrate":
        migrate_v3_data()