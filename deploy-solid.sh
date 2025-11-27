#!/bin/bash

echo "🚀 Deploying Solid.js version..."

# Переходим в папку solid-app
cd solid-app

# Устанавливаем зависимости
echo "📦 Installing dependencies..."
npm install

# Собираем production build
echo "🔨 Building for production..."
npm run build

# Копируем собранные файлы в public
echo "📂 Copying files to public..."
rm -rf ../public/*
cp -r dist/* ../public/

echo "✅ Deployment complete!"
echo "📝 Don't forget to restart the server: pm2 restart adeita"

