#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 wird benötigt. Siehe INSTALLATION.md."
  exit 1
fi
exec python3 start.py "$@"
