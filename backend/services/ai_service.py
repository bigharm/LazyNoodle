# backend/services/ai_service.py
# AI 调用服务 - 封装所有 AI 相关操作

import json
import re
from openai import OpenAI
from backend.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, DEFAULT_TEMPERATURE


def clean_json_response(response: str) -> str:
    """清理 AI 响应，提取 JSON"""
    if not response:
        return "{}"
    
    response = response.strip()
    
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
        return response[first_brace:last_brace + 1]
    
    return response


def safe_json_loads(response: str, default=None):
    """安全地加载 JSON，失败时返回默认值"""
    try:
        return json.loads(clean_json_response(response))
    except json.JSONDecodeError:
        return default or {}


class AIService:
    """AI 服务单例"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.client = OpenAI(
            api_key=DEEPSEEK_API_KEY,
            base_url=DEEPSEEK_BASE_URL
        )
        self.model = DEEPSEEK_MODEL
    
    def call(self, prompt: str, temperature: float = DEFAULT_TEMPERATURE) -> str:
        """调用 AI API"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"AI调用失败: {e}")
            return ""
    
    def call_json(self, prompt: str, temperature: float = DEFAULT_TEMPERATURE, default=None):
        """调用 AI 并返回 JSON 对象"""
        response = self.call(prompt, temperature)
        return safe_json_loads(response, default)
    
    def clean_json(self, response: str) -> str:
        """清理 JSON 响应"""
        return clean_json_response(response)


# 全局单例
ai_service = AIService()


def call_ai(prompt: str, temperature: float = DEFAULT_TEMPERATURE) -> str:
    """便捷函数：调用 AI"""
    return ai_service.call(prompt, temperature)


def call_ai_json(prompt: str, temperature: float = DEFAULT_TEMPERATURE, default=None):
    """便捷函数：调用 AI 并返回 JSON"""
    return ai_service.call_json(prompt, temperature, default)


# 注意：这里不要重复定义 clean_json_response，使用上面的函数即可