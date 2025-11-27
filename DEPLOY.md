# 🚀 Деплой Adeita Vichat (Solid.js)

## 📋 Предварительные требования на сервере:

- Node.js 18+ 
- npm или yarn
- PM2 (для автозапуска)
- Git

## 🔧 Первоначальная настройка на сервере:

### 1. Клонируем репозиторий:
```bash
cd /var/www/
git clone https://github.com/your-username/adeita.online.git
cd adeita.online
```

### 2. Устанавливаем зависимости сервера:
```bash
npm install
```

### 3. Собираем Solid.js:
```bash
cd solid-app
npm install
npm run build
cd ..
```

### 4. Копируем файлы в public:
```bash
./deploy-solid.sh
```

### 5. Настраиваем PM2:
```bash
# Запускаем сервер
pm2 start server.js --name adeita

# Сохраняем конфигурацию
pm2 save

# Автозапуск при перезагрузке
pm2 startup
```

## 🔄 Обновление (после git push):

### На сервере выполни:
```bash
cd /var/www/adeita.online

# Получаем изменения
git pull

# Запускаем deploy скрипт
./deploy-solid.sh

# Перезапускаем сервер
pm2 restart adeita
```

## 📝 Структура после деплоя:

```
adeita.online/
├── server.js              # Node.js сервер (Socket.IO)
├── public/                # Собранный Solid.js (раздается через Express)
│   ├── index.html
│   ├── assets/
│   │   ├── index-xxx.js
│   │   └── index-xxx.css
│   └── icon/
├── solid-app/             # Исходники Solid.js
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
└── deploy-solid.sh        # Скрипт деплоя
```

## 🌐 Nginx конфигурация (если используется):

```nginx
server {
    listen 80;
    server_name adeita.online www.adeita.online;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name adeita.online www.adeita.online;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/adeita.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/adeita.online/privkey.pem;
    
    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔍 Проверка работы:

```bash
# Проверить статус сервера
pm2 status

# Посмотреть логи
pm2 logs adeita

# Перезапустить
pm2 restart adeita

# Остановить
pm2 stop adeita
```

## 🐛 Troubleshooting:

### Проблема: Socket.IO не подключается
```bash
# Проверь что сервер слушает на правильном порту
netstat -tlnp | grep 3001

# Проверь логи
pm2 logs adeita --lines 100
```

### Проблема: Статические файлы не загружаются
```bash
# Проверь что файлы скопированы
ls -la public/

# Пересобери
./deploy-solid.sh
```

### Проблема: Изменения не применяются
```bash
# Очисти кеш браузера или открой в инкогнито
# Убедись что перезапустил сервер
pm2 restart adeita
```

## 📊 Мониторинг:

```bash
# Использование ресурсов
pm2 monit

# Детальная информация
pm2 show adeita
```

