
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
			const playerSymbol = symbolsForPlayers[this.game.currentPlayer];
			for (let x = 0; x < this.width; x++) {
				for (let y = 0; y < this.height; y++) {
					const symbol = this.game.getSymbol(x, y);
					const cell = this.getCell(x, y);
					cell.classList.toggle('owned', symbol == playerSymbol);
				}
			}
			this.logMessage(`Tura gracza ${event.player + 1} (znak: ${playerSymbol})`);
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
		if (!this.game) return this;
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
				const symbol = this.game.getSymbol(columnIndex, rowIndex);
				if (symbol) {
					td.innerText = symbol;
					td.classList.toggle('filled', true);
				}
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
					this.tbody.querySelectorAll('td.target').forEach(cell => cell.classList.toggle('target', false));
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
