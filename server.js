const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const TicTacToeGame = require('./tictactoe')

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'gjhlhlgALSHGhkasgklGSakgjlagwshsvSAhaglasajg';

mongoose.connect('mongodb://mongo:27017/tictactoe', {
	useNewUrlParser: true,
	useUnifiedTopology: true
});


// Database schema
const userSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	wins: { type: Number, default: 0 },
	losses: { type: Number, default: 0 },
	draws: { type: Number, default: 0 },
	game: { type: mongoose.Schema.Types.ObjectId, ref: 'TicTacToeGame' },
  });

const User = mongoose.model('User', userSchema);

// Game schema
const ticTacToeGameSchema = new mongoose.Schema({
	board: [[String]],
	currentPlayer: String,
});

// Method to check if the game is over
ticTacToeGameSchema.methods.gameOver = function () {
	const ticTacToeGame = new TicTacToeGame(this);
	return ticTacToeGame.isGameOver();
};
  
// Method to check if a player has won
ticTacToeGameSchema.methods.checkWin = function () {
	const ticTacToeGame = new TicTacToeGame(this);
	return ticTacToeGame.checkWin();
};

  
const gameSchema = new mongoose.Schema({
	players: [String],
	gameInstance: ticTacToeGameSchema,
	active: { type: Boolean, default: true },
	startTime: { type: Date, default: Date.now },
});
  
// a way to apply the move to the game instance, 
// because we don't actually use the game instance in the game schema
gameSchema.methods.applyMove = function (row, col, player_x, player_o) {
	const ticTacToeGame = new TicTacToeGame(this.gameInstance);
	const moveResult = ticTacToeGame.makeMove(row, col);

	if (moveResult) {
		if (!ticTacToeGame.isGameOver()) {
			ticTacToeGame.switchPlayer(player_x, player_o);
		}
		this.gameInstance = ticTacToeGame.getGameState();
		this.save(); // Save the updated game state to the database
	}
	

	return moveResult;
};

// Method to reset the game
gameSchema.methods.resetGame = function () {
	const ticTacToeGame = new TicTacToeGame();
	this.gameInstance.board = ticTacToeGame.board;
	this.gameInstance.currentPlayer = this.players[0];
	this.gameInstance.save(); // Save the updated game state to the database
	this.active = true;
};
  
const Game = mongoose.model('Game', gameSchema);


// _____________________________________________________________
app.use(bodyParser.json());

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
	const token = req.header('Authorization');
	if (!token) return res.status(401).json({ error: 'Access denied. Token not provided.' });

	jwt.verify(token, JWT_SECRET, (err, user) => {
		if (err) return res.status(403).json({ error: 'Invalid token.' });

		req.user = user;
		next();
	});
};

// Middleware to verify if a user is part of a game
const verifyGamePlayer = async (req, res, next) => {
	const gameId = req.params.gameId;
	const game = await Game.findById(gameId).populate('gameInstance');

	if (!game) {
		return res.status(404).json({ error: 'Game not found.' });
	}

	const currentPlayer = req.user.username;
	if (!game.players.includes(currentPlayer)) {
		return res.status(403).json({ error: 'You are not a player in this game.' });
	}

	req.game = game;
	next();
};

// API endpoints

// Get all users
app.get('/api/users', async (req, res) => {
	try {
		const users = await User.find({}, { password: 0 }); // Exclude password field from the response
	res.json(users);
	} catch (error) {
	res.status(500).json({ error: 'Failed to fetch users.' });
	}
});
// Get user leaderboard with selected fields
app.get('/api/users/leaderboard', async (req, res) => {
	try {
	const users = await User.find({}, { _id: 0, username: 1, wins: 1, losses: 1, draws: 1 })
		.sort({ wins: 'desc' });

	res.status(200).json(users);
	} catch (error) {
	res.status(500).json({ error: 'Failed to fetch users leaderboard. ' + error });
	}
});

// Create a new user
app.post('/api/register', async (req, res) => {
	try {
		const { username, password } = req.body;
		
		// Hash the password before saving it to the database
		const hashedPassword = await bcrypt.hash(password, 10);

		const newUser = new User({ username, password: hashedPassword });
		await newUser.save();

		res.status(201).json({ message: 'User created successfully.' });
	} catch (error) {
		res.status(400).json({ error: 'Failed to create user.' });
	}
});

// Login
app.post('/api/login', async (req, res) => {
	try {
		const { username, password } = req.body;

		const user = await User.findOne({ username });
		if (!user) return res.status(401).json({ error: 'Invalid username or password.' });

		const validPassword = await bcrypt.compare(password, user.password);
		if (!validPassword) return res.status(401).json({ error: 'Invalid username or password.' });

		// Generate JWT token
		const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '12h' });
		res.json({ token });
	} catch (error) {
		res.status(400).json({ error: 'Failed to log in.' });
	}
});

// Delete user (requires authentication)
app.delete('/api/delete', verifyToken, async (req, res) => {
	try {
		const { username } = req.user;

		// Ensure that the user can only delete their own account
		if (req.body.username !== username) {
		return res.status(403).json({ error: 'Permission denied. You can only delete your own account.' });
		}

		await User.deleteOne({ username });
		res.json({ message: 'User deleted successfully.' });
	} catch (error) {
	res.status(400).json({ error: 'Failed to delete user.' });
	}
});



// _____________________________________________________________
// game api

// Start a new game
app.post('/api/start-game', verifyToken, async (req, res) => {
	try {
	const { player2 } = req.body;
	const player1 = req.user.username;

	const newGame = new Game({
		players: [player1, player2],
		gameInstance: {
		board: [
			[' ', ' ', ' '],
			[' ', ' ', ' '],
			[' ', ' ', ' '],
		],
		currentPlayer: player1,
		},
	});

	await newGame.save();

	// Update users with game reference
	await User.updateMany(
		{ username: { $in: [player1, player2] } },
		{ $set: { game: newGame._id } }
	);

	res.status(201).json({ message: 'Game started successfully.', gameId: newGame._id });
	} catch (error) {
	res.status(400).json({ error: 'Failed to start a game. ' + error });
	}
});
  
  // Make a move in the game
app.post('/api/make-move/:gameId', verifyToken, async (req, res) => {
	try {
	const { gameId } = req.params;
	const { row, col } = req.body;
	const player = req.user.username;

	// Find the game by ID
	const game = await Game.findById(gameId);

	if (!game) {
		return res.status(404).json({ error: 'Game not found.' });
	}

	// Check if the game is active
	if (!game.active) {
		return res.status(400).json({ error: 'Game is not active.' });
	}

	// Check if it's the player's turn
	if (player !== game.gameInstance.currentPlayer) {
		return res.status(403).json({ error: 'Not your turn.' });
	}

	// Apply the move using the TicTacToeGame class
	const moveResult = await game.applyMove(row, col, game.players[0], game.players[1]);

	if (!moveResult) {
		return res.status(400).json({ error: 'Invalid move.' });
	}

	// Check if the game is over
	if (game.gameInstance.gameOver()) {
		const winner = game.gameInstance.checkWin() ? game.gameInstance.currentPlayer : null;
	
		// Update player stats
		if (winner) {
			// If there's a winner, update wins and losses
			const loser = game.players.find(player => player !== winner);
		
			// if there is a loser (if you play against yourself, there is no loser)
			if(loser){ 
				await User.updateOne({ username: winner }, { $inc: { wins: 1 } });
				await User.updateOne({ username: loser }, { $inc: { losses: 1 } });
			}
		} else {
			// If it's a draw, update draws for both players
			await User.updateMany(
				{ username: { $in: game.players } },
				{ $inc: { draws: 1 } }
			);
		}
	
		let message;
		if (winner) {
			message = `Player ${winner} wins!`;
		} else {
			message = 'It\'s a draw!';
		}
		// End the game
		game.active = false;
		console.log("came here");
		await game.save();
		
	
		return res.status(200).json({ message, winner, updatedGameState: game.gameInstance });
	}

	res.status(200).json({ message: 'Move successful.', updatedGameState: game.gameInstance });
	} catch (error) {
	res.status(500).json({ error: 'Failed to make a move. ' + error });
	}
});

// Restart the game
app.post('/api/restart-game/:gameId', verifyToken, async (req, res) => {
	try {
	const { gameId } = req.params;

	// Find the game by ID
	const game = await Game.findById(gameId);

	if (!game) {
		return res.status(404).json({ error: 'Game not found.' });
	}

	// Check if the user making the request is one of the players
	const requestingUser = req.user.username;
	if (!game.players.includes(requestingUser)) {
		return res.status(403).json({ error: 'Permission denied. You are not a player in this game.' });
	}

	// Restart the game
	game.resetGame();
	await game.save();

	res.status(200).json({ message: 'Game restarted successfully.', updatedGameState: game.gameInstance });
	} catch (error) {
	res.status(500).json({ error: 'Failed to restart the game. ' + error });
	}
});
  
// Delete the game (requires authentication)
app.delete('/api/delete-game/:gameId', verifyToken, verifyGamePlayer, async (req, res) => {
	try {
	const { gameId } = req.params;

	await Game.findByIdAndDelete(gameId);
	res.json({ message: 'Game deleted successfully.' });
	} catch (error) {
	res.status(500).json({ error: 'Failed to delete game. ' + error });
	}
});

app.get('/api/games', verifyToken, async (req, res) => {
	try {
	// Get all games from the database
	const games = await Game.find({});

	// If no games are found, return an empty array
	if (!games) {
		return res.status(200).json([]);
	}

	// Return the list of games
	res.status(200).json(games);
	} catch (error) {
	res.status(500).json({ error: 'Failed to fetch games. ' + error });
	}
});

// _____________________________________________________________




app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});