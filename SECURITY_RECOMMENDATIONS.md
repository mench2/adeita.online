# 🔒 Рекомендации по безопасности

## ⚠️ КРИТИЧНО: Защита TURN сервера

### Проблема
TURN credentials сейчас захардкожены в клиентском коде:
```typescript
{ urls: 'turn:95.81.117.141:3478', username: 'adeita', credential: 'TeFmLD44bTHMQeyuWgyFcB0fuRnuS3QklMb3ObxHPQM=' }
```

**Риски:**
- Любой может использовать твой TURN сервер
- Трафик будет тратиться на чужие звонки
- Возможна DDoS атака через TURN

### ✅ Решение 1: Динамические TURN credentials (рекомендуется)

Вместо статических credentials генерируй временные на сервере:

**1. На сервере (server.js):**
```javascript
import crypto from 'crypto';

// Секретный ключ (ТОЛЬКО на сервере, не в git!)
const TURN_SECRET = process.env.TURN_SECRET || 'your-secret-key-here';

// Генерация временных TURN credentials
app.get('/api/turn-credentials', (req, res) => {
  const username = Date.now() + ':adeita'; // Временное имя с timestamp
  const ttl = 3600; // Время жизни 1 час
  
  // HMAC-SHA1 для генерации пароля
  const hmac = crypto.createHmac('sha1', TURN_SECRET);
  hmac.update(username);
  const credential = hmac.digest('base64');
  
  res.json({
    username: username,
    credential: credential,
    ttl: ttl,
    uris: [
      'turn:95.81.117.141:3478',
      'turns:95.81.117.141:5349'
    ]
  });
});
```

**2. На клиенте (webrtc.ts):**
```typescript
// Убрать статические credentials
export async function getTurnCredentials(): Promise<RTCIceServer[]> {
  try {
    const response = await fetch('/api/turn-credentials');
    const data = await response.json();
    
    return data.uris.map((uri: string) => ({
      urls: uri,
      username: data.username,
      credential: data.credential
    }));
  } catch (error) {
    console.error('Failed to get TURN credentials:', error);
    // Fallback на публичные STUN серверы
    return stunOnlyServers;
  }
}
```

**3. Настройка TURN сервера (coturn):**
```bash
# В /etc/turnserver.conf добавь:
use-auth-secret
static-auth-secret=your-secret-key-here
realm=adeita.online

# Перезапусти coturn:
sudo systemctl restart coturn
```

### ✅ Решение 2: Rate limiting для TURN

Ограничь использование TURN сервера:

```bash
# В /etc/turnserver.conf:
max-bps=1000000              # Максимум 1 Mbps на соединение
total-quota=100              # Максимум 100 MB на сессию
user-quota=50                # Максимум 50 MB на пользователя
bps-capacity=10000000        # Общая пропускная способность 10 Mbps
```

### ✅ Решение 3: Whitelist IP адресов

Разреши TURN только с твоего домена:

```bash
# В /etc/turnserver.conf:
allowed-peer-ip=95.81.117.141
denied-peer-ip=0.0.0.0-255.255.255.255

# Или через iptables:
sudo iptables -A INPUT -p udp --dport 3478 -m string --string "adeita.online" --algo bm -j ACCEPT
sudo iptables -A INPUT -p udp --dport 3478 -j DROP
```

## 🔒 Дополнительные улучшения

### 1. Добавь CSP заголовки

В `nginx.conf`:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss: https:; media-src 'self' blob:;" always;
```

### 2. Скрой версии сервера

В `nginx.conf`:
```nginx
server_tokens off;
```

В `server.js`:
```javascript
app.disable('x-powered-by');
```

### 3. Добавь rate limiting для API

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // Максимум 100 запросов
});

app.use('/api/', limiter);
```

### 4. Логирование подозрительной активности

```javascript
// В server.js добавь:
const suspiciousActivity = new Map();

io.on('connection', (socket) => {
  const ip = socket.handshake.headers['x-real-ip'] || socket.handshake.address;
  
  // Проверка на слишком частые подключения
  const activity = suspiciousActivity.get(ip) || { count: 0, firstSeen: Date.now() };
  activity.count++;
  
  if (activity.count > 10 && Date.now() - activity.firstSeen < 60000) {
    console.warn(`⚠️ Suspicious activity from ${ip}: ${activity.count} connections in 1 minute`);
    socket.disconnect();
    return;
  }
  
  suspiciousActivity.set(ip, activity);
});

// Очистка каждые 5 минут
setInterval(() => {
  suspiciousActivity.clear();
}, 5 * 60 * 1000);
```

### 5. Мониторинг TURN трафика

```bash
# Установи vnstat для мониторинга трафика:
sudo apt install vnstat
sudo vnstat -i eth0 -l  # Мониторинг в реальном времени

# Или через iptables:
sudo iptables -A INPUT -p udp --dport 3478 -j LOG --log-prefix "TURN: "
sudo tail -f /var/log/syslog | grep TURN
```

## 📊 Текущий статус безопасности

| Компонент | Статус | Приоритет |
|-----------|--------|-----------|
| E2EE шифрование | ✅ Отлично | - |
| HTTPS/SSL | ✅ Отлично | - |
| SSH ключи | ✅ Отлично | - |
| TURN credentials | ⚠️ Требует улучшения | 🔴 Высокий |
| Rate limiting | ✅ Есть базовая защита | 🟡 Средний |
| CSP headers | ❌ Отсутствует | 🟢 Низкий |
| Мониторинг | ❌ Отсутствует | 🟡 Средний |

## 🎯 План действий

### Сейчас (критично):
1. ✅ E2EE уже реализован
2. ⚠️ Реализовать динамические TURN credentials
3. ⚠️ Настроить rate limiting для TURN

### Потом (важно):
4. Добавить CSP заголовки
5. Настроить мониторинг трафика
6. Добавить логирование подозрительной активности

### В будущем (желательно):
7. Whitelist IP для TURN
8. Автоматические алерты при превышении лимитов
9. Dashboard для мониторинга

## 💡 Итог

**Текущая безопасность: 7/10**

Основные данные (видео/аудио/чат) защищены E2EE - это отлично!

Главная проблема - открытый TURN сервер может быть использован третьими лицами.

**Приоритет:** Реализовать динамические TURN credentials в течение недели.

