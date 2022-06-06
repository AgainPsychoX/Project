
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

class AlphaBetaTreeGenerationFeedback extends EventTarget {
	constructor(interactivity = 0) {
		super();
		this.count = 0;
		this.leafs = 0;
		this.wins = 0;
		this.loses = 0;
		this.draws = 0;
		this.cutoffs = 0;
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
	 * @param {AlphaBetaNode} node 
	 * @param {Game} state
	 */
	async onNodePrepared(node, state) {
		this.count++;
		if (state.phase == 'over') {
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

	onNodeCutoff(node, state) {
		this.cutoffs++;
	}
}

/**
 * @callback gameAction
 * @param {Game} game Game to affect.
 */

class AlphaBetaNode {
	/**
	 * @param {number} playerToWin Player to win.
	 * @param {number} [alpha=-Infinity]
	 * @param {number} [beta=+Infinity]
	 * @param {GameAction} [action] 
	 * @param  {...any} [args]
	 */
	constructor(playerToWin, alpha = -Infinity, beta = +Infinity, action, ...args) {
		/** @type {number} */ this.playerToWin = playerToWin;
		/** @type {GameAction} */ this.action = action
		/** @type {any[]} */ this.args = args;
		/** @type {AlphaBetaNode[]} */ this.children = [];
		/** @type {number} */ this.alpha = alpha;
		/** @type {number} */ this.beta = beta;
	}

	toString() {
		return `${this.action}(${this.args.join(', ')}) alpha: ${this.alpha} beta: ${this.beta} score: ${this.score}`;
		// return `${this.action}(${this.args.join(', ')})`;
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

	// get score() {
	// 	return this.alpha;
	// 	// return this.alpha + this.beta;
	// 	// // Score passing via alpha/beta variables
	// 	// if (isNaN(this.beta))

	// 	// if (this.currentPlayer == this.playerToWin)
	// 	// 	return this.alpha;
	// 	// else
	// 	// 	return this.beta;
	// }

	/**
	 * @param {Game} currentState
	 * @param {AlphaBetaTreeGenerationFeedback} [feedback]
	 */
	async *childrenGenerator(currentState, feedback) {
		if (this.args.length == 2 && this.args[0] == 1 && this.args[1] == 2 && currentState.currentPlayer == 1) {
			void(1);
		};
		switch (currentState.phase) {
			case 'placing':
				for (const {x, y} of currentState.placePossibilitiesGenerator()) {
					const child = new AlphaBetaNode(this.playerToWin, this.alpha, this.beta, 'place', x, y);
					const nextState = currentState.clone();
					child.applyTo(nextState);
					const score = await child.prepare(nextState, feedback);
					yield { child, nextState, score };
				}
				break;
			case 'moving':
				for (const {sx, sy, tx, ty} of currentState.movePossibilitiesForSymbolGenerator(currentState.currentPlayerSymbol)) {
					const child = new AlphaBetaNode(this.playerToWin, this.alpha, this.beta, 'move', sx, sy, tx, ty);
					const nextState = currentState.clone();
					child.applyTo(nextState);
					const score = await child.prepare(nextState, feedback);
					yield { child, nextState, score };
				}
				break;
		}
	}

	/**
	 * @param {Game} currentState
	 * @param {AlphaBetaTreeGenerationFeedback} [feedback]
	 */
	async prepare(currentState, feedback) {
		// console.groupCollapsed(`${this}`);
		// console.group(currentState.toString());
		let out = -1;
		if (currentState.phase == 'over') {
			if (currentState.currentPlayer == this.playerToWin) out = 1;
			else if (currentState.currentPlayer == -1) out = 0;
			else out = -1;
			this.alpha = this.beta = out;
			// console.log('over: ' + out);
		}
		else {
			if (currentState.currentPlayer == this.playerToWin) {
				for await (const {child, nextState, score} of this.childrenGenerator(currentState, feedback)) {
					this.children.push(child);
					if (this.alpha < score) {
						this.alpha = score;
						// this.children.push(child);
						// console.log(`new alpha: ${score}`);
					}
					if (score >= this.beta) {
						// console.log(`score ${score} >= ${this.beta} beta ... cutoff`);
						if (feedback) {
							feedback.onNodeCutoff(this);
						}
						break;
					}
				}
				out = this.alpha;
			}
			else {
				for await (const {child, nextState, score} of this.childrenGenerator(currentState, feedback)) {
					this.children.push(child);
					if (this.beta > score) {
						this.beta = score;
						// this.children.push(child);
						// console.log(`new beta: ${score}`);
					}
					if (this.alpha >= score) {
						// console.log(`alpha ${this.alpha} >= ${score} score ... cutoff`);
						if (feedback) {
							feedback.onNodeCutoff(this);
						}
						break;
					}
				}
				out = this.beta;
			}
		}
		if (feedback) {
			await feedback.onNodePrepared(this, currentState);
		}
		if (!isFinite(out)) {
			debugger;
		}
		// console.groupEnd();
		// console.groupEnd();
		this.score = out;
		return out;
	}
}

class AlphaBetaStrategy extends GameStrategy {
	static _cachedRoots = {};

	/**
	 * @param {number} player Player to win.
	 * @param {Game} game 
	 * @param {AlphaBetaTreeGenerationFeedback} [feedback] 
	 */
	static async prepareRoot(player, game, feedback) {
		const hash = await sha1('XD' + game.currentPlayer + player + JSON.stringify(game.settings) + game.state);

		const found = AlphaBetaStrategy._cachedRoots[hash];
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

		const fresh = new AlphaBetaNode(player);
		const imagination = game.clone().start();
		return AlphaBetaStrategy._cachedRoots[hash] = fresh.prepare(imagination, feedback).then(() => {
			if (feedback) feedback.finish();
			return fresh;
		});
	}

	constructor() {
		super();
		/** @type {AlphaBetaNode[]|null} */
		this.possibilities = null;
	}

	getBestPossibility() {
		// const bestScore = Math.max(...this.possibilities.map(p => p.score));
		// const bestPossibilities = this.possibilities.filter(p => p.score == bestScore).map(p => p);
		// return bestPossibilities[Math.random() * bestPossibilities.length | 0];

		// return this.possibilities[Math.random() * this.possibilities.length | 0];

		const bestScore = Math.max(...this.possibilities.map(p => p.score));
		return this.possibilities.find(p => p.score == bestScore);
	}

	/**
	 * @param {Game} game 
	 * @param {number} [player=1] 
	 * @param {GameVisualizer} [visualizer]
	 */
	async attach(game, player = 1, visualizer) {
		super.attach(game, player, visualizer);

		this.game.addEventListener('next', this.nextListener = async (event) => {
			if (this.player == event.player) {
				this.updateUI();
				const best = this.getBestPossibility();
				best.applyTo(this.game);
				this.possibilities = best.children;
				// this.updateUI();
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
		this.game.removeEventListener('next',  this.nextListener);
		this.game.removeEventListener('place', this.placeListener);
		this.game.removeEventListener('move',  this.moveListener);
		this.possibilities = null;
		super.detach();
		return this;
	}

	/**
	 * @param {AlphaBetaNode[]} nodes 
	 * @param {Game} currentState
	 * @returns `HTMLDetailsElement`s to represent the nodes.
	 */
	 _generatePossibilitiesUI(nodes, currentState) {
		return nodes
			// .sort((a, b) => a.score - b.score)
			.map(node => {
				let text;
				switch (node.action) {
					case 'place':
						text = `${currentState.currentPlayerSymbol} (${node.args.join(', ')}) | α: ${node.alpha} β: ${node.beta} | wynik: ${node.score}`;
						break;
					case 'move':
						const [sx, sy, tx, ty] = node.args;
						text = `${currentState.currentPlayerSymbol} (${sx}, ${sy}) na (${tx}, ${ty}) | α: ${node.alpha} β: ${node.beta} | wynik: ${node.score}`;
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
		const feedback = new AlphaBetaTreeGenerationFeedback(1000);
		const startTime = +new Date();
		if (this.visualizer) {
			feedback.addEventListener('cacheMiss', async () => {
				this.visualizer.lock();
				this.visualizer.uiRoot.querySelector('.strategy').innerHTML = `<h4>Generowanie drzewa alpha-beta...</h4><p>Zaczyna: ${this.game.settings.startingPlayer == 0 ? 'Człowiek' : 'Komputer'}</p><p></p>`;
				const p = this.visualizer.uiRoot.querySelector('.strategy p:nth-of-type(2)');
				const update = () => p.innerHTML = `Węzłów: ${feedback.count}. Liści: ${feedback.leafs}. Odcięć: ${feedback.cutoffs}. Czas: ${((+new Date() - startTime) / 1000).toFixed(1)}s`;
				feedback.addEventListener('report', update);
				feedback.addEventListener('finish', () => {
					update();
					this.visualizer.unlock();
				});
			});
		}
		const root = await AlphaBetaStrategy.prepareRoot(this.player, this.game, feedback);
		this.possibilities = root.children;
		if (feedback.count > 0) {
			await delay(1000);
		}
		if (this.visualizer) {
			this.visualizer.uiRoot.querySelector('.strategy').innerHTML = `<h4>Najbliższe węzły alpha-beta (wg. wyniku)</h4><div class="nodes"></div>`;
		}
	}
}
