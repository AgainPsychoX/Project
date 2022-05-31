
/**
 * Abstract class for game strategy. Attaches to game instance to play as player.
 * @abstract
 */
class GameStrategy {
	constructor() {
		/** @type {Game|null} */ this.game = null;
		/** @type {number} */ this.player = 1;
	}

	/**
	 * Attaches (listeners) to given game instance to manipulate it as given player.
	 * @abstract
	 * @param {Game} game 
	 * @param {number} player
	 * @returns This, for chaining.
	 */
	attach(game, player = 1) {
		this.game = game;
		this.player = player;
		return this; // for chaining
	}

	/**
	 * Detaches from the related game instance.
	 * @abstract
	 * @returns This, for chaining.
	 */
	detach() {
		this.game = null;
		return this; // for chaining
	}
}
