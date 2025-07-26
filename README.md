
# Vibe Builders Sprint Commitment Dashboard

A personal sprint commitment dashboard for the Vibe Builders Collective that manages 14-day sprint cycles with intelligent validation and automated transitions.

## 🚀 Current Development Status

**Project Phase:** Phase 6 - Deployment and Monitoring *(In Progress)*

### ✅ Completed Phases
- **Phase 1:** ✅ Core Sprint Calculation Engine
- **Phase 2:** ✅ Dashboard User Interface  
- **Phase 3:** ✅ Validation and Business Rules
- **Phase 4:** ✅ API Integration and Webhooks
- **Phase 5:** ✅ Data Persistence and State Management

### 🔧 Current Phase Progress
**Phase 6: Deployment and Monitoring**
- ⏳ Task 1: Configure production environment variables *(In Progress)*
- ⚪ Task 2: Set up database connection for production
- ⚪ Task 3: Configure webhook URL endpoints for Make.com access
- ⚪ Task 4: Test public accessibility and SSL/HTTPS
- ⚪ Task 5: Optimize bundle size and loading performance
- ⚪ Task 6: Set up error monitoring and logging
- ⚪ Task 7: Create health check endpoints
- ⚪ Task 8: Implement webhook delivery monitoring
- ⚪ Task 9: Add comprehensive error logging
- ⚪ Task 10: Set up performance tracking
- ⚪ Task 11: Create monitoring dashboard

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, Shadcn/ui
- **Backend**: Node.js + Express, PostgreSQL, Drizzle ORM
- **Database**: Neon Database (Serverless PostgreSQL)
- **Integration**: Make.com webhooks for automation
- **Deployment**: Replit public hosting

### Key Components
```
├── client/                 # React frontend
│   ├── src/components/     # UI components (Shadcn/ui)
│   ├── src/pages/         # Dashboard pages
│   └── src/lib/           # Utilities and query client
├── server/                # Express backend
│   ├── services/          # Business logic services
│   ├── routes.ts          # API endpoints
│   └── storage.ts         # Database operations
├── shared/                # Common schemas and types
└── migrations/            # Database migration files
```

## 📊 Sprint System

### Sprint Schedule
- **Duration**: 14 days per sprint
- **Start Time**: Every Friday at 12:01 AM
- **Anchor Date**: June 20, 2025
- **Rolling Window**: 24 historic + 1 current + 6 future sprints

### Commitment Rules
- **Build Sprints**: Require descriptions, minimum 2 per 6-sprint window
- **Test Sprints**: No description required, unlimited quantity
- **PTO Sprints**: No description required, maximum 2 per 6-sprint window

## 🔗 API Endpoints

### Dashboard Data
```
GET /api/dashboard/:username
```
Returns user's sprint data with stats and validation status.

### Update Commitments
```
POST /api/dashboard/:username/commitments
Content-Type: application/json

{
  "commitments": [
    {
      "sprintId": "string",
      "type": "build" | "test" | "pto",
      "description": "string (required for build)"
    }
  ]
}
```

### Sprint Transition (Make.com)
```
POST /api/advance-sprint
Authorization: Bearer <token>
```
Advances all users' sprints from future→current→historic.

### Health Check
```
GET /api/health
GET /api/health/detailed
```
System health monitoring endpoints.

## 🔔 Webhook Events

### New Commitment
Triggered when users make first-time sprint commitments:
```json
{
  "user_name": "string",
  "sprint_start_date": "YYYY-MM-DD",
  "sprint_type": "Build" | "Test" | "PTO",
  "description": "string (if Build type)",
  "dashboard_url": "string",
  "timestamp": "ISO 8601 string"
}
```

### Dashboard Completion
Sent once when user completes initial dashboard setup:
```json
{
  "user_name": "string",
  "dashboard_url": "string",
  "completion_timestamp": "ISO 8601 string"
}
```

## 🗄️ Database Schema

### Key Tables
- **users**: Member credentials and metadata
- **sprints**: Sprint periods with dates and commitments
- **sprint_commitments**: User-sprint relationships with validation
- **webhook_logs**: Audit trail for external integrations

### Implemented Features
- ✅ Dynamic sprint date calculations
- ✅ Real-time commitment validation
- ✅ Automated sprint transitions
- ✅ Webhook integration with Make.com
- ✅ Transaction-safe database operations
- ✅ Comprehensive error handling
- ✅ State change detection
- ✅ Performance optimized queries

## 🚀 Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd vibe-builders-dashboard
   npm install
   ```

2. **Environment Setup**
   Create a `.env` file with:
   ```
   DATABASE_URL=your_postgresql_connection_string
   WEBHOOK_URL=your_make_com_webhook_endpoint
   SPRINT_TRANSITION_TOKEN=your_secure_token
   NODE_ENV=development
   ```

3. **Database Setup**
   ```bash
   npx drizzle-kit generate
   npx drizzle-kit migrate
   ```

4. **Run the Application**
   ```bash
   npm run dev
   ```
   
   Access the dashboard at `http://localhost:5000`

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run specific test suites
npm test sprintCalculator
npm test validationEngine
```

### Test Coverage
- ✅ Sprint date calculation algorithms
- ✅ Validation business rules
- ✅ State change detection
- ✅ Webhook payload formatting

## 🚀 Deployment (Replit)

### Environment Variables for Production
```
DATABASE_URL=postgresql://...  (Neon Database)
WEBHOOK_URL=https://hook.us1.make.com/...
SPRINT_TRANSITION_TOKEN=secure_random_token
NODE_ENV=production
PORT=5000
```

### Deployment Steps
1. Connect your Replit to this repository
2. Configure environment variables in Secrets tab
3. Run the application - automatic public deployment
4. Test webhook endpoints for Make.com integration

## 🔧 Development

### Project Structure
- **PRD-TaskBreakdown Methodology**: Structured as Project > Phase > Epic > User Story > Task
- **Type Safety**: Full TypeScript coverage with Zod validation
- **Real-time Validation**: Client-side and server-side rule enforcement
- **Transaction Safety**: Database operations with rollback support

### Key Services
- **SprintCalculator**: Dynamic date calculations and status determination
- **ValidationEngine**: Business rule enforcement for commitments
- **StateChangeDetector**: Identifies new commitments for webhook triggers
- **WebhookService**: External integration management with retry logic

## 📈 Completed Features

### Core Engine
- ✅ Dynamic sprint calculation from June 20, 2025 anchor
- ✅ Automatic sprint status determination (historic/current/future)
- ✅ Rolling 24-sprint historic window management

### Dashboard Interface
- ✅ Three-section layout (Historic/Current/Future)
- ✅ Real-time validation indicators
- ✅ Responsive design with Tailwind CSS
- ✅ Interactive commitment forms

### Validation System
- ✅ 6-sprint rolling window validation
- ✅ PTO maximum (2) and Build minimum (2) constraints
- ✅ Real-time form validation with error messaging

### API & Webhooks
- ✅ RESTful API endpoints
- ✅ Make.com webhook integration
- ✅ Sprint transition automation
- ✅ Individual webhook delivery for new commitments

### Data Management
- ✅ PostgreSQL with Drizzle ORM
- ✅ Database migrations and indexes
- ✅ Transaction-safe operations
- ✅ Comprehensive audit logging

## 🔒 Security Features

- ✅ API authentication for Make.com integration
- ✅ Input validation and sanitization
- ✅ Secure environment variable management
- ✅ Transaction-based data consistency
- ✅ Rate limiting considerations

## 📝 Development Notes

### Current Focus
- Preparing for production deployment on Replit
- Setting up monitoring and observability
- Optimizing performance for public access

### Known Limitations
- Single-user system (designed for personal use)
- Manual user creation required
- Make.com webhook dependency for sprint transitions

## 🆘 Troubleshooting

### Common Issues
- **Build Errors**: Check TypeScript compilation issues
- **Database Connections**: Verify PostgreSQL connection string format
- **Webhook Failures**: Confirm Make.com endpoint availability
- **Date Calculations**: Verify June 20, 2025 anchor date logic

### Development Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run test suite
npx drizzle-kit generate  # Generate migrations
npx drizzle-kit migrate   # Apply migrations
```

---

**Built with ❤️ for the Vibe Builders Collective**

*Last Updated: Development Day End - Phase 6 Task 1 In Progress*
