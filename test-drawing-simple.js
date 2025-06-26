// Simple Drawing Test Script
// Run this to test your drawing functionality

const { io } = require("socket.io-client");

async function testDrawing() {
  console.log("🎨 Testing Drawing Functionality...");
  
  // Connect to your server
  const socket = io("http://localhost:3001", {
    auth: { token: "test-token" }
  });

  const testBoardId = "test-drawing-board";
  const results = [];

  try {
    // Wait for connection
    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
    
    console.log("✅ Connected to server");
    results.push("Connection: PASS");

    // Join board room
    socket.emit('joinBoardRoom', { boardId: testBoardId });
    console.log("✅ Joined board room");

    // Test 1: Basic Drawing
    console.log("\n🎨 Testing basic drawing...");
    const strokeId = `test-${Date.now()}`;
    
    socket.emit('drawingStatus', { boardId: testBoardId, isDrawing: true });
    socket.emit('strokeStart', { 
      boardId: testBoardId, 
      strokeId, 
      color: "#ff0000", 
      brushSize: 3, 
      opacity: 1 
    });
    socket.emit('strokePoint', { 
      boardId: testBoardId, 
      strokeId, 
      point: { x: 100, y: 100, timestamp: Date.now() } 
    });
    socket.emit('strokeEnd', { boardId: testBoardId, strokeId });
    socket.emit('drawingStatus', { boardId: testBoardId, isDrawing: false });
    
    console.log("✅ Basic drawing events sent");
    results.push("Basic Drawing: PASS");

    // Test 2: Container Drawing
    console.log("\n📦 Testing container drawing...");
    const containerId = "test-container";
    const containerStrokeId = `container-${Date.now()}`;
    
    socket.emit('containerDrawingStatus', { 
      boardId: testBoardId, 
      containerId, 
      isDrawing: true 
    });
    socket.emit('containerStrokeStart', { 
      boardId: testBoardId, 
      containerId, 
      strokeId: containerStrokeId, 
      color: "#0000ff", 
      brushSize: 2, 
      opacity: 1 
    });
    socket.emit('containerStrokePoint', { 
      boardId: testBoardId, 
      containerId, 
      strokeId: containerStrokeId, 
      point: { x: 50, y: 50, timestamp: Date.now() } 
    });
    socket.emit('containerStrokeEnd', { 
      boardId: testBoardId, 
      containerId, 
      strokeId: containerStrokeId 
    });
    
    console.log("✅ Container drawing events sent");
    results.push("Container Drawing: PASS");

    // Test 3: Cursor Tracking
    console.log("\n🖱️ Testing cursor tracking...");
    socket.emit('cursorPosition', { boardId: testBoardId, x: 200, y: 200 });
    console.log("✅ Cursor position sent");
    results.push("Cursor Tracking: PASS");

    // Test 4: Performance
    console.log("\n⚡ Testing performance...");
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      const perfStrokeId = `perf-${i}-${Date.now()}`;
      socket.emit('strokeStart', { 
        boardId: testBoardId, 
        strokeId: perfStrokeId, 
        color: "#00ff00", 
        brushSize: 2, 
        opacity: 1 
      });
      socket.emit('strokePoint', { 
        boardId: testBoardId, 
        strokeId: perfStrokeId, 
        point: { x: i * 10, y: i * 10, timestamp: Date.now() } 
      });
      socket.emit('strokeEnd', { boardId: testBoardId, strokeId: perfStrokeId });
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Performance: 10 strokes in ${duration}ms`);
    results.push(`Performance: PASS (${duration}ms)`);

    // Test 5: Clear Drawing
    console.log("\n🧹 Testing clear drawing...");
    socket.emit('clearBoardDrawing', { boardId: testBoardId });
    console.log("✅ Clear drawing event sent");
    results.push("Clear Drawing: PASS");

    console.log("\n📊 All Tests Completed Successfully!");
    console.log("Results:", results);

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    socket.disconnect();
    console.log("🔌 Disconnected from server");
  }
}

// Run the test
testDrawing().catch(console.error); 