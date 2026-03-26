const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite dev server
    methods: ["GET", "POST"],
  },
});

// In-memory store
const users = {}; // socketId -> username
const messageHistory = []; // last 50 messages

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // --- JOIN ---
  socket.on("join", (username) => {
    users[socket.id] = username;

    // Send history to the joining user
    socket.emit("history", messageHistory);

    // Announce to everyone else
    const systemMsg = {
      id: Date.now(),
      type: "system",
      text: `${username} joined the chat`,
      timestamp: new Date().toISOString(),
    };
    messageHistory.push(systemMsg);
    if (messageHistory.length > 50) messageHistory.shift();
    io.emit("message", systemMsg);

    // Broadcast updated user list
    io.emit("users", Object.values(users));
  });

  // --- MESSAGE ---
  socket.on("message", (text) => {
    const username = users[socket.id];
    if (!username || !text?.trim()) return;

    const msg = {
      id: Date.now(),
      type: "chat",
      username,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };
    messageHistory.push(msg);
    if (messageHistory.length > 50) messageHistory.shift();
    io.emit("message", msg);
  });

  // --- TYPING ---
  socket.on("typing", (isTyping) => {
    const username = users[socket.id];
    if (!username) return;
    socket.broadcast.emit("typing", { username, isTyping });
  });

  // --- DISCONNECT ---
  socket.on("disconnect", () => {
    const username = users[socket.id];
    if (username) {
      delete users[socket.id];
      const systemMsg = {
        id: Date.now(),
        type: "system",
        text: `${username} left the chat`,
        timestamp: new Date().toISOString(),
      };
      messageHistory.push(systemMsg);
      if (messageHistory.length > 50) messageHistory.shift();
      io.emit("message", systemMsg);
      io.emit("users", Object.values(users));
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});