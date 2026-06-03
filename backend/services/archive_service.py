# backend/services/archive_service.py
# 历史归档服务 - 将旧对话归档到独立文件

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

from backend.world_manager import get_characters_dir


def get_archive_path(character_id: str, world_id: str = None) -> Path:
    """获取归档文件路径"""
    characters_dir = get_characters_dir(world_id)
    return characters_dir / f"{character_id}_history_archive.json"


def load_archive(character_id: str, world_id: str = None) -> Dict:
    """加载归档数据"""
    archive_path = get_archive_path(character_id, world_id)
    if archive_path.exists():
        try:
            with open(archive_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print(f"⚠️ 归档文件损坏，创建新归档: {archive_path}")
            return get_default_archive(character_id)
    return get_default_archive(character_id)


def get_default_archive(character_id: str) -> Dict:
    """获取默认归档数据结构"""
    return {
        "version": "1.0",
        "character_id": character_id,
        "created_at": datetime.now().isoformat(),
        "archives": [],
        "total_messages": 0
    }


def save_archive(character_id: str, data: Dict, world_id: str = None):
    """保存归档数据"""
    archive_path = get_archive_path(character_id, world_id)
    with open(archive_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def archive_old_messages(character: Dict, character_id: str, world_id: str = None, 
                         keep_count: int = 500) -> bool:
    """
    将超出保留数量的旧消息归档
    
    Args:
        character: 角色数据
        character_id: 角色ID
        world_id: 世界ID
        keep_count: 保留的最新消息数量
    
    Returns:
        是否进行了归档
    """
    history = character.get("conversation_history", [])
    history_len = len(history)
    
    if history_len <= keep_count:
        return False
    
    # 需要归档的消息
    archive_messages = history[:-keep_count]
    kept_messages = history[-keep_count:]
    
    # 更新角色数据
    character["conversation_history"] = kept_messages
    
    # 加载现有归档
    archive_data = load_archive(character_id, world_id)
    
    # 计算归档索引
    total_messages = archive_data.get("total_messages", 0)
    start_index = total_messages
    end_index = total_messages + len(archive_messages) - 1
    
    # 创建新归档块
    new_archive = {
        "id": f"archive_{len(archive_data['archives'])}",
        "start_index": start_index,
        "end_index": end_index,
        "messages": archive_messages,
        "summary": None,  # 待生成
        "summary_created_at": None,
        "archived_at": datetime.now().isoformat()
    }
    
    archive_data["archives"].append(new_archive)
    archive_data["total_messages"] = end_index + 1
    
    save_archive(character_id, archive_data, world_id)
    
    # 标记需要生成总结
    character["need_summarize_archive"] = True
    
    print(f"📦 已归档 {len(archive_messages)} 条消息，当前保留 {len(kept_messages)} 条")
    return True


def get_all_historical_messages(character_id: str, world_id: str = None) -> List[Dict]:
    """获取所有历史消息（包括归档）"""
    all_messages = []
    
    # 加载归档
    archive_data = load_archive(character_id, world_id)
    for archive in archive_data.get("archives", []):
        all_messages.extend(archive.get("messages", []))
    
    return all_messages


def get_archives_for_summary(character_id: str, world_id: str = None) -> List[Dict]:
    """获取需要生成总结的归档块（没有总结的）"""
    archive_data = load_archive(character_id, world_id)
    need_summary = []
    
    for archive in archive_data.get("archives", []):
        if archive.get("summary") is None:
            need_summary.append(archive)
    
    return need_summary


def get_all_archives_with_summary(character_id: str, world_id: str = None) -> List[Dict]:
    """获取所有已有总结的归档块"""
    archive_data = load_archive(character_id, world_id)
    with_summary = []
    
    for archive in archive_data.get("archives", []):
        if archive.get("summary") is not None:
            with_summary.append(archive)
    
    return with_summary


def update_archive_summary(character_id: str, archive_id: str, summary: str, 
                           world_id: str = None) -> bool:
    """更新归档块的总结"""
    archive_data = load_archive(character_id, world_id)
    
    for archive in archive_data.get("archives", []):
        if archive.get("id") == archive_id:
            archive["summary"] = summary
            archive["summary_created_at"] = datetime.now().isoformat()
            save_archive(character_id, archive_data, world_id)
            print(f"✅ 已更新归档总结: {archive_id}")
            return True
    
    print(f"⚠️ 未找到归档块: {archive_id}")
    return False


def build_historical_context(character_id: str, world_id: str = None, 
                             max_summaries: int = 5) -> str:
    """
    构建历史上下文（用于 AI）
    返回最近的 N 条总结
    """
    archive_data = load_archive(character_id, world_id)
    archives = archive_data.get("archives", [])
    
    # 只返回有总结的归档块
    with_summary = [a for a in archives if a.get("summary")]
    
    # 取最近的几条总结（按归档时间倒序）
    with_summary.reverse()
    recent_summaries = with_summary[:max_summaries]
    
    if not recent_summaries:
        return ""
    
    context = "## 历史概要\n\n"
    for i, summary in enumerate(recent_summaries, 1):
        context += f"{i}. {summary['summary']}\n"
    
    return context


def get_archive_statistics(character_id: str, world_id: str = None) -> Dict:
    """获取归档统计信息"""
    archive_data = load_archive(character_id, world_id)
    archives = archive_data.get("archives", [])
    
    total_messages = 0
    summarized_count = 0
    total_summarized_messages = 0
    
    for archive in archives:
        msg_count = len(archive.get("messages", []))
        total_messages += msg_count
        
        if archive.get("summary") is not None:
            summarized_count += 1
            total_summarized_messages += msg_count
    
    return {
        "total_archives": len(archives),
        "total_messages": total_messages,
        "summarized_archives": summarized_count,
        "summarized_messages": total_summarized_messages,
        "pending_summaries": len(archives) - summarized_count
    }


def delete_archives_for_character(character_id: str, world_id: str = None) -> bool:
    """删除角色的所有归档文件"""
    archive_path = get_archive_path(character_id, world_id)
    if archive_path.exists():
        archive_path.unlink()
        print(f"🗑️ 已删除归档文件: {archive_path}")
        return True
    return False


def migrate_character_archives(character_id: str, world_id: str = None) -> bool:
    """
    迁移角色的现有历史到归档（用于首次运行）
    将当前对话历史的一部分归档
    """
    from backend.world_manager import load_character, save_character
    
    character = load_character(character_id, world_id)
    if not character:
        print(f"❌ 角色不存在: {character_id}")
        return False
    
    # 检查是否已有归档
    archive_data = load_archive(character_id, world_id)
    if archive_data.get("archives"):
        print(f"⏭️ 角色已有归档，跳过: {character_id}")
        return False
    
    history = character.get("conversation_history", [])
    history_len = len(history)
    
    if history_len <= 500:
        print(f"⏭️ 角色历史不足500条，无需归档: {character_id} ({history_len}条)")
        return False
    
    # 归档旧消息（保留最近500条）
    result = archive_old_messages(character, character_id, world_id, keep_count=500)
    
    if result:
        save_character(character_id, character, world_id)
        print(f"✅ 角色归档完成: {character_id}")
        return True
    
    return False