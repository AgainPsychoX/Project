
let game = new Game();
const visualizer = new GameVisualizer(document.querySelector('#game')).attach(game);
let strategy = new RandomGameStrategy().attach(game);

document.querySelector('#game .controls button[name=reset]').addEventListener('click', () => {
	visualizer.detach();
	strategy.detach();
	game.reset();
	visualizer.attach(game);
	strategy.attach(game);
	game.start(Math.floor(Math.random() * 2));
});



game.start(Math.floor(Math.random() * 2));


