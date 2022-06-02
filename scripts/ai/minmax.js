
async function sha1(string) {
	const sourceBytes = new TextEncoder().encode(string);
	const digest = await (crypto.subtle || crypto.webcrypto.subtle).digest("SHA-1", sourceBytes);
	const resultBytes = [...new Uint8Array(digest)];
	return resultBytes.map(x => x.toString(16).padStart(2, '0')).join("");
}

async function delay(milliseconds) {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}
async function nextFrame() {
	return new Promise(resolve => requestAnimationFrame(resolve));
}

/**
 * @callback gameAction
 * @param {Game} game Game to affect.
 */

class MinMaxNode {
	/**
	 * @param {Game} game 
	 * @param {GameAction} action 
	 * @param  {...any} args 
	 */
	constructor(game, action, ...args) {
		/** @type {Game} */ this.game = game;
		/** @type {number} */ this.player = game.currentPlayer;
		/** @type {GameAction} */ this.action = action
		/** @type {any[]} */ this.args = args;
		/** @type {MinMaxNode[]} */ this.children = [];
		/** @type {number} */ this.winner = -1;

		this.applyTo(this.game);
	}

	toString() {
		return `${this.player} ${this.action} ${this.args.join(' ')}`;
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

	scoreFor(player) {
		if (this.winner === player) return 1;
		if (this.winner === -1) return  0;
		return -1;
	}

	async prepare() {
		switch (this.game.phase) {
			case 'placing': 
				for (const {x, y} of this.game.placePossibilitiesGenerator()) {
					const child = new MinMaxNode(this.game.clone(), 'place', x, y);
					await child.prepare();
					this.children.push(child);
				}
				break;
			case 'moving': 
				for (const {sx, sy, tx, ty} of this.game.movePossibilitiesForSymbolGenerator(this.game.currentPlayerSymbol)) {
					const child = new MinMaxNode(this.game.clone(), 'move', sx, sy, tx, ty);
					await child.prepare();
					this.children.push(child);
				}
				break;
			case 'over':
				this.winner = this.game.currentPlayer;
				break;
		}
		for (const node of this.children) {
			if (node.winner == this.game.currentPlayer) {
				this.winner = this.game.currentPlayer;
				break;
			}
		}
		this.game = null;
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
	static _cachedRoots = {};

	/**
	 * @param {Game} game 
	 */
	static async prepareRoot(game) {
		const hash = await sha1('XD' + game.currentPlayer + JSON.stringify(game.settings) + game.state);

		const found = MinMaxStrategy._cachedRoots[hash];
		if (found) return found;

		const fresh = new MinMaxNode(game.clone());
		await fresh.prepare();
		MinMaxStrategy._cachedRoots[hash] = fresh;
		return fresh;
	}

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
		console.log(
			this.possibilities
				.map(p => [p, p.scoreFor(this.player)])
				.sort((a, b) => a[1] - b[1])
				.map(p => `${p[0].action} ${p[0].args.join(' ')} -> score: ${p[1]}, winner: ${p[0].winner} [children: ${p[0].children.length}]`)
				.join('\n')
		);
	}

	getBestPossibility() {
		const withScores = this.possibilities.map(p => [p, p.scoreFor(this.player)]);
		const bestScore = Math.max(...withScores.map(p => p[1]));
		const bestPossibilities = withScores.filter(p => p[1] == bestScore).map(p => p[0]);
		return bestPossibilities[Math.random() * bestPossibilities.length | 0];
	}

	async start() {
		// Minimal delay is required to observe game in first phase (as 'start' event is fired before 'phase')
		await nextFrame();

		const root = await MinMaxStrategy.prepareRoot(this.game);
		this.possibilities = root.children;

		if (this.game.currentPlayer != this.player) {
			console.log('nodes: ' + this.countNodes());
			console.log(`Min-max possibilities for player ${this.game.currentPlayer}:`);
			this.debugPrintPossibilities();
		}
	}

	/**
	 * Performs next action.
	 */
	async next() {
		// Wait for ready
		await this.readyPromise;
		console.log('nodes: ' + this.countNodes());

		console.log(`Min-max possibilities for player ${this.player}:`);
		this.debugPrintPossibilities();

		const best = this.getBestPossibility();
		best.applyTo(this.game);
		this.possibilities = best.children;

		console.log('nodes: ' + this.countNodes());

		console.log(`Min-max possibilities for player ${this.game.currentPlayer}:`);
		this.debugPrintPossibilities();
	}

	/**
	 * @param {Game} game 
	 * @param {number} player 
	 */
	attach(game, player = 1) {
		super.attach(game, player);
		this.game.addEventListener('start', this.startListener = event => {
			this.readyPromise = this.start();
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
