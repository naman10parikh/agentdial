#!/bin/bash
set -e

# AgentDial — Agent Identity Protocol
# One-line installer: curl -fsSL https://raw.githubusercontent.com/naman10parikh/agentdial/main/install.sh | bash

PURPLE='\033[0;35m'
GREEN='\033[0;32m'
DIM='\033[2m'
RESET='\033[0m'

echo ""
echo -e "${PURPLE}   ___                    __  ____  _       __${RESET}"
echo -e "${PURPLE}  / _ |___ ____ ___  ____/ / / __ \\(_)___ _/ /${RESET}"
echo -e "${PURPLE} / __ / _ \`/ -_) _ \\/ __/ / / / / / / _ \`/ / ${RESET}"
echo -e "${PURPLE}/_/ |_\\_, /\\__/_//_/\\__/_/ /_/ /_/_/\\_,_/_/  ${RESET}"
echo -e "${PURPLE}     /___/${RESET}"
echo ""
echo -e "${DIM}  Agent Identity Protocol — v1.0${RESET}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js is required but not installed."
    echo "Install it from https://nodejs.org (v18+)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Node.js 18+ required. You have $(node -v)."
    exit 1
fi

echo -e "${DIM}  Installing agentdial...${RESET}"
npm install -g agentdial

echo ""
echo -e "${GREEN}  ✓ agentdial installed${RESET}"
echo ""
echo -e "  Run ${PURPLE}agentdial setup${RESET} to give your agent an identity."
echo -e "  Run ${PURPLE}agentdial --help${RESET} to see all commands."
echo ""
