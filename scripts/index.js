
const gameUiRoot = document.querySelector('#game');

let game = new Game();

const visualizer = new GameVisualizer(gameUiRoot).attach(game);

const strategies = {
	none: null,
	random: new RandomStrategy(),
	minMax: new MinMaxStrategy(),
};
let strategy;
let startingPlayer = 0;

const resetButton = gameUiRoot.querySelector('.controls button[name=reset]');
async function reset() {
	resetButton.disabled = true;

	// Detach anything from the game instance
	if (strategy) {
		strategy.detach();
	}
	visualizer.detach();

	// Reset the game state
	game.reset();

	// Algorithm for computer to use
	{
		strategy = strategies[gameUiRoot.querySelector('.controls select[name=computerAlgorithm]').value];
		if (strategy === undefined) {
			throw new Error(`Strategy not found by name`);
		}
	}

	// Starting player
	{
		const value = gameUiRoot.querySelector('.controls select[name=startingPlayer]').value;
		const num = parseInt(value);
		if (isNaN(num)) {
			switch (value) {
				case 'random':
					startingPlayer = -1;
					break;
				case 'alternately': 
					startingPlayer = (startingPlayer + 1) % game.settings.playersCount;
					break;
				case 'loser':  {
					if (game.currentPlayer >= 0)
						startingPlayer = (game.currentPlayer + 1) % game.settings.playersCount;
					else
						startingPlayer = -1;
					break;
				}
				case 'winner': {
					if (game.currentPlayer >= 0)
						startingPlayer = game.currentPlayer;
					else
						startingPlayer = -1;
					break;
				}
			}
			if (startingPlayer == -1) {
				startingPlayer = Math.floor(Math.random() * game.settings.playersCount);
			}
		}
		else {
			startingPlayer = num;
		}
	}
	game.settings.startingPlayer = startingPlayer;

	// Attach visualizer
	visualizer.attach(game);

	// Attach strategy, if any
	if (strategy) {
		strategy.attach(game, 1, visualizer);
		await strategy.prepare();
	}

	// Start the game
	game.start();

	resetButton.disabled = false;
}
resetButton.addEventListener('click', reset);

// gameUiRoot.querySelector('.controls select[name=computerAlgorithm]').value = 'random'; // prevent lag while in development
reset();


