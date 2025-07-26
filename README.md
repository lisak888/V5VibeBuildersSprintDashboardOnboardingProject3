
# Vibe Builders Sprint Commitment Dashboard

A personal sprint commitment dashboard for the Vibe Builders Collective that manages 14-day sprint cycles with intelligent validation and automated transitions.

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
   ```

3. **Run the Application**
   ```bash
   npm run dev
   ```
   
   Access the dashboard at `http://localhost:5000`

## 📋 Features

### Core Functionality
- **Dynamic Sprint Calculation**: Automatically calculates sprint dates from June 20, 2025 anchor
- **Three Sprint Types**: Build, Test, and PTO commitments
- **Intelligent Validation**: Enforces 2 PTO max / 2 Build min per 6-sprint window
- **Real-time Updates**: Live validation and state management
- **Webhook Integration**: Automated notifications via Make.com

### Sprint Management
- **24 Historic Sprints**: Rolling window of past commitments
- **1 Current Sprint**: Active sprint tracking
- **6 Future Sprints**: Planning horizon with editable commitments
- **Automated Transitions**: API-driven sprint advancement

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, Shadcn/ui
- **Backend**: Node.js + Express, PostgreSQL, Drizzle ORM
- **Integration**: Make.com webhooks for automation
- **Deployment**: Replit public hosting

### Key Components
```
├── client/                 # React frontend
│   ├── src/components/     # UI components
│   ├── src/pages/         # Dashboard pages
│   └── src/lib/           # Utilities and query client
├── server/                # Express backend
│   ├── services/          # Business logic
│   ├── routes.ts          # API endpoints
│   └── storage.ts         # Database operations
└── shared/                # Common schemas and types
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
- **sprint_commitments**: User-sprint relationships
- **webhook_logs**: Audit trail for external integrations

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run specific test suites
npm test sprintCalculator
npm test validationEngine
```

### Test Coverage
- Sprint date calculation algorithms
- Validation business rules
- State change detection
- Webhook payload formatting

## 🚀 Deployment

### Replit Deployment
1. Connect your Replit to this repository
2. Configure environment variables in Secrets
3. Run the application - it will be automatically deployed

### Environment Variables
```
DATABASE_URL=postgresql://...
WEBHOOK_URL=https://hook.us1.make.com/...
SPRINT_TRANSITION_TOKEN=secure_random_token
NODE_ENV=production
```

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
- **WebhookService**: External integration management

## 📝 Contributing

1. Follow the existing code patterns and TypeScript conventions
2. Add unit tests for new business logic
3. Update documentation for API changes
4. Test webhook integrations thoroughly

## 🔒 Security

- API authentication for Make.com integration
- Input validation and sanitization
- Secure environment variable management
- Transaction-based data consistency

## 📈 Monitoring

- Real-time validation status tracking
- Webhook delivery success monitoring
- Sprint transition audit logging
- Performance metrics collection

## 🆘 Troubleshooting

### Common Issues
- **Webhook Failures**: Check Make.com endpoint availability and token
- **Date Calculation Errors**: Verify June 20, 2025 anchor date logic
- **Validation Issues**: Review 6-sprint window business rules
- **Database Connections**: Confirm PostgreSQL connection string

### Support
For issues related to the Vibe Builders Collective sprint system, refer to the PROJECT-PRD.md for detailed specifications and requirements.

---

**Built with ❤️ for the Vibe Builders Collective**
