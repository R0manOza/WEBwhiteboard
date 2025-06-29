#!/bin/bash

# WEBwhiteboard EC2 Deployment Script
# Run this script on your EC2 instance after connecting via SSH

set -e  # Exit on any error

echo "🚀 Starting WEBwhiteboard deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as ec2-user."
   exit 1
fi

# Update system
print_status "Updating system packages..."
sudo yum update -y

# Install Node.js 18
print_status "Installing Node.js 18..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
print_status "Node.js version: $NODE_VERSION"

# Install PM2 globally
print_status "Installing PM2..."
sudo npm install -g pm2

# Install nginx
print_status "Installing nginx..."
sudo yum install -y nginx

# Install Git
print_status "Installing Git..."
sudo yum install -y git

# Start and enable nginx
print_status "Starting nginx service..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Clone repository (if not already present)
if [ ! -d "/home/ec2-user/WEBwhiteboard" ]; then
    print_status "Cloning repository..."
    cd /home/ec2-user
    git clone https://github.com/R0manOza/WEBwhiteboard.git
else
    print_status "Repository already exists, pulling latest changes..."
    cd /home/ec2-user/WEBwhiteboard
    git pull origin main
fi

# Create logs directory
print_status "Creating logs directory..."
mkdir -p /home/ec2-user/WEBwhiteboard/backend/logs

# Install backend dependencies
print_status "Installing backend dependencies..."
cd /home/ec2-user/WEBwhiteboard/backend
npm install
npm run build

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd /home/ec2-user/WEBwhiteboard/frontend
npm install
npm run build

# Copy nginx configuration
print_status "Configuring nginx..."
sudo cp /home/ec2-user/WEBwhiteboard/nginx.conf /etc/nginx/conf.d/webwhiteboard.conf

# Test nginx configuration
if sudo nginx -t; then
    print_status "Nginx configuration is valid"
    sudo systemctl reload nginx
else
    print_error "Nginx configuration is invalid"
    exit 1
fi

# Start backend with PM2
print_status "Starting backend service with PM2..."
cd /home/ec2-user/WEBwhiteboard/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup

print_status "✅ Deployment completed successfully!"

echo ""
print_warning "IMPORTANT: You need to configure environment variables:"
echo "1. Backend: /home/ec2-user/WEBwhiteboard/backend/.env"
echo "2. Frontend: /home/ec2-user/WEBwhiteboard/frontend/.env"
echo ""
echo "Backend .env should contain:"
echo "FIREBASE_PROJECT_ID=your-project-id"
echo "FIREBASE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n\""
echo "FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
echo "PORT=3001"
echo "NODE_ENV=production"
echo ""
echo "Frontend .env should contain:"
echo "VITE_API_URL=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3001/api"
echo "VITE_SOCKET_URL=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3001"
echo ""
print_status "After configuring environment variables, restart the backend:"
echo "pm2 restart webwhiteboard-backend"
echo ""
print_status "Your application should be available at:"
echo "http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)" 