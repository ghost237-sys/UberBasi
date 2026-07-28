#!/bin/bash

# UberBasi AWS One-Command Deployment Update Script
set -e

echo "🚀 Starting UberBasi Update Deployment on AWS..."

# Pull latest code from repository
git pull origin main

# Rebuild containers in production mode
echo "📦 Building Docker containers..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

# Clean up dangling images to save disk space
docker image prune -f

echo "✓ UberBasi successfully updated and running on AWS!"
echo "🌐 Frontend: http://YOUR_AWS_EC2_PUBLIC_IP:3000"
echo "⚡ Backend: http://YOUR_AWS_EC2_PUBLIC_IP:8000/docs"
