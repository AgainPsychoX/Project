
async function delay(milliseconds) {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/**
 * @callback gameAction
 * @param {Game} game Game to affect.
 */

let minMaxNodeCount = 0;

class MinMaxNode {
	/**
	 * @param {number} player  
	 * @param {Game} game 
	 * @param {GameAction} action 
	 * @param  {...any} args 
	 */
	constructor(player, game, action, ...args) {
		/** @type {number} */ this.player = player;
		/** @type {Game} */ this.game = game;
		/** @type {GameAction} */ this.action = action
		/** @type {any[]} */ this.args = args;
		/** @type {MinMaxNode[]} */ this.children = [];
		/** @type {number} */ this.score = -Infinity;

		this.applyTo(this.game);
		minMaxNodeCount += 1;
	}

	/**
	 * @param {Game} game 
	 */
	applyTo(game) {
		// TODO: GameAction could be separated as class, then here would only be like `this.game.apply(this.action)`
		switch (this.action) {
			case 'place':
				game.place(...this.args, game.currentPlayer);
				break;
			case 'move':
				game.move(...this.args, game.currentPlayer);
				break;
		}
	}

	isMyTurn() {
		return this.game.currentPlayer == this.player
	}

	prepare() {
		const aggregate = this.player == this.game.currentPlayer ? Math.max : Math.min;
		switch (this.game.phase) {
			case 'placing': 
				for (const {x, y} of this.game.placePossibilitiesGenerator()) {
					const child = new MinMaxNode(this.player, this.game.clone(), 'place', x, y);
					child.prepare();
					this.children.push(child);
				}
				this.score = aggregate.apply(null, this.children.map(c => c.score));
				break;
			case 'moving': 
				for (const {sx, sy, tx, ty} of this.game.movePossibilitiesForSymbolGenerator(this.game.currentPlayerSymbol)) {
					const child = new MinMaxNode(this.player, this.game.clone(), 'move', sx, sy, tx, ty);
					child.prepare();
					this.children.push(child);
				}
				this.score = aggregate.apply(null, this.children.map(c => c.score));
				break;
			case 'over':
				if (this.game.currentPlayer == this.player) {
					this.score = 1;
					break;
				}
				if (this.game.currentPlayer == -1) {
					this.score = 0;
					break;
				}
				this.score = -1;
				break;
		}
		return this;
	}

	countNodes() {
		let count = this.children.length;
		for (const child of this.children) {
			count += child.countNodes();
		}
		return count;
	}
}

class MinMaxStrategy extends GameStrategy {
	constructor() {
		super();
		/** @type {MinMaxNode[]|null} */
		this.possibilities = null;
	}

	countNodes() {
		let count = this.possibilities.length;
		for (const child of this.possibilities) {
			count += child.countNodes();
		}
		return count;
	}

	debugPrintPossibilities() {
		console.log(this.possibilities.sort((a, b) => a.score - b.score).map(p => `${p.action} ${p.args.join(' ')} -> score: ${p.score}`).join('\n'));
	}

	getBestPossibility() {
		const bestScore = Math.max(...this.possibilities.map(p => p.score));
		const bestPossibilities = this.possibilities.filter(p => p.score == bestScore);
		return bestPossibilities[Math.random() * bestPossibilities.length | 0];
	}

	async start() {
		// Minimal delay is required
		await delay(333);

		minMaxNodeCount = 0;

		// TODO: add ref to node, prevent exploring already solved states (add `game.hash()`)
		this.possibilities = new MinMaxNode(this.player, this.game.clone()).prepare().children;
	}

	/**
	 * Performs next action.
	 */
	async next() {
		// Minimal delay is required
		await delay(333);
		console.log('nodes: ' + this.countNodes());

		this.debugPrintPossibilities();

		const best = this.getBestPossibility();
		best.applyTo(this.game);
		this.possibilities = best.children;

		console.log('nodes: ' + this.countNodes());
	}

	/**
	 * @param {Game} game 
	 * @param {number} player 
	 */
	attach(game, player = 1) {
		super.attach(game, player);
		this.game.addEventListener('start', this.startListener = event => {
			this.start();
		});
		this.game.addEventListener('next', this.nextListener = event => {
			if (this.player == event.player) {
				this.next();
			}
		});
		this.game.addEventListener('place', 
			this.placeListener = /** @param {PlacedSymbolEvent} event */ event => {
				if (this.player == event.player) return;
				if (!(this.possibilities.length > 0)) return;
				const observed = this.possibilities.find(p => p.action == 'place' && p.args[0] == event.x && p.args[1] == event.y)
				this.possibilities = observed.children;
			}
		);
		this.game.addEventListener('move', 
			this.moveListener = /** @param {MovedSymbolEvent} event */ event => {
				if (this.player == event.player) return;
				if (!(this.possibilities.length > 0)) return;
				const observed = this.possibilities.find(p => p.action == 'move' 
					&& p.args[0] == event.sx && p.args[1] == event.sy
					&& p.args[2] == event.tx && p.args[3] == event.ty
				);
				this.possibilities = observed.children;
			}
		);
		return this;
	}

	detach() {
		if (!this.game) return this;
		this.game.removeEventListener('start', this.startListener);
		this.game.removeEventListener('next',  this.nextListener);
		this.game.removeEventListener('place', this.placeListener);
		this.game.removeEventListener('move',  this.moveListener);
		this.possibilities = null;
		super.detach();
		return this;
	}
}
