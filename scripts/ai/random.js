
async function delay(milliseconds) {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

class RandomGameStrategy extends GameStrategy {
	constructor() {
		super();
	}

	getPlacePossibilities() {
		return [...this.game.stateIterable()].filter(e => !e.c);
	}

	getMovePossibilities() {
		return [...this.game.stateIterable()].filter(e => e.c == this.symbolCode).flatMap(e => {
			return [...this.game.movePositionsGenerator(e.x, e.y)].map(p => ({sx: e.x, sy: e.y, tx: p.x, ty: p.y}));
		});
	}

	getRandomPlacePossibility() {
		const possibilities = this.getPlacePossibilities();
		return possibilities[Math.floor(Math.random() * possibilities.length)]
	}

	getRandomMovePossibility() {
		const possibilities = this.getMovePossibilities();
		return possibilities[Math.floor(Math.random() * possibilities.length)]
	}

	/**
	 * Performs next action.
	 */
	async next() {
		// Minimal delay is required
		await delay(333);

		switch (this.game.phase) {
			case 'placing': {
				const {x, y} = this.getRandomPlacePossibility();
				this.game.place(x, y, this.player);
				break;
			}
			case 'moving': {
				const {sx, sy, tx, ty} = this.getRandomMovePossibility();
				this.game.move(sx, sy, tx, ty, this.player);
				break;
			}
		}
	}

	/**
	 * @param {Game} game 
	 * @param {number} player 
	 */
	attach(game, player = 1) {
		super.attach(game, player);
		this.symbolCode = symbolsForPlayers[player].charCodeAt(0);
		this.game.addEventListener('start', this.startListener = event => {
			if (this.player == event.player) {
				this.next();
			}
		});
		this.game.addEventListener('next', this.nextListener = event => {
			if (this.player == event.player) {
				this.next();
			}
		});
		return this;
	}

	detach() {
		if (!this.game) return this;
		this.game.removeEventListener('start', this.startListener);
		this.game.removeEventListener('next',  this.nextListener);
		super.detach();
		return this;
	}
}
