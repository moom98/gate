#!/bin/sh
# Wrapper script for Claude CLI to ensure proper PTY execution
# Use sh instead of bash for better compatibility with posix_spawn

exec /opt/homebrew/Caskroom/claude-code/2.0.72/claude "$@"
