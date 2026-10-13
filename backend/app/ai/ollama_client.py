import json
import urllib.request
import urllib.error
import time
import re
from typing import Optional, Dict, Any
from backend.app.ai.call_tracker import record_model_call

OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_SQL_MODEL = "qwen2.5-coder:3b"
DEFAULT_SYNTHESIS_MODEL = "qwen2.5:3b"

class OllamaClient:
    def __init__(self, base_url: str = OLLAMA_BASE_URL):
        self.base_url = base_url
        self.http_call_count = 0

    def get_call_count(self) -> int:
        return self.http_call_count

    def reset_call_count(self) -> None:
        self.http_call_count = 0

    def is_available(self) -> bool:
        self.http_call_count += 1
        try:
            req = urllib.request.Request(f"{self.base_url}/api/tags")
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                return resp.status == 200
        except Exception:
            return False

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        model: str = DEFAULT_SQL_MODEL,
        temperature: float = 0.0,
        max_tokens: int = 150,
        timeout: float = 120.0,
        task_type: str = "GENERAL"
    ) -> Optional[str]:
        record_model_call(task_type)
        self.http_call_count += 1
        payload: Dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": "30m",
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "num_ctx": 4096,
                "num_thread": 8,
                "top_p": 0.9
            }
        }
        if system:
            payload["system"] = system

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}/api/generate",
            data=data,
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                res_json = json.loads(resp.read().decode("utf-8"))
                return res_json.get("response", "").strip()
        except urllib.error.URLError as ue:
            print(f"[OllamaClient] URLError calling {model}: {ue}")
            return None
        except Exception as e:
            print(f"[OllamaClient] Error calling {model}: {e}")
            return None

    def extract_sql_query(self, text: Optional[str]) -> str:
        if not text:
            return ""
        # Extract SQL from markdown or raw text
        match = re.search(r'```(?:sql)?\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
        
        # Or look for SELECT ... ;
        match2 = re.search(r'(SELECT\s+.*)', text, re.DOTALL | re.IGNORECASE)
        if match2:
            return match2.group(1).strip().rstrip(';')
            
        return text.strip().rstrip(';')

ollama_client = OllamaClient()
