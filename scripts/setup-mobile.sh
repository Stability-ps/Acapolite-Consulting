#!/usr/bin/env bash
set -e

PLATFORM="${1:-all}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Installing web dependencies"
npm install

echo "==> Installing mobile dependencies"
cd mobile
npm install

echo "==> Building Acapolite mobile web bundle"
npm run build:web

if [ "$PLATFORM" = "all" ] || [ "$PLATFORM" = "ios" ]; then
  if [ ! -d ios ]; then
    echo "==> Creating iOS project"
    npx cap add ios
  fi
fi

if [ "$PLATFORM" = "all" ] || [ "$PLATFORM" = "android" ]; then
  if [ ! -d android ]; then
    echo "==> Creating Android project"
    npx cap add android
  fi
fi

echo "==> Syncing Capacitor"
npx cap sync

if [ "$PLATFORM" = "ios" ]; then
  echo "==> Opening iOS project in Xcode"
  npx cap open ios
elif [ "$PLATFORM" = "android" ]; then
  echo "==> Opening Android project in Android Studio"
  npx cap open android
else
  echo
  echo "Mobile setup complete."
  echo "Open iOS:     npm run mobile:ios"
  echo "Open Android: npm run mobile:android"
fi
