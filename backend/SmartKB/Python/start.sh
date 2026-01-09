#!/bin/bash

# Function to cleanup on exit
cleanup() {
    echo "Shutting down services..."
    if [ ! -z "$PYTHON_PID" ]; then
        kill $PYTHON_PID 2>/dev/null
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT

# Start Python embedding service in background
echo "🚀 Starting Python embedding service..."
cd /app/python
python3 embedding_service.py &
PYTHON_PID=$!

# Wait a bit for Python service to start
sleep 5

# Check if Python service is running
if ! kill -0 $PYTHON_PID 2>/dev/null; then
    echo "❌ Python embedding service failed to start!"
    exit 1
fi

echo "✅ Python embedding service started (PID: $PYTHON_PID)"

# Start .NET application (foreground)
echo "🚀 Starting .NET application..."
cd /app
dotnet SmartKB.dll

# If .NET app exits, cleanup
cleanup

