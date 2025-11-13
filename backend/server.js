const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors({
  origin: ["http://localhost:3000", "https://your-app.vercel.app"], // замените на ваш домен
  methods: ["GET", "POST"]
}));
app.use(express.json());

// Статика для фронтенда (если хотим все в одном)
app.use(express.static(path.join(__dirname, '../frontend/public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Разрешаем все домены для публичного доступа
    methods: ["GET", "POST"]
  }
});

// Ваш существующий код socket.io...
io.on('connection', (socket) => {
  console.log('✅ Новый пользователь подключен:', socket.id);

  socket.on('join-city-room', (city) => {
    socket.join(city);
    socket.userData = { city, id: socket.id };
    socket.to(city).emit('user-joined', socket.id);
    socket.emit('room-joined', city);
    console.log(`👤 Пользователь ${socket.id} в городе: ${city}`);
  });

  socket.on('find-partner', (city) => {
    const room = io.sockets.adapter.rooms.get(city);
    if (room && room.size > 1) {
      const users = Array.from(room).filter(id => id !== socket.id);
      if (users.length > 0) {
        const partnerId = users[0];
        socket.partnerId = partnerId;
        socket.to(partnerId).emit('partner-found', socket.id);
        socket.emit('partner-found', partnerId);
      } else {
        socket.emit('waiting-for-partner');
      }
    } else {
      socket.emit('waiting-for-partner');
    }
  });

  // WebRTC сигналы
  socket.on('webrtc-offer', (offer, partnerId) => {
    socket.to(partnerId).emit('webrtc-offer', offer, socket.id);
  });

  socket.on('webrtc-answer', (answer, partnerId) => {
    socket.to(partnerId).emit('webrtc-answer', answer, socket.id);
  });

  socket.on('webrtc-ice-candidate', (candidate, partnerId) => {
    socket.to(partnerId).emit('webrtc-ice-candidate', candidate, socket.id);
  });

  socket.on('disconnect', () => {
    console.log('❌ Пользователь отключен:', socket.id);
    if (socket.partnerId) {
      socket.to(socket.partnerId).emit('partner-disconnected');
    }
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Публичный сервер запущен на порту ${PORT}`);
});