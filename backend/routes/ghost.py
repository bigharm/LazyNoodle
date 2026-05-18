# backend/routes/ghost.py
# 幽灵模式核心路由（环境交互、NPC对话、系统助手）

import json
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional

from ..world_manager import (
    get_current_world_path,
    get_locations_dir,
    get_world_worldview,
    load_character,
    save_character,
    ensure_character_fields,
    load_tasks,
    save_tasks
)
from ..location_manager import get_location_manager
from ..services.ai_service import call_ai, clean_json_response, call_ai_json
from ..services.relationship_service import update_relationships, get_current_relationships
from ..config import PROMPTS_DIR,DEBUG

router = APIRouter()


# ========== Pydantic 模型 ==========
class EnvironmentInteractRequest(BaseModel):
    character_id: str
    chapter_index: int = 1
    scene: str
    player_name: str
    user_input: Dict[str, str]
    history: List[Dict] = []
    scene_npcs: List[Dict] = []


class NPCDialogueRequest(BaseModel):
    character_id: str
    chapter_index: int = 1
    scene: str
    player_name: str
    npc_id: str
    npc_name: str
    user_input: str
    is_greeting: bool = False
    is_continue: bool = False
    history: List[Dict] = []
    scene_npcs: List[Dict] = []


class SystemHelperRequest(BaseModel):
    character_id: str
    query: str
    player_name: str
    player_identity: str
    current_scene: str
    resources: Dict = {}
    reputation: Dict = {}
    unlocked_locations: List = []
    current_goals: List = []
    active_tasks: List = []
    history: List[Dict] = []
    extra_context: Dict = {}


class AppendConversationRequest(BaseModel):
    character_id: str
    speaker: str
    content: str
    scene: str
    is_dead: bool = False


# ========== 辅助函数 ==========
def load_prompt(prompt_name: str) -> str:
    """加载 prompt 模板"""
    prompt_path = PROMPTS_DIR / prompt_name
    if prompt_path.exists():
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    return ""


def format_history_for_ai(history: List[Dict], max_count: int = 20) -> str:
    """格式化历史对话供 AI 使用"""
    if not history:
        return "（无历史记录）"
    
    lines = []
    for h in history[-max_count:]:
        speaker = h.get("speaker", "未知")
        content = h.get("content", "")
        lines.append(f"{speaker}: {content}")
    
    return "\n".join(lines)


def format_locations_for_ai() -> str:
    """格式化已有地点库供 AI 使用"""
    lm = get_location_manager(get_locations_dir())
    all_locations = lm.get_all_locations()
    
    regions = []
    scenes = []
    
    for loc_id, loc in all_locations.items():
        if hasattr(loc, 'name'):
            name = loc.name
            loc_type = loc.type
            parent = loc.parent
        else:
            name = loc.get('name')
            loc_type = loc.get('type')
            parent = loc.get('parent')
        
        if loc_type == 'region':
            regions.append(f"  - {name} ({loc_id})")
        else:
            scenes.append(f"  - {name} ({loc_id})，父级={parent}")
    
    lines = ["【区域】"]
    lines.extend(regions if regions else ["  （暂无区域）"])
    lines.append("【场景】")
    lines.extend(scenes if scenes else ["  （暂无场景）"])
    
    return "\n".join(lines)


def format_npcs_for_ai(npcs: List[Dict]) -> str:
    """格式化 NPC 信息供 AI 使用"""
    if not npcs:
        return "（没有其他人在场）"
    
    lines = []
    for npc in npcs:
        profile = npc.get("profile", {})
        lines.append(f"- {npc.get('name')}：{profile.get('identity', '普通人')}")
        if profile.get("description"):
            lines.append(f"  外貌性格：{profile.get('description')}")
    return "\n".join(lines)


# ========== API 端点 ==========

@router.post("/environment_interact")
async def environment_interact(request: EnvironmentInteractRequest):
    """环境交互 - 核心 API"""
    try:
        print(f"🎭 环境交互: 角色={request.character_id}, 场景={request.scene}")
        
        character = load_character(request.character_id)
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 加载任务数据
        tasks_data = load_tasks(request.character_id)
        active_tasks = tasks_data.get("active_tasks", [])
        
        if character["status"].get("is_dead"):
            return {
                "description": character["status"].get("death_cause", "你已经死亡，无法继续互动。"),
                "is_dead": True,
                "new_location": None
            }
        
        worldview = get_world_worldview()
        scene_npcs = request.scene_npcs
        history = character.get("conversation_history", [])
        history_text = format_history_for_ai(history + request.history)
        
        user_input_text = ""
        if request.user_input.get("action") and request.user_input.get("speech"):
            user_input_text = f"（动作：{request.user_input['action']}）\"{request.user_input['speech']}\""
        elif request.user_input.get("action"):
            user_input_text = f"（动作：{request.user_input['action']}）"
        elif request.user_input.get("speech"):
            user_input_text = f"\"{request.user_input['speech']}\""
        
        prompt_template = load_prompt("environment_interact.txt")
        
        if not prompt_template:
            return {
                "description": "系统错误：找不到环境交互的提示词模板。",
                "is_dead": False,
                "new_location": None
            }
        
        profile = character.get("profile", {})
        existing_locations = format_locations_for_ai()
        
        time_info = character.get("time", {})
        current_day = time_info.get("current_day", 1)
        current_hour = time_info.get("current_hour", 8)
        energy_state = time_info.get("energy_state", "精力充沛")
        time_remaining = time_info.get("chapter_time_remaining", 72)
        current_relationships = get_current_relationships(character)
        
        # 格式化任务信息供 AI 使用（包含 task_id）
        active_tasks_text = ""
        if active_tasks:
            task_list = []
            for task in active_tasks:
                task_list.append(f"- ID: {task.get('id')} | 名称: [{task.get('name')}] | 描述: {task.get('description')} | 优先级: {task.get('priority', 100)}")
            active_tasks_text = "\n".join(task_list)
        else:
            active_tasks_text = "（无活跃任务）"
        
        prompt = prompt_template.format(
            world_setting=worldview,
            location_id=request.scene,
            player_name=profile.get("name", "玩家"),
            player_identity=profile.get("identity", "旅行者"),
            player_appearance=profile.get("appearance", "普通"),
            player_personality=profile.get("personality", "平和"),
            player_background=profile.get("background", "来历不明"),
            npc_info=format_npcs_for_ai(scene_npcs),
            history_text=history_text,
            user_input=user_input_text,
            existing_locations=existing_locations,
            current_day=current_day,
            current_hour=current_hour,
            energy_state=energy_state,
            time_remaining=time_remaining,
            current_relationships=current_relationships,
            active_tasks=active_tasks_text
        )
        if DEBUG:
            print("\n" + "="*80)
            print("📤 [环境交互] 发送给AI的Prompt:")
            print("="*80)
            print(prompt)
            print("="*80)

        response = call_ai(prompt, temperature=0.8)
        
        if DEBUG:
            print("\n" + "="*80)
            print("📥 [环境交互] AI原始响应:")
            print("="*80)
            print(response)
            print("="*80)

        cleaned = clean_json_response(response)

        try:
            result = json.loads(cleaned)
            
            if result.get("is_dead"):
                character["status"]["is_dead"] = True
                character["status"]["death_cause"] = result.get("description", "未知原因")
                save_character(request.character_id, character)
            
            # 处理时间变化
            time_cost = result.get("time_cost", 0)
            new_energy_state = result.get("new_energy_state")
            
            if time_cost > 0:
                time_info = character.get("time", {})
                current_hour_val = time_info.get("current_hour", 8)
                current_day_val = time_info.get("current_day", 1)
                time_remaining_val = time_info.get("chapter_time_remaining", 72)
                
                new_hour_val = current_hour_val + time_cost
                new_day_val = current_day_val
                if new_hour_val >= 24:
                    new_day_val = current_day_val + (new_hour_val // 24)
                    new_hour_val = new_hour_val % 24
                
                time_info["current_hour"] = new_hour_val
                time_info["current_day"] = new_day_val
                time_info["chapter_time_remaining"] = max(0, time_remaining_val - time_cost)
                
                if new_energy_state:
                    time_info["energy_state"] = new_energy_state
                
                character["time"] = time_info
                save_character(request.character_id, character)
                
                # 添加时间流逝到描述
                if time_cost == 0.25:
                    result["description"] = f"{result['description']}\n\n⏰ 过了15分钟"
                elif time_cost == 0.5:
                    result["description"] = f"{result['description']}\n\n⏰ 过了30分钟"
                elif time_cost == 0.75:
                    result["description"] = f"{result['description']}\n\n⏰ 过了45分钟"
                elif time_cost == 1:
                    result["description"] = f"{result['description']}\n\n⏰ 过了1小时"
                elif time_cost < 1:
                    minutes = int(time_cost * 60)
                    result["description"] = f"{result['description']}\n\n⏰ 过了{minutes}分钟"
                elif time_cost == int(time_cost):
                    result["description"] = f"{result['description']}\n\n⏰ 过了{int(time_cost)}小时"
                else:
                    hours = int(time_cost)
                    minutes = int((time_cost - hours) * 60)
                    if hours > 0 and minutes > 0:
                        result["description"] = f"{result['description']}\n\n⏰ 过了{hours}小时{minutes}分钟"
                    elif hours > 0:
                        result["description"] = f"{result['description']}\n\n⏰ 过了{hours}小时"
                    else:
                        result["description"] = f"{result['description']}\n\n⏰ 过了{minutes}分钟"
            
            # 处理关系更新
            relationship_update = result.get("relationship_update")
            if relationship_update and isinstance(relationship_update, str) and relationship_update.strip():
                current_hour_val = character.get("time", {}).get("current_hour", 0)
                update_relationships(character, relationship_update, current_hour_val)
                save_character(request.character_id, character)
                print(f"📝 关系已更新: {relationship_update[:100]}...")
            
            # 处理任务更新
            task_updates = result.get("task_updates", [])
            if task_updates:
                tasks_updated = False
                for update in task_updates:
                    task_id = update.get("task_id")
                    action = update.get("action")
                    info = update.get("info", "")
                    
                    if action == "update" or action == "complete":
                        # 更新活跃任务，保持原有的 priority
                        for task in active_tasks:
                            if task.get("id") == task_id:
                                task["description"] = info
                                # 保持原有的 priority，不修改
                                # priority 字段保持不变
                                tasks_updated = True
                                break
                        
                        # 如果是完成状态，移动到已完成列表
                        if action == "complete":
                            completed_task = None
                            for i, task in enumerate(active_tasks):
                                if task.get("id") == task_id:
                                    completed_task = active_tasks.pop(i)
                                    completed_task["completed_at"] = datetime.now().isoformat()
                                    completed_task["completion_description"] = info
                                    # 保留原有的 priority
                                    tasks_updated = True
                                    break
                            
                            if completed_task:
                                tasks_data["completed_tasks"].append(completed_task)
                    
                    elif action == "add":
                        # 添加新任务（从环境交互中生成）
                        priority = update.get("priority", 100)
                        priority = max(1, min(1000, priority))
                        new_task = {
                            "id": f"task_{int(datetime.now().timestamp())}_{len(active_tasks)}",
                            "name": update.get("name", "新任务"),
                            "description": info,
                            "priority": priority,
                            "created_at": datetime.now().isoformat(),
                            "source": update.get("source", "environment")
                        }
                        active_tasks.append(new_task)
                        tasks_updated = True
                    
                    elif action == "update_priority":
                        # 更新任务优先级
                        for task in active_tasks:
                            if task.get("id") == task_id:
                                new_priority = update.get("priority", 100)
                                new_priority = max(1, min(1000, new_priority))
                                task["priority"] = new_priority
                                tasks_updated = True
                                print(f"📋 任务优先级已更新: {task.get('name')} -> {new_priority}")
                                break
                
                # 按优先级排序活跃任务
                if tasks_updated:
                    active_tasks.sort(key=lambda x: x.get("priority", 100))
                    tasks_data["active_tasks"] = active_tasks
                    save_tasks(request.character_id, tasks_data)
                    print(f"📋 任务数据已更新")
            
            # 处理场景切换
            new_location_data = result.get("new_location")
            if new_location_data:
                new_location_name = new_location_data.get("name")
                location_type = new_location_data.get("type", "existing")
                
                if new_location_name and new_location_name != request.scene:
                    lm = get_location_manager(get_locations_dir())
                    existing_location = lm.get_location_by_name(new_location_name)
                    location_id = None
                    
                    if not existing_location and location_type == "new":
                        parent_id = new_location_data.get("parent_id")
                        description = new_location_data.get("description", f"在{request.scene}发现的地点")
                        icon = new_location_data.get("icon", "🔍")
                        
                        if parent_id:
                            parent_location = lm.get_location(parent_id)
                            if not parent_location:
                                parent_location = lm.get_location_by_name(parent_id)
                                parent_id = parent_location.id if parent_location else None
                        
                        new_loc = lm.add_dynamic_location(
                            name=new_location_name,
                            parent=parent_id,
                            description=description,
                            icon=icon,
                            discovered_from=request.scene,
                            discovered_by=request.character_id
                        )
                        print(f"📍 添加新地点: {new_location_name} (ID: {new_loc.id})")
                        location_id = new_loc.id
                    elif existing_location:
                        location_id = existing_location.id if hasattr(existing_location, 'id') else existing_location.get("id")
                    else:
                        location_id = new_location_name
                    
                    character["status"]["current_scene"] = new_location_name
                    
                    unlocked = character.setdefault("unlocked_locations", {})
                    if new_location_name not in unlocked:
                        unlocked[new_location_name] = {
                            "status": "entered",
                            "first_visited": datetime.now().isoformat(),
                            "location_id": location_id
                        }
                    
                    save_character(request.character_id, character)
                    result["new_location"] = new_location_name
                else:
                    result["new_location"] = None
            else:
                result["new_location"] = None
            
            return result
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON 解析失败: {e}")
            return {
                "description": response[:200] if response else "AI 响应解析失败",
                "is_dead": False,
                "new_location": None
            }
    
    except Exception as e:
        print(f"❌ 环境交互请求处理失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/npc_dialogue")
async def npc_dialogue(request: NPCDialogueRequest):
    """NPC 对话 - 模拟 NPC 回应"""
    import re
    print(f"💬 NPC 对话: {request.npc_name}, 玩家={request.player_name}")
    
    character = load_character(request.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")
    
    if character["status"].get("is_dead"):
        return {"description": "你已经死亡，无法对话。"}
    
    # 加载任务数据
    tasks_data = load_tasks(request.character_id)
    active_tasks = tasks_data.get("active_tasks", [])
    
    worldview = get_world_worldview()
    
    # 获取 NPC 数据
    from ..world_manager import get_npcs_dir
    npc_index_path = get_npcs_dir() / "npc_index.json"
    npc_data = None
    if npc_index_path.exists():
        with open(npc_index_path, 'r', encoding='utf-8') as f:
            npc_index = json.load(f)
            for npc in npc_index.get("npcs", []):
                if npc.get("id") == request.npc_id:
                    npc_data = npc
                    break
    
    npc_profile = npc_data.get("profile", {}) if npc_data else {}
    npc_info = f"- 名称：{request.npc_name}\n"
    npc_info += f"- 身份：{npc_profile.get('identity', '普通人')}\n"
    npc_info += f"- 性格：{npc_profile.get('personality', '未知')}\n"
    npc_info += f"- 背景：{npc_profile.get('background', '未知')}"
    
    profile = character.get("profile", {})
    player_info = f"- 名称：{request.player_name}\n"
    player_info += f"- 身份：{profile.get('identity', '旅行者')}\n"
    player_info += f"- 外貌：{profile.get('appearance', '普通')}\n"
    player_info += f"- 性格：{profile.get('personality', '平和')}"
    
    history_text = format_history_for_ai(request.history)
    scene_npcs_info = format_npcs_for_ai(request.scene_npcs) if request.scene_npcs else "（没有其他人在场）"
    current_relationships = get_current_relationships(character)
    
    # 格式化任务信息供 AI 使用
    active_tasks_text = ""
    if active_tasks:
        task_list = []
        for task in active_tasks:
            task_list.append(f"- ID: {task.get('id')} | 任务名称: {task.get('name')} | 描述: {task.get('description')} | 优先级: {task.get('priority', 100)}")
        active_tasks_text = "\n".join(task_list)
    else:
        active_tasks_text = "（无活跃任务）"
    
    # 解析用户输入（可能包含动作和语言）
    user_input_text = request.user_input
    action = ""
    speech = ""
    
    # 解析 【动作】xxx 和 【语言】"xxx" 格式
    if '【动作】' in user_input_text:
        action_match = re.search(r'【动作】(.*?)(?:\n|$)', user_input_text)
        if action_match:
            action = action_match.group(1).strip()
    
    if '【语言】' in user_input_text:
        speech_match = re.search(r'【语言】"(.*?)"', user_input_text)
        if speech_match:
            speech = speech_match.group(1).strip()
        else:
            # 如果没有引号，尝试直接提取
            speech_match2 = re.search(r'【语言】(.*?)(?:\n|$)', user_input_text)
            if speech_match2:
                speech = speech_match2.group(1).strip()
    
    # 如果没有解析到动作和语言，使用原始输入
    if not action and not speech:
        speech = user_input_text
    
    # 构建发送给 AI 的用户输入文本
    if request.is_greeting:
        user_input_display = f"（{request.player_name} 开始与 {request.npc_name} 对话）"
    elif request.is_continue:
        user_input_display = "[玩家没有说话，等待NPC继续]"
    else:
        if action and speech:
            user_input_display = f"（动作：{action}）对 {request.npc_name} 说：\"{speech}\""
        elif action:
            user_input_display = f"（动作：{action}）"
        elif speech:
            user_input_display = f"对 {request.npc_name} 说：\"{speech}\""
        else:
            user_input_display = user_input_text
    
    prompt_template = load_prompt("npc_dialogue.txt")
    if not prompt_template:
        return {"description": f"{request.npc_name}：你好啊。"}
    
    time_info = character.get("time", {})
    current_hour = time_info.get("current_hour", 0)
    
    prompt = prompt_template.format(
        world_setting=worldview,
        npc_info=npc_info,
        player_info=player_info,
        scene=request.scene,
        scene_npcs=scene_npcs_info,
        history_text=history_text,
        user_input=user_input_display,
        npc_name=request.npc_name,
        current_relationships=current_relationships,
        active_tasks=active_tasks_text
    )
    if DEBUG:
        print("\n" + "="*80)
        print("📤 [NPC对话] 发送给AI的Prompt:")
        print("="*80)
        print(prompt)
        print("="*80)

    response = call_ai(prompt, temperature=0.8)

    if DEBUG:
        print("\n" + "="*80)
        print("📥 [NPC对话] AI原始响应:")
        print("="*80)
        print(response)
        print("="*80)
    cleaned = clean_json_response(response)
    
    try:
        result = json.loads(cleaned)
        description = result.get("description", response)
        exit_dialogue = result.get("exit_dialogue", False)
        relationship_update = result.get("relationship_update")
        
        if relationship_update and isinstance(relationship_update, str) and relationship_update.strip():
            update_relationships(character, relationship_update, current_hour)
            save_character(request.character_id, character)
        
        # 处理任务更新
        task_updates = result.get("task_updates", [])
        if task_updates:
            tasks_updated = False
            for update in task_updates:
                task_id = update.get("task_id")
                action_type = update.get("action")
                info = update.get("info", "")
                
                if action_type == "update" or action_type == "complete":
                    # 更新活跃任务，保持原有的 priority
                    for task in active_tasks:
                        if task.get("id") == task_id:
                            task["description"] = info
                            tasks_updated = True
                            break
                    
                    # 如果是完成状态，移动到已完成列表
                    if action_type == "complete":
                        completed_task = None
                        for i, task in enumerate(active_tasks):
                            if task.get("id") == task_id:
                                completed_task = active_tasks.pop(i)
                                completed_task["completed_at"] = datetime.now().isoformat()
                                completed_task["completion_description"] = info
                                tasks_updated = True
                                break
                        
                        if completed_task:
                            tasks_data["completed_tasks"].append(completed_task)
                
                elif action_type == "add":
                    # 添加新任务
                    priority = update.get("priority", 100)
                    priority = max(1, min(1000, priority))
                    new_task = {
                        "id": f"task_{int(datetime.now().timestamp())}_{len(active_tasks)}",
                        "name": update.get("name", "新任务"),
                        "description": info,
                        "priority": priority,
                        "created_at": datetime.now().isoformat(),
                        "source": "npc_dialogue"
                    }
                    active_tasks.append(new_task)
                    tasks_updated = True
                
                elif action_type == "update_priority":
                    # 更新任务优先级
                    for task in active_tasks:
                        if task.get("id") == task_id:
                            new_priority = update.get("priority", 100)
                            new_priority = max(1, min(1000, new_priority))
                            task["priority"] = new_priority
                            tasks_updated = True
                            print(f"📋 任务优先级已更新: {task.get('name')} -> {new_priority}")
                            break
            
            # 按优先级排序活跃任务
            if tasks_updated:
                active_tasks.sort(key=lambda x: x.get("priority", 100))
                tasks_data["active_tasks"] = active_tasks
                save_tasks(request.character_id, tasks_data)
                print(f"📋 任务数据已更新 (NPC对话)")
        
        if description and description.strip().startswith('{') and '"description"' in description:
            try:
                inner_result = json.loads(description)
                description = inner_result.get("description", description)
                exit_dialogue = inner_result.get("exit_dialogue", exit_dialogue)
            except:
                pass
        
        return {
            "description": description,
            "exit_dialogue": exit_dialogue
        }
    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析失败: {e}")
        print(f"原始响应: {response}")
        print(f"清理后: {cleaned}")
        # 尝试修复常见问题：确保键名用双引号
        import re
        # 尝试修复：将不带引号的键名加上引号
        fixed = re.sub(r'([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', cleaned)
        try:
            result = json.loads(fixed)
            print("✅ 自动修复成功")
        except:
            # 返回默认响应，不让前端出错
            return {
                "description": "（AI抽疯）‘抱歉，刚才走神了。你说了什么？’",
                "exit_dialogue": False
            }

@router.post("/system_helper")
async def system_helper(request: SystemHelperRequest):
    """系统助手 - 帮助菜单（支持独立历史）"""
    print(f"🤖 系统助手查询: {request.query}")
    
    character = load_character(request.character_id) if request.character_id else None
    character_id = request.character_id
    
    # 加载任务数据
    tasks_data = {}
    active_tasks = []
    if character_id:
        tasks_data = load_tasks(character_id)
        active_tasks = tasks_data.get("active_tasks", [])
    
    worldview = request.extra_context.get("worldview") if request.extra_context else None
    if not worldview:
        worldview = get_world_worldview()
    
    locations_data = request.extra_context.get("locations") if request.extra_context else None
    if not locations_data:
        lm = get_location_manager(get_locations_dir())
        all_locations = lm.get_all_locations()
        locations_data = format_locations_for_api(all_locations)
    
    npcs_data = request.extra_context.get("npcs") if request.extra_context else None
    if not npcs_data:
        from ..world_manager import get_npcs_dir
        npc_index_path = get_npcs_dir() / "npc_index.json"
        if npc_index_path.exists():
            with open(npc_index_path, 'r', encoding='utf-8') as f:
                npc_index = json.load(f)
                npcs_data = npc_index.get("npcs", [])
    
    system_history = []
    if character_id and character:
        system_history = character.get("system_helper_history", [])
    
    recent_history = system_history[-10:] if system_history else []
    history_text = format_system_helper_history(recent_history)
    current_relationships = get_current_relationships(character) if character else ""
    
    # 格式化任务信息供 AI 使用（包含 task_id）
    active_tasks_text = ""
    if active_tasks:
        task_list = []
        for task in active_tasks:
            task_list.append(f"- ID: {task.get('id')} | 名称: [{task.get('name')}] | 描述: {task.get('description')} | 优先级: {task.get('priority', 100)}")
        active_tasks_text = "\n".join(task_list)
    else:
        active_tasks_text = "（无活跃任务）"
    
    all_info = {
        "name": request.player_name,
        "identity": request.player_identity,
        "current_scene": request.current_scene,
        "resources": request.resources,
        "reputation": request.reputation,
        "unlocked_locations": request.unlocked_locations,
        "current_goals": request.current_goals,
        "active_tasks": active_tasks_text,
        "relationships": current_relationships,
        "extra": request.extra_context
    }
    all_info_str = json.dumps(all_info, ensure_ascii=False, indent=2)
    locations_str = json.dumps(locations_data, ensure_ascii=False, indent=2)
    npcs_str = json.dumps(npcs_data, ensure_ascii=False, indent=2)
    
    prompt_template = load_prompt("system_helper.txt")
    if not prompt_template:
        prompt_template = """你是系统助手。{query}"""
    
    prompt = prompt_template.format(
        world_setting=worldview,
        all_info=all_info_str,
        locations_info=locations_str,
        npcs_info=npcs_str,
        history_text=history_text,
        query=request.query
    )
    
    response = call_ai(prompt, temperature=0.7)
    cleaned = clean_json_response(response)
    
    task_generated = False
    new_task = None
    
    try:
        result = json.loads(cleaned)
        description = result.get("description", response[:200])
        task_generated = result.get("task_generated", False)
        new_task = result.get("task")
        
        # 注意：这里不再自动保存任务
        # 只返回任务信息，让前端确认
        
    except json.JSONDecodeError:
        description = response[:200] if response else "系统助手无法处理你的请求"
        task_generated = False
        new_task = None
    
    if character_id and character:
        character = load_character(character_id)
        if character:
            system_history = character.get("system_helper_history", [])
            system_history.append({
                "role": "user",
                "content": request.query,
                "timestamp": datetime.now().isoformat()
            })
            system_history.append({
                "role": "assistant",
                "content": description,
                "timestamp": datetime.now().isoformat()
            })
            if len(system_history) > 20:
                system_history = system_history[-20:]
            character["system_helper_history"] = system_history
            save_character(character_id, character)
    
    return {
        "description": description,
        "task_generated": task_generated,
        "task": new_task,
        "task_data": new_task
    }

@router.post("/append_conversation")
async def append_conversation(request: AppendConversationRequest):
    """添加对话记录"""
    character = load_character(request.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="角色不存在")
    
    time_info = character.get("time", {})
    current_hour = time_info.get("current_hour", 0)
    
    entry = {
        "speaker": request.speaker,
        "content": request.content,
        "scene": request.scene,
        "is_dead": request.is_dead,
        "timestamp": datetime.now().isoformat(),
        "game_hour": current_hour
    }
    
    character.setdefault("conversation_history", []).append(entry)
    
    if len(character["conversation_history"]) > 500:
        character["conversation_history"] = character["conversation_history"][-500:]
    
    save_character(request.character_id, character)
    
    return {"status": "ok"}


# ========== 辅助函数 ==========
def format_locations_for_api(all_locations: Dict):
    """将 Location 对象格式化为 API 可返回的字典"""
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


def format_system_helper_history(history: List[Dict], max_count: int = 5) -> str:
    """格式化系统助手历史供 AI 使用"""
    if not history:
        return "（无历史记录）"
    
    lines = []
    for h in history[-max_count*2:]:
        role = "用户" if h.get("role") == "user" else "助手"
        content = h.get("content", "")
        lines.append(f"{role}：{content}")
    
    return "\n".join(lines)


@router.get("/test_ai")
async def test_ai():
    """测试 AI API 是否配置正确"""
    try:
        response = call_ai("请回复：OK", temperature=0.5)
        if response and len(response) > 0:
            return {
                "success": True,
                "message": "AI API 正常工作",
                "response_preview": response[:100]
            }
        else:
            return {
                "success": False,
                "message": "AI API 返回空响应"
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"AI API 调用失败: {str(e)}"
        }
    
@router.get("/tasks")
async def get_tasks(character_id: str):
    """获取角色的任务数据"""
    from ..world_manager import load_tasks
    
    tasks_data = load_tasks(character_id)
    return {
        "active_tasks": tasks_data.get("active_tasks", []),
        "completed_tasks": tasks_data.get("completed_tasks", [])
    }

@router.post("/add_task")
async def add_task(request: dict):
    """添加新任务（玩家确认后）"""
    from ..world_manager import load_tasks, save_tasks
    from datetime import datetime
    
    character_id = request.get("character_id")
    task_info = request.get("task", {})
    
    if not character_id or not task_info:
        raise HTTPException(status_code=400, detail="缺少必要参数")
    
    tasks_data = load_tasks(character_id)
    active_tasks = tasks_data.get("active_tasks", [])
    
    # 获取优先级，默认100
    priority = task_info.get("priority", 100)
    # 确保优先级在1-1000范围内
    priority = max(1, min(1000, priority))
    
    # 创建新任务
    new_task = {
        "id": f"task_{int(datetime.now().timestamp())}_{len(active_tasks)}",
        "name": task_info.get("name", "新任务"),
        "description": task_info.get("description", ""),
        "priority": priority,
        "created_at": datetime.now().isoformat(),
        "source": task_info.get("source", "system_helper")
    }
    
    active_tasks.append(new_task)
    # 按优先级排序（数值越小越优先）
    active_tasks.sort(key=lambda x: x.get("priority", 100))
    tasks_data["active_tasks"] = active_tasks
    save_tasks(character_id, tasks_data)
    
    print(f"📋 新任务已添加: {new_task['name']} (优先级: {priority})")
    
    return {"status": "ok", "task": new_task}


@router.post("/observe_npc")
async def observe_npc(request: dict):
    """静默观察NPC - 不触发NPC反应"""
    import json
    
    character_id = request.get("character_id")
    npc_name = request.get("npc_name")
    scene = request.get("scene")
    
    if not character_id or not npc_name:
        raise HTTPException(status_code=400, detail="缺少必要参数")
    
    # 获取角色信息（用于获取关系）
    character = load_character(character_id)
    current_relationships = get_current_relationships(character) if character else ""
    
    # 获取世界观
    worldview = get_world_worldview()
    
    # 获取NPC信息
    from ..world_manager import get_npcs_dir
    npc_index_path = get_npcs_dir() / "npc_index.json"
    npc_info = ""
    if npc_index_path.exists():
        with open(npc_index_path, 'r', encoding='utf-8') as f:
            npc_index = json.load(f)
            for npc in npc_index.get("npcs", []):
                if npc.get("name") == npc_name or npc.get("id") == npc_name:
                    profile = npc.get("profile", {})
                    npc_info = f"- 名称：{npc.get('name')}\n"
                    npc_info += f"- 身份：{profile.get('identity', '未知')}\n"
                    npc_info += f"- 描述：{profile.get('description', '暂无详细描述')}"
                    break
    
    # 加载 prompt 模板
    prompt_template = load_prompt("observe_npc.txt")
    if not prompt_template:
        prompt_template = """{"description": "你静静地观察着{npc_name}，但没有发现什么特别之处。"}"""
    
    prompt = prompt_template.format(
        world_setting=worldview,
        scene=scene,
        npc_info=npc_info if npc_info else "（没有其他人在场）",
        current_relationships=current_relationships if current_relationships else "（无特殊关系）",
        npc_name=npc_name
    )
    
    # 调用AI
    response = call_ai(prompt, temperature=0.5)
    cleaned = clean_json_response(response)
    
    try:
        result = json.loads(cleaned)
        description = result.get("description", f"你静静地观察着{npc_name}，但没有发现什么特别之处。")
    except json.JSONDecodeError:
        description = f"你静静地观察着{npc_name}，但没有发现什么特别之处。"
    
    return {"description": description}

@router.post("/delete_task")
async def delete_task(request: dict):
    """删除任务（移动到 removed_tasks）"""
    from ..world_manager import load_tasks, save_tasks
    from datetime import datetime
    
    character_id = request.get("character_id")
    task_id = request.get("task_id")
    
    if not character_id or not task_id:
        raise HTTPException(status_code=400, detail="缺少必要参数")
    
    tasks_data = load_tasks(character_id)
    active_tasks = tasks_data.get("active_tasks", [])
    removed_tasks = tasks_data.get("removed_tasks", [])
    
    # 查找并移动任务
    removed_task = None
    for i, task in enumerate(active_tasks):
        if task.get("id") == task_id:
            removed_task = active_tasks.pop(i)
            break
    
    if removed_task:
        removed_task["removed_at"] = datetime.now().isoformat()
        removed_task["removed_reason"] = "user_deleted"
        removed_tasks.append(removed_task)
        tasks_data["active_tasks"] = active_tasks
        tasks_data["removed_tasks"] = removed_tasks
        save_tasks(character_id, tasks_data)
        print(f"🗑️ 任务已删除: {removed_task.get('name')} (移动到 removed_tasks)")
        return {"status": "ok", "message": "任务已删除"}
    else:
        raise HTTPException(status_code=404, detail="任务不存在")

@router.post("/test_ai_with_key")
async def test_ai_with_key(request: dict):
    """使用用户提供的 API Key 测试连接"""
    from openai import OpenAI
    from ..config import DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
    
    api_key = request.get("api_key")
    if not api_key:
        return {"success": False, "message": "未提供 API Key"}
    
    try:
        # 使用与 test_ai 完全相同的方式创建 client
        client = OpenAI(
            api_key=api_key,
            base_url=DEEPSEEK_BASE_URL
        )
        
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[{"role": "user", "content": "请回复：OK"}],
            temperature=0.5
        )
        
        if response.choices and response.choices[0].message.content:
            return {"success": True, "message": "连接成功"}
        else:
            return {"success": False, "message": "API 返回异常"}
            
    except Exception as e:
        print(f"测试 API Key 错误: {type(e).__name__}: {e}")
        return {"success": False, "message": f"错误: {str(e)}"}

