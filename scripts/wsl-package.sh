#!/usr/bin/env bash
set -e

# tiny linux packager thing
npm install
npm run dist:linux

echo "Built packages in ./release"
