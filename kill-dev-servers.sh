#!/usr/bin/env bash

# Script to stop all dev / preview server processes safely

echo "Searching for dev server processes..."

# Find PIDs of common dev servers (vite, next, webpack, dev/preview CLI runners)
# Exclude system, editor, MCP, and agent processes
PIDS=$(ps aux | grep -E "vite|next-server|webpack-dev-server|astro|nuxt|remix|gatsby|react-scripts" | grep -v -E "grep|chrome-devtools|codegraph|trusted-worker|kernel\.js|cua_node|antigravity" | awk '{print $2}')

if [ -z "$PIDS" ]; then
  echo "No active dev server processes found."
else
  echo "Found dev server process PIDs: $PIDS"
  for PID in $PIDS; do
    echo "Stopping PID $PID..."
    kill -9 "$PID" 2>/dev/null || true
  done
  echo "All dev server processes have been stopped."
fi
