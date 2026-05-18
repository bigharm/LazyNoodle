# backend/routes/character.py
# 角色管理相关路由

import uuid
import json
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional, Any

from backend.world_manager import (
    get_current_world,
    get_characters_dir,
    ensure_character_fields,
    load_character,
    save_character,
    get_all_characters,
    get_locations_dir
)
from backend.services.ai_service import call_ai, clean_json_response
from backend.config import PROMPTS_DIR

router = APIRouter()


class CreateCharacterRequest(BaseModel):
    profile: Dict[str, Any]
    chapter_index: int = 1


class LoadCharacterRequest(BaseModel):
    character_id: str
    chapter_index: int = 1
    scene: Optional[str] = None


class DeleteHistoryRequest(BaseModel):
    character_id: str
    from_index: int


class ValidateCharacterRequest(BaseModel):
    user_input: str
    chapter_index: int = 1


# ========== 辅助函数 ==========
def load_prompt(prompt_name: str) -> str:
    """加载 prompt 模板"""
    prompt_path = PROMPTS_DIR / prompt_name
    if prompt_path.exists():
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    return ""


def load_world_setting() -> str:
    """加载当前世界的世界观设定"""
    from backend.world_manager import get_world_worldview
    return get_world_worldview()


# ========== API 端点 ==========

@router.post("/validate_character")
async def validate_character_endpoint(request: ValidateCharacterRequest):
    """验证角色设定"""
    worldview = load_world_setting()
    existing = get_all_characters()
    prompt_template = load_prompt("validate_character.txt")
    
    if not prompt_template:
        return {
            "valid": True,
            "message": "使用默认角色",
            "suggested_profile": {
                "name": "无名修士",
                "gender": "男",
                "identity": "散修",
                "appearance": "二十出头，普通相貌",
                "personality": "平和内敛",
                "background": "游历四方的散修"
            }
        }
    
    prompt = prompt_template.format(
        world_setting=worldview,
        existing_characters=json.dumps(existing, ensure_ascii=False),
        user_input=request.user_input
    )
    
    response = call_ai(prompt, temperature=0.6)
    cleaned = clean_json_response(response)
    
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {
            "valid": True,
            "message": "验证完成",
            "suggested_profile": {
                "name": "无名修士",
                "gender": "男",
                "identity": "散修",
                "appearance": "二十出头，普通相貌",
                "personality": "平和内敛",
                "background": request.user_input[:100]
            }
        }


@router.post("/create_character")
async def create_character_endpoint(request: CreateCharacterRequest):
    """创建角色"""
    character_id = str(uuid.uuid4())
    
    character_data = {
        "character_id": character_id,
        "world_id": get_current_world(),
        "created_at": datetime.now().isoformat(),
        "last_played": datetime.now().isoformat(),
        "profile": request.profile,
        "status": {
            "is_dead": False,
            "death_cause": None,
            "health": 100,
            "current_scene": "unknown"
        },
        "relationships": {},
        "inventory": [],
        "conversation_history": [],
        "unlocked_locations": {},
        "relationships_history": [],
        "time": {
            "current_day": 1,
            "current_hour": 8,
            "energy_state": "精力充沛",
            "chapter_time_remaining": 72,
            "chapter_node_name": "下个关键节点",
            "last_rest_day": 1,
            "last_rest_hour": 20
        },
        "system_helper_history": [],
        "resources": {"灵石": 0, "药材": [], "道具": []},
        "reputation": {},
        "current_goals": [],
        "active_tasks": [],
        "completed_tasks": []
    }
    
    save_character(character_id, character_data)
    
    return {
        "status": "ok",
        "character_id": character_id,
        "profile": request.profile
    }


@router.post("/load_character")
async def load_character_endpoint(request: LoadCharacterRequest):
    """加载角色"""
    character = load_character(request.character_id)
    
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")
    
    if "unlocked_locations" not in character:
        character["unlocked_locations"] = {}
    
    if request.scene:
        character["status"]["current_scene"] = request.scene
        
        unlocked = character.setdefault("unlocked_locations", {})
        if request.scene not in unlocked:
            unlocked[request.scene] = {
                "status": "entered",
                "first_visited": datetime.now().isoformat()
            }
    
    character["last_played"] = datetime.now().isoformat()
    save_character(request.character_id, character)
    
    return {
        "status": "ok",
        "character_id": character["character_id"],
        "profile": character.get("profile", {}),
        "current_scene": character["status"].get("current_scene", "unknown"),
        "is_dead": character["status"].get("is_dead", False),
        "death_cause": character["status"].get("death_cause"),
        "conversation_history": character.get("conversation_history", []),
        "unlocked_locations": character.get("unlocked_locations", {}),
        "time": character.get("time", {})
    }


@router.get("/list_characters")
async def list_characters_endpoint():
    """列出所有角色"""
    return {"characters": get_all_characters()}


@router.get("/characters")
async def list_characters_alt():
    """列出所有角色（备用路径）"""
    return {"characters": get_all_characters()}


@router.post("/delete_character")
async def delete_character(request: dict):
    """删除角色（移动到_deleted文件夹）"""
    import shutil
    
    character_id = request.get("character_id")
    if not character_id:
        raise HTTPException(status_code=400, detail="需要提供 character_id")
    
    characters_dir = get_characters_dir()
    src_path = characters_dir / f"{character_id}.json"
    
    if not src_path.exists():
        raise HTTPException(status_code=404, detail="角色不存在")
    
    deleted_dir = characters_dir / "_deleted"
    deleted_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst_path = deleted_dir / f"{character_id}_{timestamp}.json"
    
    shutil.move(str(src_path), str(dst_path))
    
    print(f"🗑️ 角色已删除（移动到 {dst_path}）")
    
    return {"status": "ok", "message": f"角色已删除", "deleted_path": str(dst_path)}


@router.post("/delete_history")
async def delete_history(request: DeleteHistoryRequest):
    """从指定索引删除对话历史，并回滚关系状态"""
    from backend.services.relationship_service import rollback_relationships_to_hour
    
    character = load_character(request.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")
    
    history = character.get("conversation_history", [])
    
    if request.from_index >= 0 and request.from_index < len(history):
        remaining_last_index = request.from_index - 1
        target_game_hour = None
        
        if remaining_last_index >= 0:
            target_game_hour = history[remaining_last_index].get("game_hour")
        
        character["conversation_history"] = history[:request.from_index]
        
        if target_game_hour is not None:
            rollback_relationships_to_hour(character, target_game_hour)
        else:
            character["relationships_history"] = []
        
        if character["status"].get("is_dead"):
            character["status"]["is_dead"] = False
            character["status"]["death_cause"] = None
        
        save_character(request.character_id, character)
    
    return {"status": "ok"}


@router.post("/end_session")
async def end_session(request: dict):
    """结束幽灵会话"""
    character_id = request.get("character_id")
    character = load_character(character_id) if character_id else None
    if character:
        character["last_played"] = datetime.now().isoformat()
        save_character(character_id, character)
    
    return {"status": "ok"}


@router.get("/export_character/{character_id}")
async def export_character(character_id: str):
    """导出角色数据"""
    character_data = load_character(character_id)
    
    if not character_data:
        raise HTTPException(status_code=404, detail="角色不存在")
    
    return character_data


@router.post("/import_character")
async def import_character(request: dict):
    """导入角色数据"""
    character_data = request.get("character_data")
    if not character_data:
        raise HTTPException(status_code=400, detail="需要提供角色数据")
    
    if "character_id" not in character_data:
        character_data["character_id"] = str(uuid.uuid4())
    
    existing_characters = get_all_characters()
    for existing in existing_characters:
        if existing.get("profile", {}).get("name") == character_data.get("profile", {}).get("name"):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            character_data["profile"]["name"] = f"{character_data['profile']['name']}_{timestamp}"
    
    character_data = ensure_character_fields(character_data)
    character_data["world_id"] = get_current_world()
    
    save_character(character_data["character_id"], character_data)
    
    return {
        "status": "ok",
        "character_id": character_data["character_id"],
        "message": f"角色「{character_data['profile'].get('name')}」导入成功"
    }


@router.post("/convert_to_npc")
async def convert_to_npc(request: dict):
    """将角色转换为NPC"""
    import shutil
    
    character_id = request.get("character_id")
    location_id = request.get("location_id")  # 新增：指定的地点ID
    location_name = request.get("location_name")  # 新增：指定的地点名称
    
    if not character_id:
        raise HTTPException(status_code=400, detail="需要提供 character_id")
    
    character = load_character(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")
    
    profile = character.get("profile", {})
    
    # 确定地点ID
    if location_id:
        # 使用前端传递的地点ID
        final_location_id = location_id
    else:
        # 降级：使用角色当前场景
        status = character.get("status", {})
        current_scene = status.get("current_scene", "未知")
        from backend.location_manager import get_location_manager
        lm = get_location_manager(get_locations_dir())
        location = lm.get_location_by_name(current_scene)
        final_location_id = location.id if location and hasattr(location, 'id') else current_scene
    
    npc_id = f"npc_converted_{int(datetime.now().timestamp())}_{character_id[:8]}"
    
    new_npc = {
        "id": npc_id,
        "name": profile.get("name", "无名"),
        "gender": profile.get("gender", "未知"),
        "profile": {
            "identity": profile.get("identity", "旅行者"),
            "description": f"外貌：{profile.get('appearance', '未知')}\n性格：{profile.get('personality', '未知')}",
            "personality_traits": profile.get("personality", "").split("，") if profile.get("personality") else [],
            "background": profile.get("background", "来历不明"),
            "converted_from_character": character_id,
            "converted_at": datetime.now().isoformat()
        },
        "location_id": final_location_id,
        "active": True,
        "dead": False,
        "is_converted": True,
        "original_character_id": character_id
    }
    
    # 加载并保存 NPC 索引
    from backend.world_manager import get_npcs_dir
    npc_index_path = get_npcs_dir() / "npc_index.json"
    
    npc_index = {}
    if npc_index_path.exists():
        with open(npc_index_path, 'r', encoding='utf-8') as f:
            npc_index = json.load(f)
    
    npc_index.setdefault("npcs", []).append(new_npc)
    npc_index["last_updated"] = datetime.now().isoformat()
    
    with open(npc_index_path, 'w', encoding='utf-8') as f:
        json.dump(npc_index, f, ensure_ascii=False, indent=2)
    
    # 删除原角色
    characters_dir = get_characters_dir()
    src_path = characters_dir / f"{character_id}.json"
    deleted_dir = characters_dir / "_deleted"
    deleted_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst_path = deleted_dir / f"{character_id}_converted_to_npc_{timestamp}.json"
    shutil.move(str(src_path), str(dst_path))
    
    print(f"👤 角色已转为NPC: {profile.get('name')} -> {npc_id} (地点: {final_location_id})")
    
    return {
        "status": "ok",
        "message": f"角色「{profile.get('name')}」已转为NPC",
        "npc_id": npc_id,
        "npc_name": profile.get("name")
    }

@router.post("/add_npc")
async def add_npc(request: dict):
    """添加 NPC"""
    npc_data = request.get("npc")
    if not npc_data:
        raise HTTPException(status_code=400, detail="需要提供 npc 数据")
    
    from backend.world_manager import get_npcs_dir
    npc_index_path = get_npcs_dir() / "npc_index.json"
    
    npc_index = {}
    if npc_index_path.exists():
        with open(npc_index_path, 'r', encoding='utf-8') as f:
            npc_index = json.load(f)
    
    if any(n.get("id") == npc_data["id"] for n in npc_index.get("npcs", [])):
        npc_data["id"] = f"{npc_data['id']}_{int(datetime.now().timestamp())}"
    
    npc_index.setdefault("npcs", []).append(npc_data)
    npc_index["last_updated"] = datetime.now().isoformat()
    
    location_id = npc_data.get("location_id")
    if location_id:
        npc_index.setdefault("location_npc_map", {}).setdefault(location_id, []).append(npc_data["id"])
    
    with open(npc_index_path, 'w', encoding='utf-8') as f:
        json.dump(npc_index, f, ensure_ascii=False, indent=2)
    
    return {"status": "ok", "npc_id": npc_data["id"], "message": f"NPC {npc_data['name']} 添加成功"}


@router.get("/npcs/all")
async def get_all_npcs():
    """获取所有 NPC"""
    from backend.world_manager import get_npcs_dir
    npc_index_path = get_npcs_dir() / "npc_index.json"
    
    npc_index = {}
    if npc_index_path.exists():
        with open(npc_index_path, 'r', encoding='utf-8') as f:
            npc_index = json.load(f)
    
    return {"npcs": npc_index.get("npcs", [])}