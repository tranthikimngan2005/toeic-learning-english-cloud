# Use Node.js 18 Alpine as base
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Set environment variables for Docker file watching on Windows
ENV CHOKIDAR_USEPOLLING=true \
    WATCHPACK_POLLING=true

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "start"]
