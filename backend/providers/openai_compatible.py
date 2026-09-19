import asyncio
import ipaddress
from urllib.parse import urlsplit

import httpx
from .base import AIProvider, Message, ProviderConfig

class ProviderError(Exception):
    def __init__(self, message: str, code: str = "provider_error"):
        super().__init__(message)
        self.code = code

def endpoint(base_url: str) -> str:
    value = base_url.strip().rstrip("/")
    parsed = urlsplit(value)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ProviderError("请设置合法的 Base URL，不要在地址中放密钥、查询参数或片段。", "configuration")
    if parsed.scheme == "http":
        try:
            local = ipaddress.ip_address(parsed.hostname).is_loopback
        except ValueError:
            local = parsed.hostname == "localhost"
        if not local:
            raise ProviderError("远程模型服务必须使用 HTTPS；本机服务可使用 HTTP。", "configuration")
    return value if value.endswith("/chat/completions") else value + "/chat/completions"

class OpenAICompatibleProvider(AIProvider):
    def __init__(self, config: ProviderConfig):
        if not config.model.strip():
            raise ProviderError("请先在设置页填写并保存 Model。", "configuration")
        if config.provider in {"openai", "deepseek", "openrouter"} and not config.api_key:
            raise ProviderError("请先在设置页填写并保存 API Key。", "configuration")
        self.config = config
        self.url = endpoint(config.base_url)

    async def generate(self, messages: list[Message]) -> str:
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = "Bearer " + self.config.api_key
        body = {"model": self.config.model, "messages": [{"role": m.role, "content": m.content} for m in messages], "stream": False, "temperature": 0.2, "max_tokens": 6000}
        if self.config.provider == "deepseek":
            body["thinking"] = {"type": "disabled"}
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(60, connect=10), follow_redirects=False, trust_env=False) as client:
                for attempt in range(2):
                    response = await client.post(self.url, headers=headers, json=body)
                    if response.status_code in (429, 500, 502, 503, 504) and attempt == 0:
                        await asyncio.sleep(1)
                        continue
                    if response.status_code in (401, 403):
                        raise ProviderError("模型服务拒绝授权，请检查 API Key 与模型权限。", "authorization")
                    if response.status_code == 429:
                        raise ProviderError("模型服务限流或额度不足，请稍后重试。", "rate_limit")
                    if not response.is_success:
                        raise ProviderError(f"模型服务返回 HTTP {response.status_code}，请检查地址和模型配置。", "http_error")
                    try:
                        data = response.json()
                        text = data["choices"][0]["message"]["content"]
                        if not isinstance(text, str) or not text.strip() or len(text) > 120000:
                            raise ValueError()
                        if data["choices"][0].get("finish_reason") == "length":
                            raise ProviderError("模型输出被截断，请减少题目数量后重试。", "truncated")
                        return text
                    except (ValueError, KeyError, IndexError, TypeError):
                        raise ProviderError("模型响应不是有效的 Chat Completions 文本。", "response") from None
        except httpx.TimeoutException:
            raise ProviderError("模型请求超时，已保留原有数据，可重试。", "timeout") from None
        except httpx.HTTPError:
            raise ProviderError("无法连接模型服务，请检查网络与 Base URL。", "connection") from None
        raise ProviderError("模型没有返回结果。")
