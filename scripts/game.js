
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
 * @typedef {'place'|'move'} GameAction
 */
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

	toString() {
		let str = `players: ${this.playersCount}, places: ${this.settings.placesPerPlayer}, moves: ${this.settings.movesPerPlayer}\n`;
		for (let y = 0; y < this.settings.height; y++) {
			for (let x = 0; x < this.settings.width; x++) {
				str += (this.getSymbol(x, y) ?? '.') + ' ';
			}
			str += '\n';
		}
		str += `currentPlayer: ${this.currentPlayer} (${this.currentPlayerSymbol})\n`;
		return str;
	}

	clone() {
		const instance = new Game(this.settings);
		instance.currentPlayer = this.currentPlayer;
		instance.state = [...this.state];
		instance.phase = this.phase;
		instance.remainingPlaces = [...this.remainingPlaces];
		instance.remainingMoves = [...this.remainingMoves];
		return instance;
	}

	reset() {
		this.currentPlayer = 0;
		this.state = Array(this.settings.width * this.settings.height).fill(0);
		/** @type {GamePhase} */
		this.phase = 'placing';
		this.remainingPlaces = Array(this.settings.playersCount).fill(this.settings.placesPerPlayer);
		this.remainingMoves = Array(this.settings.playersCount).fill(this.settings.movesPerPlayer);
	}

	get(x, y) {
		return this.state[x + y * this.settings.width]
	}
	set(x, y, v) {
		this.state[x + y * this.settings.width] = v;
	}

	/**
	 * Returns iterable for pairs of coords and values.
	 */
	stateIterable() {
		const that = this;
		return {
			[Symbol.iterator]: () => ({
				x: 0,
				y: 0,
				next: function() {
					if (this.x == that.settings.width) {
						this.x = 0;
						this.y += 1;
					}
					if (this.y < that.settings.height) {
						this.x += 1;
						return {
							value: {
								x: this.x - 1, 
								y: this.y, 
								c: that.get(this.x - 1, this.y),
							},
							// done: (this.x == that.settings.width && this.y == that.settings.width - 1),
							done: false,
						};
					}
					return { done: true };
				},
			})
		};
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

	get currentPlayerSymbol() {
		return symbolsForPlayers[this.currentPlayer];
	}

	isOver() {
		return this.phase == 'over';
	}

	victory(player) {
		this.currentPlayer = player;
		this.dispatchEvent(new PhaseEvent(this.phase = 'over'));
		this.dispatchEvent(new GameOverEvent(this.currentPlayer));
	}

	draw() {
		this.currentPlayer = -1;
		this.dispatchEvent(new PhaseEvent(this.phase = 'over'));
		this.dispatchEvent(new DrawEvent());
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
			this.draw();
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
			this.victory(this.currentPlayer);
			return;
		}
		if (!this.isAnyFree()) {
			this.draw();
			return;
		}
		this.next();
	}
	
	/**
	 * Generates possible place positions (free cells).
	 */
	*placePossibilitiesGenerator() {
		for (const {x, y, c} of this.stateIterable())
			if (!c)
				yield {x, y};
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
			this.victory(this.currentPlayer);
			return;
		}
		this.next();
	}

	/**
	 * Generates diagonally aligned positions from given (coords) cell.
	 * @param {number} sx Center cell X coord.
	 * @param {number} sy Center cell Y coord.
	 */
	*diagonalPositionsGenerator(sx, sy) {
		const w = this.settings.width;
		const h = this.settings.height;
		for (let x = sx - 1, y = sy - 1; 0 <= x && 0 <= y; x--, y--) yield {x, y};
		for (let x = sx - 1, y = sy + 1; 0 <= x && y < h;  x--, y++) yield {x, y};
		for (let x = sx + 1, y = sy - 1; x < w  && 0 <= y; x++, y--) yield {x, y};
		for (let x = sx + 1, y = sy + 1; x < w  && y < h;  x++, y++) yield {x, y};
	}

	/**
	 * Generates orthogonally aligned positions from given (coords) cell.
	 * @param {number} sx Center cell X coord.
	 * @param {number} sy Center cell Y coord.
	 */
	*orthogonalPositionsGenerator(sx, sy) {
		for (let x = sx - 1; 0 <= x; x--) yield {x, y: sy};
		for (let x = this.settings.width - 1;  sx < x; x--) yield {x, y: sy};
		for (let y = sy - 1; 0 <= y; y--) yield {x: sx, y};
		for (let y = this.settings.height - 1;  sy < y; y--) yield {x: sx, y};
	}

	/**
	 * Generates available positions for moving given (coords) cell.
	 * @param {number} sx Source cell X coord.
	 * @param {number} sy Source cell Y coord.
	 */
	*movePositionsGenerator(sx, sy) {
		if (this.settings.orthogonalMoves)
			for (const {x, y} of this.orthogonalPositionsGenerator(sx, sy))
				if (this.isFree(x, y))
					yield {x, y};
		if (this.settings.diagonalMoves)
			for (const {x, y} of this.diagonalPositionsGenerator(sx, sy))
				if (this.isFree(x, y))
					yield {x, y};
	}

	/**
	 * Generates possible moves of given symbol.
	 */
	*movePossibilitiesForSymbolGenerator(symbol) {
		const code = symbol.charCodeAt(0);
		for (const {x, y, c} of this.stateIterable()) {
			if (c == code) {
				const sx = x;
				const sy = y;
				for (const {x, y} of this.movePositionsGenerator(sx, sy)) {
					yield {sx, sy, tx: x, ty: y};
				}
			}
		}
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
		this.currentPlayer = player - 1;
		this.next();
	}
}
