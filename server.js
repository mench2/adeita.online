import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Доверяем Cloudflare как прокси
app.set('trust proxy', true);

// Middleware для логирования реального IP
app.use((req, res, next) => {
  const realIP = req.headers['cf-connecting-ip'] || req.ip;
  if (process.env.VERBOSE_LOGS === 'true') {
    console.log('Real user IP:', realIP);
  }
  next();
});
// Разрешаем использование камеры/микрофона в webview (Permissions-Policy)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self)');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
const server = http.createServer(app);
const VERBOSE_LOGS = process.env.VERBOSE_LOGS === '1' || process.env.VERBOSE_LOGS === 'true';
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 2000, // ОЧЕНЬ быстрое обнаружение (2 секунды)
  pingInterval: 1000, // ОЧЕНЬ частая проверка (1 секунда)
  transports: ['websocket', 'polling'], // Поддерживаем оба транспорта
  allowEIO3: true, // Совместимость с старыми версиями
  upgradeTimeout: 1000, // Быстрое обновление соединения
  maxHttpBufferSize: 1e6 // Увеличиваем буфер для быстрой передачи
});

// simple in-memory rooms map: roomId -> Set(socketId)
const roomIdToSocketIds = new Map();
// Map для хранения имен пользователей: socketId -> userName
const socketIdToUserName = new Map();
// Map для отслеживания активности пользователей: socketId -> { lastActivity, messageCount, joinTime, lastPing }
const userActivity = new Map();
// Интервал для проверки неактивных пользователей
const INACTIVITY_CHECK_INTERVAL = 2000; // 2 секунды (ОЧЕНЬ часто)
const MAX_INACTIVITY_TIME = 5000; // 5 секунд (МАКСИМАЛЬНО агрессивно)
// Настройки защиты от ботов
const BOT_PROTECTION = {
  MAX_MESSAGES_PER_MINUTE: 10, // Максимум сообщений в минуту
  MAX_ROOMS_PER_HOUR: 5, // Максимум комнат в час
  MIN_TIME_BETWEEN_MESSAGES: 1000, // Минимальное время между сообщениями (мс)
  MAX_MESSAGE_LENGTH: 500, // Максимальная длина сообщения
  MAX_USERNAME_LENGTH: 20 // Максимальная длина имени пользователя
};

// Функции для защиты от ботов
function initializeUserActivity(socketId) {
  userActivity.set(socketId, {
    lastActivity: Date.now(),
    messageCount: 0,
    joinTime: Date.now(),
    roomJoins: 0,
    lastPing: Date.now()
  });
}

function updateUserActivity(socketId) {
  const activity = userActivity.get(socketId);
  if (activity) {
    activity.lastActivity = Date.now();
    activity.lastPing = Date.now();
  }
}

// Функция для проверки неактивных пользователей
function checkInactiveUsers() {
  const now = Date.now();
  const inactiveUsers = [];
  
  for (const [socketId, activity] of userActivity.entries()) {
    if (now - activity.lastPing > MAX_INACTIVITY_TIME) {
      inactiveUsers.push(socketId);
    }
  }
  
  // Удаляем неактивных пользователей
  for (const socketId of inactiveUsers) {
    if (VERBOSE_LOGS) console.log(`Removing inactive user: ${socketId}`);
    
    // Находим комнату пользователя и уведомляем остальных
    for (const [roomId, peers] of roomIdToSocketIds.entries()) {
      if (peers.has(socketId)) {
        peers.delete(socketId);
        io.to(roomId).emit('peer-left', { socketId: socketId });
        if (peers.size === 0) {
          roomIdToSocketIds.delete(roomId);
        }
        break;
      }
    }
    
    // Очищаем данные пользователя
    userActivity.delete(socketId);
    socketIdToUserName.delete(socketId);
  }
}

function checkMessageRate(socketId) {
  const activity = userActivity.get(socketId);
  if (!activity) return true;
  
  const now = Date.now();
  const timeSinceLastMessage = now - activity.lastActivity;
  
  // Проверяем минимальное время между сообщениями
  if (timeSinceLastMessage < BOT_PROTECTION.MIN_TIME_BETWEEN_MESSAGES) {
    return false;
  }
  
  // Сбрасываем счетчик сообщений каждую минуту
  if (now - activity.joinTime > 60000) {
    activity.messageCount = 0;
    activity.joinTime = now;
  }
  
  // Проверяем лимит сообщений в минуту
  if (activity.messageCount >= BOT_PROTECTION.MAX_MESSAGES_PER_MINUTE) {
    return false;
  }
  
  activity.messageCount++;
  return true;
}

function checkRoomJoinRate(socketId) {
  const activity = userActivity.get(socketId);
  if (!activity) return true;
  
  const now = Date.now();
  const timeSinceJoin = now - activity.joinTime;
  
  // Сбрасываем счетчик комнат каждый час
  if (timeSinceJoin > 3600000) {
    activity.roomJoins = 0;
    activity.joinTime = now;
  }
  
  // Проверяем лимит комнат в час
  if (activity.roomJoins >= BOT_PROTECTION.MAX_ROOMS_PER_HOUR) {
    return false;
  }
  
  activity.roomJoins++;
  return true;
}

function validateMessage(text) {
  if (!text || typeof text !== 'string') return false;
  if (text.length > BOT_PROTECTION.MAX_MESSAGE_LENGTH) return false;
  if (text.trim().length === 0) return false;
  
  // Проверяем на спам-паттерны
  const spamPatterns = [
    /(.)\1{10,}/, // Повторяющиеся символы
    /https?:\/\/[^\s]+/gi, // Ссылки
    /[A-Z]{10,}/, // Много заглавных букв подряд
    /[0-9]{10,}/ // Много цифр подряд
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(text)) return false;
  }
  
  return true;
}

function validateUserName(userName) {
  if (!userName || typeof userName !== 'string') return false;
  if (userName.length > BOT_PROTECTION.MAX_USERNAME_LENGTH) return false;
  if (userName.trim().length < 2) return false;
  
  // Проверяем на нежелательные символы
  const invalidChars = /[<>\"'&]/;
  if (invalidChars.test(userName)) return false;
  
  return true;
}

io.on('connection', (socket) => {
  let currentRoomId = null;
  
  // Инициализируем активность пользователя
  initializeUserActivity(socket.id);
  
  // Обработчик ping для отслеживания активности
  socket.on('ping', () => {
    updateUserActivity(socket.id);
    socket.emit('pong');
  });

  socket.on('join', (roomId) => {
    if (VERBOSE_LOGS) console.log(`Socket ${socket.id} joining room ${roomId}`);
    
    // Проверяем лимит комнат
    if (!checkRoomJoinRate(socket.id)) {
      if (VERBOSE_LOGS) console.log(`Socket ${socket.id} exceeded room join rate limit`);
      socket.emit('error', { message: 'Превышен лимит присоединений к комнатам' });
      return;
    }
    
    // Выходим из предыдущей комнаты если есть
    if (currentRoomId) {
      socket.leave(currentRoomId);
      const prevPeers = roomIdToSocketIds.get(currentRoomId);
      if (prevPeers) {
        prevPeers.delete(socket.id);
        socket.to(currentRoomId).emit('peer-left', { socketId: socket.id });
        if (prevPeers.size === 0) roomIdToSocketIds.delete(currentRoomId);
      }
    }

    if (!roomIdToSocketIds.has(roomId)) roomIdToSocketIds.set(roomId, new Set());
    const peers = roomIdToSocketIds.get(roomId);
    peers.add(socket.id);
    socket.join(roomId);
    currentRoomId = roomId;

    // Отправляем новому пиру список всех существующих пиров
    const existingPeers = [...peers].filter(id => id !== socket.id);
    if (VERBOSE_LOGS) console.log(`Sending peers list to ${socket.id}:`, existingPeers);
    socket.emit('peers-list', { peers: existingPeers });

    // Уведомляем всех существующих пиров о новом участнике
    if (VERBOSE_LOGS) console.log(`Notifying room ${roomId} about new peer: ${socket.id}`);
    socket.to(roomId).emit('peer-joined', { socketId: socket.id });
  });

  socket.on('leave', (roomId) => {
    if (VERBOSE_LOGS) console.log(`Socket ${socket.id} leaving room ${roomId}`);
    const peers = roomIdToSocketIds.get(roomId);
    if (peers) {
      peers.delete(socket.id);
      socket.to(roomId).emit('peer-left', { socketId: socket.id });
      if (peers.size === 0) roomIdToSocketIds.delete(roomId);
    }
    socket.leave(roomId);
    if (currentRoomId === roomId) currentRoomId = null;
  });

  socket.on('disconnect', (reason) => {
    if (VERBOSE_LOGS) console.log(`Socket ${socket.id} disconnected, reason: ${reason}`);
    
    // Немедленно уведомляем всех в комнате о выходе пользователя
    if (currentRoomId) {
      const peers = roomIdToSocketIds.get(currentRoomId);
      if (peers) {
        peers.delete(socket.id);
        // Отправляем уведомление о выходе всем участникам комнаты
        socket.to(currentRoomId).emit('peer-left', { socketId: socket.id });
        if (peers.size === 0) {
          roomIdToSocketIds.delete(currentRoomId);
          if (VERBOSE_LOGS) console.log(`Room ${currentRoomId} is now empty, deleting`);
        }
      }
    }
    
    // Очищаем все данные пользователя
    socketIdToUserName.delete(socket.id);
    userActivity.delete(socket.id);
  });

  socket.on('signal', ({ to, data }) => {
    if (to) {
      if (VERBOSE_LOGS) console.log(`Signal from ${socket.id} to ${to}:`, data.type || 'candidate');
      io.to(to).emit('signal', { from: socket.id, data });
    }
  });

  socket.on('set-user-name', ({ userName }) => {
    if (VERBOSE_LOGS) console.log(`Socket ${socket.id} set name to: ${userName}`);
    
    // Проверяем валидность имени
    if (!validateUserName(userName)) {
      if (VERBOSE_LOGS) console.log(`Socket ${socket.id} provided invalid username: ${userName}`);
      socket.emit('error', { message: 'Недопустимое имя пользователя' });
      return;
    }
    
    socketIdToUserName.set(socket.id, userName);
    
    // Уведомляем всех в текущей комнате о новом имени
    if (currentRoomId) {
      socket.to(currentRoomId).emit('user-name-set', { 
        socketId: socket.id, 
        userName: userName 
      });
    }
  });

  socket.on('chat-message', ({ author, text, timestamp }) => {
    if (VERBOSE_LOGS) console.log(`Chat message from ${socket.id} (${author})`);
    
    // Проверяем валидность сообщения
    if (!validateMessage(text)) {
      if (VERBOSE_LOGS) console.log(`Socket ${socket.id} sent invalid message`);
      socket.emit('error', { message: 'Недопустимое сообщение' });
      return;
    }
    
    // Проверяем лимит сообщений
    if (!checkMessageRate(socket.id)) {
      if (VERBOSE_LOGS) console.log(`Socket ${socket.id} exceeded message rate limit`);
      socket.emit('error', { message: 'Превышен лимит сообщений' });
      return;
    }
    
    // Пересылаем сообщение всем в текущей комнате
    if (currentRoomId) {
      socket.to(currentRoomId).emit('chat-message', {
        author: author,
        text: text,
        timestamp: timestamp
      });
    }
  });
});

app.use(express.static(path.join(__dirname, 'public')));

// Запускаем интервал проверки неактивных пользователей
setInterval(checkInactiveUsers, INACTIVITY_CHECK_INTERVAL);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Adeita Vichat listening on http://localhost:${PORT}`);
});