#!/bin/sh

# Start Redis in the background (in-memory only, no persistence)
redis-server --daemonize yes --save "" --appendonly no

# Wait for Redis to be ready
until redis-cli ping > /dev/null 2>&1; do
  echo "Waiting for Redis..."
  sleep 0.5
done

echo "Redis is ready"

# Start the Go server (foreground)
exec ./server
