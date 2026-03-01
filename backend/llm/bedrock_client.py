"""
AWS Bedrock client for Mistral models.
Async-invocation where possible; falls back to sync for compatibility.
"""
import json
import os
import urllib.error
import urllib.request
from typing import Any, Optional

import boto3
import botocore.config

BEDROCK_REGION = os.getenv("BEDROCK_REGION", "us-east-1")
MISTRAL_MODEL_ID = os.getenv("MISTRAL_MODEL_ID", "mistral.mistral-large-2402-v1:0")
MISTRAL_CHAT_MODEL = os.getenv("MISTRAL_CHAT_MODEL", "mistral-large-latest")
MISTRAL_API_URL = os.getenv("MISTRAL_API_URL", "https://api.mistral.ai/v1/chat/completions")


class BedrockClient:
    def __init__(
        self,
        region: Optional[str] = None,
        model_id: Optional[str] = None,
        aws_access_key: Optional[str] = None,
        aws_secret_key: Optional[str] = None,
        aws_session_token: Optional[str] = None,
        mistral_api_key: Optional[str] = None,
        mistral_chat_model: Optional[str] = None,
    ):
        self.region = region or os.getenv("BEDROCK_REGION", BEDROCK_REGION)
        self.model_id = model_id or os.getenv("MISTRAL_MODEL_ID", MISTRAL_MODEL_ID)
        self.mistral_api_key = mistral_api_key or os.getenv("MISTRAL_API_KEY")
        self.mistral_chat_model = mistral_chat_model or os.getenv("MISTRAL_CHAT_MODEL", MISTRAL_CHAT_MODEL)
        kwargs = {"region_name": self.region}
        if aws_access_key:
            kwargs["aws_access_key_id"] = aws_access_key
        if aws_secret_key:
            kwargs["aws_secret_access_key"] = aws_secret_key
        if aws_session_token:
            kwargs["aws_session_token"] = aws_session_token
        self._client = boto3.client(
            "bedrock-runtime",
            **kwargs,
            config=botocore.config.Config(retries={"max_attempts": 3, "mode": "standard"}),
        )

    def invoke(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> str:
        """Invoke Mistral model via Bedrock. Returns assistant text.
        Uses native inference format: single <s>[INST] ... [/INST] as required by AWS."""
        import logging
        log = logging.getLogger(__name__)
        instruction = prompt
        if system:
            instruction = f"{system}\n\n{prompt}"
        formatted_prompt = f"<s>[INST] {instruction} [/INST]"
        body = {
            "prompt": formatted_prompt,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        try:
            response = self._client.invoke_model(
                modelId=self.model_id,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(body),
            )
            result = json.loads(response["body"].read())
            text = (result.get("outputs") or [{}])[0].get("text", "").strip()
            if text:
                return text
        except Exception as e:
            log.warning("Bedrock invoke_model failed: %s", e, exc_info=bool(os.getenv("BEDROCK_DEBUG")))
            if os.getenv("BEDROCK_DEBUG"):
                raise
            # Fall through to direct Mistral API if configured.
            pass

        if self.mistral_api_key:
            return self._invoke_mistral_chat(
                prompt=prompt,
                system=system,
                max_tokens=max_tokens,
                temperature=temperature,
            )

        raise RuntimeError(
            "No working LLM provider. Configure Bedrock credentials or MISTRAL_API_KEY."
        )

    async def invoke_async(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> str:
        """Async wrapper; runs invoke in thread pool for non-blocking use."""
        import asyncio
        return await asyncio.to_thread(
            self.invoke,
            prompt=prompt,
            system=system,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    def _invoke_mistral_chat(
        self,
        prompt: str,
        system: Optional[str],
        max_tokens: int,
        temperature: float,
    ) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload = {
            "model": self.mistral_chat_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        req = urllib.request.Request(
            MISTRAL_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.mistral_api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        return (body.get("choices", [{}])[0].get("message", {}).get("content", "") or "").strip()
