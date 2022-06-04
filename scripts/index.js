
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

function reset() {
	// Detach anything from the game instance
	if (strategy) {
		strategy.detach();
	}
	visualizer.detach();

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
	

	// Reset the game state
	game.reset();

	// Attach visualizer
	visualizer.attach(game);

	// Attach strategy, if any
	if (strategy) {
		strategy.attach(game);
	}

	// Start the game
	game.start(startingPlayer);
}
gameUiRoot.querySelector('.controls button[name=reset]').addEventListener('click', reset);

gameUiRoot.querySelector('.controls select[name=computerAlgorithm]').value = 'random';
reset();


