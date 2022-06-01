
let game = new Game();
// {
// 	const x = 'X'.charCodeAt(0);
// 	const o = 'O'.charCodeAt(0);
// 	game.state = [
// 		x, x, 0, 
// 		o, o, 0,
// 		0, 0, 0,
// 	];
// 	game.remainingPlaces[1] = game.remainingPlaces[0] = 1;
// }
const visualizer = new GameVisualizer(document.querySelector('#game')).attach(game);
// let strategy = new RandomStrategy().attach(game);
let strategy = new MinMaxStrategy().attach(game);

document.querySelector('#game .controls button[name=reset]').addEventListener('click', () => {
	visualizer.detach();
	strategy.detach();
	game.reset();
	visualizer.attach(game);
	strategy.attach(game);
	game.start(Math.floor(Math.random() * 2));
});



// game.start(Math.floor(Math.random() * 2));
game.start(1);


