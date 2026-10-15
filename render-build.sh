#!/usr/bin/env bash
set -e

echo "Installing Node.js dependencies..."
npm install

echo "Installing yt-dlp..."
python3 -m pip install -U yt-dlp

echo "Verifying yt-dlp..."
python3 -m yt_dlp --version

echo "Build completed successfully!"
