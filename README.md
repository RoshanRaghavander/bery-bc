# Bery Chain

Bery Chain is a custom blockchain implementation with a full-stack architecture featuring a backend node and a React frontend.

## Project Structure

- `src/`: Backend Node.js blockchain implementation
- `frontend/`: React + Vite frontend application
- `scripts/`: Utility scripts for wallet creation, key generation, etc.

## Deployment

### Frontend (Vercel/Netlify)

To deploy the frontend application:

1. **Connect your repository** to Vercel or Netlify.
2. Configure the **Build Settings**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Deploy!

### Backend

To run the backend node:

1. Install dependencies: `npm install`
2. Build the project: `npm run build`
3. Start the node: `npm start`

## Development

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
npm install
npm run build
npm start
```
