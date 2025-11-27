#!/bin/bash

echo "🚀 Starting deployment..."

# Переходим в директорию проекта
cd /var/www/adeita.online

# Сбрасываем локальные изменения (в public/ и т.д.)
echo "🔄 Resetting local changes..."
git reset --hard HEAD
git clean -fd

# Получаем последние изменения
echo "📥 Pulling latest changes..."
git pull

# Собираем Solid.js
echo "🔨 Building Solid.js..."
cd solid-app
npm run build

# Копируем файлы
echo "📂 Deploying files..."
cd ..
./deploy-solid.sh

# Перезапускаем PM2
echo "🔄 Restarting PM2..."
pm2 restart adeita

# Показываем статус
echo "✅ Deployment complete!"
echo ""
echo "📊 Status:"
pm2 status

echo ""
echo "📝 Recent logs:"
pm2 logs adeita --lines 5 --nostream

echo ""
echo "🌐 Site: https://adeita.online"

