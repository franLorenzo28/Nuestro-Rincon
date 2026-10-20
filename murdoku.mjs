const SIZE = 6;
const STORAGE_KEY = 'murdoku-progress';
const PEOPLE = [
  ['Ana', 'Estaba en el Salón, en la fila más al norte.'],
  ['Bruno', 'Se sentó en la silla de la Cocina.'],
  ['Clara', 'Estaba justo al este de la estantería, dentro del Salón.'],
  ['Diego', 'Estaba en el Jardín, junto a la fuente.'],
  ['Eva', 'Estaba en la Terraza, al norte de Luz.'],
  ['Luz', 'La víctima. Estaba sentada en el banco de la Terraza.']
];
const OBJECTS = new Map([
  [1, ['🍽️', 'mesa', false]], [4, ['💡', 'lámpara', false]],
  [10, ['🪑', 'silla', true]], [13, ['📚', 'estantería', false]],
  [18, ['⛲', 'fuente', false]], [28, ['🌷', 'flores', false]],
  [33, ['🪑', 'banco', true]], [32, ['🌳', 'árbol', false]]
]);
const ROOM_NAMES = ['Salón', 'Cocina', 'Jardín', 'Terraza'];
const row = index => Math.floor(index / SIZE);
const col = index => index % SIZE;
const room = index => (row(index) < 3 ? 0 : 2) + (col(index) < 3 ? 0 : 1);
const adjacent = (a, b) => Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b)) === 1;

const element = (tag, className = '', value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};
const button = (label, className, handler) => {
  const node = element('button', className, label);
  node.type = 'button';node.addEventListener('click', handler);return node;
};

export function isMurdokuSolved(placements) {
  if (!Array.isArray(placements) || placements.length !== SIZE * SIZE) return false;
  const positions = PEOPLE.map((_, person) => placements.indexOf(person));
  if (positions.some(index => index < 0 || OBJECTS.has(index) && !OBJECTS.get(index)[2])) return false;
  if (PEOPLE.some((_, person) => placements.lastIndexOf(person) !== positions[person])) return false;
  if (new Set(positions.map(row)).size !== SIZE || new Set(positions.map(col)).size !== SIZE) return false;
  const [ana, bruno, clara, diego, eva, luz] = positions;
  if (!(room(ana) === 0 && row(ana) === 0)) return false;
  if (bruno !== 10 || clara !== 14) return false;
  if (!(room(diego) === 2 && adjacent(diego, 18))) return false;
  if (!(room(eva) === 3 && row(eva) < row(luz))) return false;
  if (luz !== 33) return false;
  return positions.filter(index => room(index) === room(luz)).length === 2;
}

function freshProgress() {
  return { placements: Array(SIZE * SIZE).fill(null), marks: [], solved: false };
}

function savedProgress(value) {
  if (!value || !Array.isArray(value.placements) || value.placements.length !== SIZE * SIZE
    || !value.placements.every(person => person === null || Number.isInteger(person) && person >= 0 && person < PEOPLE.length)) return freshProgress();
  return { placements: value.placements.slice(),
    marks: Array.isArray(value.marks) ? value.marks.filter(index => Number.isInteger(index) && index >= 0 && index < SIZE * SIZE) : [],
    solved: value.solved === true && isMurdokuSolved(value.placements) };
}

export function openMurdoku(root, dialog, { get, set, onWin }) {
  root.className = 'gb murdoku';
  let progress = savedProgress(get(STORAGE_KEY, null));
  let selected = 0, markMode = false, readyToAccuse = false;
  const intro = element('p', '', 'Luz apareció sin vida durante una reunión. Ubicá a las seis personas: una por fila y una por columna. El culpable fue la única persona que estaba con ella en la misma zona.');
  const help = element('p', 'cuenta', 'Seleccioná un personaje y tocá una casilla. La mesa, la lámpara, la estantería, la fuente, las flores y el árbol no se pueden ocupar.');
  const suspects = element('div', 'mur-suspects');
  const legend = element('div', 'mur-legend');
  ROOM_NAMES.forEach((name, index) => legend.append(element('span', `room-${index}`, name)));
  const grid = element('div', 'mur-grid');
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', 'Escena del misterio, seis filas por seis columnas');
  const status = element('p', 'est mur-status');status.setAttribute('role', 'status');
  const controls = element('div', 'acc mur-controls');
  const placeButton = button('Colocar', 'btn', () => { markMode = false; render(); });
  const markButton = button('Marcar X', 'btn s', () => { markMode = true; render(); });
  controls.append(placeButton, markButton,
    button('Comprobar', 'btn s', check),
    button('Borrar tablero', 'cerrar', () => {
      if (!confirm('¿Borrar las ubicaciones y marcas de este caso?')) return;
      progress = freshProgress();readyToAccuse = false;save();render();
    }));
  const accusation = element('div', 'mur-accusation');
  const layout = element('div', 'mur-layout');
  const cluesPane = element('div', 'mur-clues-pane');cluesPane.append(suspects);
  const scenePane = element('div', 'mur-scene-pane');scenePane.append(legend, grid, status, controls, accusation);
  layout.append(cluesPane, scenePane);
  root.replaceChildren(intro, help, layout);

  function save() { set(STORAGE_KEY, progress); }

  function place(index) {
    if (progress.solved) return;
    if (markMode) {
      if (progress.placements[index] !== null) return;
      progress.marks = progress.marks.includes(index)
        ? progress.marks.filter(item => item !== index) : [...progress.marks, index];
      save();render();return;
    }
    const old = progress.placements.indexOf(selected);
    if (progress.placements[index] === selected) {
      progress.placements[index] = null;readyToAccuse = false;save();render();return;
    }
    if (progress.placements[index] !== null) {
      status.textContent = 'Esa casilla ya tiene una persona. Seleccionala para moverla.';return;
    }
    const conflict = progress.placements.some((person, position) => person !== null && position !== old
      && (row(position) === row(index) || col(position) === col(index)));
    if (conflict) { status.textContent = 'Ya hay otra persona en esa fila o columna.';return; }
    if (old >= 0) progress.placements[old] = null;
    progress.placements[index] = selected;
    progress.marks = progress.marks.filter(item => item !== index);
    readyToAccuse = false;save();render();
  }

  function check() {
    const count = progress.placements.filter(person => person !== null).length;
    if (count < PEOPLE.length) {
      status.textContent = `Faltan ${PEOPLE.length - count} ${count === PEOPLE.length - 1 ? 'persona' : 'personas'} por ubicar.`;return;
    }
    if (!isMurdokuSolved(progress.placements)) {
      status.textContent = 'Alguna ubicación no coincide con las pistas. Revisá las filas, las zonas y los objetos.';return;
    }
    readyToAccuse = true;status.textContent = 'Todas las personas están bien ubicadas. ¿Quién estaba a solas con Luz?';renderAccusation();
  }

  function accuse(person) {
    if (!readyToAccuse || progress.solved) return;
    if (person !== 4) {status.textContent = 'Esa persona no estaba a solas con Luz. Mirá la zona de la víctima.';return;}
    progress.solved = true;readyToAccuse = false;save();
    status.textContent = '¡Caso resuelto! Eva estaba a solas con Luz en la Terraza.';
    onWin('resuelto');render();
  }

  function renderAccusation() {
    accusation.replaceChildren();
    if (progress.solved) {
      accusation.append(element('p', 'aviso ok', 'Caso resuelto: Eva estaba a solas con Luz en la Terraza.'));
      return;
    }
    if (!readyToAccuse) return;
    accusation.append(element('p', '', 'Acusación final:'));
    const choices = element('div', 'mur-accuse-buttons');
    PEOPLE.slice(0, -1).forEach(([name], index) => choices.append(button(name, 'btn s', () => accuse(index))));
    accusation.append(choices);
  }

  function render() {
    suspects.replaceChildren();
    PEOPLE.forEach(([name, clue], index) => {
      const card = button('', `mur-suspect ${selected === index ? 'selected' : ''}`, () => {
        selected = index;markMode = false;render();
      });
      card.setAttribute('aria-pressed', String(selected === index && !markMode));
      card.append(element('strong', '', name + (index === 5 ? ' · víctima' : '')), element('small', '', clue));
      suspects.append(card);
    });
    grid.replaceChildren();
    for (let index = 0; index < SIZE * SIZE; index++) {
      const object = OBJECTS.get(index), blocked = object && !object[2];
      const person = progress.placements[index];
      const cell = button('', `mur-cell room-${room(index)}${col(index) === 2 ? ' room-right' : ''}${row(index) === 2 ? ' room-bottom' : ''}${blocked ? ' blocked' : ''}`, () => place(index));
      const name = person !== null ? PEOPLE[person][0] : null;
      cell.setAttribute('aria-label', `Fila ${row(index) + 1}, columna ${col(index) + 1}, ${ROOM_NAMES[room(index)]}${object ? ', ' + object[1] : ''}${name ? ', ' + name : ''}${progress.marks.includes(index) ? ', descartada' : ''}`);
      if (object) cell.append(element('span', 'mur-object', object[0]));
      if (name) cell.append(element('span', 'mur-person', name[0]));
      else if (progress.marks.includes(index)) cell.append(element('span', 'mur-cross', '×'));
      cell.disabled = Boolean(blocked) || progress.solved;
      grid.append(cell);
    }
    placeButton.setAttribute('aria-pressed', String(!markMode));
    markButton.setAttribute('aria-pressed', String(markMode));
    if (progress.solved) status.textContent = '¡Caso resuelto! Eva estaba a solas con Luz en la Terraza.';
    else status.textContent = `${progress.placements.filter(person => person !== null).length} de ${PEOPLE.length} personas ubicadas. Modo: ${markMode ? 'marcar X' : 'colocar'}.`;
    renderAccusation();
  }

  render();
}
