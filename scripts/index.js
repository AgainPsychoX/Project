
class PlayerEvent extends Event {
	constructor(type, player) {
		super(type);
		/** @type {number} */
		this.player = player;
	}
}

class PlacedSymbolEvent extends PlayerEvent {
	constructor(player, x, y, symbol) {
		super('place', player);
		/** @type {number} */
		this.x = x;
		/** @type {number} */
		this.y = y;
		/** @type {string} */
		this.symbol = symbol;
	}
}

class StreakEvent extends PlayerEvent {
	constructor(places, symbol, player) {
		super('streak', player);
		/** @type {{x: number, y: number}[]} */
		this.places = places;
		/** @type {string} */
		this.symbol = symbol;
	}
}

class GameOverEvent extends PlayerEvent {
	constructor(player) {
		super('victory', player);
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

class Game extends EventTarget {
	/**
	 * @param {number} width 
	 * @param {number} height 
	 * @param {number} playersCount 
	 */
	constructor(width, height, playersCount) {
		super();
		this.width = width;
		this.height = height;
		this.playersCount = playersCount;
		this.reset();
	}

	reset() {
		this.currentPlayer = 0;
		this.state = Array(this.width * this.height).fill(0);
		this.over = false;
	}

	get(x, y) {
		return this.state[x + y * this.width]
	}
	set(x, y, v) {
		this.state[x + y * this.width] = v;
	}

	isFree(x, y) {
		return !this.get(x, y);
	}
	isAnyFree() {
		return this.state.indexOf(0) != -1;
	}

	getSymbol(x, y) {
		return String.fromCharCode(this.get(x, y));
	}
	setSymbol(x, y, symbol) {
		this.set(x, y, symbol.charCodeAt(0));
	}

	isOver() {
		return this.over;
	}

	/**
	 * Prepares for next turn.
	 */
	next() {
		this.currentPlayer = (this.currentPlayer + 1) % this.playersCount;
		this.dispatchEvent(new PlayerEvent('next', this.currentPlayer));
	}

	/**
	 * 
	 * @param {number} x 
	 * @param {number} y 
	 */
	place(x, y, player) {
		if (player != this.currentPlayer) {
			throw new Error(`Wrong player turn`);
		}
		if (!this.isFree(x, y)) {
			throw new Error(`Place already taken`);
		}
		const symbol = symbolsForPlayers[this.currentPlayer];
		this.setSymbol(x, y, symbol);
		this.dispatchEvent(new PlacedSymbolEvent(this.currentPlayer, x, y, symbol));
		const streak = this.checkForStreak(x, y);
		if (streak) {
			this.over = true;
			this.dispatchEvent(new StreakEvent(streak.highlight, streak.symbol, this.currentPlayer));
			this.dispatchEvent(new GameOverEvent(this.currentPlayer));
			return;
		}
		if (!this.isAnyFree()) {
			this.over = true;
			this.dispatchEvent(new GameOverEvent(-1));
			return;
		}
		this.next();
	}

	/**
	 * @param {number} x 
	 * @param {number} y 
	 */
	checkForStreak(x, y) {
		const requiredLength = Math.min(this.width, this.height);
		
		if (typeof x === undefined) {
			throw new Error(`Not implemented`);
		}

		// Check rows
		const rowLastStart = Math.min(this.width - requiredLength, x);
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
		const columnLastStart = Math.min(this.height - requiredLength, y);
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
			i: for (let i = Math.min(this.width, x + requiredLength) - 1; last <= i; i--) {
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
		if (!(0 <= player && player < this.playersCount)) {
			throw new Error(`Invalid player`);
		}
		if (this.isOver()) {
			throw new Error(`Game over, use reset first`);
		}
		this.currentPlayer = player;
		this.dispatchEvent(new PlayerEvent('start', player));
	}
}



class GameVisualizer {
	/**
	 * @param {HTMLElement} uiRoot 
	 */
	constructor(uiRoot) {
		this.uiRoot = uiRoot;
	}

	get width() {
		return this.game.width;
	}
	get height() {
		return this.game.height;
	}

	/**
	 * @param {Game} game 
	 */
	attach(game) {
		this.game = game;
		this.buildUI();
		this.game.addEventListener('place', this.placeListener = event => {
			this.getCell(event.x, event.y).innerText = event.symbol;
			this.logMessage(`Gracz ${event.player + 1} stawia ${event.symbol} na pozycji (${event.x}, ${event.y})`);
		});
		this.game.addEventListener('start', this.startListener = event => {
			this.logMessage(`Zaczyna gracz ${event.player + 1}`);
		});
		this.game.addEventListener('next', this.nextListener = event => {
			this.logMessage(`Tura gracza ${event.player + 1}`);
		});
		this.game.addEventListener('streak', this.streakListener = /** @param {StreakEvent} event */ event => {
			this.logMessage(`Gracz ${event.player + 1} wypełnił linię ${event.places.map(p => `(${p.x}, ${p.y})`).join(', ')}`);
			for (const place of event.places) {
				this.getCell(place.x, place.y).classList.toggle('highlight', true);
			}
		});
		this.game.addEventListener('victory',
			this.victoryListener = event => {
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
		this.game.removeEventListener('place', this.placeListener);
		this.game.removeEventListener('start', this.startListener);
		this.game.removeEventListener('next', this.nextListener);
		this.game.removeEventListener('streak', this.streakListener);
		this.game.removeEventListener('victory', this.victoryListener);
		this.game = null;
		return this; // for chaining
	}

	buildUI() {
		const rows = [...Array(this.height).keys()].map(rowIndex => {
			const tr = document.createElement('tr');
			for (const columnIndex of Array(this.width).keys()) {
				const td = document.createElement('td');
				td.addEventListener('click', () => {
					if (this.game.isOver()) return;
					if (!this.game.isFree(columnIndex, rowIndex)) {
						// alert('To miejsce jest już zajęte!');
						return;
					}
					this.game.place(columnIndex, rowIndex, this.game.currentPlayer);
				});
				tr.appendChild(td);
			}
			return tr;
		});
		this.uiRoot.querySelector('table > tbody').replaceChildren(...rows);
	}

	getCell(x, y) {
		return this.uiRoot.querySelector(`table > tbody > tr:nth-of-type(${y + 1}) td:nth-of-type(${x + 1})`);
	}
}



const game = new Game(3, 3, 2);
const visualizer = new GameVisualizer(document.querySelector('#game')).attach(game);

game.start(Math.floor(Math.random() * 2));


