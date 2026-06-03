#!/usr/bin/env python
# migrate_summaries.py - 为现有角色生成初始总结

import os
import sys
import json
import asyncio
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from backend.config import WORLDS_DIR, SUMMARIZE_CONFIG
from backend.services.summarize_service import (
    generate_level1_summary,
    generate_level2_summary,
    get_last_summary_end_index,
    should_summarize_level1,
    should_summarize_level2
)
from backend.world_manager import load_character, save_character, get_characters_dir


async def generate_initial_summaries(character, character_id, world_id=None):
    """为角色生成初始总结"""
    conversation_history = character.get("conversation_history", [])
    history_len = len(conversation_history)
    
    if history_len == 0:
        print(f"  无对话历史，跳过")
        return False
    
    print(f"  对话历史: {history_len} 条")
    
    # 生成第一层总结
    print(f"  生成第一层总结...")
    start_idx = 0
    summaries = []
    
    while start_idx < history_len:
        end_idx = min(start_idx + SUMMARIZE_CONFIG["level1_size"], history_len)
        
        # 临时添加需要总结的消息
        temp_summary = await generate_level1_summary(character, start_idx, end_idx)
        if temp_summary:
            summaries.append(temp_summary)
            print(f"    总结 {start_idx}-{end_idx-1}: {temp_summary['content'][:50]}...")
        
        start_idx = end_idx
    
    # 保存第一层总结
    if summaries:
        character["conversation_summaries"] = summaries
        print(f"  生成了 {len(summaries)} 个阶段总结")
    
    # 生成第二层总结
    if len(summaries) >= SUMMARIZE_CONFIG["level2_size"]:
        print(f"  生成第二层总结...")
        high_summaries = []
        summary_idx = 0
        
        while summary_idx < len(summaries):
            end_idx = min(summary_idx + SUMMARIZE_CONFIG["level2_size"], len(summaries))
            summary_ids = [s["id"] for s in summaries[summary_idx:end_idx]]
            
            temp_high = await generate_level2_summary(character, summary_ids)
            if temp_high:
                high_summaries.append(temp_high)
                print(f"    高层总结 {summary_idx}-{end_idx-1}: {temp_high['content'][:50]}...")
            
            summary_idx = end_idx
        
        if high_summaries:
            character["high_level_summaries"] = high_summaries
            print(f"  生成了 {len(high_summaries)} 个高层总结")
    
    return True


async def process_all_characters():
    """处理所有世界中的所有角色"""
    print("=" * 60)
    print("开始为现有角色生成初始总结")
    print("=" * 60)
    
    # 遍历所有世界
    if not WORLDS_DIR.exists():
        print(f"世界目录不存在: {WORLDS_DIR}")
        return
    
    total_characters = 0
    total_processed = 0
    
    for world_dir in WORLDS_DIR.iterdir():
        if not world_dir.is_dir():
            continue
        
        world_id = world_dir.name
        characters_dir = world_dir / "sessions" / "characters"
        
        if not characters_dir.exists():
            continue
        
        print(f"\n📁 世界: {world_id}")
        
        # 遍历角色文件
        for char_file in characters_dir.glob("*.json"):
            # 跳过任务文件和历史文件
            if "_tasks" in char_file.name or "_history" in char_file.name:
                continue
            
            character_id = char_file.stem
            print(f"\n  👤 角色: {character_id}")
            
            try:
                character = load_character(character_id, world_id)
                if not character:
                    print(f"    无法加载角色")
                    continue
                
                # 检查是否已有总结
                if character.get("conversation_summaries") or character.get("high_level_summaries"):
                    print(f"    已有总结，跳过")
                    continue
                
                total_characters += 1
                
                # 生成总结
                success = await generate_initial_summaries(character, character_id, world_id)
                
                if success:
                    # 保存角色
                    save_character(character_id, character, world_id)
                    total_processed += 1
                    print(f"    ✅ 总结已保存")
                else:
                    print(f"    ⚠️ 无需总结")
                    
            except Exception as e:
                print(f"    ❌ 处理失败: {e}")
                import traceback
                traceback.print_exc()
    
    print("\n" + "=" * 60)
    print(f"处理完成！")
    print(f"  总角色数: {total_characters}")
    print(f"  已生成总结: {total_processed}")
    print("=" * 60)


async def process_single_character(character_id, world_id=None):
    """处理单个角色"""
    print(f"处理角色: {character_id}")
    
    character = load_character(character_id, world_id)
    if not character:
        print(f"角色不存在: {character_id}")
        return False
    
    if character.get("conversation_summaries") or character.get("high_level_summaries"):
        print(f"角色已有总结，跳过")
        return False
    
    success = await generate_initial_summaries(character, character_id, world_id)
    
    if success:
        save_character(character_id, character, world_id)
        print(f"✅ 总结已保存")
        return True
    
    return False


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="为现有角色生成初始总结")
    parser.add_argument("--character", type=str, help="指定角色ID（可选）")
    parser.add_argument("--world", type=str, help="指定世界ID（可选）")
    
    args = parser.parse_args()
    
    if args.character:
        # 处理单个角色
        asyncio.run(process_single_character(args.character, args.world))
    else:
        # 处理所有角色
        asyncio.run(process_all_characters())