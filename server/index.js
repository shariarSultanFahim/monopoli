const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const rooms = {}; 
const MAX_PLAYERS = 6;
const STARTING_CASH = 1500;

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').substring(0, 5).toUpperCase();
}

function initGameState(players) {
  return {
    turnIndex: 0,
    players: players.map(p => ({
      ...p,
      cash: STARTING_CASH,
      position: 0,
      properties: [], // Array of board IDs owned
      inJail: false,
      jailTurns: 0,
      bankrupt: false
    })),
    boardOwnership: {}, // Map of property ID to player ID
    log: ['Game started!'],
    awaitingAction: null // e.g. { type: 'buy', spaceId: 1, amount: 60 } or null
  };
}

io.on('connection', (socket) => {
  socket.on('create_room', (playerName, callback) => {
    let roomCode;
    do { roomCode = generateRoomCode(); } while (rooms[roomCode]);
    
    const player = { id: socket.id, name: playerName, color: '#ef4444', isHost: true };
    rooms[roomCode] = { id: roomCode, host: socket.id, players: [player], started: false, state: null };

    socket.join(roomCode);
    if(callback) callback({ success: true, roomCode, room: rooms[roomCode] });
    io.to(roomCode).emit('room_update', rooms[roomCode]);
  });

  socket.on('join_room', ({ roomCode, playerName }, callback) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];
    if (!room) return callback && callback({ success: false, message: 'Room not found' });
    if (room.started) return callback && callback({ success: false, message: 'Game already started' });
    if (room.players.length >= MAX_PLAYERS) return callback && callback({ success: false, message: 'Room full' });

    const existingName = room.players.find(p => p.name === playerName);
    const finalName = existingName ? `${playerName} 2` : playerName;
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    const usedColors = room.players.map(p => p.color);
    const availableColor = colors.find(c => !usedColors.includes(c)) || colors[0];

    const player = { id: socket.id, name: finalName, color: availableColor, isHost: false };
    room.players.push(player);
    socket.join(roomCode);
    
    if(callback) callback({ success: true, roomCode, room });
    io.to(roomCode).emit('room_update', room);
  });

  socket.on('start_game', (roomCode, callback) => {
    const room = rooms[roomCode];
    if (room && room.host === socket.id) {
      room.started = true;
      room.state = initGameState(room.players);
      io.to(roomCode).emit('game_started', room.state);
      if(callback) callback({ success: true });
    }
  });

  socket.on('roll_dice', (roomCode) => {
    const room = rooms[roomCode];
    if(!room || !room.started) return;
    const s = room.state;
    const activePlayer = s.players[s.turnIndex];
    if(activePlayer.id !== socket.id) return;
    if(s.awaitingAction) return;

    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;

    s.log.push(`${activePlayer.name} rolled ${total}`);

    // Very simple movement (ignoring jail doubles logic for now)
    activePlayer.position = (activePlayer.position + total) % 40;
    
    // Passing Go
    if (activePlayer.position < total && activePlayer.position !== 0) {
      activePlayer.cash += 200;
      s.log.push(`${activePlayer.name} passed GO, collected ৳200`);
    }

    io.to(roomCode).emit('dice_rolled', { d1: die1, d2: die2 });
    io.to(roomCode).emit('game_update', s);

    // After move actions
    setTimeout(() => {
      handleLanded(room, activePlayer, die1 === die2);
    }, 1500); // give UI time to animate
  });

  function handleLanded(room, player, isDouble) {
    const s = room.state;
    io.to(room.id).emit('game_update', s);
    // Real complete logic requires checking space id
    // simplified: just emit event for client to prompt buy/rent/etc.
    // If we just want a fully functioning MVP, let's keep game state updated, but let client say "End Turn".
    io.to(room.id).emit('landed', { playerId: player.id, spaceId: player.position, isDouble });
  }

  socket.on('perform_action', ({ roomCode, action, payload }) => {
    const room = rooms[roomCode];
    if(!room) return;
    const s = room.state;
    const p = s.players.find(pl => pl.id === socket.id);
    if (!p) return;

    if (action === 'buy') {
      if (p.cash >= payload.price) {
        p.cash -= payload.price;
        p.properties.push(payload.spaceId);
        s.boardOwnership[payload.spaceId] = p.id;
        s.log.push(`${p.name} bought space ${payload.spaceId} for ৳${payload.price}`);
      }
    } else if (action === 'pay_rent') {
      const owner = s.players.find(pl => pl.id === payload.ownerId);
      if (owner) {
        p.cash -= payload.amount;
        owner.cash += payload.amount;
        s.log.push(`${p.name} paid ৳${payload.amount} rent to ${owner.name}`);
      }
    } else if (action === 'pay_tax') {
      p.cash -= payload.amount;
      s.log.push(`${p.name} paid ৳${payload.amount} tax`);
    }

    if (p.cash < 0) {
       p.bankrupt = true;
       s.log.push(`${p.name} is bankrupt!`);
       // Free properties
       p.properties.forEach(propId => delete s.boardOwnership[propId]);
       p.properties = [];
    }

    io.to(roomCode).emit('game_update', s);
  });

  socket.on('end_turn', (roomCode) => {
    const room = rooms[roomCode];
    if(!room) return;
    const s = room.state;
    if(s.players[s.turnIndex].id !== socket.id) return;
    
    // Find next non-bankrupt player
    do {
      s.turnIndex = (s.turnIndex + 1) % s.players.length;
    } while (s.players[s.turnIndex].bankrupt);

    s.log.push(`Turn ended. Now ${s.players[s.turnIndex].name}'s turn.`);
    io.to(roomCode).emit('game_update', s);
  });

  socket.on('disconnect', () => {
    for (const [roomCode, room] of Object.entries(rooms)) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          delete rooms[roomCode];
        } else {
          if (room.host === socket.id) {
            room.host = room.players[0].id;
            room.players[0].isHost = true;
          }
          io.to(roomCode).emit('room_update', room);
        }
      }
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
