
class PlayerEvent extends Event {
	constructor(type, player) {
		super(type);
		/** @type {number} */ this.player = player;
	}
}

class PlacedSymbolEvent extends PlayerEvent {
	constructor(player, x, y, symbol) {
		super('place', player);
		/** @type {number} */ this.x = x;
		/** @type {number} */ this.y = y;
		/** @type {string} */ this.symbol = symbol;
	}
}

class MovedSymbolEvent extends PlayerEvent {
	constructor(player, sx, sy, tx, ty, symbol) {
		super('move', player);
		/** @type {number} */ this.sx = sx;
		/** @type {number} */ this.sy = sy;
		/** @type {number} */ this.tx = tx;
		/** @type {number} */ this.ty = ty;
		/** @type {string} */ this.symbol = symbol;
	}
}

class StreakEvent extends PlayerEvent {
	constructor(places, symbol, player) {
		super('streak', player);
		/** @type {{x: number, y: number}[]} */ this.places = places;
		/** @type {string} */ this.symbol = symbol;
	}
}

class GameOverEvent extends PlayerEvent {
	constructor(player) {
		super('victory', player);
	}
}

class DrawEvent extends GameOverEvent {
	constructor() {
		super(-1);
	}
}

/**
 * @typedef {'placing'|'moving'|'over'} GamePhase
 */

class PhaseEvent extends Event {
	constructor(phase) {
		super('phase');
		/** @type {GamePhase} */ this.phase = phase;
	}
}

function symbolForPlayer(player) {
	if (player == 0) return 'X';
	if (player == 1) return 'O';
	let code = 'A'.codePointAt(0) + player - 2; // player 2 gets A, 3 gets B, etc.
	if ('O'.charCodeAt(0) <= code) code += 1;
	if ('X'.charCodeAt(0) <= code) code += 1;
	return String.fromCharCode(code);
}
const symbolsForPlayers = [...Array(26).keys()].map(i => symbolForPlayer(i));


/**
 * @typedef GameSettings
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [playersCount]
 * @property {number} [placesPerPlayer]
 * @property {number} [movesPerPlayer]
 * @property {boolean} [orthogonalMoves]
 * @property {boolean} [diagonalMoves]
 */

class Game extends EventTarget {
	/** @type {GameSettings} */
	static DEFAULT_SETTINGS = {
		width: 3,
		height: 3,
		playersCount: 2,
		placesPerPlayer: 3,
		movesPerPlayer: 1,
		orthogonalMoves: true,
		diagonalMoves: false,
	}

	/**
	 * @param {GameSettings} settings 
	 */
	constructor(settings = {}) {
		super();
		/** @type {GameSettings} */
		this.settings = Object.assign(Object.assign({}, Game.DEFAULT_SETTINGS), settings);
		this.reset();
	}

	reset() {
		this.currentPlayer = 0;
		this.state = Array(this.settings.width * this.settings.height).fill(0);
		this.remainingPlaces = Array(this.settings.playersCount).fill(this.settings.placesPerPlayer);
		this.remainingMoves = Array(this.settings.playersCount).fill(this.settings.movesPerPlayer);
		/** @type {GamePhase} */
		this.phase = 'placing';
	}

	get(x, y) {
		return this.state[x + y * this.settings.width]
	}
	set(x, y, v) {
		this.state[x + y * this.settings.width] = v;
	}

	isFree(x, y) {
		return !this.get(x, y);
	}
	isAnyFree() {
		return this.state.indexOf(0) != -1;
	}

	getSymbol(x, y) {
		const code = this.get(x, y);
		if (!code) return null;
		return String.fromCharCode(code);
	}
	setSymbol(x, y, symbol) {
		this.set(x, y, symbol.charCodeAt(0));
	}

	isOver() {
		return this.phase == 'over';
	}

	/**
	 * Prepares for next turn.
	 */
	next() {
		this.currentPlayer = (this.currentPlayer + 1) % this.settings.playersCount;

		if (this.phase == 'placing' && this.remainingPlaces[this.currentPlayer] == 0) {
			this.dispatchEvent(new PhaseEvent(this.phase = 'moving'));
		}
		if (this.phase == 'moving' && this.remainingMoves[this.currentPlayer] == 0) {
			this.dispatchEvent(new PhaseEvent(this.phase = 'over'));
			this.dispatchEvent(new DrawEvent());
			return;
		}

		this.dispatchEvent(new PlayerEvent('next', this.currentPlayer));
	}

	/**
	 * Places symbol at given coords by selected player.
	 * @param {number} x 
	 * @param {number} y 
	 * @param {number} player
	 */
	place(x, y, player) {
		if (player != this.currentPlayer) {
			throw new Error(`Wrong player turn`);
		}
		if (!this.isFree(x, y)) {
			throw new Error(`Place already taken`);
		}
		if (!(this.remainingPlaces[this.currentPlayer] > 0)) {
			throw new Error(`No more placing for this player`);
		}
		this.remainingPlaces[this.currentPlayer] -= 1;

		const symbol = symbolsForPlayers[this.currentPlayer];
		this.setSymbol(x, y, symbol);
		this.dispatchEvent(new PlacedSymbolEvent(this.currentPlayer, x, y, symbol));

		const streak = this.checkForStreak(x, y);
		if (streak) {
			this.dispatchEvent(new StreakEvent(streak.highlight, streak.symbol, this.currentPlayer));
			this.dispatchEvent(new PhaseEvent(this.phase = 'over'));
			this.dispatchEvent(new GameOverEvent(this.currentPlayer));
			return;
		}
		if (!this.isAnyFree()) {
			this.dispatchEvent(new PhaseEvent(this.phase = 'over'));
			this.dispatchEvent(new DrawEvent());
			return;
		}
		this.next();
	}

	/**
	 * Checks if symbol under given coords can be moved to other given coords.
	 * @param {number} sx 
	 * @param {number} sy 
	 * @param {number} tx 
	 * @param {number} ty 
	 * @returns True if can move, false otherwise.
	 */
	canMove(sx, sy, tx, ty) {
		if (!this.isFree(tx, ty)) {
			return false;
		}
		if (!this.getSymbol(sx, sy)) {
			return false;
		}
		if (this.settings.orthogonalMoves) {
			if (sx == tx || sy == ty) {
				return true;
			}
		}
		if (this.settings.diagonalMoves) {
			if ((sx + sy == tx + ty) || (sx - sy == tx - ty)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Moves symbol from under given coords to other given coords by selected player.
	 * @param {number} sx 
	 * @param {number} sy 
	 * @param {number} tx 
	 * @param {number} ty 
	 * @param {number} player 
	 */
	move(sx, sy, tx, ty, player) {
		if (player != this.currentPlayer) {
			throw new Error(`Wrong player turn`);
		}
		if (!this.isFree(tx, ty)) {
			throw new Error(`Place already taken`);
		}

		let reachable = false;
		if (this.settings.orthogonalMoves) {
			if (sx == tx || sy == ty) {
				reachable = true;
			}
		}
		if (this.settings.diagonalMoves) {
			if ((sx + sy == tx + ty) || (sx - sy == tx - ty)) {
				reachable = true;
			}
		}
		if (!reachable) {
			throw new Error(`Target unreachable`);
		}

		const sourceSymbol = this.getSymbol(sx, sy);
		if (!sourceSymbol) {
			throw new Error(`Nothing to move`);
		}
		const playerSymbol = symbolsForPlayers[this.currentPlayer];
		if (sourceSymbol != playerSymbol) {
			throw new Error(`Cannot move other players tokens`);
		}

		if (!(this.remainingMoves[this.currentPlayer] > 0)) {
			throw new Error(`No more moving for this player`);
		}
		this.remainingMoves[this.currentPlayer] -= 1;

		this.set(sx, sy, 0);
		this.setSymbol(tx, ty, playerSymbol);
		this.dispatchEvent(new MovedSymbolEvent(this.currentPlayer, sx, sy, tx, ty, playerSymbol));

		const streak = this.checkForStreak(tx, ty);
		if (streak) {
			this.dispatchEvent(new StreakEvent(streak.highlight, streak.symbol, this.currentPlayer));
			this.dispatchEvent(new PhaseEvent(this.phase = 'over'));
			this.dispatchEvent(new GameOverEvent(this.currentPlayer));
			return;
		}
		this.next();
	}

	/**
	 * @param {number} x 
	 * @param {number} y 
	 */
	checkForStreak(x, y) {
		const requiredLength = Math.min(this.settings.width, this.settings.height);
		
		if (typeof x === undefined) {
			throw new Error(`Not implemented`);
		}

		// Check rows
		const rowLastStart = Math.min(this.settings.width - requiredLength, x);
		{
			i: for (let i = Math.max(0, x - requiredLength + 1); i <= rowLastStart; i++) {
				const value = this.get(i, y);
				if (!value) {
					continue;
				}
				for (let j = 1; j < requiredLength; j++) {
					if (value != this.get(i + 1, y)) {
						continue i;
					}
					i += 1;
				}
				i -= requiredLength - 1;
				return {
					symbol: String.fromCharCode(value), 
					highlight: Array.from({length: requiredLength}, (_, j) => ({x: i + j, y})),
				};
			}
		}

		// Check columns
		const columnLastStart = Math.min(this.settings.height - requiredLength, y);
		{
			i: for (let i = Math.max(0, y - requiredLength + 1); i <= columnLastStart; i++) {
				const value = this.get(x, i);
				if (!value) {
					continue;
				}
				for (let j = 1; j < requiredLength; j++) {
					if (value != this.get(x, i + 1)) {
						continue i;
					}
					i += 1;
				}
				i -= requiredLength - 1;
				return {
					symbol: String.fromCharCode(value), 
					highlight: Array.from({length: requiredLength}, (_, j) => ({x, y: i + j})),
				};
			}
		}

		// Check axis 1
		const diff = y - x;
		{
			const last = Math.min(rowLastStart, columnLastStart - diff);
			i: for (let i = Math.max(0, x - requiredLength + 1); i <= last; i++) {
				const value = this.get(i, i + diff);
				if (!value) {
					continue;
				}
				for (let j = 1; j < requiredLength; j++) {
					if (value != this.get(i + 1, i + 1 + diff)) {
						continue i;
					}
					i += 1;
				}
				i -= requiredLength - 1;
				return {
					symbol: String.fromCharCode(value), 
					highlight: Array.from({length: requiredLength}, (_, j) => ({x: i + j, y: i + j + diff})),
				};
			}
		}

		// Check axis 2
		{
			const sum = y + x;
			const last = Math.max(x, requiredLength - 1);
			i: for (let i = Math.min(this.settings.width, x + requiredLength) - 1; last <= i; i--) {
				const value = this.get(i, sum - i);
				if (!value) {
					continue;
				}
				for (let j = 1; j < requiredLength; j++) {
					if (value != this.get(i - 1, sum - (i - 1))) {
						continue i;
					}
					i -= 1;
				}
				return {
					symbol: String.fromCharCode(value), 
					highlight: Array.from({length: requiredLength}, (_, j) => ({x: i + j, y: sum - (i + j)})),
				};
			}
		}

		return null;
	}

	/**
	 * @param {number} player Player which should start the game.
	 */
	start(player) {
		if (!(0 <= player && player < this.settings.playersCount)) {
			throw new Error(`Invalid player`);
		}
		if (this.isOver()) {
			throw new Error(`Game over, use reset first`);
		}
		this.currentPlayer = player;
		this.dispatchEvent(new PlayerEvent('start', player));
		this.dispatchEvent(new PhaseEvent(this.phase));
	}
}



const phaseToDisplayName = {
	'placing': 'Stawianie znaków',
	'moving': 'Przesuwanie znaków',
	'over': 'Koniec gry',
}

class GameVisualizer {
	/**
	 * @param {HTMLElement} uiRoot 
	 */
	constructor(uiRoot) {
		this.uiRoot = uiRoot;
		this.tbody = this.uiRoot.querySelector('table > tbody');
	}

	get width() {
		return this.game.settings.width;
	}
	get height() {
		return this.game.settings.height;
	}

	/**
	 * @param {Game} game 
	 */
	attach(game) {
		this.game = game;
		this.buildUI();
		this.game.addEventListener('start', this.startListener = event => {
			this.logMessage(`Zaczyna gracz ${event.player + 1} (znak: ${symbolsForPlayers[event.player]})`);
		});
		this.game.addEventListener('next', this.nextListener = event => {
			for (let x = 0; x < this.width; x++) {
				for (let y = 0; y < this.height; y++) {
					const symbol = this.game.getSymbol(x, y);
					const own = symbol == symbolsForPlayers[this.game.currentPlayer];
					const cell = this.getCell(x, y);
					cell.classList.toggle('owned', own);
				}
			}
			this.logMessage(`Tura gracza ${event.player + 1}`);
		});
		this.game.addEventListener('place',
			this.placeListener = /** @param {PlacedSymbolEvent} event */ event => {
				const cell = this.getCell(event.x, event.y);
				cell.innerText = event.symbol;
				cell.classList.toggle('filled', true);
				this.logMessage(`Gracz ${event.player + 1} stawia ${event.symbol} na pozycji (${event.x}, ${event.y})`);
			}
		);
		this.game.addEventListener('move', 
			this.moveListener = /** @param {MovedSymbolEvent} event */ event => {
				const sc = this.getCell(event.sx, event.sy);
				sc.innerText = '';
				sc.classList.toggle('filled', false);
				const tc = this.getCell(event.tx, event.ty);
				tc.innerText = event.symbol;
				tc.classList.toggle('filled', true);
				this.logMessage(`Gracz ${event.player + 1} przesuwa ${event.symbol} z pozycji (${event.sx}, ${event.sy}) na (${event.tx}, ${event.ty})`);
			}
		)
		this.game.addEventListener('streak', 
			this.streakListener = /** @param {StreakEvent} event */ event => {
				for (const place of event.places) {
					const cell = this.getCell(place.x, place.y);
					cell.classList.toggle('highlight', true);
				}
				this.logMessage(`Gracz ${event.player + 1} wypełnił linię ${event.places.map(p => `(${p.x}, ${p.y})`).join(', ')}`);
			}
		);
		this.game.addEventListener('phase', 
			this.phaseListener = /** @param {PhaseEvent} event */ event => {
				switch (event.phase) {
					case 'placing':
						this.disableMoving();
						this.enablePlacing();
						break;
					case 'moving':
						this.disablePlacing();
						this.enableMoving();
						break;
					case 'over':
						this.disableMoving();
						this.disablePlacing();
						break;
				}
				this.logMessage(`Faza gry: ${phaseToDisplayName[event.phase]}`);
			}
		)
		this.game.addEventListener('victory',
			this.victoryListener = /** @param {VictoryEvent} event */ event => {
				if (event.player < 0) {
					this.logMessage(`Gra zakończona remisem`);
				}
				else {
					this.logMessage(`Wygrał gracz ${event.player + 1}, koniec gry`);
				}
			}
		);
		return this; // for chaining
	}

	logMessage(content) {
		const li = document.createElement('li');
		li.innerHTML = content;
		this.uiRoot.querySelector('.messages').appendChild(li);
	}

	detach() {
		this.game.removeEventListener('start',   this.startListener);
		this.game.removeEventListener('next',    this.nextListener);
		this.game.removeEventListener('place',   this.placeListener);
		this.game.removeEventListener('move',    this.moveListener);
		this.game.removeEventListener('streak',  this.streakListener);
		this.game.removeEventListener('phase',   this.phaseListener);
		this.game.removeEventListener('victory', this.victoryListener);
		this.game = null;
		this.uiRoot.querySelector('.messages').replaceChildren();
		return this; // for chaining
	}

	/**
	 * @param {({clientX: number, clientY: number})} pointerEvent 
	 */
	eventToCoords(pointerEvent) {
		const bb = this.tbody.getBoundingClientRect();
		return [
			Math.floor((pointerEvent.clientX - bb.x) / bb.width * this.width),
			Math.floor((pointerEvent.clientY - bb.y) / bb.height * this.height),
		];
	}

	enablePlacing() {
		this.uiRoot.querySelector('table').classList.toggle('placing', true);
		this.tbody.addEventListener('click', this.clickListener = event => {
			const [columnIndex, rowIndex] = this.eventToCoords(event);
			if (this.game.isOver()) return;
			if (!this.game.isFree(columnIndex, rowIndex)) {
				// alert('To miejsce jest już zajęte!');
				return;
			}
			this.game.place(columnIndex, rowIndex, this.game.currentPlayer);
		});
	}
	disablePlacing() {
		this.uiRoot.querySelector('table').classList.toggle('placing', false);
		this.tbody.removeEventListener('click', this.clickListener);
	}

	enableMoving() {
		this.uiRoot.querySelector('table').classList.toggle('moving', true);
		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				const cell = this.getCell(x, y);
				cell.draggable = true;
			}
		}
	}
	disableMoving() {
		this.uiRoot.querySelector('table').classList.toggle('moving', false);
		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				const cell = this.getCell(x, y);
				cell.draggable = false;
			}
		}
	}

	buildUI() {
		const rows = [...Array(this.height).keys()].map(rowIndex => {
			const tr = document.createElement('tr');
			for (const columnIndex of Array(this.width).keys()) {
				const td = document.createElement('td');
				td.innerText = this.game.getSymbol(columnIndex, rowIndex) || '';
				td.addEventListener('dragstart', event => {
					const symbol = this.game.getSymbol(columnIndex, rowIndex);
					if (!symbol || symbol != symbolsForPlayers[this.game.currentPlayer]) {
						// Nothing to move
						event.preventDefault();
						return;
					}
					event.dataTransfer.dropEffect = 'move';
					event.dataTransfer.setData('application/json', JSON.stringify({
						x: columnIndex, 
						y: rowIndex,
					}));
					for (let x = 0; x < this.width; x++) {
						for (let y = 0; y < this.height; y++) {
							const cell = this.getCell(x, y);
							const canMove = this.game.canMove(columnIndex, rowIndex, x, y);
							cell.classList.toggle('target', canMove);
						}
					}
				});
				td.addEventListener('dragover', event => {
					if (!td.classList.contains('target')) {
						return;
					}

					event.preventDefault();
					event.dataTransfer.dropEffect = 'move';
				});
				td.addEventListener('drop', event => {
					let x, y;
					try {
						({x, y} = JSON.parse(event.dataTransfer.getData('application/json')));
					}
					catch (e) {
						return;
					}
					event.preventDefault();
					this.game.move(x, y, columnIndex, rowIndex, this.game.currentPlayer);
					for (let x = 0; x < this.width; x++) {
						for (let y = 0; y < this.height; y++) {
							const cell = this.getCell(x, y);
							cell.classList.toggle('target', false);
						}
					}
				});
				tr.appendChild(td);
			}
			return tr;
		});
		this.uiRoot.querySelector('table > tbody').replaceChildren(...rows);
	}

	getCell(x, y) {
		return this.tbody.querySelector(`tr:nth-of-type(${y + 1}) td:nth-of-type(${x + 1})`);
	}
}



const game = new Game();
const visualizer = new GameVisualizer(document.querySelector('#game')).attach(game);
document.querySelector('#game .controls button[name=reset]').addEventListener('click', () => {
	visualizer.detach();
	game.reset();
	visualizer.attach(game);
	game.start(Math.floor(Math.random() * 2));
});



game.start(Math.floor(Math.random() * 2));


