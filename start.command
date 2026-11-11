#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Please install Node.js 24 LTS from https://nodejs.org/ and try again."
  read -r answer
  exit 1
fi
node tools/start.mjs
result=$?
if [ "$result" -ne 0 ]; then
  echo "Startup failed. Press Enter to close."
  read -r answer
fi
exit "$result"
