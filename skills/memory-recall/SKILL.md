---
name: memory
description: Recall relevant knowledge cards from the unified memory vault and capture durable findings. Use memory_recall before answering when prior context helps; call memory_capture when a session produces a durable insight.
---

# Memory Eternal

This agent has access to `memory_recall` (retrieve cards) and `memory_capture` (store a card) via the `memory` MCP server.

## When to recall
Before answering when the user's question may depend on prior project decisions, past bugs, or preferences. Combine with `memory_stats` to gauge coverage.

## When to capture
At the end of a session that produced a durable, reusable conclusion (a fix, a decision, an architecture rationale, a constraint). Capture concise findings rather than raw transcripts; the hook also auto-captures at session end into the same vault (pending → audit). Source attribution is automatic.
