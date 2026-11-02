#!/bin/bash
# Docker never restarts an unhealthy container. After 4 failed checks in a row, stop the proxy:
# it is the entrypoint's last command, so the container exits and `restart: unless-stopped` restarts WARP.
STATE=/tmp/warp-failures

if /healthcheck/index.sh; then
  echo 0 > "$STATE"
  exit 0
fi

failures=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$failures" > "$STATE"
if [ "$failures" -ge 4 ]; then
  echo 0 > "$STATE"
  for proc in /proc/[0-9]*; do
    [ "$(cat "$proc/comm" 2>/dev/null)" = gost ] && kill "${proc#/proc/}"
  done
fi
exit 1
