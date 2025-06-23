#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Setting up AutoDoc...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js v14 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm."
    exit 1
fi

# Create backend .env file
echo -e "${GREEN}Creating backend .env file...${NC}"
cat > backend/.env << EOL
PORT=5000
MONGODB_URI=mongodb://localhost:27017/autodoc
JWT_SECRET=your_jwt_secret_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EOL

# Create frontend .env file
echo -e "${GREEN}Creating frontend .env file...${NC}"
cat > frontend/.env << EOL
VITE_API_URL=http://localhost:5000
EOL

# Install backend dependencies
echo -e "${GREEN}Installing backend dependencies...${NC}"
cd backend
npm install

# Install frontend dependencies
echo -e "${GREEN}Installing frontend dependencies...${NC}"
cd ../frontend
npm install

echo -e "${BLUE}Setup complete!${NC}"
echo -e "Please update the following files with your credentials:"
echo -e "1. backend/.env - Add your MongoDB URI and Cloudinary credentials"
echo -e "2. frontend/.env - Update API URL if needed"
echo -e "\nTo start the application:"
echo -e "1. Start MongoDB"
echo -e "2. Run 'cd backend && npm run dev' in one terminal"
echo -e "3. Run 'cd frontend && npm run dev' in another terminal"
echo -e "4. Open http://localhost:5173 in your browser" 