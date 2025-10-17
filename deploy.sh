#!/bin/bash
echo "🚀 Starting deployment..."

cd /var/www/adeita.online || exit

# Обновляем код из репозитория
echo "🔄 Pulling latest changes from GitHub..."
git fetch --all
git reset --hard origin/main

# Устанавливаем зависимости
echo "📦 Installing dependencies..."
npm install --production

# Перезапускаем приложение через PM2
echo "♻️ Restarting PM2 process..."
pm2 restart adeita || pm2 start server.js --name adeita

echo "✅ Deployment complete!"