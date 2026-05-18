# backend/services/relationship_service.py
# 关系系统服务 - 处理角色关系更新和历史

from typing import Dict, List


def get_current_relationships(character: Dict) -> str:
    """获取当前最新的关系状态"""
    history = character.get("relationships_history", [])
    if not history:
        return ""
    
    # 按 hour 降序排序，取最大的（最新）
    sorted_history = sorted(history, key=lambda x: x.get("hour", 0), reverse=True)
    return sorted_history[0].get("content", "")


def update_relationships(character: Dict, new_content: str, current_hour: int, max_history: int = 20):
    """更新关系历史"""
    history = character.get("relationships_history", [])
    
    # 添加新记录
    history.append({
        "hour": current_hour,
        "content": new_content,
        "timestamp": None  # 可选的额外字段
    })
    
    # 按 hour 降序排序
    history.sort(key=lambda x: x.get("hour", 0), reverse=True)
    
    # 保留最近 max_history 条
    if len(history) > max_history:
        history = history[:max_history]
    
    character["relationships_history"] = history


def rollback_relationships_to_hour(character: Dict, target_hour: int):
    """回滚关系到指定游戏时间"""
    relationships_history = character.get("relationships_history", [])
    
    if not relationships_history:
        return
    
    # 按 hour 降序排序
    sorted_history = sorted(relationships_history, key=lambda x: x.get("hour", 0), reverse=True)
    
    # 找到第一个 hour <= target_hour 的记录
    target_record = None
    for record in sorted_history:
        if record.get("hour", 0) <= target_hour:
            target_record = record
            break
    
    if target_record:
        # 保留目标记录及之后的所有记录
        new_history = [r for r in relationships_history if r.get("hour", 0) <= target_hour]
        new_history.sort(key=lambda x: x.get("hour", 0), reverse=True)
        character["relationships_history"] = new_history
    else:
        character["relationships_history"] = []
    
    print(f"🔄 关系已回滚到游戏时间 {target_hour} 之前，保留 {len(character['relationships_history'])} 条记录")