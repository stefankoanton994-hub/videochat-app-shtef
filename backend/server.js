const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Простое хранилище пар пользователей
const activePairs = new Map();

io.on('connection', (socket) => {
  console.log('✅ Пользователь подключен:', socket.id);

  // Присоединение к комнате города
  socket.on('join-city-room', (city) => {
    socket.join(city);
    console.log(`👤 ${socket.id} присоединился к ${city}`);
    socket.emit('room-joined', city);
  });

  // Поиск собеседника
  socket.on('find-partner', (city) => {
    const room = io.sockets.adapter.rooms.get(city);
    
    if (room && room.size > 1) {
      const users = Array.from(room).filter(id => id !== socket.id);
      
      if (users.length > 0) {
        const partnerId = users[0];
        
        // Сохраняем пару
        activePairs.set(socket.id, partnerId);
        activePairs.set(partnerId, socket.id);
        
        // Уведомляем обоих
        socket.emit('partner-found', partnerId);
        socket.to(partnerId).emit('partner-found', socket.id);
        
        console.log(`🤝 Создана пара: ${socket.id} и ${partnerId}`);
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

  // Отключение
  socket.on('disconnect', () => {
    console.log('❌ Пользователь отключен:', socket.id);
    
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      socket.to(partnerId).emit('partner-disconnected');
      activePairs.delete(socket.id);
      activePairs.delete(partnerId);
    }
  });
});

// Статус сервера
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    activeConnections: io.engine.clientsCount 
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});