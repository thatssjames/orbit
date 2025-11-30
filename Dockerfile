FROM --platform=linux/arm64 node:20.18.1

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma client for the specific platform
RUN npx prisma generate

# Bundle app source
COPY . .

# Build the app
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]