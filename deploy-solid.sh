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

# Очищаем public (кроме .git если есть)
rm -rf ../public/*

# Копируем новые файлы (Vite уже включил icon/ в dist/)
cp -r dist/* ../public/

echo "✨ Files copied successfully!"

echo "✅ Deployment complete!"
echo "📝 Don't forget to restart the server: pm2 restart adeita"

