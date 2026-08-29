# MutationMechanic - Setup and Development Instructions

## Project Overview

MutationMechanic is an AI-driven protein engineering dashboard for analyzing pathogenicity, structural impact, and splicing defects of genetic variants. The application has both a frontend (React/Vite) and a new backend (Express/Prisma/PostgreSQL) for persistent storage and collaboration features.

## Project Structure

```
mutationmechanic/
├── backend/              # Express/Prisma backend server
│   ├── prisma/           # Database schema and migrations
│   ├── src/              # Backend source code
│   │   └── server.ts     # Main server file
│   ├── package.json
│   └── ...
├── components/           # React UI components
├── services/             # API service clients
├── utils/                # Utility functions
├── types/                # TypeScript type definitions
├── docs/                 # Documentation files
├── App.tsx               # Main React app
├── index.html
├── package.json          # Frontend dependencies
├── vite.config.ts        # Vite configuration
├── .env.local            # Frontend environment variables
└── Instructions.md       # This file
```

## Prerequisites

- **Node.js** 18+ (for both frontend and backend)
- **npm** or **yarn** package manager
- **PostgreSQL** database (for backend persistence)
- **Git** for version control

## Frontend Setup (React/Vite)

### 1. Install Frontend Dependencies
```bash
cd mutationmechanic
npm install
```

### 2. Configure Environment Variables
Create `.env.local` in the root directory:
```env
VITE_GEMINI_API_KEY=your_google_genai_api_key
VITE_ALPHAGENOME_API_KEY=your_alpha_genome_api_key
```

### 3. Run Frontend Development Server
```bash
npm run dev
```
The frontend will be available at `http://localhost:3000`

### 4. Frontend Features
- Variant Explainer (protein structures, pLDDT heatmaps)
- Compensatory Design (AI suggested stabilizing mutations)
- Splicing Decoder (exon skipping, cryptic splice sites)
- Analytics Dashboard (history, statistics)
- 3D Visualization (3Dmol.js integration)

## Backend Setup (Express/Prisma/PostgreSQL)

### 1. Navigate to Backend
```bash
cd mutationmechanic/backend
```

### 2. Install Backend Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create `.env` in the backend directory:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/mutationmechanic"
FRONTEND_URL="http://localhost:3000"
PORT=5000
```

### 4. Set Up Database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (alternatively: npm run db:migrate)
npm run db:push
```

### 5. Run Backend Development Server
```bash
npm run dev
```
The backend will be available at `http://localhost:5000`

### 6. Backend Features
- Database persistence with PostgreSQL
- User management and authentication
- Analysis storage and retrieval
- Collaboration features (sharing and comments)
- History tracking
- Splicing analysis storage
- Protein structure data storage

## Running Both Servers Simultaneously

### Option 1: Use Concurrently
Install and use concurrently to run both servers:
```bash
# From root directory
npm install -g concurrently

# Run both servers
concurrently "npm run dev" "cd backend && npm run dev"
```

### Option 2: Separate Terminals
- Terminal 1: `cd mutationmechanic && npm run dev` (Frontend on port 3000)
- Terminal 2: `cd mutationmechanic/backend && npm run dev` (Backend on port 5000)

## Database Schema

The backend uses the following models:

- **User**: Authentication, preferences, and user data
- **Analysis**: Variant analysis results and metadata
- **HistoryRecord**: User history of analyses
- **SplicingAnalysis**: Splicing prediction data
- **SharedAccess**: Collaboration and sharing permissions
- **Comment**: Comments and discussions on analyses
- **UserPreference**: User-specific settings
- **ProteinStructure**: 3D protein structure data (PDB format)

## API Endpoints

### Backend API (http://localhost:5000)
- `GET /api/health` - Health check
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user details
- `POST /api/analyses` - Create analysis
- `GET /api/analyses` - Get user analyses
- `GET /api/analyses/:id` - Get specific analysis
- `POST /api/history` - Create history record
- `GET /api/history/:userId` - Get user history
- `POST /api/splicing` - Create splicing analysis
- `POST /api/share` - Share analysis
- `POST /api/comments` - Add comment
- `GET /api/comments/:analysisId` - Get comments for analysis

### Frontend Integration
The frontend will need to be updated to use the backend API endpoints instead of or in addition to the local IndexedDB storage.

## Development Commands

### Frontend Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend Commands
```bash
npm run dev          # Start development server with auto-restart
npm run build        # Compile TypeScript to JavaScript
npm run start        # Run compiled production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Create and apply migration
npm run db:studio    # Open Prisma Studio (database GUI)
```

## Environment Variables

### Frontend (.env.local)
- `VITE_GEMINI_API_KEY` - Google GenAI API key
- `VITE_ALPHAGENOME_API_KEY` - AlphaGenome API key

### Backend (.env)
- `DATABASE_URL` - PostgreSQL connection string
- `FRONTEND_URL` - Frontend URL for CORS
- `PORT` - Backend server port
- `JWT_SECRET` - Secret for JWT token generation

## Database Management

### Using Prisma Studio
```bash
cd backend
npx prisma studio
```

### Creating Migrations
```bash
# When you change the schema.prisma file
npx prisma migrate dev --name migration_name
```

### Seeding Database
If you add a seed file, you can run:
```bash
npx prisma db seed
```

## Frontend-Backend Integration

The frontend currently uses client-side storage (IndexedDB). To integrate with the new backend:

1. Update API service files in `services/` directory to use backend endpoints
2. Modify the history service to use backend endpoints instead of or in addition to IndexedDB
3. Add authentication to connect frontend users with backend user accounts
4. Update the UI to show collaboration features

## Troubleshooting

### Common Issues
1. **Database Connection**: Ensure PostgreSQL is running and credentials are correct
2. **CORS Errors**: Verify FRONTEND_URL matches your frontend server URL
3. **API Keys**: Make sure all required API keys are in environment variables
4. **Port Conflicts**: Ensure ports 3000 (frontend) and 5000 (backend) are available

### Database Issues
- Make sure PostgreSQL is installed and running
- Check that the database name in DATABASE_URL exists
- Verify user credentials have appropriate permissions

## Production Deployment

### Frontend
- Build with `npm run build`
- Serve static files with a web server like Nginx

### Backend
- Build with `npm run build`
- Set production environment variables
- Run with `npm start`

### Docker (Future Enhancement)
Consider Dockerizing both frontend and backend for easier deployment.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes and test both frontend and backend
4. Commit changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a pull request