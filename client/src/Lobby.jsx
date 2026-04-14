import { useState } from 'react';

export default function Lobby({ socket, roomData, onJoinRoom, onCreateRoom, onStartGame, myId }) {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // If we are already in a room, display the room details
  if (roomData) {
    const isHost = roomData.host === myId;
    return (
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Lobby</h2>
          <div className="bg-slate-900 mx-auto px-4 py-2 rounded-lg inline-block font-mono text-3xl tracking-widest text-emerald-400 font-bold shadow-inner">
            {roomData.id}
          </div>
          <p className="text-slate-400 mt-2 text-sm">Share this code with your friends</p>
        </div>

        <div className="space-y-3 mb-8">
          <h3 className="text-slate-300 uppercase text-xs font-bold tracking-wider">Players ({roomData.players.length}/6)</h3>
          {roomData.players.map(player => (
            <div key={player.id} className="flex items-center space-x-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
              <div
                className="w-4 h-4 rounded-full shadow-sm"
                style={{ backgroundColor: player.color }}
              ></div>
              <span className="text-slate-200 font-medium flex-1">
                {player.name} {player.id === myId ? <span className="text-slate-500 text-sm">(You)</span> : ''}
              </span>
              {player.isHost && (
                <span className="bg-amber-500/10 text-amber-500 text-xs px-2 py-1 rounded font-bold">HOST</span>
              )}
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={() => onStartGame(roomData.id)}
            disabled={roomData.players.length < 2}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold py-3 px-4 rounded-lg transition-colors shadow-lg disabled:shadow-none"
          >
            {roomData.players.length < 2 ? 'Need more players...' : 'Start Game'}
          </button>
        ) : (
          <div className="text-center p-3 text-emerald-500/80 bg-emerald-500/10 rounded-lg font-medium border border-emerald-500/20">
            Waiting for host to start...
          </div>
        )}
      </div>
    );
  }

  // Pre-room form (Join/Create)
  return (
    <div className="bg-slate-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
      <h2 className="text-2xl font-black text-white text-center mb-8">Join the Game</h2>
      
      <div className="mb-6">
        <label className="block text-slate-400 text-sm font-bold mb-2">Display Name</label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          maxLength={15}
          className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg py-3 px-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
        />
      </div>

      <div className="space-y-4 pt-2 border-t border-slate-700">
        <div>
          <label className="block text-slate-400 text-sm font-bold mb-2">Have a code?</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room Code"
              maxLength={5}
              className="w-2/3 bg-slate-900 text-white font-mono uppercase tracking-widest border border-slate-700 rounded-lg py-3 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-bold placeholder:tracking-normal placeholder:font-sans placeholder:font-normal"
            />
            <button
              onClick={() => onJoinRoom(joinCode, playerName)}
              disabled={!playerName.trim() || joinCode.length < 3}
              className="w-1/3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg disabled:shadow-none"
            >
              Join
            </button>
          </div>
        </div>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-800 text-slate-400 font-bold uppercase tracking-wider">or</span>
          </div>
        </div>

        <button
          onClick={() => onCreateRoom(playerName)}
          disabled={!playerName.trim()}
          className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg transition-colors border border-slate-600 shadow-sm"
        >
          Create New Room
        </button>
      </div>
    </div>
  );
}
