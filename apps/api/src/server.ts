import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let ioInstance: Server | null = null;

export const setupSocket = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  ioInstance = io;

  console.log('Socket.io initialized and attached to HTTP server');

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a match room
    socket.on('joinMatch', (matchId: string) => {
      socket.join(`match_${matchId}`);
      console.log(`User joined match room: match_${matchId}`);
    });

    // Broadcast ball-by-ball updates
    socket.on('ballUpdate', (data) => {
      const { matchId, ball } = data;
      console.log(`Broadcasting ball update for match_${matchId}:`, ball);
      io.to(`match_${matchId}`).emit('ballUpdate', ball);
    });

    socket.on('disconnect', () => {
      console.log('A user disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = (): Server | null => ioInstance;