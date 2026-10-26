import { io, Socket } from 'socket.io-client';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== 'undefined'
    ? (window.location.port === '5173' || window.location.port === '3000'
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : window.location.origin)
    : 'http://localhost:3001');

export const socket: Socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
