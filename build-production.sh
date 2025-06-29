#!/bin/bash

# Production Build Script for WEBwhiteboard Frontend
# This script builds the frontend with production environment variables

set -e

echo "🏗️  Building WEBwhiteboard for production..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "Error: frontend directory not found."
    exit 1
fi

# Get EC2 public IP (if running on EC2)
EC2_IP=""
if curl -s http://169.254.169.254/latest/meta-data/public-ipv4 > /dev/null 2>&1; then
    EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
    print_status "Detected EC2 instance IP: $EC2_IP"
fi

# Create production environment file
print_status "Creating production environment file..."
cat > frontend/.env << EOF
# Production Configuration
VITE_API_URL=http://${EC2_IP:-localhost}:3001/api
VITE_SOCKET_URL=http://${EC2_IP:-localhost}:3001
EOF

print_status "Environment file created with:"
echo "VITE_API_URL=http://${EC2_IP:-localhost}:3001/api"
echo "VITE_SOCKET_URL=http://${EC2_IP:-localhost}:3001"

# Install dependencies
print_status "Installing frontend dependencies..."
cd frontend
npm install

# Build for production
print_status "Building frontend for production..."
npm run build

print_status "✅ Production build completed!"
print_status "Frontend build is available in: frontend/dist/"

# Show build size
if command -v du > /dev/null 2>&1; then
    BUILD_SIZE=$(du -sh dist | cut -f1)
    print_status "Build size: $BUILD_SIZE"
fi

print_warning "Remember to:"
echo "1. Copy the dist/ folder to your web server"
echo "2. Configure nginx to serve from the dist/ directory"
echo "3. Ensure your backend is running on port 3001" 