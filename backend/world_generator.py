# backend/world_generator.py

import json
import time
from pathlib import Path
from typing import Dict, Optional

from backend.world_manager import (
    get_current_world_path,
    get_world_worldview,
    get_locations_dir,
    get_npcs_dir,
    save_timeline,
    get_default_locations,
    get_default_npcs,
    get_default_timeline
)
from backend.config import PROMPTS_DIR
from backend.services.ai_service import call_ai, clean_json_response


def _load_prompt(prompt_name: str) -> str:
    """加载 prompt 模板"""
    prompt_path = PROMPTS_DIR / prompt_name
    if prompt_path.exists():
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    return ""


def save_locations(locations_data: Dict):
    """保存地点数据"""
    locations_dir = get_locations_dir()
    base_file = locations_dir / "location_base.json"
    
    with open(base_file, 'w', encoding='utf-8') as f:
        json.dump(locations_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 地点数据已保存: {base_file}")
    return len(locations_data.get("locations", []))


def save_npcs(npcs_data: Dict):
    """保存 NPC 数据"""
    npcs_dir = get_npcs_dir()
    npc_file = npcs_dir / "npc_index.json"
    
    npc_index = {
        "npcs": npcs_data.get("npcs", []),
        "generated_chapters": [],
        "version": "2.0",
        "last_updated": None
    }
    
    with open(npc_file, 'w', encoding='utf-8') as f:
        json.dump(npc_index, f, ensure_ascii=False, indent=2)
    
    print(f"✅ NPC 数据已保存: {npc_file}")
    return len(npcs_data.get("npcs", []))


async def generate_locations_from_worldview() -> Dict:
    """根据世界观生成初始地点库"""
    worldview = get_world_worldview()
    prompt_template = _load_prompt("generate_locations.txt")
    
    if not prompt_template:
        print("⚠️ 找不到 generate_locations.txt，使用默认地点数据")
        return get_default_locations()
    
    prompt = prompt_template.format(world_setting=worldview)
    
    for attempt in range(3):
        try:
            print(f"📤 生成地点库 (尝试 {attempt + 1}/3)...")
            response = call_ai(prompt, temperature=0.5)
            cleaned = clean_json_response(response)
            data = json.loads(cleaned)
            
            if "regions" in data and "locations" in data:
                print(f"✅ 地点库生成成功: {len(data.get('regions', []))} 个区域, {len(data.get('locations', []))} 个地点")
                return data
            else:
                print(f"⚠️ AI 返回数据格式不完整: {data.keys()}")
                
        except json.JSONDecodeError as e:
            print(f"❌ JSON 解析失败 (尝试 {attempt + 1}): {e}")
            if attempt < 2:
                time.sleep(2)
        except Exception as e:
            print(f"❌ AI 调用失败 (尝试 {attempt + 1}): {e}")
            if attempt < 2:
                time.sleep(2)
    
    print("⚠️ AI 生成地点失败，使用默认地点数据")
    return get_default_locations()


async def generate_npcs_from_worldview(locations_data: Dict) -> Dict:
    """根据世界观和地点库生成 NPC"""
    worldview = get_world_worldview()
    
    locations_text = ""
    for region in locations_data.get("regions", []):
        region_id = region.get("id")
        region_name = region.get("name")
        locations_text += f"\n【区域】id: {region_id}, name: {region_name}\n"
        
        # 列出该区域下的场景
        for loc in locations_data.get("locations", []):
            if loc.get("parent") == region_id:
                loc_id = loc.get("id")
                loc_name = loc.get("name")
                locations_text += f"  - 场景 id: {loc_id}, name: {loc_name}\n"
    
    locations_text = locations_text if locations_text else "（无地点信息）"
    print(f"📍 地点概览:\n{locations_text}")
    
    prompt_template = _load_prompt("generate_npcs.txt")
    
    if not prompt_template:
        print("⚠️ 找不到 generate_npcs.txt，使用默认 NPC 数据")
        return get_default_npcs()
    
    prompt = prompt_template.format(
        world_setting=worldview,
        locations=locations_text
    )
    
    for attempt in range(3):
        try:
            print(f"📤 生成 NPC (尝试 {attempt + 1}/3)...")
            response = call_ai(prompt, temperature=0.6)
            cleaned = clean_json_response(response)
            data = json.loads(cleaned)
            
            if "npcs" in data:
                print(f"✅ NPC 生成成功: {len(data.get('npcs', []))} 个 NPC")
                return data
            else:
                print(f"⚠️ AI 返回数据缺少 npcs 字段")
                
        except json.JSONDecodeError as e:
            print(f"❌ JSON 解析失败 (尝试 {attempt + 1}): {e}")
            if attempt < 2:
                time.sleep(2)
        except Exception as e:
            print(f"❌ AI 调用失败 (尝试 {attempt + 1}): {e}")
            if attempt < 2:
                time.sleep(2)
    
    print("⚠️ AI 生成 NPC 失败，使用默认 NPC 数据")
    return get_default_npcs()


async def generate_timeline_from_worldview() -> Dict:
    """根据世界观生成时间线"""
    worldview = get_world_worldview()
    prompt_template = _load_prompt("generate_timeline.txt")
    
    if not prompt_template:
        print("⚠️ 找不到 generate_timeline.txt，使用默认时间线")
        return get_default_timeline()
    
    prompt = prompt_template.format(world_setting=worldview)
    
    for attempt in range(3):
        try:
            print(f"📤 生成时间线 (尝试 {attempt + 1}/3)...")
            response = call_ai(prompt, temperature=0.5)
            cleaned = clean_json_response(response)
            data = json.loads(cleaned)
            
            if "milestones" in data:
                print(f"✅ 时间线生成成功: {len(data.get('milestones', []))} 个里程碑")
                return data
            else:
                print(f"⚠️ AI 返回数据缺少 milestones 字段")
                
        except json.JSONDecodeError as e:
            print(f"❌ JSON 解析失败 (尝试 {attempt + 1}): {e}")
            if attempt < 2:
                time.sleep(2)
        except Exception as e:
            print(f"❌ AI 调用失败 (尝试 {attempt + 1}): {e}")
            if attempt < 2:
                time.sleep(2)
    
    print("⚠️ AI 生成时间线失败，使用默认时间线")
    return get_default_timeline()


async def generate_world_data() -> Dict:
    """生成完整的初始世界数据（地点 + NPC + 时间线）"""
    print("\n" + "="*60)
    print("🌍 开始生成世界数据...")
    print("="*60)
    
    results = {
        "locations_count": 0,
        "npcs_count": 0,
        "timeline_milestones": 0,
        "fallback_used": False
    }
    
    print("\n📍 步骤 1/3: 生成地点库...")
    locations_data = await generate_locations_from_worldview()
    results["locations_count"] = save_locations(locations_data)
    
    print("\n👤 步骤 2/3: 生成 NPC...")
    npcs_data = await generate_npcs_from_worldview(locations_data)
    results["npcs_count"] = save_npcs(npcs_data)
    
    print("\n⏰ 步骤 3/3: 生成时间线...")
    timeline_data = await generate_timeline_from_worldview()
    save_timeline(timeline_data)
    results["timeline_milestones"] = len(timeline_data.get("milestones", []))
    
    if locations_data == get_default_locations() or npcs_data == get_default_npcs():
        results["fallback_used"] = True
        print("\n⚠️ 注意：部分数据使用了默认值（AI 生成失败）")
    
    print("\n" + "="*60)
    print("✅ 世界数据生成完成！")
    print(f"   📍 地点: {results['locations_count']} 个")
    print(f"   👤 NPC: {results['npcs_count']} 个")
    print(f"   ⏰ 里程碑: {results['timeline_milestones']} 个")
    print("="*60 + "\n")
    
    return results