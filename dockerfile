# Use Node 20 (Required for Next.js 15/16 stability)
FROM node:20-alpine

# Install compatibility library for Next.js compiler (SWC) on Alpine Linux
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Copy package files first to optimize cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Disable Next.js Telemetry to save resources
ENV NEXT_TELEMETRY_DISABLED 1

# Build the Next.js application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]