const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  })
);

app.get("/", (req, res) => {
  res.send("PeerDrop Server Running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
  },
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    if (!rooms[roomId].includes(socket.id)) {
  rooms[roomId].push(socket.id);
}

    console.log(`User ${socket.id} joined room ${roomId}`);
    console.log("Room users:", rooms[roomId]);

    socket.emit("room-joined", {
      roomId,
      users: rooms[roomId],
    });

    socket.to(roomId).emit("user-joined", {
      userId: socket.id,
      users: rooms[roomId],
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);

      socket.to(roomId).emit("user-left", {
        userId: socket.id,
        users: rooms[roomId],
      });

      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});