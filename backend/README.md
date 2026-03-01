# Backend - AI Social Simulation

This backend uses a single runtime path:

- `server.main:app` (FastAPI)

It exposes:

- `POST /generate_agents`
- `POST /run_simulation`
- `GET /health`
- `WS /simulation_stream`

## Setup

Run from the `backend` directory:

```bash
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend (project root):

```bash
npm run dev
```

## Environment variables

- `BEDROCK_REGION` (default: `us-east-1`)
- `MISTRAL_MODEL_ID` (default: `mistral.mistral-large-2402-v1:0`)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- optional: `AWS_SESSION_TOKEN`
- optional: `MISTRAL_API_KEY` (direct Mistral API fallback)
- optional: `MISTRAL_CHAT_MODEL` (default: `mistral-large-latest`)
- optional: `USE_STRANDS_AGENTS` (default: `1`)
- optional: `STRANDS_MODEL_ID` (default: `us.anthropic.claude-sonnet-4-20250514-v1:0`)

Runtime order:
1. Strands Agent invocation (if `strands-agents` installed and enabled)
2. Bedrock (`bedrock-runtime`)
3. Direct Mistral API (if `MISTRAL_API_KEY` is set)
4. Local deterministic fallback behavior

## Why the backend might use hardcoded fallback

See **BACKEND_FALLBACK_ANALYSIS.md** for full analysis. Summary:

- **Bedrock format**: The Mistral native format requires a single `<s>[INST] ... [/INST]` prompt. The client now uses this; previously the prompt could be rejected or misparsed.
- **Credentials**: Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `backend/.env`. Use `.env.example` as a template (no extra text on the same line as the variable).
- **Debug**: Set `BEDROCK_DEBUG=1` to log and re-raise Bedrock errors. Check logs for "Bedrock persona generation failed" or "Bedrock behavior invoke failed".

## Strands Swarm (policy debate)

- Set `USE_STRANDS_SWARM=1` to run an optional Strands **Swarm** (researcher → critic → synthesizer) for a structured policy debate. See `agents/swarm_debate.py`. Call `run_policy_debate_swarm(scenario)` from your code to use it.
