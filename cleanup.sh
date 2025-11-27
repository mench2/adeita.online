#!/bin/bash

echo "🧹 Cleaning up old files..."

# Удаляем старый deploy.sh если есть
if [ -f "deploy.sh" ]; then
  echo "🗑️ Removing old deploy.sh..."
  rm -f deploy.sh
fi

# Очищаем dist/ (пересоздастся при сборке)
if [ -d "solid-app/dist" ]; then
  echo "🗑️ Removing solid-app/dist/..."
  rm -rf solid-app/dist/
fi

# Очищаем логи PM2
echo "🗑️ Flushing PM2 logs..."
pm2 flush 2>/dev/null || echo "PM2 not found, skipping..."

# Очищаем npm cache
echo "🗑️ Cleaning npm cache..."
npm cache clean --force 2>/dev/null || echo "npm cache clean failed, skipping..."

echo "✅ Cleanup complete!"
echo ""
echo "📊 Current disk usage:"
du -sh /var/www/adeita.online 2>/dev/null || du -sh .

