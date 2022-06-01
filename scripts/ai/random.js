
async function delay(milliseconds) {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

class RandomStrategy extends GameStrategy {
	constructor() {
		super();
	}

	get symbol() {
		return symbolsForPlayers[this.player];
	}

	getRandomPlacePossibility() {
		const possibilities = [...this.game.placePossibilitiesGenerator()];
		return possibilities[Math.floor(Math.random() * possibilities.length)]
	}

	getRandomMovePossibility() {
		const possibilities = [...this.game.movePossibilitiesForSymbolGenerator(this.symbol)];
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
		this.game.addEventListener('next', this.nextListener = event => {
			if (this.player == event.player) {
				this.next();
			}
		});
		return this;
	}

	detach() {
		if (!this.game) return this;
		this.game.removeEventListener('next',  this.nextListener);
		super.detach();
		return this;
	}
}
