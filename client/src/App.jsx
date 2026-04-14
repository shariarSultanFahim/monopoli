import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import Lobby from './Lobby'
import Game from './Game'
import './App.css'

// Connect outside component to prevent reconnects on render
const serverUrl = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
const socket = io(serverUrl);

function App() {
  const [connected, setConnected] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [initialGameState, setInitialGameState] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => {
      setConnected(false);
      // optionally reset view entirely if disconnected
      // setGameStarted(false); setRoomData(null);
    });
    
    socket.on('room_update', (data) => {
      setRoomData(data);
    });

    socket.on('game_started', (initialState) => {
      setInitialGameState(initialState);
      setGameStarted(true);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room_update');
      socket.off('game_started');
    };
  }, []);

  const handleCreateRoom = (playerName) => {
    setErrorMsg('');
    socket.emit('create_room', playerName, (res) => {
      if (!res.success) setErrorMsg(res.message || 'Failed to create room');
    });
  };

  const handleJoinRoom = (roomCode, playerName) => {
    setErrorMsg('');
    socket.emit('join_room', { roomCode, playerName }, (res) => {
      if (!res.success) setErrorMsg(res.message);
    });
  };

  const handleStartGame = (roomCode) => {
    socket.emit('start_game', roomCode, (res) => {
      if (!res.success) setErrorMsg(res.message);
    });
  };

  // If game is started, we take over the whole screen
  if (gameStarted && initialGameState) {
    return <Game socket={socket} roomCode={roomData.id} initialGameState={initialGameState} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100 p-4 font-sans">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500 max-w-2xl text-shadow-sm">
          Dhoni Hobar Mojar Khela
        </h1>
        <div className="flex items-center justify-center space-x-2 text-sm text-slate-400 font-medium">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500'}`}></div>
          <span>{connected ? 'Server Connected' : 'Connecting to Server...'}</span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-6 max-w-md w-full font-medium">
          {errorMsg}
        </div>
      )}

      <Lobby
        socket={socket}
        roomData={roomData}
        onJoinRoom={handleJoinRoom}
        onCreateRoom={handleCreateRoom}
        onStartGame={handleStartGame}
        myId={socket.id}
      />
    </div>
  )
}

export default App
