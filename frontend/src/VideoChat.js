import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const VideoChat = () => {
  const [socket, setSocket] = useState(null);
  const [currentCity, setCurrentCity] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [partnerId, setPartnerId] = useState(null);
  
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnection = useRef();
  const localStream = useRef();

  // Список российских городов для выбора
  const russianCities = [
    'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
    'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
    'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград'
  ];

  useEffect(() => {
    // Инициализация socket.io
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // Обработчики событий
    newSocket.on('connect', () => {
      setStatus('connected');
      console.log('Connected to server');
    });

    newSocket.on('room-joined', (city) => {
      setStatus(`connected to ${city}`);
    });

    newSocket.on('partner-found', (foundPartnerId) => {
      setPartnerId(foundPartnerId);
      setStatus('in call');
      startWebRTC(foundPartnerId);
    });

    newSocket.on('waiting-for-partner', () => {
      setStatus('searching for partner');
    });

    newSocket.on('partner-disconnected', () => {
      setStatus('partner disconnected');
      setPartnerId(null);
      endCall();
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinCity = async (city) => {
    if (!socket) return;
    
    setCurrentCity(city);
    socket.emit('join-city-room', city);
    setStatus(`joined ${city}`);
    
    // Запрашиваем доступ к камере и микрофону
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      localStream.current = stream;
      localVideoRef.current.srcObject = stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Не удалось получить доступ к камере и микрофону. Проверьте разрешения браузера.');
    }
  };

  const findPartner = () => {
    if (!socket || !currentCity) return;
    socket.emit('find-partner', currentCity);
    setStatus('searching...');
  };

  const startWebRTC = (targetPartnerId) => {
    if (!localStream.current) return;

    // Создаем peer connection
    peerConnection.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    // Добавляем локальный поток
    localStream.current.getTracks().forEach(track => {
      peerConnection.current.addTrack(track, localStream.current);
    });

    // Обрабатываем удаленный поток
    peerConnection.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    // Обмен ICE кандидатами
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', event.candidate, targetPartnerId);
      }
    };

    // Создаем offer
    peerConnection.current.createOffer()
      .then(offer => peerConnection.current.setLocalDescription(offer))
      .then(() => {
        socket.emit('webrtc-offer', 
          peerConnection.current.localDescription, 
          targetPartnerId
        );
      });

    // Обработчики WebRTC сигналов от сервера
    socket.on('webrtc-offer', async (offer, from) => {
      await peerConnection.current.setRemoteDescription(offer);
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('webrtc-answer', answer, from);
    });

    socket.on('webrtc-answer', (answer) => {
      peerConnection.current.setRemoteDescription(answer);
    });

    socket.on('webrtc-ice-candidate', (candidate) => {
      peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    });
  };

  const endCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (socket && partnerId) {
      socket.emit('end-call');
    }
    setPartnerId(null);
    setStatus(`connected to ${currentCity}`);
    
    // Останавливаем видео только удаленного пользователя
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const leaveCity = () => {
    endCall();
    setCurrentCity('');
    setStatus('connected');
    if (socket) {
      socket.emit('leave-city-room');
    }
    
    // Останавливаем локальное видео
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>🎥 Видеочат знакомств по городам России</h1>
      
      {!currentCity ? (
        <div>
          <h2>Выберите ваш город:</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {russianCities.map(city => (
              <button
                key={city}
                onClick={() => joinCity(city)}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2>Город: {currentCity}</h2>
            <p>Статус: {status}</p>
            
            {!partnerId ? (
              <button 
                onClick={findPartner}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🔍 Найти собеседника
              </button>
            ) : (
              <button 
                onClick={endCall}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                📞 Завершить звонок
              </button>
            )}
            
            <button 
              onClick={leaveCity}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                marginLeft: '10px'
              }}
            >
              🚪 Покинуть город
            </button>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <div>
              <h3>Ваше видео:</h3>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '400px', height: '300px', border: '1px solid #ccc' }}
              />
            </div>
            
            <div>
              <h3>Собеседник:</h3>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: '400px', height: '300px', border: '1px solid #ccc' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoChat;