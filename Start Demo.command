#!/bin/bash
cd "$(dirname "$0")"
clear
echo "Watch Together — starting the presentation…"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is missing. Install it from https://nodejs.org then try again."
  open "https://nodejs.org"
  read -r -p "Press Return to close."
  exit 1
fi

if command -v git >/dev/null 2>&1 && command -v git-lfs >/dev/null 2>&1; then
  git lfs pull >/dev/null 2>&1 || true
fi

if [ ! -d node_modules ]; then
  echo "Installing packages (first run only)…"
  npm install
  echo
fi

echo "Opening http://localhost:3000"
echo "Leave this window open during the demo. Close it to stop."
echo
npm run present
