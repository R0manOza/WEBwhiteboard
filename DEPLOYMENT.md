# EC2 Deployment Guide

## Prerequisites

- AWS Account
- Firebase Project
- Domain Name (optional)

## Step 1: Create EC2 Instance

### 1.1 Launch EC2 Instance

1. Go to AWS Console → EC2 → Launch Instance
2. Choose "Amazon Linux 2023" (free tier eligible)
3. Instance Type: t2.micro (free tier)
4. Configure Security Group:
   - SSH (Port 22) - Your IP
   - HTTP (Port 80) - 0.0.0.0/0
   - HTTPS (Port 443) - 0.0.0.0/0
   - Custom TCP (Port 3001) - 0.0.0.0/0 (for backend API)
5. Create or select a key pair for SSH access
6. Launch instance

### 1.2 Connect to Instance

```bash
ssh -i your-key.pem ec2-user@your-ec2-public-ip
```

## Step 2: Server Environment Setup

### 2.1 Update System

```bash
sudo yum update -y
```

### 2.2 Install Node.js 18

```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 2.3 Install PM2

```bash
sudo npm install -g pm2
```

### 2.4 Install nginx

```bash
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2.5 Install Git

```bash
sudo yum install -y git
```

## Step 3: Clone and Setup Application

### 3.1 Clone Repository

```bash
cd /home/ec2-user
git clone https://github.com/R0manOza/WEBwhiteboard.git
cd WEBwhiteboard
```

### 3.2 Install Dependencies

```bash
# Backend
cd backend
npm install
npm run build

# Frontend
cd ../frontend
npm install
npm run build
```

### 3.3 Setup Environment Variables

```bash
# Backend environment
sudo nano /home/ec2-user/WEBwhiteboard/backend/.env
```

Add your Firebase configuration:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
PORT=3001
NODE_ENV=production
```

```bash
# Frontend environment
sudo nano /home/ec2-user/WEBwhiteboard/frontend/.env
```

Add your configuration:

```
VITE_API_URL=http://your-ec2-ip:3001/api
VITE_SOCKET_URL=http://your-ec2-ip:3001
```

## Step 4: Configure nginx

### 4.1 Create nginx configuration

```bash
sudo nano /etc/nginx/conf.d/webwhiteboard.conf
```

Add the configuration from `nginx.conf` in this repository.

### 4.2 Test and reload nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5: Start Services with PM2

### 5.1 Start Backend

```bash
cd /home/ec2-user/WEBwhiteboard/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5.2 Build and serve Frontend

The frontend will be built and served by nginx.

## Step 6: SSL Setup (Optional)

### 6.1 Install Certbot

```bash
sudo yum install -y certbot python3-certbot-nginx
```

### 6.2 Get SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting

### Check PM2 Status

```bash
pm2 status
pm2 logs
```

### Check nginx Status

```bash
sudo systemctl status nginx
sudo nginx -t
```

### Check Firewall

```bash
sudo firewall-cmd --list-all
```

### View Logs

```bash
# nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PM2 logs
pm2 logs backend
```
