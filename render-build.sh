#!/usr/bin/env bash
set -e

npm install
python3 -m pip install -U yt-dlp
python3 -m yt_dlp --version
