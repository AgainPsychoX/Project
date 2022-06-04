
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
	 * @param {number} player Player to win.
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

	async prepare() {
		await MinMaxStrategy._keepInteractivePromise(); // prevent page responding
		const aggregate = this.player == this.game.currentPlayer ? Math.max : Math.min;
		switch (this.game.phase) {
			case 'placing': 
				for (const {x, y} of this.game.placePossibilitiesGenerator()) {
					const child = new MinMaxNode(this.player, this.game.clone(), 'place', x, y);
					await child.prepare();
					this.children.push(child);
				}
				this.score = aggregate.apply(null, this.children.map(c => c.score));
				break;
			case 'moving': 
				for (const {sx, sy, tx, ty} of this.game.movePossibilitiesForSymbolGenerator(this.game.currentPlayerSymbol)) {
					const child = new MinMaxNode(this.player, this.game.clone(), 'move', sx, sy, tx, ty);
					await child.prepare();
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
	 * @param {number} player Player to win.
	 * @param {Game} game 
	 */
	static async prepareRoot(player, game) {
		const hash = await sha1('XD' + game.currentPlayer + player + JSON.stringify(game.settings) + game.state);

		const found = MinMaxStrategy._cachedRoots[hash];
		if (found) return found;

		const fresh = new MinMaxNode(player, game.clone());
		await fresh.prepare();
		MinMaxStrategy._cachedRoots[hash] = fresh;
		return fresh;
	}

	static _keepInteractiveCounter = 0;
	static async _keepInteractivePromise() {
		if (++MinMaxStrategy._keepInteractiveCounter % 10000 == 0) {
			console.log(`Building min-max tree: ${MinMaxStrategy._keepInteractiveCounter} nodes...`);
			return nextFrame();
		}
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
				.sort((a, b) => a.score - b.score)
				.map(p => `${p.action} ${p.args.join(' ')} -> score: ${p.score} [children: ${p.children.length}]`)
				.join('\n')
		);
	}

	getBestPossibility() {
		const bestScore = Math.max(...this.possibilities.map(p => p.score));
		const bestPossibilities = this.possibilities.filter(p => p.score == bestScore).map(p => p);
		return bestPossibilities[Math.random() * bestPossibilities.length | 0];
	}

	async start() {
		// Minimal delay is required to observe game in first phase (as 'start' event is fired before 'phase')
		await nextFrame();

		const root = await MinMaxStrategy.prepareRoot(this.player, this.game);
		this.possibilities = root.children;

		if (this.game.currentPlayer != this.player) {
			console.log('nodes: ' + this.countNodes());
			console.log(`Min-max possibilities:`);
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
		console.log(`Min-max possibilities:`);
		this.debugPrintPossibilities();

		const best = this.getBestPossibility();
		best.applyTo(this.game);
		this.possibilities = best.children;

		console.log('nodes: ' + this.countNodes());
		console.log(`Min-max possibilities:`);
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
