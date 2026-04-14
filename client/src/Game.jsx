import React, { useEffect, useState } from 'react';
import { BOARD_SPACES, COLOR_MAP } from './boardConfig';

export default function Game({ socket, roomCode, initialGameState }) {
  const [gameState, setGameState] = useState(initialGameState);
  const [dice, setDice] = useState({ d1: 1, d2: 1 });
  const [modalAction, setModalAction] = useState(null); // { type, space, amount, ownerId }

  useEffect(() => {
    socket.on('game_update', (state) => setGameState(state));
    socket.on('dice_rolled', (res) => setDice(res));
    socket.on('landed', ({ playerId, spaceId }) => {
      if (playerId !== socket.id) return;
      const space = BOARD_SPACES[spaceId];
      const ownerId = gameState.boardOwnership[spaceId];
      
      if (space.type === 'property' || space.type === 'station' || space.type === 'utility') {
        if (!ownerId) {
          setModalAction({ type: 'buy', space, spaceId, price: space.price, amount: space.price });
        } else if (ownerId !== socket.id) {
          // simplified: rent is fixed base for now
          setModalAction({ type: 'pay_rent', space, spaceId, amount: space.rent || 25, ownerId });
        } else {
          setModalAction({ type: 'end_turn', space: null });
        }
      } else if (space.type === 'tax') {
        setModalAction({ type: 'pay_tax', space, amount: space.price });
      } else {
        setModalAction({ type: 'end_turn', space: null });
      }
    });

    return () => {
      socket.off('game_update');
      socket.off('dice_rolled');
      socket.off('landed');
    };
  }, [socket, gameState]);

  const activePlayer = gameState.players[gameState.turnIndex];
  const isMyTurn = activePlayer.id === socket.id;
  const me = gameState.players.find(p => p.id === socket.id);

  const rollDice = () => socket.emit('roll_dice', roomCode);
  const endTurn = () => {
    setModalAction(null);
    socket.emit('end_turn', roomCode);
  };

  const handleAction = () => {
    if (!modalAction) return;
    socket.emit('perform_action', { roomCode, action: modalAction.type, payload: modalAction });
    setModalAction(null);
    socket.emit('end_turn', roomCode); // auto end turn after action for MVP
  };

  const renderCell = (id) => {
    const space = BOARD_SPACES[id];
    if (!space) return null;
    const playersHere = gameState.players.filter(p => !p.bankrupt && p.position === id);
    const ownerId = gameState.boardOwnership[id];
    let ownerColor = null;
    if (ownerId) {
      ownerColor = gameState.players.find(p => p.id === ownerId)?.color;
    }

    return (
      <div key={id} className={`flex flex-col relative text-[9px] border bg-slate-100 text-slate-800 border-slate-300 w-full h-full overflow-hidden text-center`}>
        {space.color && <div className="h-4 w-full border-b border-black" style={{ backgroundColor: COLOR_MAP[space.color] }}></div>}
        <div className="flex-1 p-[2px] font-bold lead-tight flex items-center justify-center">
            {space.name}
        </div>
        {space.price > 0 && <div className="pb-[2px]">৳{space.price}</div>}
        {ownerColor && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-tl-full border-l border-t border-black" style={{ backgroundColor: ownerColor }}></div>}
        
        {/* Render Players */}
        <div className="absolute inset-0 flex flex-wrap items-center justify-center pointer-events-none p-1 gap-1">
            {playersHere.map(p => (
                <div key={p.id} className="w-4 h-4 rounded-full shadow-md border border-white z-10 animate-bounce" style={{ backgroundColor: p.color }}></div>
            ))}
        </div>
      </div>
    );
  };

  const boardCells = Array.from({ length: 40 }).map((_, i) => renderCell(i));

  return (
    <div className="w-full flex md:flex-row flex-col h-full bg-slate-900 border-t border-slate-800 absolute inset-0 overflow-hidden text-slate-200">
      
      {/* Sidebar Info */}
      <div className="md:w-64 w-full md:border-r border-b border-slate-700 bg-slate-800 p-4 overflow-y-auto z-20 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-emerald-400 border-b border-slate-700 pb-2">Players</h2>
        <div className="space-y-3 mb-6">
          {gameState.players.map((p, i) => (
            <div key={p.id} className={`p-2 rounded border ${i === gameState.turnIndex ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900/50'} ${p.bankrupt ? 'opacity-30 line-through' : ''}`}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                <div className="font-bold flex-1">{p.name}</div>
                <div className="text-emerald-300 font-mono">৳{p.cash}</div>
              </div>
            </div>
          ))}
        </div>

        <h3 className="font-bold border-b border-slate-700 pb-2 mb-2 text-blue-300">My Properties ({me.properties.length})</h3>
        <div className="flex flex-wrap gap-1 mb-6 text-xs font-mono bg-slate-900 p-2 rounded max-h-32 overflow-y-auto border border-slate-700">
            {me.properties.length === 0 ? <span className="text-slate-500 italic">None yet</span> :
             me.properties.map(id => (
                 <span key={id} className="bg-slate-700 px-1 py-0.5 rounded">{BOARD_SPACES[id].name}</span>
             ))
            }
        </div>

        <h3 className="font-bold border-b border-slate-700 pb-2 mb-2 text-slate-400">Game Log</h3>
        <div className="h-40 overflow-y-auto text-xs font-mono bg-slate-900 p-2 rounded flex flex-col-reverse justify-start border border-slate-700">
          {[...gameState.log].reverse().map((msg, i) => (
            <div key={i} className="mb-1 text-slate-300">{msg}</div>
          ))}
        </div>
      </div>

      {/* Board Layout */}
      <div className="flex-1 flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
        <div className="relative border-4 border-slate-900 bg-[#cce3c6] shadow-2xl shrink-0" style={{ width: '85vh', height: '85vh', maxWidth: '800px', maxHeight: '800px' }}>
            
            {/* The actual Grid */}
            <div className="w-full h-full relative">
                {/* Top Row: 20 -> 30 */}
                <div className="absolute top-0 left-0 right-0 h-[12.5%] flex">
                    <div className="w-[12.5%] h-full shrink-0">{boardCells[20]}</div>
                    <div className="flex-1 flex">{boardCells.slice(21, 30).map(c => <div key={c.key} className="flex-1 h-full">{c}</div>)}</div>
                    <div className="w-[12.5%] h-full shrink-0">{boardCells[30]}</div>
                </div>

                {/* Right Col: 31 -> 39 */}
                <div className="absolute top-[12.5%] bottom-[12.5%] right-0 w-[12.5%] flex flex-col">
                    {boardCells.slice(31, 40).map(c => <div key={c.key} className="flex-1 w-full">{c}</div>)}
                </div>

                {/* Bottom Row: 10 <- 0 */}
                <div className="absolute bottom-0 left-0 right-0 h-[12.5%] flex">
                    <div className="w-[12.5%] h-full shrink-0">{boardCells[10]}</div>
                    <div className="flex-1 flex flex-row-reverse">{boardCells.slice(1, 10).map(c => <div key={c.key} className="flex-1 h-full">{c}</div>)}</div>
                    <div className="w-[12.5%] h-full shrink-0">{boardCells[0]}</div>
                </div>

                {/* Left Col: 19 <- 11 */}
                <div className="absolute top-[12.5%] bottom-[12.5%] left-0 w-[12.5%] flex flex-col-reverse">
                    {boardCells.slice(11, 20).map(c => <div key={c.key} className="flex-1 w-full">{c}</div>)}
                </div>

                {/* Center / Action Area */}
                <div className="absolute top-[12.5%] bottom-[12.5%] left-[12.5%] right-[12.5%] flex flex-col items-center justify-center p-4">
                    <h1 className="text-3xl font-black mb-8 text-black opacity-30 uppercase tracking-widest text-center leading-tight">Dhoni Hobar<br/>Mojar Khela</h1>
                    
                    <div className="flex space-x-4 mb-8">
                        <div className="w-16 h-16 bg-white border border-slate-300 rounded-xl shadow-lg flex items-center justify-center text-4xl font-black text-black">{dice.d1}</div>
                        <div className="w-16 h-16 bg-white border border-slate-300 rounded-xl shadow-lg flex items-center justify-center text-4xl font-black text-black">{dice.d2}</div>
                    </div>

                    <div className="h-32 w-full max-w-sm flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl relative z-30">
                       {!modalAction ? (
                          isMyTurn ? (
                             <button onClick={rollDice} className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black py-4 px-10 rounded-xl text-xl w-full shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all transform hover:scale-105 active:scale-95">ROLL DICE</button>
                          ) : (
                             <div className="font-bold text-slate-400 animate-pulse text-lg py-4">Waiting for {activePlayer.name}'s Action...</div>
                          )
                       ) : (
                          <div className="w-full text-center flex flex-col h-full justify-between">
                              <h3 className="font-bold text-lg text-white">Action Required</h3>
                              {modalAction.type === 'buy' && <p>Buy {modalAction.space.name} for ৳{modalAction.amount}?</p>}
                              {modalAction.type === 'pay_rent' && <p className="text-red-400">Pay ৳{modalAction.amount} rent for landing on {modalAction.space.name}!</p>}
                              {modalAction.type === 'pay_tax' && <p className="text-red-400">Pay ৳{modalAction.amount} logic/tax!</p>}
                              {modalAction.type === 'end_turn' && <p className="text-yellow-400">Nothing to do here.</p>}
                              
                              <div className="flex justify-center mt-2 gap-2">
                                 {modalAction.type === 'buy' ? (
                                    <>
                                       <button onClick={handleAction} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-4 rounded shadow">Buy</button>
                                       <button onClick={endTurn} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-1 px-4 rounded">Pass</button>
                                    </>
                                 ) : modalAction.type === 'end_turn' ? (
                                     <button onClick={endTurn} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-4 rounded w-full">End Turn</button>
                                 ) : (
                                     <button onClick={handleAction} className="bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-4 rounded w-full">Pay ৳{modalAction.amount}</button>
                                 )}
                              </div>
                          </div>
                       )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
