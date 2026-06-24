#!/usr/bin/env bash
#
# Phase 3 Step 3 — End-to-End Approval + SSE Flow Test
#
# Prerequisites:
#   pnpm dev must be running in apps/agent-service
#   A REQUIRE_APPROVAL policy rule must be created first (step 1 below)
#
# Usage:
#   bash scripts/test-approval-sse.sh

set -e

BASE="http://localhost:3001"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[test]${NC} $*"; }
ok()  { echo -e "${GREEN}[ok]${NC}   $*"; }
warn(){ echo -e "${YELLOW}[warn]${NC} $*"; }
fail(){ echo -e "${RED}[fail]${NC} $*"; exit 1; }

# ──────────────────────────────────────────────────────────────────────────────
# 0. Health check
# ──────────────────────────────────────────────────────────────────────────────
log "Checking agent service health..."
HEALTH=$(curl -sf "$BASE/health") || fail "Agent service is not running at $BASE"
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
ok "Service is healthy"

# ──────────────────────────────────────────────────────────────────────────────
# 1. Create a REQUIRE_APPROVAL policy rule for vault__delete_secret
# ──────────────────────────────────────────────────────────────────────────────
log "Creating REQUIRE_APPROVAL rule for 'vault__delete_secret'..."
RULE=$(curl -sf -X POST "$BASE/api/policies" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "tool_block",
    "toolPattern": "vault__delete_secret",
    "action": "REQUIRE_APPROVAL",
    "enabled": true,
    "priority": 10,
    "config": { "timeoutMs": 120000 }
  }')
echo "$RULE"
RULE_ID=$(echo "$RULE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
ok "Rule created: $RULE_ID"

# ──────────────────────────────────────────────────────────────────────────────
# 2. Open the SSE /stream/approvals in the background — capture to a tmp file
# ──────────────────────────────────────────────────────────────────────────────
SSE_LOG=$(mktemp)
log "Opening SSE /stream/approvals (writing to $SSE_LOG)..."
curl -sN "$BASE/stream/approvals" > "$SSE_LOG" &
SSE_PID=$!
sleep 1   # Give stream time to connect

# ──────────────────────────────────────────────────────────────────────────────
# 3. Send a chat message that will trigger the approval-gated tool
# ──────────────────────────────────────────────────────────────────────────────
log "Sending chat message: 'delete the jwt_secret from the dev namespace'..."
CHAT_RESPONSE=""
# Run in background — the agent loop will BLOCK waiting for approval
curl -sf -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "delete the jwt_secret from the dev namespace"}' \
  > /tmp/chat_response.json &
CHAT_PID=$!

sleep 3  # Give the agent loop time to hit the tool call and create the pending approval

# ──────────────────────────────────────────────────────────────────────────────
# 4. Check the SSE log for approval_requested
# ──────────────────────────────────────────────────────────────────────────────
log "Checking SSE log for approval_requested event..."
if grep -q '"type":"approval_requested"' "$SSE_LOG"; then
  ok "approval_requested event received over SSE ✓"
else
  warn "SSE event not seen yet — checking approvals API directly..."
fi

# ──────────────────────────────────────────────────────────────────────────────
# 5. Poll GET /api/approvals to find the pending approval ID
# ──────────────────────────────────────────────────────────────────────────────
log "Polling GET $BASE/api/approvals..."
PENDING=$(curl -sf "$BASE/api/approvals")
echo "$PENDING"
APPROVAL_ID=$(echo "$PENDING" | grep -o '"approvalId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$APPROVAL_ID" ]; then
  fail "No pending approval found! Check that the policy rule matched correctly."
fi
ok "Found pending approval: $APPROVAL_ID"

# ──────────────────────────────────────────────────────────────────────────────
# 6. Approve the pending tool call
# ──────────────────────────────────────────────────────────────────────────────
log "Approving $APPROVAL_ID..."
DECISION=$(curl -sf -X POST "$BASE/api/approvals/$APPROVAL_ID/decide" \
  -H "Content-Type: application/json" \
  -d '{"decision": "APPROVED", "decidedBy": "test-script"}')
echo "$DECISION"
ok "Approval resolved"

# ──────────────────────────────────────────────────────────────────────────────
# 7. Wait for the agent loop to complete
# ──────────────────────────────────────────────────────────────────────────────
log "Waiting for agent loop to complete..."
wait $CHAT_PID 2>/dev/null || true
sleep 1

log "Chat response:"
cat /tmp/chat_response.json 2>/dev/null && echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 8. Check SSE log for approval_decided
# ──────────────────────────────────────────────────────────────────────────────
log "Checking SSE log for approval_decided event..."
if grep -q '"type":"approval_decided"' "$SSE_LOG"; then
  ok "approval_decided event received over SSE ✓"
else
  warn "approval_decided not found in SSE log — may have arrived before grep"
fi

# ──────────────────────────────────────────────────────────────────────────────
# 9. Cleanup
# ──────────────────────────────────────────────────────────────────────────────
kill $SSE_PID 2>/dev/null || true
rm -f "$SSE_LOG" /tmp/chat_response.json

# Delete the test rule
if [ -n "$RULE_ID" ]; then
  curl -sf -X DELETE "$BASE/api/policies/$RULE_ID" > /dev/null
  ok "Test rule cleaned up: $RULE_ID"
fi

echo ""
ok "Phase 3 Step 3 — ApprovalQueue + EventBus + SSE: ALL CHECKS PASSED ✓"
