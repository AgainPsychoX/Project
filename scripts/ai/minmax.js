
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

class MinMaxTreeGenerationFeedback extends EventTarget {
	constructor(interactivity = 0) {
		super();
		this.count = 0;
		this.leafs = 0;
		this.wins = 0;
		this.loses = 0;
		this.draws = 0;
		this.interactivity = interactivity;
	}

	cacheMiss() {
		this.dispatchEvent(new Event('cacheMiss'));
	}
	cacheHit() {
		this.dispatchEvent(new Event('cacheHit'));
	}
	finish() {
		this.dispatchEvent(new Event('finish'));
	}

	/**
	 * @param {MinMaxNode} node 
	 */
	async onNodePrepared(node) {
		this.count++;
		if (node.game.phase == 'over') {
			this.leafs++;
			if (node.score > 0) this.wins++;
			if (node.score < 0) this.loses++;
			if (node.score == 0) this.draws++;
		}
		if (this.count % this.interactivity == 0) {
			this.dispatchEvent(new Event('report'))
			await nextFrame();
		}
	}
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

	/**
	 * @param {MinMaxTreeGenerationFeedback} [feedback]
	 */
	async prepare(feedback) {
		const aggregate = this.player == this.game.currentPlayer ? Math.max : Math.min;
		switch (this.game.phase) {
			case 'placing': 
				for (const {x, y} of this.game.placePossibilitiesGenerator()) {
					const child = new MinMaxNode(this.player, this.game.clone(), 'place', x, y);
					await child.prepare(feedback);
					this.children.push(child);
				}
				this.score = aggregate.apply(null, this.children.map(c => c.score));
				break;
			case 'moving': 
				for (const {sx, sy, tx, ty} of this.game.movePossibilitiesForSymbolGenerator(this.game.currentPlayerSymbol)) {
					const child = new MinMaxNode(this.player, this.game.clone(), 'move', sx, sy, tx, ty);
					await child.prepare(feedback);
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
		if (feedback) {
			await feedback.onNodePrepared(this);
		}
		this.game = null;
	}
}

class MinMaxStrategy extends GameStrategy {
	static _cachedRoots = {};

	/**
	 * @param {number} player Player to win.
	 * @param {Game} game 
	 * @param {MinMaxTreeGenerationFeedback} [feedback] 
	 */
	static async prepareRoot(player, game, feedback) {
		const hash = await sha1('XD' + game.currentPlayer + player + JSON.stringify(game.settings) + game.state);

		const found = MinMaxStrategy._cachedRoots[hash];
		if (feedback) {
			if (found) {
				feedback.cacheHit();
				return found;
			}
			else {
				feedback.cacheMiss();
			}
		}
		if (found) return found;

		const fresh = new MinMaxNode(player, game.clone().start());
		return MinMaxStrategy._cachedRoots[hash] = fresh.prepare(feedback).then(() => {
			if (feedback) feedback.finish();
			return fresh;
		});
	}

	static clearCache() {
		MinMaxStrategy._cachedRoots = {};
	}

	constructor() {
		super();
		/** @type {MinMaxNode[]|null} */
		this.possibilities = null;
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

	/**
	 * @param {Game} game 
	 * @param {number} [player=1] 
	 * @param {GameVisualizer} [visualizer]
	 */
	async attach(game, player = 1, visualizer) {
		super.attach(game, player, visualizer);

		this.game.addEventListener('next', this.firstNextListener = () => {
			this.updateUI();
			this.game.removeEventListener('next',  this.firstNextListener);
		});
		this.game.addEventListener('next', this.nextListener = async (event) => {
			if (this.player == event.player) {
				// this.updateUI(); // debugging - checking strategy choice making
				const best = this.getBestPossibility();
				best.applyTo(this.game);
				this.possibilities = best.children;
				this.updateUI();
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
		this.game.removeEventListener('next',  this.firstNextListener);
		this.game.removeEventListener('next',  this.nextListener);
		this.game.removeEventListener('place', this.placeListener);
		this.game.removeEventListener('move',  this.moveListener);
		this.possibilities = null;
		super.detach();
		return this;
	}

	/**
	 * @param {MinMaxNode[]} nodes 
	 * @param {Game} currentState
	 * @returns `HTMLDetailsElement`s to represent the nodes.
	 */
	 _generatePossibilitiesUI(nodes, currentState) {
		return nodes
			.sort((a, b) => a.score - b.score)
			.map(node => {
				let text;
				switch (node.action) {
					case 'place':
						text = `${currentState.currentPlayerSymbol} (${node.args.join(', ')}) | wynik: ${node.score}`;
						break;
					case 'move':
						const [sx, sy, tx, ty] = node.args;
						text = `${currentState.currentPlayerSymbol} (${sx}, ${sy}) na (${tx}, ${ty}) | wynik: ${node.score}`;
						break;
				}

				if (node.children.length > 0) {
					const details = document.createElement('details');
					const summary = document.createElement('summary');
					summary.innerText = text;
					details.appendChild(summary);

					const nextState = currentState.clone();
					node.applyTo(nextState);
	
					// Generate more UI upon expanding
					const toggleListener = () => {
						if (details.open) {
							details.append(...this._generatePossibilitiesUI(node.children, nextState));
						}
						details.removeEventListener('toggle', toggleListener);
					};
					details.addEventListener('toggle', toggleListener);
	
					// Collapse children upon expanding
					details.addEventListener('toggle', () => {
						details.querySelectorAll(':scope > details').forEach(details => {
							details.open = false;
						});
					});
	
					return details;
				}
				else {
					const li = document.createElement('li');
					li.innerText = text;
					return li;
				}
			})
		;
	}

	updateUI() {
		if (!this.visualizer) return;
		if (this.game.isOver()) {
			this.visualizer.uiRoot.querySelector('.strategy').replaceChildren();
		}
		else {
			this.visualizer.uiRoot.querySelector('.strategy .nodes').replaceChildren(...this._generatePossibilitiesUI(this.possibilities, this.game.clone()));
		}
	}

	async prepare() {
		const feedback = new MinMaxTreeGenerationFeedback(1000);
		const startTime = +new Date();
		if (this.visualizer) {
			feedback.addEventListener('cacheMiss', async () => {
				this.visualizer.lock();
				this.visualizer.uiRoot.querySelector('.strategy').innerHTML = `<h4>Generowanie drzewa min-max...</h4><p>Zaczyna: ${this.game.settings.startingPlayer == 0 ? 'Człowiek' : 'Komputer'}</p><p></p>`;
				const p = this.visualizer.uiRoot.querySelector('.strategy p:nth-of-type(2)');
				const update = () => p.innerHTML = `Węzłów: ${feedback.count}. Liści: ${feedback.leafs}. Czas: ${((+new Date() - startTime) / 1000).toFixed(1)}s`;
				feedback.addEventListener('report', update);
				feedback.addEventListener('finish', () => {
					update();
					this.visualizer.unlock();
				});
			});
		}
		const root = await MinMaxStrategy.prepareRoot(this.player, this.game, feedback);
		this.possibilities = root.children;
		if (feedback.count > 0) {
			await delay(1000);
		}
		if (this.visualizer) {
			this.visualizer.uiRoot.querySelector('.strategy').innerHTML = `<h4>Najbliższe węzły min-max (wg. wyniku)</h4><div class="nodes"></div>`;
		}
	}
}
