const EMPTY = ' ';
const PLAYER_X = 'X';
const PLAYER_O = 'O';

class TicTacToeGame {
    constructor(state = null) {
        if (state) {
          // If a state is provided, use it
          this.board = state.board;
          this.currentPlayer = state.currentPlayer;
        } else {
          // Otherwise, initialize with default values
          this.board = [
            [EMPTY, EMPTY, EMPTY],
            [EMPTY, EMPTY, EMPTY],
            [EMPTY, EMPTY, EMPTY],
          ];
          this.currentPlayer = PLAYER_X;
        }
      }

  // Function to make a move on the board
    makeMove(row, col) {
        if (this.board[row][col] === EMPTY) {
        this.board[row][col] = this.currentPlayer;
        return true; // Move successful
        }
        return false; // Move invalid (cell already occupied)
    }

    // Function to switch to the next player
    switchPlayer(player_x, player_o) {
        this.currentPlayer = this.currentPlayer === player_x ? player_o : player_x;
    }

    // Function to check if the game is over
    isGameOver() {
        return this.checkWin() || this.isBoardFull();
    }

    // Function to check if a player has won
    checkWin() {
        // Check rows, columns, and diagonals for a win
        for (let i = 0; i < 3; i++) {
        // Check rows and columns
        if (
            this.board[i][0] !== EMPTY &&
            this.board[i][0] === this.board[i][1] &&
            this.board[i][1] === this.board[i][2]
        ) {
            return true; // Row win
        }
        if (
            this.board[0][i] !== EMPTY &&
            this.board[0][i] === this.board[1][i] &&
            this.board[1][i] === this.board[2][i]
        ) {
            return true; // Column win
        }
        }

        // Check diagonals
        if (
        this.board[0][0] !== EMPTY &&
        this.board[0][0] === this.board[1][1] &&
        this.board[1][1] === this.board[2][2]
        ) {
        return true; // Diagonal win (top-left to bottom-right)
        }
        if (
        this.board[0][2] !== EMPTY &&
        this.board[0][2] === this.board[1][1] &&
        this.board[1][1] === this.board[2][0]
        ) {
        return true; // Diagonal win (top-right to bottom-left)
        }

        return false; // No win
    }

    // Function to check if the board is full
    isBoardFull() {
        for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (this.board[i][j] === EMPTY) {
            return false; // Board is not full
            }
        }
        }
        return true; // Board is full
    }

    // Function to reset the game
    resetGame() {
        this.board = [
        [EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY],
        ];
        this.currentPlayer = PLAYER_X;
    }

    // Function to get the current state of the game
    getGameState() {
        return {
        board: this.board,
        currentPlayer: this.currentPlayer,
        gameOver: this.isGameOver(),
        winner: this.checkWin() ? this.currentPlayer : null,
        };
    }
}

module.exports = TicTacToeGame;