const { createServer } = require("http");
const { Server } = require("socket.io");
const BASE_URL=process.env.BASE_URL;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "https://type-champ-n9ccdcbsd-pyansus-projects.vercel.app",
    methods: ["GET", "POST"]
  }
});

const players = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("request_to_play", ({ playerName }) => {
    players[socket.id] = {
      name: playerName,
      score: 0,
      opponent: null
    };

    let opponentFound = false;
    for (const id in players) {
      if (id !== socket.id && !players[id].opponent) {
        players[id].opponent = socket.id;
        players[socket.id].opponent = id;
        opponentFound = true;

        io.to(socket.id).emit("OpponentFound", { opponentName: players[id].name });
        io.to(id).emit("OpponentFound", { opponentName: playerName });

        break;
      }
    }

    if (!opponentFound) {
      io.to(socket.id).emit("OpponentNotFound");
    }
  });

  socket.on("score_update", (score) => {
    players[socket.id].score = score;

    if (players[socket.id].opponent) {
      io.to(players[socket.id].opponent).emit("opponent_score_update", score);
    }
  });

  socket.on("game_over", () => {
    const player = players[socket.id];
    const opponent = players[player.opponent];

    if (player && opponent) {
      let winner;
      if (player.score > opponent.score) {
        winner = player.name;
      } else if (player.score < opponent.score) {
        winner = opponent.name;
      } else {
        winner = "It's a Tie!";
      }

      io.to(socket.id).emit("announce_winner", winner);
      io.to(player.opponent).emit("announce_winner", winner);
    }
  });

  socket.on("chat_message", (message) => {
    const player = players[socket.id];
    if (player && player.opponent) {
      const chatData = {
        sender: player.name,
        message: message
      };
      io.to(socket.id).emit("chat_message", chatData);
      io.to(player.opponent).emit("chat_message", chatData);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    if (players[socket.id]) {
      const opponentId = players[socket.id].opponent;
      if (opponentId && players[opponentId]) {
        players[opponentId].opponent = null;
        io.to(opponentId).emit("OpponentLeft");
      }
      delete players[socket.id];
    }
  });
});

httpServer.listen(3000, () => {
  console.log("Server listening on port 3000");
});
