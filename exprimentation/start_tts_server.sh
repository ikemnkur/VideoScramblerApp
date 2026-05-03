#!/bin/bash

echo "=== TTS Watermark Server Startup ==="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

# Check if requirements are installed
echo "Checking dependencies..."
python3 -c "import flask, edge_tts, pydub" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing dependencies..."
    pip3 install -r tts_requirements.txt
fi

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Warning: ffmpeg is not installed"
    echo "Install with: sudo apt-get install ffmpeg (Ubuntu/Debian)"
    echo "            or: brew install ffmpeg (macOS)"
    echo ""
fi

echo ""
echo "Starting TTS Server on http://localhost:5001..."
echo "Press Ctrl+C to stop"
echo ""

python3 tts_server.py
