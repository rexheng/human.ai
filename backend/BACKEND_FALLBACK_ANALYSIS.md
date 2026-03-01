# Why the Backend Falls Back to Hardcoded — Analysis & Fixes

## Summary

The backend uses **hardcoded personas** and **hardcoded agent opinions** when:

1. **Agent generation** (`agents/generator.py`): Any exception from `bedrock.invoke()` or JSON parse failure → `_fallback_personas()`.
2. **Agent behavior** (`agents/behavior.py`): Strands invocation returns `{}`, or `bedrock.invoke()` throws, or response parsing fails → `_fallback_opinion()`.

## Root Causes

### 1. AWS Bedrock request format

- **Expected by AWS**: For `mistral.mistral-large-2402-v1:0`, the body must use the **native inference** format:
  - `prompt`: a **single** string wrapped as `<s>[INST] {content} [/INST]` (leading `<s>` is required).
- **Our code** (`llm/bedrock_client.py`): Built prompt via `_messages_to_mistral_prompt()`, which produced multiple `[INST] ... [/INST]` blocks **without** the leading `<s>`. That can cause the model or gateway to reject or misinterpret the request.
- **Fix**: Use one combined instruction and wrap it as `<s>[INST] ... [/INST]` for Bedrock.

### 2. AWS credentials and client creation

- **Server** (`server/main.py`): Passes `os.getenv("AWS_ACCESS_KEY_ID")`, `os.getenv("AWS_SECRET_ACCESS_KEY")` into `BedrockClient`. If these are unset or wrong, `boto3` may use the default chain (e.g. `~/.aws/credentials`) or fail at first `invoke_model` call.
- **.env.example**: Was invalid (e.g. `AWS_ACCESS_KEY_ID=VITE_BEDROCK_BEARER_TOKEN = ...`). Correct format is separate keys: `AWS_ACCESS_KEY_ID=...` and `AWS_SECRET_ACCESS_KEY=...`.
- **Fix**: Correct `.env.example`; optionally add a startup or `/health` check that tries one Bedrock call and logs the error.

### 3. Exceptions swallowed

- **generator.py**: `except Exception: return _fallback_personas()` — the real error (e.g. `ClientError`, `NoCredentialsError`, or invalid request body) is never logged.
- **behavior.py**: Same pattern; Strands and Bedrock failures are silent.
- **Fix**: Log the exception (and optionally re-raise in dev) so we see why Bedrock or Strands failed.

### 4. Strands integration

- **behavior.py**: `_invoke_with_strands()` imports `from strands import Agent` and `from strands.models import BedrockModel`. If the installed package is `strands-agents`, the import path may be different (e.g. `strands_agents`). Also, BedrockModel may require `model_id` and `region_name` in a specific format.
- **Fix**: Verify Strands package name and import paths; use Strands **Swarm** for policy-debate flows so multiple agents collaborate (researcher, critic, synthesizer) and hand off; wire Bedrock as the LLM for those agents.

### 5. BedrockClient initialization with missing credentials

- If `region` is `None` and `BEDROCK_REGION` is unset, `self.region` becomes `"us-east-1"`. If AWS credentials are missing, `boto3.client("bedrock-runtime", region_name=...)` still succeeds; the failure happens on the first `invoke_model` call with a message like `NoCredentialsError` or `UnauthorizedException`.
- **Fix**: Ensure `.env` has valid `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (or use IAM roles when running on AWS). Use the corrected Bedrock prompt format so the only remaining failure mode is credentials/permissions.

## Fixes Applied

1. **llm/bedrock_client.py**: Build a single `<s>[INST] ... [/INST]` prompt for Bedrock; combine system and user into one instruction; log and re-raise on Bedrock errors when `BEDROCK_DEBUG=1`.
2. **agents/generator.py**: Log exception before returning fallback; optionally set a flag or return metadata so the API can report "used_fallback: true".
3. **agents/behavior.py**: Log Strands and Bedrock failures; ensure Bedrock is tried with the fixed prompt format.
4. **.env.example**: Clean template with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BEDROCK_REGION`, `MISTRAL_MODEL_ID`; remove invalid placeholder.
5. **Strands Swarm**: Add an optional policy-debate path using `strands.multiagent.Swarm` with specialist agents (e.g. researcher, critic, synthesizer) and Bedrock as the model, so the simulation can use real multi-agent debate when configured.

## How to Verify

1. Set in `backend/.env`: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BEDROCK_REGION=us-east-1`.
2. Run backend and call `POST /generate_agents` with `population_size=3`. Check server logs for any exception; if none, response should contain varied LLM-generated personas.
3. Run simulation and check logs for Bedrock or Strands errors; agent messages should reflect LLM output when Bedrock and (optionally) Strands are working.
