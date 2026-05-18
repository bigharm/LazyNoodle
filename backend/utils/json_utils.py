# backend/utils/json_utils.py
# JSON 处理工具函数

import json
import re


def clean_json_response(response: str) -> str:
    """清理 AI 响应，提取 JSON"""
    if not response:
        return "{}"
    
    response = response.strip()
    
    # 移除 BOM 头
    if response.startswith('\ufeff'):
        response = response[1:]
    
    # 移除 markdown 代码块
    if response.startswith("```json"):
        response = response[7:]
    elif response.startswith("```"):
        response = response[3:]
    if response.endswith("```"):
        response = response[:-3]
    
    response = response.strip()
    
    # 找到第一个 { 和最后一个 }
    first_brace = response.find('{')
    last_brace = response.rfind('}')
    
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        response = response[first_brace:last_brace + 1]
    
    # 清理控制字符（保留换行和制表符，但要小心处理）
    # 移除无效的控制字符
    response = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', response)
    
    # 修复中文引号问题（可选）
    response = response.replace('"', '"').replace('"', '"')
    response = response.replace(''', "'").replace(''', "'")
    
    return response


def safe_json_loads(response: str, default=None):
    """安全地加载 JSON，失败时返回默认值"""
    try:
        cleaned = clean_json_response(response)
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"JSON 解析错误: {e}")
        print(f"问题内容预览: {cleaned[:200] if 'cleaned' in locals() else response[:200]}")
        return default or {}

def load_json_file(file_path, default=None):
    """安全加载 JSON 文件"""
    if not file_path.exists():
        return default or {}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载 JSON 文件失败 {file_path}: {e}")
        return default or {}


def save_json_file(file_path, data):
    """安全保存 JSON 文件"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存 JSON 文件失败 {file_path}: {e}")
        return False