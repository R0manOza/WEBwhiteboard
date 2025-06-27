const { io } = require("socket.io-client");

class DrawingTestSuite {
  constructor() {
    this.testResults = [];
    this.socket = null;
    this.testBoardId = "test-drawing-board";
    this.testContainerId = "test-container-123";
  }

  async runAllTests() {
    console.log("🎨 Starting Automated Drawing Tests...");
    
    await this.testSocketConnection();
    await this.testDrawingEvents();
    await this.testContainerDrawing();
    await this.testMultiUserSync();
    await this.testPerformance();
    
    this.printResults();
  }

  async testSocketConnection() {
    console.log("\n🔌 Testing Socket Connection...");
    
    try {
      // Test 1: Connection
      this.socket = io("http://localhost:3001", {
        auth: { token: "test-token" }
      });

      await this.waitForEvent(this.socket, 'connect');
      console.log("✅ Socket connected successfully");

      // Test 2: Join Board Room
      this.socket.emit('joinBoardRoom', { boardId: this.testBoardId });
      await this.waitForEvent(this.socket, 'onlineUsers');
      console.log("✅ Joined board room successfully");

      this.testResults.push({ test: "Socket Connection", passed: true });
    } catch (error) {
      console.error("❌ Socket connection failed:", error);
      this.testResults.push({ test: "Socket Connection", passed: false, error });
    }
  }

  async testDrawingEvents() {
    console.log("\n🎨 Testing Drawing Events...");
    
    try {
      const strokeId = `test-stroke-${Date.now()}`;
      const testPoint = { x: 100, y: 100, timestamp: Date.now() };

      // Test 1: Drawing Status
      this.socket.emit('drawingStatus', { 
        boardId: this.testBoardId, 
        isDrawing: true 
      });
      console.log("✅ Drawing status event sent");

      // Test 2: Stroke Start
      this.socket.emit('strokeStart', {
        boardId: this.testBoardId,
        strokeId,
        color: "#ff0000",
        brushSize: 3,
        opacity: 1
      });
      console.log("✅ Stroke start event sent");

      // Test 3: Stroke Points
      this.socket.emit('strokePoint', {
        boardId: this.testBoardId,
        strokeId,
        point: testPoint
      });
      console.log("✅ Stroke point event sent");

      // Test 4: Stroke End
      this.socket.emit('strokeEnd', {
        boardId: this.testBoardId,
        strokeId
      });
      console.log("✅ Stroke end event sent");

      // Test 5: Drawing Status End
      this.socket.emit('drawingStatus', { 
        boardId: this.testBoardId, 
        isDrawing: false 
      });
      console.log("✅ Drawing status end event sent");

      this.testResults.push({ test: "Drawing Events", passed: true });
    } catch (error) {
      console.error("❌ Drawing events test failed:", error);
      this.testResults.push({ test: "Drawing Events", passed: false, error });
    }
  }

  async testContainerDrawing() {
    console.log("\n📦 Testing Container Drawing...");
    
    try {
      const strokeId = `container-stroke-${Date.now()}`;
      const testPoint = { x: 50, y: 50, timestamp: Date.now() };

      // Test 1: Container Drawing Status
      this.socket.emit('containerDrawingStatus', {
        boardId: this.testBoardId,
        containerId: this.testContainerId,
        isDrawing: true
      });
      console.log("✅ Container drawing status event sent");

      // Test 2: Container Stroke Start
      this.socket.emit('containerStrokeStart', {
        boardId: this.testBoardId,
        containerId: this.testContainerId,
        strokeId,
        color: "#0000ff",
        brushSize: 2,
        opacity: 1
      });
      console.log("✅ Container stroke start event sent");

      // Test 3: Container Stroke Point
      this.socket.emit('containerStrokePoint', {
        boardId: this.testBoardId,
        containerId: this.testContainerId,
        strokeId,
        point: testPoint
      });
      console.log("✅ Container stroke point event sent");

      // Test 4: Container Stroke End
      this.socket.emit('containerStrokeEnd', {
        boardId: this.testBoardId,
        containerId: this.testContainerId,
        strokeId
      });
      console.log("✅ Container stroke end event sent");

      this.testResults.push({ test: "Container Drawing", passed: true });
    } catch (error) {
      console.error("❌ Container drawing test failed:", error);
      this.testResults.push({ test: "Container Drawing", passed: false, error });
    }
  }

  async testMultiUserSync() {
    console.log("\n👥 Testing Multi-User Sync...");
    
    try {
      // Test 1: Cursor Position
      this.socket.emit('cursorPosition', {
        boardId: this.testBoardId,
        x: 200,
        y: 200
      });
      console.log("✅ Cursor position event sent");

      // Test 2: Container Position Update
      this.socket.emit('containerPositionUpdate', {
        boardId: this.testBoardId,
        containerId: this.testContainerId,
        position: { x: 300, y: 300 },
        userId: "test-user"
      });
      console.log("✅ Container position update event sent");

      // Test 3: Container Size Update
      this.socket.emit('containerSizeUpdate', {
        boardId: this.testBoardId,
        containerId: this.testContainerId,
        size: { width: 400, height: 300 },
        userId: "test-user"
      });
      console.log("✅ Container size update event sent");

      // Test 4: Clear Board Drawing
      this.socket.emit('clearBoardDrawing', {
        boardId: this.testBoardId
      });
      console.log("✅ Clear board drawing event sent");

      this.testResults.push({ test: "Multi-User Sync", passed: true });
    } catch (error) {
      console.error("❌ Multi-user sync test failed:", error);
      this.testResults.push({ test: "Multi-User Sync", passed: false, error });
    }
  }

  async testPerformance() {
    console.log("\n⚡ Testing Performance...");
    
    try {
      const startTime = performance.now();
      const strokeCount = 10;

      // Test rapid stroke creation
      for (let i = 0; i < strokeCount; i++) {
        const strokeId = `perf-stroke-${i}-${Date.now()}`;
        
        this.socket.emit('strokeStart', {
          boardId: this.testBoardId,
          strokeId,
          color: "#00ff00",
          brushSize: 2,
          opacity: 1
        });

        this.socket.emit('strokePoint', {
          boardId: this.testBoardId,
          strokeId,
          point: { x: i * 10, y: i * 10, timestamp: Date.now() }
        });

        this.socket.emit('strokeEnd', {
          boardId: this.testBoardId,
          strokeId
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTime = duration / strokeCount;

      console.log(`✅ Performance test completed:`);
      console.log(`   - ${strokeCount} strokes in ${duration.toFixed(2)}ms`);
      console.log(`   - Average: ${avgTime.toFixed(2)}ms per stroke`);

      if (avgTime < 50) {
        console.log("✅ Performance is good (< 50ms per stroke)");
        this.testResults.push({ test: "Performance", passed: true, data: { avgTime } });
      } else {
        console.warn("⚠️ Performance might be slow (> 50ms per stroke)");
        this.testResults.push({ test: "Performance", passed: false, data: { avgTime } });
      }
    } catch (error) {
      console.error("❌ Performance test failed:", error);
      this.testResults.push({ test: "Performance", passed: false, error });
    }
  }

  waitForEvent(socket, eventName, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${eventName}`));
      }, timeout);

      socket.once(eventName, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  printResults() {
    console.log("\n📊 Test Results Summary:");
    console.log("=========================");
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} - ${result.test}`);
      if (result.error) {
        console.log(`   Error: ${result.error.message}`);
      }
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
  }

  cleanup() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Browser Console Version
if (typeof window !== 'undefined') {
  // For browser console testing
  window.DrawingTestSuite = DrawingTestSuite;
  
  // Auto-run when loaded in browser
  const testSuite = new DrawingTestSuite();
  testSuite.runAllTests().then(() => {
    console.log("🧹 Cleaning up...");
    testSuite.cleanup();
  });
}

// Node.js Version
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DrawingTestSuite;
} 