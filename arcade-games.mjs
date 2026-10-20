const element = (tag, className = '', value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};

const action = (label, className, handler) => {
  const button = element('button', className, label);
  button.type = 'button';
  button.addEventListener('click', handler);
  return button;
};

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export function ticTacToeResult(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: board.every(Boolean) ? 'draw' : null, line: [] };
}

export function chooseMachineMove(board, random = Math.random) {
  const free = board.flatMap((value, index) => value ? [] : [index]);
  if (!free.length) return -1;
  for (const mark of ['O', 'X']) {
    for (const index of free) {
      const trial = board.slice();
      trial[index] = mark;
      if (ticTacToeResult(trial).winner === mark) return index;
    }
  }
  if (free.includes(4)) return 4;
  const corners = free.filter(index => [0, 2, 6, 8].includes(index));
  const choices = corners.length ? corners : free;
  return choices[Math.floor(random() * choices.length)];
}

function ticTacToeBoard(board, onCell, line = [], disabled = false) {
  const grid = element('div', 'tateti-board');
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', 'Tablero de tatetí');
  board.forEach((mark, index) => {
    const cell = action(mark || '', `tateti-cell ${mark ? 'mark-' + mark.toLowerCase() : ''}${line.includes(index) ? ' winning' : ''}`, () => onCell(index));
    cell.setAttribute('aria-label', `Fila ${Math.floor(index / 3) + 1}, columna ${index % 3 + 1}: ${mark || 'vacía'}`);
    cell.disabled = disabled || Boolean(mark);
    grid.append(cell);
  });
  return grid;
}

const ROOM_KEY = 'tateti-room';
const emptyBoard = () => Array(9).fill('');
const validRoom = room => room && typeof room === 'object' && typeof room.id === 'string'
  && typeof room.host === 'string' && Array.isArray(room.board) && room.board.length === 9
  && room.board.every(value => ['', 'X', 'O'].includes(value))
  && ['waiting', 'playing', 'done', 'cancelled'].includes(room.status) ? room : null;

export function createTicTacToeRoom(userId, id = crypto.randomUUID()) {
  return { id, host: userId, guest: null, board: emptyBoard(), turn: 'X', status: 'waiting', winner: null };
}

export function joinTicTacToeRoom(room, userId) {
  if (!validRoom(room) || room.status !== 'waiting' || room.host === userId || room.guest) return null;
  return { ...room, guest: userId, status: 'playing' };
}

export function playTicTacToeRoom(room, userId, index) {
  if (!validRoom(room) || room.status !== 'playing' || !Number.isInteger(index)
    || index < 0 || index > 8 || room.board[index]) return null;
  const symbol = room.host === userId ? 'X' : room.guest === userId ? 'O' : null;
  if (!symbol || room.turn !== symbol) return null;
  const board = room.board.slice();
  board[index] = symbol;
  const result = ticTacToeResult(board);
  return { ...room, board, turn: symbol === 'X' ? 'O' : 'X',
    status: result.winner ? 'done' : 'playing', winner: result.winner };
}

export function openTicTacToe(root, dialog, { store, userId, onWin }) {
  let mode = 'menu', machineBoard = emptyBoard(), machineBusy = false, machineResult = null;
  let room = validRoom(store.get(ROOM_KEY, null)), machineTimer = null;
  const unsubscribe = store.onChange(ROOM_KEY, value => {
    room = validRoom(value);
    if (mode === 'shared') renderShared();
  });
  dialog.addEventListener('close', () => {
    clearTimeout(machineTimer);
    unsubscribe();
  }, { once: true });

  function menu() {
    mode = 'menu';
    clearTimeout(machineTimer);
    root.replaceChildren(
      element('p', '', 'Elegí cómo jugar. En pareja, una persona crea la sala y la otra se une desde su perfil.'),
      action('Contra la máquina', 'btn', () => { mode = 'machine'; resetMachine(); }),
      action('Jugar en pareja', 'btn s', () => { mode = 'shared'; renderShared(); })
    );
    root.className = 'gb tateti-menu';
  }

  function resetMachine() {
    clearTimeout(machineTimer);
    machineBoard = emptyBoard();
    machineBusy = false;
    machineResult = null;
    renderMachine();
  }

  function playMachine(index) {
    if (machineBusy || machineResult?.winner || machineBoard[index]) return;
    machineBoard[index] = 'X';
    machineResult = ticTacToeResult(machineBoard);
    if (machineResult.winner === 'X') onWin(machineBoard.filter(Boolean).length);
    if (!machineResult.winner) {
      machineBusy = true;
      machineTimer = setTimeout(() => {
        if (mode !== 'machine' || !dialog.open) return;
        const move = chooseMachineMove(machineBoard);
        if (move >= 0) machineBoard[move] = 'O';
        machineResult = ticTacToeResult(machineBoard);
        machineBusy = false;
        renderMachine();
      }, 350);
    }
    renderMachine();
  }

  function renderMachine() {
    root.className = 'gb';
    const result = machineResult || ticTacToeResult(machineBoard);
    const message = result.winner === 'X' ? '¡Ganaste!'
      : result.winner === 'O' ? 'Ganó la máquina.'
      : result.winner === 'draw' ? 'Empate.'
      : machineBusy ? 'Turno de la máquina…' : 'Sos X. Tu turno.';
    const controls = element('div', 'acc');
    controls.append(action('Otra partida', 'btn s', resetMachine), action('Cambiar modo', 'cerrar', menu));
    root.replaceChildren(
      element('p', 'game-status', message),
      ticTacToeBoard(machineBoard, playMachine, result.line, machineBusy || Boolean(result.winner)),
      controls
    );
  }

  function saveRoom(next) {
    if (!store.set(ROOM_KEY, next)) return;
    room = next;
    renderShared();
  }

  function createRoom() {
    saveRoom(createTicTacToeRoom(userId));
  }

  function joinRoom() {
    const joined = joinTicTacToeRoom(room, userId);
    if (joined) saveRoom(joined);
  }

  function playShared(index) {
    const next = playTicTacToeRoom(room, userId, index);
    if (!next) return;
    const symbol = room.host === userId ? 'X' : 'O';
    saveRoom(next);
    if (next.winner === symbol) onWin(next.board.filter(Boolean).length);
  }

  function renderShared() {
    root.className = 'gb';
    const controls = element('div', 'acc');
    controls.append(action('Cambiar modo', 'cerrar', menu));
    if (!room || room.status === 'cancelled' || (room.status === 'waiting' && room.host !== userId && room.guest)) {
      controls.prepend(action('Crear sala', 'btn', createRoom));
      root.replaceChildren(element('p', 'game-status', 'Todavía no hay una sala abierta.'), controls);
      return;
    }
    if (room.status === 'waiting') {
      if (room.host === userId) {
        controls.prepend(action('Cancelar sala', 'btn s', () => saveRoom({ ...room, status: 'cancelled' })));
        root.replaceChildren(element('p', 'game-status', 'Sala creada. La otra persona puede entrar a Tatetí y pulsar «Unirse».'), controls);
      } else {
        controls.prepend(action('Unirse a la partida', 'btn', joinRoom));
        root.replaceChildren(element('p', 'game-status', 'La otra persona creó una sala. ¡Unite para empezar!'), controls);
      }
      return;
    }
    const symbol = room.host === userId ? 'X' : room.guest === userId ? 'O' : null;
    const result = ticTacToeResult(room.board);
    const message = room.status === 'done'
      ? room.winner === 'draw' ? 'Empate.' : room.winner === symbol ? '¡Ganaste!' : 'Ganó la otra persona.'
      : !symbol ? 'Esta partida ya tiene dos jugadores.'
      : room.turn === symbol ? `Sos ${symbol}. Tu turno.` : `Sos ${symbol}. Turno de la otra persona.`;
    if (room.status === 'done') controls.prepend(action('Crear otra sala', 'btn s', createRoom));
    root.replaceChildren(
      element('p', 'game-status', message),
      ticTacToeBoard(room.board, playShared, result.line, room.status !== 'playing' || room.turn !== symbol),
      controls
    );
  }

  menu();
}

const SNAKE_SIZE = 18;
const SNAKE_PIXELS = 360;
const directions = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]
};

export function openSnake(root, dialog, { get, set, onWin }) {
  root.className = 'gb';
  const canvas = element('canvas', 'snake-canvas');
  canvas.width = canvas.height = SNAKE_PIXELS;
  canvas.setAttribute('aria-label', 'Tablero de la vivorita');
  const ctx = canvas.getContext('2d');
  const info = element('p', 'game-status');
  const message = element('p', 'snake-message', 'Comé las frutas sin tocar los bordes ni tu cuerpo. Usá las flechas, WASD o los botones. Con cinco frutas ganás puntos y el logro.');
  const playButton = action('Empezar', 'btn', toggle);
  const restartButton = action('Reiniciar', 'btn s', restart);
  const controls = element('div', 'acc');
  controls.append(playButton, restartButton);
  const arrows = element('div', 'snake-controls');
  for (const [label, key] of [['↑', 'ArrowUp'], ['←', 'ArrowLeft'], ['↓', 'ArrowDown'], ['→', 'ArrowRight']]) {
    const button = action(label, '', () => steer(directions[key]));
    button.setAttribute('aria-label', `Mover ${key.replace('Arrow', '').toLowerCase()}`);
    arrows.append(button);
  }
  root.replaceChildren(info, canvas, message, arrows, controls);

  let snake, food, direction, nextDirection, score, best = Number(get('snake-best', 0)) || 0;
  let timer = null, running = false, over = false, paused = false;
  let touchStart = null;

  function spawnFood() {
    const free = [];
    for (let y = 0; y < SNAKE_SIZE; y++) for (let x = 0; x < SNAKE_SIZE; x++) {
      if (!snake.some(piece => piece.x === x && piece.y === y)) free.push({ x, y });
    }
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function draw() {
    const cell = SNAKE_PIXELS / SNAKE_SIZE;
    ctx.fillStyle = '#F1E6C8';
    ctx.fillRect(0, 0, SNAKE_PIXELS, SNAKE_PIXELS);
    ctx.strokeStyle = 'rgba(94, 74, 66, .12)';
    for (let i = 1; i < SNAKE_SIZE; i++) {
      ctx.beginPath();ctx.moveTo(i * cell, 0);ctx.lineTo(i * cell, SNAKE_PIXELS);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0, i * cell);ctx.lineTo(SNAKE_PIXELS, i * cell);ctx.stroke();
    }
    if (food) {
      ctx.fillStyle = '#A8606B';
      ctx.beginPath();ctx.arc((food.x + .5) * cell, (food.y + .5) * cell, cell * .34, 0, Math.PI * 2);ctx.fill();
    }
    snake.forEach((piece, index) => {
      ctx.fillStyle = index ? '#8EA785' : '#587B59';
      ctx.fillRect(piece.x * cell + 2, piece.y * cell + 2, cell - 4, cell - 4);
    });
    info.textContent = `Frutas: ${score} · Mejor: ${Math.max(best, score)}`;
  }

  function reset() {
    clearInterval(timer);
    running = paused = over = false;
    snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
    food = spawnFood();
    direction = nextDirection = [1, 0];
    score = 0;
    playButton.textContent = 'Empezar';
    message.textContent = 'Comé las frutas sin tocar los bordes ni tu cuerpo. Usá las flechas, WASD o los botones. Con cinco frutas ganás puntos y el logro.';
    draw();
  }

  function finish(won = false) {
    clearInterval(timer);
    running = false;
    over = true;
    playButton.textContent = 'Empezar de nuevo';
    message.textContent = won ? '¡Llenaste todo el tablero!' : `Fin de la partida. Comiste ${score} ${score === 1 ? 'fruta' : 'frutas'}.`;
    if (score > best) { best = score; set('snake-best', best); }
    if (score >= 5) onWin(score);
  }

  function tick() {
    direction = nextDirection;
    const head = { x: snake[0].x + direction[0], y: snake[0].y + direction[1] };
    const eating = food && head.x === food.x && head.y === food.y;
    const body = eating ? snake : snake.slice(0, -1);
    if (head.x < 0 || head.y < 0 || head.x >= SNAKE_SIZE || head.y >= SNAKE_SIZE
      || body.some(piece => piece.x === head.x && piece.y === head.y)) { finish();return; }
    snake.unshift(head);
    if (eating) {
      score++;
      food = spawnFood();
      if (!food) { draw();finish(true);return; }
    } else snake.pop();
    draw();
  }

  function toggle() {
    if (over) reset();
    if (running) {
      clearInterval(timer);running = false;paused = true;
      playButton.textContent = 'Continuar';message.textContent = 'En pausa.';
    } else {
      running = true;paused = false;
      playButton.textContent = 'Pausar';message.textContent = '¡Seguí la fruta!';
      timer = setInterval(tick, 145);
    }
  }

  function restart() { reset();toggle(); }

  function steer(next) {
    if (!running || (next[0] === -direction[0] && next[1] === -direction[1])) return;
    nextDirection = next;
  }

  const onKey = event => {
    const next = directions[event.key] || directions[event.key.toLowerCase()];
    if (!next) return;
    event.preventDefault();
    steer(next);
  };
  dialog.addEventListener('keydown', onKey);
  canvas.addEventListener('touchstart', event => {
    const touch = event.touches[0];
    touchStart = [touch.clientX, touch.clientY];
  }, { passive: true });
  canvas.addEventListener('touchend', event => {
    if (!touchStart) return;
    const touch = event.changedTouches[0], dx = touch.clientX - touchStart[0], dy = touch.clientY - touchStart[1];
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    event.preventDefault();
    steer(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
  }, { passive: false });
  dialog.addEventListener('close', () => {
    clearInterval(timer);
    dialog.removeEventListener('keydown', onKey);
    if (score > best) set('snake-best', score);
  }, { once: true });
  reset();
}
