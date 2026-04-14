FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose port used by server
EXPOSE 3001

# Start the server
CMD ["node", "index.js"]
