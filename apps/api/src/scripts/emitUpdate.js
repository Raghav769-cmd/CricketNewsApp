// Simple emitter script to test socket.io server

const { io } = require('socket.io-client');

const MATCH_ID = process.argv[2] || '1';
const WS_URL = process.env.WS_URL || 'http://localhost:5000';

const socket = io(WS_URL, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('Connected to socket.io server as emitter, id=', socket.id);

  const payload = {
    matchId: String(MATCH_ID),
    liveScore: 'Toss-up 0/0',
  };

  console.log('Emitting ballUpdate:', payload);
  socket.emit('ballUpdate', payload);

  // leave open for a short time to ensure delivery, then exit
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 500);
});

socket.on('connect_error', (err) => {
  console.error('connect_error', err);
  process.exit(1);
});
