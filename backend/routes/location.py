# backend/routes/location.py
# 地点管理相关路由

from fastapi import APIRouter, HTTPException
from backend.world_manager import get_locations_dir, get_current_world_path
from backend.location_manager import get_location_manager

router = APIRouter()


@router.get("/locations/tree")  # 移除 /ghost 前缀
async def get_locations_tree(character_id: str, chapter_index: int = 1):
    """获取玩家已解锁地点树"""
    from backend.routes.character import load_character
    
    character = load_character(character_id)
    unlocked_locations = character.get("unlocked_locations", {}) if character else {}
    
    unlocked_names = list(unlocked_locations.keys())
    print(f"已解锁地点名称: {unlocked_names}")
    
    if not unlocked_names:
        return {"tree": []}
    
    lm = get_location_manager(get_locations_dir())
    all_locations = lm.get_all_locations()
    
    location_info = {}
    for loc_id, loc in all_locations.items():
        if hasattr(loc, 'name'):
            name = loc.name
            loc_type = loc.type
            parent = loc.parent
            icon = loc.icon
            description = loc.description
        else:
            name = loc.get('name')
            loc_type = loc.get('type')
            parent = loc.get('parent')
            icon = loc.get('icon', '📍')
            description = loc.get('description', '')
        
        location_info[name] = {
            "id": loc_id,
            "type": loc_type,
            "parent": parent,
            "icon": icon,
            "description": description
        }
    
    regions = {}
    for name, info in location_info.items():
        if info["type"] == "region":
            regions[name] = info
    
    if not regions:
        regions = {"可探索区域": {"id": "default", "icon": "📍"}}
    
    tree = []
    for region_name, region_info in regions.items():
        region_tree = {
            "id": region_info.get("id"),
            "name": region_name,
            "icon": region_info.get("icon", "📁"),
            "locations": []
        }
        
        for loc_name, loc_info in location_info.items():
            if loc_info["type"] != "scene":
                continue
            
            if loc_name not in unlocked_names:
                continue
            
            parent_name = loc_info.get("parent")
            if parent_name == region_name or (parent_name and parent_name == region_info.get("id")):
                region_tree["locations"].append({
                    "id": loc_info["id"],
                    "name": loc_name,
                    "description": loc_info.get("description", ""),
                    "icon": loc_info.get("icon", "📍"),
                    "unlock_status": unlocked_locations.get(loc_name, {}).get("status", "entered")
                })
        
        if region_tree["locations"]:
            tree.append(region_tree)
    
    print(f"📍 返回地点树: {len(tree)} 个区域")
    return {"tree": tree}


@router.get("/locations/all")  # 移除 /ghost 前缀
async def get_all_locations_endpoint():
    """获取所有地点（用于前端构建地点树）"""
    lm = get_location_manager(get_locations_dir())
    all_locations = lm.get_all_locations()
    
    regions = []
    scenes = []
    
    for loc_id, loc in all_locations.items():
        if hasattr(loc, 'type'):
            loc_type = loc.type
            name = loc.name
            parent = loc.parent
            icon = loc.icon
            description = loc.description
        else:
            loc_type = loc.get('type')
            name = loc.get('name')
            parent = loc.get('parent')
            icon = loc.get('icon', '📍')
            description = loc.get('description', '')
        
        if loc_type == 'region':
            regions.append({
                "id": loc_id,
                "name": name,
                "icon": icon,
                "description": description
            })
        else:
            scenes.append({
                "id": loc_id,
                "name": name,
                "parent": parent,
                "icon": icon,
                "description": description
            })
    
    return {"regions": regions, "locations": scenes}


@router.get("/locations/by_name/{location_name}")  # 移除 /ghost 前缀
async def get_location_by_name(location_name: str):
    """根据名称获取地点信息"""
    print(f"🔍 获取地点信息: {location_name}")
    
    lm = get_location_manager(get_locations_dir())
    location = lm.get_location_by_name(location_name)
    if location:
        if hasattr(location, 'id'):
            return {
                "id": location.id,
                "name": location.name,
                "description": location.description,
                "icon": location.icon,
                "parent": location.parent
            }
        return {
            "id": location.get("id"),
            "name": location.get("name"),
            "description": location.get("description", ""),
            "icon": location.get("icon", "📍"),
            "parent": location.get("parent")
        }
    
    return {
        "id": location_name,
        "name": location_name,
        "description": f"在{location_name}发现的地点",
        "icon": "📍",
        "parent": None
    }


@router.get("/npcs/by_scene/{scene_name}")  # 移除 /ghost 前缀
async def get_npcs_by_scene(scene_name: str):
    """获取指定场景的 NPC 列表"""
    print(f"🔍 获取场景 NPC: {scene_name}")
    
    lm = get_location_manager(get_locations_dir())
    location = lm.get_location_by_name(scene_name)
    location_id = location.id if location and hasattr(location, 'id') else scene_name
    
    from backend.world_manager import get_npcs_dir
    import json
    
    npc_index_path = get_npcs_dir() / "npc_index.json"
    npcs = []
    
    if npc_index_path.exists():
        with open(npc_index_path, 'r', encoding='utf-8') as f:
            npc_index = json.load(f)
        
        for npc in npc_index.get("npcs", []):
            if npc.get("location_id") == location_id and npc.get("active", True):
                npcs.append(npc)
    
    return {"npcs": npcs}


@router.post("/update_scene")  # 移除 /ghost 前缀
async def update_scene(request: dict):
    """更新角色场景"""
    from backend.routes.character import load_character, save_character
    from datetime import datetime
    
    character_id = request.get("character_id")
    scene = request.get("scene")
    
    if not character_id or not scene:
        raise HTTPException(status_code=400, detail="需要提供 character_id 和 scene")
    
    character = load_character(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")
    
    old_scene = character["status"].get("current_scene")
    character["status"]["current_scene"] = scene
    character["last_played"] = datetime.now().isoformat()
    
    unlocked = character.setdefault("unlocked_locations", {})
    if scene not in unlocked:
        unlocked[scene] = {
            "status": "entered",
            "first_visited": datetime.now().isoformat()
        }
    
    save_character(character_id, character)
    
    return {"status": "ok", "current_scene": scene, "old_scene": old_scene}