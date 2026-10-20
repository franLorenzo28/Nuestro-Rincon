import test from 'node:test';
import assert from 'node:assert/strict';
import { ticTacToeResult, chooseMachineMove, createTicTacToeRoom,
  joinTicTacToeRoom, playTicTacToeRoom } from '../arcade-games.mjs';
import { isMurdokuSolved } from '../murdoku.mjs';

test('el tatetí reconoce victorias, empates y jugadas de bloqueo', () => {
  assert.equal(ticTacToeResult(['X', 'X', 'X', '', 'O', '', '', '', 'O']).winner, 'X');
  assert.equal(ticTacToeResult(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']).winner, 'draw');
  assert.equal(chooseMachineMove(['X', 'X', '', 'O', '', '', '', '', '']), 2);
  assert.equal(chooseMachineMove(['O', 'O', '', 'X', 'X', '', '', '', '']), 2);
});

test('la sala compartida exige unirse y respeta turnos y resultado', () => {
  let room = createTicTacToeRoom('ivy', 'sala-1');
  assert.equal(playTicTacToeRoom(room, 'ivy', 0), null);
  assert.equal(joinTicTacToeRoom(room, 'ivy'), null);
  room = joinTicTacToeRoom(room, 'pookis');
  assert.equal(room.status, 'playing');
  assert.equal(playTicTacToeRoom(room, 'pookis', 0), null);
  room = playTicTacToeRoom(room, 'ivy', 0);
  assert.equal(playTicTacToeRoom(room, 'ivy', 1), null);
  room = playTicTacToeRoom(room, 'pookis', 3);
  room = playTicTacToeRoom(room, 'ivy', 1);
  room = playTicTacToeRoom(room, 'pookis', 4);
  room = playTicTacToeRoom(room, 'ivy', 2);
  assert.equal(room.status, 'done');
  assert.equal(room.winner, 'X');
  assert.equal(playTicTacToeRoom(room, 'pookis', 5), null);
});

test('el caso de Murdoku tiene una única solución para sus pistas', () => {
  const candidates = [[0, 2], [10], [14], [19, 24], [21, 22, 23, 27, 29], [33]];
  let solutions = 0;
  function place(person, placements) {
    if (person === candidates.length) {
      if (isMurdokuSolved(placements)) solutions++;
      return;
    }
    for (const index of candidates[person]) {
      const next = placements.slice();next[index] = person;
      place(person + 1, next);
    }
  }
  place(0, Array(36).fill(null));
  assert.equal(solutions, 1);
});
