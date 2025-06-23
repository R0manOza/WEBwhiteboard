const { io } = require("socket.io-client");

// Paste the correct token for each user here:
const token = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjNiZjA1MzkxMzk2OTEzYTc4ZWM4MGY0MjcwMzM4NjM2NDA2MTBhZGMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiTmlrb2xvemkgRWRpc2hlcmFzaHZpbGkiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSng0SklkMm5CYmI1Z2tTYlBUaExRR0x4UmdraXBFbkpyc2pxNFl1QXdCS3p0OD1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS93ZWJ3aGl0ZWJvYXJkLWYwZmM3IiwiYXVkIjoid2Vid2hpdGVib2FyZC1mMGZjNyIsImF1dGhfdGltZSI6MTc1MDY2NzE3MywidXNlcl9pZCI6IlBvSFZpUjJoNjNmYlNjT3B0R0J5OHlsZ3kzNTIiLCJzdWIiOiJQb0hWaVIyaDYzZmJTY09wdEdCeTh5bGd5MzUyIiwiaWF0IjoxNzUwNjY3MTczLCJleHAiOjE3NTA2NzA3NzMsImVtYWlsIjoiZWRpc2hlcmFzaHZpbGluaWtvbG96aUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjEwMjA2MDg4Njk2MDk3Njk2NjQwMiJdLCJlbWFpbCI6WyJlZGlzaGVyYXNodmlsaW5pa29sb3ppQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.appA2xEk880aeWRvzddH5HkOSg5CJYME68jx-AXZXJJHK26bEnr6OsmS3AMyjbabL4whVJxTHpeTSuAcH4AiXQFzO6QWraleJqqO7ElXBIjk2cvNfGSsCwXiAa_1mI0qBIK6dZETBNx3Iz0bUxmowCU6c7E8577TvtRIm-pPRr4xK95S79cjv0Ba06FQwo5Dnmit2XOCj2GJh5qfYAJWJ1NBKjMfn_0L6T1GIX-vj2UVJF5ZO6xPWw1k3AFkVfp8L7batJ7iXyMBSB9BO7iOHaVDgqv7eoV8F6SQCbQ7k6CQxyjsgRWfmH8KONuuTykvM0dfBuaQJqB_iH_ef7pNVQ";

const socket = io("http://localhost:3001", {
  auth: { token }
});

socket.on("connect", () => {
  console.log("Connected as this user!");

  // Join the same board room for both users
  socket.emit("joinBoardRoom", { boardId: "test-board" });

  // Send a cursor position after joining
  setTimeout(() => {
    socket.emit("cursorPosition", { boardId: "test-board", x: Math.floor(Math.random() * 500), y: Math.floor(Math.random() * 500) });
  }, 1000);
});

// Listen for when another user joins the board
socket.on("userJoined", (data) => {
  console.log("Another user joined the board:", data.userId);
});

// Listen for cursor movements from other users
socket.on("cursorMoved", (data) => {
  console.log("Cursor moved from another user:", data);
});

socket.on("disconnect", () => {
  console.log("Disconnected!");
});