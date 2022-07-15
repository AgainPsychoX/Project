
const gameUiRoot = document.querySelector('#game');

const game = new Game();

const visualizer = new GameVisualizer(gameUiRoot).attach(game);

const strategies = {
	none: null,
	random: new RandomStrategy(),
	minMax: new MinMaxStrategy(),
	alphaBeta: new AlphaBetaStrategy(),
};
let strategy;

const resetButton = gameUiRoot.querySelector('.controls button[name=reset]');
async function reset() {
	resetButton.disabled = true;

	// Detach anything from the game instance
	if (strategy) {
		strategy.detach();
	}
	visualizer.detach();

	// Algorithm for computer to use
	{
		strategy = strategies[gameUiRoot.querySelector('.controls select[name=computerStrategy]').value];
		if (strategy === undefined) {
			throw new Error(`Strategy not found by name`);
		}
		const useCache = gameUiRoot.querySelector('.controls input[name=strategyCache]').checked;
		if (!useCache) {
			if (strategy.clearCache) strategy.clearCache();
			else if (strategy.constructor.clearCache) strategy.constructor.clearCache();
		}
	}

	// Starting player
	{
		let startingPlayer = game.settings.startingPlayer;
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
		game.settings.startingPlayer = startingPlayer;
	}

	// Reset the game state
	game.reset();
	// const x = symbolsForPlayers[0].charCodeAt(0); // setting up initial position for debugging
	// const o = symbolsForPlayers[1].charCodeAt(0);
	// {
	// 	game.state = [
	// 		x, o, 0,
	// 		x, 0, 0,
	// 		0, 0, o,
	// 	];
	// 	game.remainingPlaces[0] = 1;
	// 	game.remainingPlaces[1] = 1;
	// }

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

const parseBoolean = (value, defaultValue = false) => {
	if (typeof value === 'undefined' || value === null) {
		return defaultValue;
	}
	if (typeof value === 'boolean') {
		return value;
	}
	switch (value.toLowerCase().trim()) {
		case "true": case "yes": case "on": case "1": return true;
		case "false": case "no": case "off": case "0": return false;
		default: return defaultValue;
	}
}

// Load settings from query params if set
{
	const searchParams = new URL(location.href).searchParams;
	for (const select of gameUiRoot.querySelectorAll('.controls select')) {
		const value = searchParams.get(select.name);
		if (value !== null) select.value = value;
	}
	for (const checkbox of gameUiRoot.querySelectorAll('.controls input[type=checkbox]')) {
		const value = searchParams.get(checkbox.name);
		if (value !== null) checkbox.checked = parseBoolean(value);
	}
}

reset();


