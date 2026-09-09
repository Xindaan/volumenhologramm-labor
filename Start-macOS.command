#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 wird benötigt. Installationsanleitung: INSTALLATION.md"
  printf 'Zum Schließen Enter drücken. '
  read -r reply
  exit 1
fi
python3 start.py "$@"
result=$?
if [ "$result" -ne 0 ]; then
  printf 'Zum Schließen Enter drücken. '
  read -r reply
fi
exit "$result"
