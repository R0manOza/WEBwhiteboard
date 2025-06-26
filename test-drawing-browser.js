// Browser Console Drawing Tests
// Copy and paste this into your browser console while on the whiteboard

(function() {
  console.log("🎨 Starting Browser Drawing Tests...");
  
  // Get the socket from your app (assuming it's available globally)
  const socket = window.socket || document.querySelector('[data-socket]')?.socket;
  
  if (!socket) {
    console.error("❌ Socket not found. Make sure you're on the whiteboard page.");
    return;
  }

  const testResults = [];
  const testBoardId = "test-board-123";

  // Test 1: Socket Connection
  console.log("\n🔌 Test 1: Socket Connection");
  if (socket.connected) {
    console.log("✅ Socket is connected");
    testResults.push({ test: "Socket Connection", passed: true });
  } else {
    console.log("❌ Socket is not connected");
    testResults.push({ test: "Socket Connection", passed: false });
  }

  // Test 2: Drawing Events
  console.log("\n🎨 Test 2: Drawing Events");
  try {
    const strokeId = `test-stroke-${Date.now()}`;
    
    // Send drawing status
    socket.emit('drawingStatus', { 
      boardId: testBoardId, 
      isDrawing: true 
    });
    console.log("✅ Drawing status sent");

    // Send stroke start
    socket.emit('strokeStart', {
      boardId: testBoardId,
      strokeId,
      color: "#ff0000",
      brushSize: 3,
      opacity: 1
    });
    console.log("✅ Stroke start sent");

    // Send stroke point
    socket.emit('strokePoint', {
      boardId: testBoardId,
      strokeId,
      point: { x: 100, y: 100, timestamp: Date.now() }
    });
    console.log("✅ Stroke point sent");

    // Send stroke end
    socket.emit('strokeEnd', {
      boardId: testBoardId,
      strokeId
    });
    console.log("✅ Stroke end sent");

    testResults.push({ test: "Drawing Events", passed: true });
  } catch (error) {
    console.error("❌ Drawing events failed:", error);
    testResults.push({ test: "Drawing Events", passed: false });
  }

  // Test 3: Container Drawing
  console.log("\n📦 Test 3: Container Drawing");
  try {
    const containerId = "test-container-123";
    const strokeId = `container-stroke-${Date.now()}`;
    
    socket.emit('containerDrawingStatus', {
      boardId: testBoardId,
      containerId,
      isDrawing: true
    });
    console.log("✅ Container drawing status sent");

    socket.emit('containerStrokeStart', {
      boardId: testBoardId,
      containerId,
      strokeId,
      color: "#0000ff",
      brushSize: 2,
      opacity: 1
    });
    console.log("✅ Container stroke start sent");

    socket.emit('containerStrokePoint', {
      boardId: testBoardId,
      containerId,
      strokeId,
      point: { x: 50, y: 50, timestamp: Date.now() }
    });
    console.log("✅ Container stroke point sent");

    testResults.push({ test: "Container Drawing", passed: true });
  } catch (error) {
    console.error("❌ Container drawing failed:", error);
    testResults.push({ test: "Container Drawing", passed: false });
  }

  // Test 4: Cursor Tracking
  console.log("\n🖱️ Test 4: Cursor Tracking");
  try {
    socket.emit('cursorPosition', {
      boardId: testBoardId,
      x: 200,
      y: 200
    });
    console.log("✅ Cursor position sent");
    testResults.push({ test: "Cursor Tracking", passed: true });
  } catch (error) {
    console.error("❌ Cursor tracking failed:", error);
    testResults.push({ test: "Cursor Tracking", passed: false });
  }

  // Test 5: Performance Test
  console.log("\n⚡ Test 5: Performance Test");
  try {
    const startTime = performance.now();
    const strokeCount = 5;

    for (let i = 0; i < strokeCount; i++) {
      const strokeId = `perf-stroke-${i}-${Date.now()}`;
      
      socket.emit('strokeStart', {
        boardId: testBoardId,
        strokeId,
        color: "#00ff00",
        brushSize: 2,
        opacity: 1
      });

      socket.emit('strokePoint', {
        boardId: testBoardId,
        strokeId,
        point: { x: i * 10, y: i * 10, timestamp: Date.now() }
      });

      socket.emit('strokeEnd', {
        boardId: testBoardId,
        strokeId
      });
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const avgTime = duration / strokeCount;

    console.log(`✅ Performance: ${strokeCount} strokes in ${duration.toFixed(2)}ms (${avgTime.toFixed(2)}ms avg)`);
    
    if (avgTime < 100) {
      testResults.push({ test: "Performance", passed: true, data: { avgTime } });
    } else {
      testResults.push({ test: "Performance", passed: false, data: { avgTime } });
    }
  } catch (error) {
    console.error("❌ Performance test failed:", error);
    testResults.push({ test: "Performance", passed: false });
  }

  // Print Results
  console.log("\n📊 Test Results:");
  console.log("================");
  
  const passed = testResults.filter(r => r.passed).length;
  const total = testResults.length;
  
  testResults.forEach(result => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} - ${result.test}`);
    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data)}`);
    }
  });

  console.log(`\nOverall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log("🎉 All tests passed! Drawing system is working correctly.");
  } else {
    console.log("⚠️ Some tests failed. Check the errors above.");
  }

  // Monitor socket events for 10 seconds
  console.log("\n🔍 Monitoring socket events for 10 seconds...");
  const eventLog = [];
  
  const originalEmit = socket.emit;
  socket.emit = function(event, ...args) {
    eventLog.push({ type: 'emit', event, args, timestamp: Date.now() });
    return originalEmit.apply(this, arguments);
  };

  socket.onAny((event, ...args) => {
    eventLog.push({ type: 'receive', event, args, timestamp: Date.now() });
  });

  setTimeout(() => {
    console.log("📝 Event Log (last 10 seconds):");
    eventLog.slice(-10).forEach(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      console.log(`[${time}] ${log.type.toUpperCase()}: ${log.event}`);
    });
    
    // Restore original emit
    socket.emit = originalEmit;
  }, 10000);

})(); 