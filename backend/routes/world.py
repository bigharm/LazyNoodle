# backend/routes/world.py
# 世界管理相关路由

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..world_manager import (
    get_current_world,
    get_current_world_path,
    get_world_index,
    get_world_path,
    get_world_worldview,
    is_world_initialized,
    register_world,
    set_current_world,
    save_world_index
)
from ..world_generator import generate_world_data
from ..config import BASE_DIR

router = APIRouter()


class CreateWorldRequest(BaseModel):
    world_id: str
    world_name: str
    description: str = ""


class SwitchWorldRequest(BaseModel):
    world_id: str


@router.get("/worlds/list")
async def list_worlds():
    """获取所有世界列表"""
    index = get_world_index()
    return {
        "worlds": index.get("worlds", []),
    }


@router.get("/world/current")
async def get_current_world_info():
    """获取当前世界信息"""
    world_id = get_current_world()
    initialized = is_world_initialized()
    worldview = get_world_worldview()
    
    index = get_world_index()
    world_info = next((w for w in index.get("worlds", []) if w["id"] == world_id), {})
    world_name = world_info.get("name", world_id)
    
    return {
        "world_id": world_id,
        "world_name": world_name,
        "initialized": initialized,
        "worldview_preview": worldview[:200] if worldview else ""
    }


@router.get("/world/status")
async def get_world_status():
    """获取当前世界初始化状态"""
    world_id = get_current_world()
    initialized = is_world_initialized()
    
    from ..world_manager import get_locations_dir, get_npcs_dir
    
    locations_dir = get_locations_dir()
    npcs_dir = get_npcs_dir()
    
    locations_exist = (locations_dir / "location_base.json").exists()
    npcs_exist = (npcs_dir / "npc_index.json").exists()
    timeline_exist = (get_current_world_path() / "timeline.json").exists()
    
    return {
        "world_id": world_id,
        "initialized": initialized,
        "locations_exist": locations_exist,
        "npcs_exist": npcs_exist,
        "timeline_exist": timeline_exist
    }


@router.post("/world/init")
async def initialize_world():
    """初始化当前世界（生成地点、NPC、时间线）"""
    if is_world_initialized():
        return {"status": "ok", "message": "世界已初始化", "initialized": True}
    
    try:
        result = await generate_world_data()
        
        return {
            "status": "ok" if not result.get("fallback_used") else "warning",
            "message": "世界初始化成功",
            "locations_count": result.get("locations_count", 0),
            "npcs_count": result.get("npcs_count", 0),
            "timeline_milestones": result.get("timeline_milestones", 0),
            "fallback_used": result.get("fallback_used", False)
        }
    except Exception as e:
        print(f"❌ 世界初始化失败: {e}")
        import traceback
        traceback.print_exc()
        
        # Fallback 到默认数据
        from ..world_manager import get_default_locations, get_default_npcs, get_default_timeline, get_locations_dir, get_npcs_dir
        import json
        
        locations_dir = get_locations_dir()
        locations_dir.mkdir(parents=True, exist_ok=True)
        with open(locations_dir / "location_base.json", 'w', encoding='utf-8') as f:
            json.dump(get_default_locations(), f, ensure_ascii=False, indent=2)
        
        npcs_dir = get_npcs_dir()
        npcs_dir.mkdir(parents=True, exist_ok=True)
        with open(npcs_dir / "npc_index.json", 'w', encoding='utf-8') as f:
            json.dump(get_default_npcs(), f, ensure_ascii=False, indent=2)
        
        timeline_path = get_current_world_path() / "timeline.json"
        with open(timeline_path, 'w', encoding='utf-8') as f:
            json.dump(get_default_timeline(), f, ensure_ascii=False, indent=2)
        
        return {
            "status": "warning",
            "message": "AI 生成失败，已使用默认数据",
            "fallback": True
        }


@router.post("/world/create")
async def create_world(request: CreateWorldRequest):
    """创建新世界"""
    world_id = request.world_id
    
    if (BASE_DIR / "worlds" / world_id).exists():
        raise HTTPException(status_code=400, detail=f"世界 {world_id} 已存在")
    
    register_world(world_id, request.world_name, request.description)
    
    new_world_path = BASE_DIR / "worlds" / world_id
    new_world_path.mkdir(parents=True, exist_ok=True)
    
    return {"status": "ok", "world_id": world_id, "message": f"世界 {request.world_name} 创建成功"}


@router.post("/world/switch")
async def switch_world(request: SwitchWorldRequest):
    """切换当前世界"""
    world_id = request.world_id
    
    world_path = BASE_DIR / "worlds" / world_id
    if not world_path.exists():
        raise HTTPException(status_code=404, detail=f"世界 {world_id} 不存在")
    
    set_current_world(world_id)
    
    return {"status": "ok", "world_id": world_id, "message": f"已切换到世界 {world_id}"}


@router.post("/world/select")
async def select_world(request: dict):
    """选择要进入的世界"""
    world_id = request.get("world_id")
    if not world_id:
        raise HTTPException(status_code=400, detail="需要提供 world_id")
    
    set_current_world(world_id)
    
    return {"status": "ok", "world_id": world_id}


@router.post("/world/delete")
async def delete_world(request: dict):
    """删除世界（移动到 _deleted 文件夹）"""
    import shutil
    from datetime import datetime
    from ..world_manager import get_world_index, save_world_index, get_world_path, get_current_world, set_current_world
    
    world_id = request.get("world_id")
    if not world_id:
        raise HTTPException(status_code=400, detail="需要提供 world_id")
    
    if world_id == "_deleted":
        raise HTTPException(status_code=400, detail="不能删除 _deleted 文件夹")
    
    index = get_world_index()
    world_info = next((w for w in index.get("worlds", []) if w["id"] == world_id), None)
    if not world_info:
        raise HTTPException(status_code=404, detail=f"世界 {world_id} 不存在")
    
    world_name = world_info.get("name", world_id)
    is_current = (world_id == get_current_world())
    
    world_path = get_world_path(world_id)
    
    deleted_dir = get_world_path("_deleted")
    deleted_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst_path = deleted_dir / f"{world_id}_{timestamp}"
    
    if world_path.exists():
        shutil.move(str(world_path), str(dst_path))
        print(f"🗑️ 世界已移动到: {dst_path}")
    
    index["worlds"] = [w for w in index.get("worlds", []) if w["id"] != world_id]
    
    if is_current:
        if index["worlds"]:
            index["current_world"] = index["worlds"][0]["id"]
        else:
            index["current_world"] = None
    
    save_world_index(index)
    
    return {
        "status": "ok",
        "world_id": world_id,
        "world_name": world_name,
        "moved_to": str(dst_path),
        "message": f"世界 {world_name} 已移动到 _deleted 文件夹"
    }


@router.post("/world/scan")
async def scan_worlds():
    """扫描 worlds 目录，同步到索引"""
    from ..world_manager import get_world_index, save_world_index, get_worlds_dir, register_world
    
    worlds_dir = get_worlds_dir()
    index = get_world_index()
    existing_worlds = {w["id"] for w in index.get("worlds", [])}
    
    new_worlds = []
    
    print("🔍 开始扫描 worlds 目录...")
    
    for item in worlds_dir.iterdir():
        if item.is_dir() and not item.name.startswith('.'):
            world_id = item.name
            worldview_path = item / "worldview.txt"
            
            if worldview_path.exists():
                if world_id not in existing_worlds:
                    world_name = world_id
                    try:
                        with open(worldview_path, 'r', encoding='utf-8') as f:
                            first_line = f.readline().strip()
                            if first_line and len(first_line) < 50:
                                world_name = first_line
                    except Exception:
                        pass
                    
                    register_world(world_id, world_name, f"从目录扫描发现的世界")
                    new_worlds.append(world_id)
                    print(f"  ✅ 发现新世界: {world_id} ({world_name})")
            else:
                print(f"  ⚠️ 缺少 worldview.txt: {world_id}")
    
    return {
        "status": "ok",
        "new_worlds_count": len(new_worlds),
        "new_worlds": new_worlds,
        "message": f"发现 {len(new_worlds)} 个新世界"
    }


@router.post("/world/create_with_worldview")
async def create_world_with_worldview(request: dict):
    """创建新世界（使用上传的世界观文件）"""
    world_id = request.get("world_id")
    world_name = request.get("world_name")
    description = request.get("description", "")
    worldview_content = request.get("worldview_content")
    
    if not world_id or not world_name:
        raise HTTPException(status_code=400, detail="需要提供 world_id 和 world_name")
    
    if not worldview_content:
        raise HTTPException(status_code=400, detail="需要提供世界观内容")
    
    world_path = BASE_DIR / "worlds" / world_id
    if world_path.exists():
        raise HTTPException(status_code=400, detail=f"世界 {world_id} 已存在")
    
    from ..world_manager import register_world, set_current_world
    register_world(world_id, world_name, description)
    
    world_path.mkdir(parents=True, exist_ok=True)
    
    worldview_path = world_path / "worldview.txt"
    with open(worldview_path, 'w', encoding='utf-8') as f:
        f.write(worldview_content)
    
    set_current_world(world_id)
    
    return {
        "status": "ok",
        "world_id": world_id,
        "world_name": world_name,
        "message": f"世界 {world_name} 创建成功"
    }


@router.get("/world/worldview")
async def get_full_worldview():
    """获取完整世界观内容"""
    worldview = get_world_worldview()
    return {"content": worldview}