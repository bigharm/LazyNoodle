# backend/services/summarize_service.py
# 对话总结服务 - 多层总结压缩历史对话

import json
from datetime import datetime
from typing import List, Dict, Optional
from backend.config import SUMMARIZE_CONFIG, PROMPTS_DIR
from backend.services.ai_service import call_ai, clean_json_response
from backend.world_manager import load_character, save_character
from backend.services.archive_service import (
    get_archives_for_summary,
    update_archive_summary
)


def format_messages_for_summary(messages: List[Dict]) -> str:
    """格式化消息用于总结"""
    lines = []
    for msg in messages:
        #speaker = msg.get("speaker", "未知")
        content = msg.get("content", "")
        lines.append(f"{content}")
    return "\n".join(lines)


def get_last_summary_end_index(character: Dict) -> int:
    """获取最后一层总结的结束索引"""
    summaries = character.get("conversation_summaries", [])
    if summaries:
        return summaries[-1]["end_index"] + 1
    return 0


def get_last_high_summary_end_index(character: Dict) -> int:
    """获取最后一层高层总结覆盖的 summary 数量"""
    high_summaries = character.get("high_level_summaries", [])
    if high_summaries:
        return len(high_summaries[-1].get("summary_ids", []))
    return 0


def get_summary_prompt(level: int) -> str:
    """获取总结的 prompt 模板"""
    prompt_path = PROMPTS_DIR / f"summarize_level{level}.txt"
    if prompt_path.exists():
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    # 默认 prompt
    if level == 1:
        return """请总结以下对话的关键信息：

{content}

总结要求：
1. 只保留关键信息：地点变化、任务进展、关系变化、重要事件、物品获取
2. 忽略日常寒暄和重复对话
3. 输出控制在50-100字

输出格式（只输出JSON）：
{{"summary": "总结内容"}}
"""
    else:
        return """请总结以下内容的关键信息：

{content}

总结要求：
1. 提取最核心的事件和变化
2. 输出控制在80-150字

输出格式（只输出JSON）：
{{"summary": "总结内容"}}
"""


async def generate_level1_summary(character: Dict, start_idx: int, end_idx: int) -> Dict:
    """生成第一层总结（原始对话 → 阶段总结）"""
    target_messages = character["conversation_history"][start_idx:end_idx]
    
    if not target_messages:
        return None
    
    content = format_messages_for_summary(target_messages)
    prompt_template = get_summary_prompt(1)
    prompt = prompt_template.format(content=content)
    
    response = call_ai(prompt, temperature=0.3)
    cleaned = clean_json_response(response)
    
    try:
        result = json.loads(cleaned)
        summary_content = result.get("summary", "")
    except json.JSONDecodeError:
        print(f"❌ 总结生成失败，使用默认总结")
        summary_content = f"进行了 {len(target_messages)} 条对话，涉及多个话题。"
    
    summaries = character.get("conversation_summaries", [])
    
    return {
        "id": f"summary_{len(summaries)}",
        "level": 1,
        "start_index": start_idx,
        "end_index": end_idx - 1,
        "content": summary_content,
        "game_hour_start": target_messages[0].get("game_hour", 0) if target_messages else 0,
        "game_hour_end": target_messages[-1].get("game_hour", 0) if target_messages else 0,
        "created_at": datetime.now().isoformat()
    }


async def generate_level2_summary(character: Dict, summary_ids: List[str]) -> Dict:
    """生成第二层总结（对多个第一层总结进行再总结）"""
    # 获取唯一的 summary_ids
    unique_ids = list(dict.fromkeys(summary_ids))
    summaries = [s for s in character.get("conversation_summaries", []) if s["id"] in unique_ids]
    
    if len(summaries) < 2:
        print(f"⚠️ 阶段总结不足2条，跳过高层总结")
        return None
    
    content = "\n\n".join([s["content"] for s in summaries])
    prompt_template = get_summary_prompt(2)
    prompt = prompt_template.format(content=content)
    
    response = call_ai(prompt, temperature=0.3)
    cleaned = clean_json_response(response)
    
    try:
        result = json.loads(cleaned)
        summary_content = result.get("summary", "")
    except json.JSONDecodeError:
        print(f"❌ 高层总结生成失败")
        summary_content = f"综合了 {len(summaries)} 个阶段的进展。"
    
    high_summaries = character.get("high_level_summaries", [])
    
    return {
        "id": f"high_summary_{len(high_summaries)}",
        "level": 2,
        "summary_ids": unique_ids,  # 使用去重后的 ID 列表
        "start_index": summaries[0]["start_index"],
        "end_index": summaries[-1]["end_index"],
        "content": summary_content,
        "created_at": datetime.now().isoformat()
    }

def should_summarize_level1(character: Dict) -> bool:
    """判断是否需要触发第一层总结"""
    history_len = len(character.get("conversation_history", []))
    last_summary_end = get_last_summary_end_index(character)
    
    return history_len - last_summary_end >= SUMMARIZE_CONFIG["level1_size"]


def should_summarize_level2(character: Dict) -> bool:
    """判断是否需要触发第二层总结"""
    level1_count = len(character.get("conversation_summaries", []))
    last_high_end = get_last_high_summary_end_index(character)
    
    # 需要足够的阶段总结才能进行高层总结
    if level1_count < SUMMARIZE_CONFIG.get("level2_size", 10):
        return False
    
    return level1_count - last_high_end >= SUMMARIZE_CONFIG["level2_size"]

async def update_summaries(character_id: str) -> Dict:
    """更新角色的所有总结（在每次 AI 响应后调用）"""
    character = load_character(character_id)
    if not character:
        return None
    
    updated = False
    
    # 1. 检查是否需要第一层总结
    if should_summarize_level1(character):
        last_end = get_last_summary_end_index(character)
        current_len = len(character["conversation_history"])
        
        # 计算需要总结的范围
        start_idx = last_end
        end_idx = min(start_idx + SUMMARIZE_CONFIG["level1_size"], current_len)
        
        if start_idx < end_idx:
            print(f"📝 生成第一层总结: 索引 {start_idx} - {end_idx-1}")
            new_summary = await generate_level1_summary(character, start_idx, end_idx)
            if new_summary:
                character.setdefault("conversation_summaries", []).append(new_summary)
                updated = True
    
    # 2. 检查是否需要第二层总结
    if should_summarize_level2(character):
        level1_summaries = character.get("conversation_summaries", [])
        # 获取需要再总结的 summary ids（最近 level2_size 条）
        recent_summaries = level1_summaries[-SUMMARIZE_CONFIG["level2_size"]:]
        summary_ids = [s["id"] for s in recent_summaries]
        
        if summary_ids:
            print(f"📝 生成第二层总结: 覆盖 {len(summary_ids)} 个阶段总结")
            high_summary = await generate_level2_summary(character, summary_ids)
            if high_summary:
                character.setdefault("high_level_summaries", []).append(high_summary)
                updated = True
    
    # 保存更新
    if updated:
        save_character(character_id, character)
        print(f"✅ 总结已更新: {character_id}")
    
    return character


def build_ai_context(character: Dict) -> str:
    """构建发送给 AI 的历史上下文"""
    context_parts = []
    
    # 1. 高层总结（所有）
    high_summaries = character.get("high_level_summaries", [])
    if high_summaries:
        context_parts.append("## 历史概要")
        for hs in high_summaries:
            context_parts.append(f"- {hs['content']}")
        context_parts.append("")
    
    # 2. 最近的第一层总结（保留最近 keep_recent_summaries 条）
    level1_summaries = character.get("conversation_summaries", [])
    keep_count = SUMMARIZE_CONFIG.get("keep_recent_summaries", 1)
    recent_summaries = level1_summaries[-keep_count:] if keep_count > 0 else []
    
    if recent_summaries:
        context_parts.append("## 近期进展")
        for rs in recent_summaries:
            context_parts.append(rs['content'])
            context_parts.append("")
    
    # 3. 最近的原始对话
    history = character.get("conversation_history", [])
    keep_recent = SUMMARIZE_CONFIG.get("keep_recent_count", 30)
    recent_messages = history[-keep_recent:] if keep_recent > 0 else []
    
    if recent_messages:
        context_parts.append("## 最近对话")
        for msg in recent_messages:
            #speaker = msg.get("speaker", "未知")
            content = msg.get("content", "")
            context_parts.append(f"{content}")
        context_parts.append("")
    
    return "\n".join(context_parts)


def clean_summaries_after_delete(character: Dict, from_index: int) -> Dict:
    """删除历史后，清理受影响的总结"""
    # 删除受影响的阶段总结（end_index >= from_index）
    original_count = len(character.get("conversation_summaries", []))
    character["conversation_summaries"] = [
        s for s in character.get("conversation_summaries", [])
        if s["end_index"] < from_index
    ]
    removed_level1 = original_count - len(character["conversation_summaries"])
    
    # 删除受影响的第二层总结（包含被删除的 summary_ids）
    valid_summary_ids = [s["id"] for s in character.get("conversation_summaries", [])]
    high_original = len(character.get("high_level_summaries", []))
    character["high_level_summaries"] = [
        h for h in character.get("high_level_summaries", [])
        if all(sid in valid_summary_ids for sid in h.get("summary_ids", []))
    ]
    removed_level2 = high_original - len(character.get("high_level_summaries", []))
    
    if removed_level1 > 0 or removed_level2 > 0:
        print(f"🗑️ 清理总结: 删除了 {removed_level1} 个阶段总结, {removed_level2} 个高层总结")
    
    return character