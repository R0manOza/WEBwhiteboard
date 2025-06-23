const { io } = require("socket.io-client");

// Paste your Firebase ID token here
const token = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjNiZjA1MzkxMzk2OTEzYTc4ZWM4MGY0MjcwMzM4NjM2NDA2MTBhZGMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiTmlrYSBFZGlzaGVyYXNodmlsaSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NLeDlCcTJNZjdvdlNjWnNEcGxHV3ZSTHpiaExHbHNXdHRKZlhQV2xKcC1Gd2hEdzdsZD1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS93ZWJ3aGl0ZWJvYXJkLWYwZmM3IiwiYXVkIjoid2Vid2hpdGVib2FyZC1mMGZjNyIsImF1dGhfdGltZSI6MTc1MDY2OTQ3OCwidXNlcl9pZCI6InpxWWZVVXN3dGNYTFRYTUNvemZVTXBQUmg3czEiLCJzdWIiOiJ6cVlmVVVzd3RjWExUWE1Db3pmVU1wUFJoN3MxIiwiaWF0IjoxNzUwNjY5NDc4LCJleHAiOjE3NTA2NzMwNzgsImVtYWlsIjoibmlrb2xvemk0NDMyQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7Imdvb2dsZS5jb20iOlsiMTE0MjcxMzY0MTA5NzQ2NzEyMDYzIl0sImVtYWlsIjpbIm5pa29sb3ppNDQzMkBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJnb29nbGUuY29tIn19.XtbEXYpaQacWOJBb4C1p7da04kRKsOWb8QH7JjaR4FIjObDi-1LqRsWrYUqdV-jpuVKIjLChUyf_X_s9pn3gRCA08wdaF8mamZlRWxTDJvvuefQWF1ZThhY7VjDw1k7bW3AlGkFruH4-Q7ph0hw2dbgyK_ElSLJsI7WqbKPNdR62dY3ox_vH5SPWywSUF4kIq6s8sF4GTQVZckadlwz58Z5YVQh0VAfC7SqhSDh52rngB5adOGp1TTTTme2zholzgBOP068Ht-5zP7IsRfLFpZ6qljNHwLM5z0kygRICcMOLWe1OXQodq8v2KzMBylbzy-WHcXIgz1Jwlxg3a4fhvg";

const socket = io("http://localhost:3001", {
  auth: { token }
});

socket.on("connect", () => {
  console.log("Connected as this user!");

  // Join the same board room for both users
  socket.emit("joinBoardRoom", { boardId: "test-board" });

  // Test drawing functionality
  setTimeout(() => {
    console.log("Testing drawing functionality...");
    
    // Test drawing status
    socket.emit("drawingStatus", { boardId: "test-board", isDrawing: true });
    
    // Test stroke start
    const strokeId = `test-stroke-${Date.now()}`;
    socket.emit("strokeStart", { 
      boardId: "test-board", 
      strokeId,
      color: "#ff0000",
      brushSize: 3,
      opacity: 1
    });
    
    // Test stroke points
    setTimeout(() => {
      socket.emit("strokePoint", { 
        boardId: "test-board", 
        strokeId,
        point: { x: 100, y: 100, timestamp: Date.now() }
      });
      
      socket.emit("strokePoint", { 
        boardId: "test-board", 
        strokeId,
        point: { x: 150, y: 150, timestamp: Date.now() }
      });
      
      // Test stroke end
      setTimeout(() => {
        socket.emit("strokeEnd", { boardId: "test-board", strokeId });
        socket.emit("drawingStatus", { boardId: "test-board", isDrawing: false });
        
        console.log("Drawing test completed!");
      }, 1000);
    }, 500);
  }, 1000);
});

// Listen for drawing events from other users
socket.on("strokeStart", (data) => {
  console.log("Stroke start from another user:", data);
});

socket.on("strokePoint", (data) => {
  console.log("Stroke point from another user:", data);
});

socket.on("strokeEnd", (data) => {
  console.log("Stroke end from another user:", data);
});

socket.on("userDrawingStatus", (data) => {
  console.log("User drawing status:", data);
});

// Listen for cursor movements from other users
socket.on("cursorMoved", (data) => {
  console.log("Cursor moved from another user:", data);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
}); 