
# Vibe Builders Sprint Commitment Dashboard - Product Requirements Document

## Project Overview

**Project Name:** Vibe Builders Sprint Commitment Dashboard  
**Project Type:** Hybrid Web Application (Replit + Make.com Integration)  
**Target Users:** Members of the Vibe Builders Collective  
**Project Duration:** 4-6 weeks  
**Architecture:** React/TypeScript frontend, Node.js/Express backend, PostgreSQL database, Make.com automation

## Project Vision

A personal sprint commitment dashboard enabling Vibe Builders Collective members to manage historic, current, and future sprint cycles with intelligent validation, automated transitions, and seamless integration between Replit's web interface and Make.com's automation platform.

## Key Success Metrics

- 100% uptime for sprint transition automation
- <500ms response time for dashboard loading
- Zero data loss during sprint transitions
- 95% webhook delivery success rate
- Real-time validation preventing rule violations

## Technical Architecture Overview

### Core Components
- **Frontend:** React with TypeScript, Shadcn/ui components, Tailwind CSS
- **Backend:** Node.js/Express with RESTful APIs
- **Database:** PostgreSQL with Drizzle ORM
- **External Integration:** Make.com webhook automation
- **Deployment:** Replit public deployment

### Security Considerations
- API endpoint authentication for Make.com integration
- Input validation and sanitization
- Rate limiting for webhook endpoints
- Secure environment variable management

---

## PHASE 1: CORE SPRINT CALCULATION ENGINE

### Epic 1.1: Dynamic Sprint Date Calculation System

#### User Story 1.1.1: Sprint Date Calculation Engine
**As a** system administrator  
**I want** the system to automatically calculate sprint dates from June 20, 2025 anchor date  
**So that** all sprint schedules are dynamically determined based on the current date  

**Acceptance Criteria:**
- [ ] Sprint dates calculated from June 20, 2025 starting point
- [ ] 14-day sprint cycles starting every Friday at 12:01 AM
- [ ] Dynamic calculation using `new Date()` for current date determination
- [ ] Up to 24 historic sprints (1 year maximum) calculated and stored
- [ ] 6 future sprints generated for planning horizon
- [ ] Sprint status automatically determined (historic/current/future)

**Tasks:**
- [ ] Create SprintCalculator service class
- [ ] Implement `calculateSprintDates()` method with June 20, 2025 anchor
- [ ] Build `getCurrentSprintIndex()` logic based on system date
- [ ] Add `getSprintsByStatus()` method for categorization
- [ ] Create comprehensive unit tests for edge cases
- [ ] Document date calculation algorithms

#### User Story 1.1.2: Sprint Status Management
**As a** user  
**I want** the system to automatically categorize sprints as historic, current, or future  
**So that** I can focus on the appropriate time horizons for planning  

**Acceptance Criteria:**
- [ ] Current sprint determined by system date comparison
- [ ] Historic sprints limited to 24 maximum (rolling window)
- [ ] Future sprints maintained at exactly 6 for planning
- [ ] Sprint status updates automatically with date changes
- [ ] Timezone-agnostic calculations for Friday 12:01 AM starts

**Tasks:**
- [ ] Implement sprint status enumeration (historic/current/future)
- [ ] Create automatic status assignment logic
- [ ] Build rolling window management for historic sprints
- [ ] Add sprint cleanup for old historic data
- [ ] Implement status transition validation

---

## PHASE 2: DASHBOARD USER INTERFACE

### Epic 2.1: Dashboard Display System

#### User Story 2.1.1: Sprint Overview Dashboard
**As a** Vibe Builders member  
**I want** to view my sprint commitments in organized sections  
**So that** I can understand my past performance and plan future work  

**Acceptance Criteria:**
- [ ] Three distinct sections: Historic, Current, Future sprints
- [ ] Visual indicators for sprint types (Build/Test/PTO)
- [ ] Date ranges displayed for each sprint
- [ ] Sprint statistics summary (Build count, Test count, PTO count)
- [ ] Responsive design for mobile and desktop
- [ ] Real-time validation status indicators

**Tasks:**
- [ ] Design React component hierarchy for dashboard layout
- [ ] Implement historic sprints read-only display
- [ ] Create current sprint status card
- [ ] Build future sprints editable interface
- [ ] Add sprint statistics calculation and display
- [ ] Implement responsive CSS with Tailwind

#### User Story 2.1.2: Sprint Commitment Form
**As a** user  
**I want** to set commitments for future sprints with appropriate validation  
**So that** I can plan my work while adhering to collective rules  

**Acceptance Criteria:**
- [ ] Dropdown selection for Build/Test/PTO commitments
- [ ] Description field enabled only for Build sprint types
- [ ] Real-time validation of 2 PTO max / 2 Build min per 6-sprint window
- [ ] Visual feedback for validation errors
- [ ] Save functionality with confirmation messaging
- [ ] Form state persistence during editing session

**Tasks:**
- [ ] Create sprint commitment form components
- [ ] Implement select dropdown with three options
- [ ] Add conditional description field for Build sprints
- [ ] Build real-time validation logic
- [ ] Create form submission handling
- [ ] Add error messaging and success feedback

### Epic 2.2: Initial Dashboard State Management

#### User Story 2.2.1: Dynamic Dashboard Initialization
**As a** new user  
**I want** the dashboard to automatically populate with initial sprint data  
**So that** I can immediately understand the system and start planning  

**Acceptance Criteria:**
- [ ] 1 historic sprint with "Build" status and onboarding description
- [ ] 1 current sprint with "Build" status and onboarding description
- [ ] 6 future sprints in editable state with null/empty initial values
- [ ] All dates calculated dynamically from June 20, 2025 anchor
- [ ] Dashboard ready for user interaction immediately upon load

**Tasks:**
- [ ] Implement dashboard initialization logic
- [ ] Create default sprint commitment seeding
- [ ] Add onboarding description text constants
- [ ] Build first-time user experience flow
- [ ] Test initialization with various current dates

---

## PHASE 3: VALIDATION AND BUSINESS RULES

### Epic 3.1: Sprint Commitment Validation Engine

#### User Story 3.1.1: Rolling Window Validation
**As a** user  
**I want** the system to prevent invalid sprint distributions  
**So that** I maintain proper work-life balance and collective standards  

**Acceptance Criteria:**
- [ ] Maximum 2 PTO sprints per 6-sprint rolling window enforced
- [ ] Minimum 2 Build sprints per 6-sprint rolling window enforced
- [ ] No constraints on Test sprint quantity
- [ ] Real-time validation during form interaction
- [ ] Clear error messages explaining constraint violations
- [ ] Validation prevents form submission when rules violated

**Tasks:**
- [ ] Create validation rule engine
- [ ] Implement 6-sprint rolling window calculation
- [ ] Add PTO maximum constraint checking
- [ ] Add Build minimum constraint checking
- [ ] Create validation error messaging system
- [ ] Build form submission prevention logic

#### User Story 3.1.2: State Change Detection
**As a** system  
**I want** to detect when users make new commitments  
**So that** appropriate webhook notifications can be triggered  

**Acceptance Criteria:**
- [ ] Previous state fetched before processing new submissions
- [ ] State comparison logic identifies newly committed sprints
- [ ] New commitments defined as null/empty to Build/Test/PTO transitions
- [ ] Individual tracking for each of the 6 future sprints
- [ ] State change detection triggers webhook preparation

**Tasks:**
- [ ] Implement previous state fetching from database
- [ ] Create state comparison algorithms
- [ ] Add new commitment identification logic
- [ ] Build change detection for each future sprint
- [ ] Create webhook trigger preparation system

---

## PHASE 4: API INTEGRATION AND WEBHOOKS

### Epic 4.1: Make.com Integration API

#### User Story 4.1.1: Sprint Transition API Endpoint
**As a** Make.com automation system  
**I want** to trigger sprint transitions via secure API  
**So that** sprint cycles advance automatically without manual intervention  

**Acceptance Criteria:**
- [ ] `POST /api/advance-sprint` endpoint exposed
- [ ] Authentication mechanism for Make.com requests
- [ ] Sprint transition logic executes: future→current→historic
- [ ] New future sprint added to maintain 6-sprint horizon
- [ ] User commitments preserved during transitions
- [ ] Error handling and rollback for failed transitions

**Tasks:**
- [ ] Create `/api/advance-sprint` route handler
- [ ] Implement authentication middleware for Make.com
- [ ] Build sprint transition business logic
- [ ] Add database transaction management
- [ ] Create rollback mechanisms for failures
- [ ] Add comprehensive logging for transitions

#### User Story 4.1.2: Webhook Service for New Commitments
**As a** system  
**I want** to send individual webhooks for each new sprint commitment  
**So that** Make.com can process commitment notifications individually  

**Acceptance Criteria:**
- [ ] Webhook triggered only for first-time commitments (null→committed)
- [ ] Individual webhook sent for each newly committed sprint
- [ ] Sequential webhook delivery, not batched
- [ ] Webhook payload includes user, sprint, and commitment details
- [ ] Retry logic for failed webhook deliveries
- [ ] Audit trail for all webhook attempts

**Tasks:**
- [ ] Create webhook service class
- [ ] Implement new commitment detection algorithm
- [ ] Build sequential webhook delivery system
- [ ] Add webhook payload formatting
- [ ] Create retry and error handling logic
- [ ] Implement webhook audit logging

### Epic 4.2: Webhook Payload Management

#### User Story 4.2.1: New Sprint Commitment Webhook Format
**As a** Make.com automation  
**I want** to receive standardized webhook payloads for new commitments  
**So that** I can process sprint commitment notifications consistently  

**Acceptance Criteria:**
- [ ] Single JSON object payload (not array)
- [ ] Required fields: user_name, sprint_start_date, sprint_type, dashboard_url, timestamp
- [ ] Optional description field for Build sprint types
- [ ] Date format: YYYY-MM-DD for sprint_start_date
- [ ] ISO 8601 format for timestamp
- [ ] Dashboard URL dynamically generated from environment

**Tasks:**
- [ ] Define webhook payload TypeScript interfaces
- [ ] Create payload formatting functions
- [ ] Add conditional description field handling
- [ ] Implement date formatting utilities
- [ ] Build dynamic URL generation logic
- [ ] Add payload validation before sending

#### User Story 4.2.2: Dashboard Completion Webhook
**As a** Make.com automation  
**I want** to receive notification when users complete dashboard setup  
**So that** I can trigger onboarding completion workflows  

**Acceptance Criteria:**
- [ ] One-time webhook sent when dashboard first completed
- [ ] Payload includes user_name, dashboard_url, completion_timestamp
- [ ] Completion defined as having at least one future sprint commitment
- [ ] Duplicate completion webhooks prevented
- [ ] Webhook sent after successful commitment save

**Tasks:**
- [ ] Define dashboard completion criteria
- [ ] Create completion detection logic
- [ ] Implement one-time webhook sending
- [ ] Add duplicate prevention mechanism
- [ ] Build completion webhook payload formatting

---

## PHASE 5: DATA PERSISTENCE AND STATE MANAGEMENT

### Epic 5.1: Database Schema and Operations

#### User Story 5.1.1: Sprint Data Management
**As a** system  
**I want** to persist sprint and commitment data reliably  
**So that** user data is maintained across sessions and transitions  

**Acceptance Criteria:**
- [ ] Sprint table with id, dates, status, type, description fields
- [ ] User table for member identification and metadata
- [ ] SprintCommitment junction table linking users to sprints
- [ ] WebhookLog table for audit trail
- [ ] Database constraints enforcing data integrity
- [ ] Efficient queries for dashboard data loading

**Tasks:**
- [ ] Design database schema with Drizzle ORM
- [ ] Create migration files for table creation
- [ ] Implement CRUD operations for all entities
- [ ] Add database indexes for performance
- [ ] Create data validation constraints
- [ ] Build efficient query methods

#### User Story 5.1.2: State Transition Management
**As a** system  
**I want** to manage sprint state transitions atomically  
**So that** data consistency is maintained during automated transitions  

**Acceptance Criteria:**
- [ ] Database transactions for sprint advancement
- [ ] Atomic updates across multiple tables
- [ ] Rollback capability for failed transitions
- [ ] Concurrent access handling
- [ ] Data consistency validation after transitions

**Tasks:**
- [ ] Implement database transaction wrapper
- [ ] Create atomic sprint advancement operations
- [ ] Add rollback and error recovery logic
- [ ] Build concurrency control mechanisms
- [ ] Create post-transition validation checks

---

## PHASE 6: DEPLOYMENT AND MONITORING

### Epic 6.1: Production Deployment

#### User Story 6.1.1: Replit Public Deployment
**As a** Vibe Builders member  
**I want** to access the dashboard via public URL  
**So that** I can manage my sprint commitments from anywhere  

**Acceptance Criteria:**
- [ ] Public deployment accessible via stable URL
- [ ] Environment variables properly configured
- [ ] Database connection established in production
- [ ] Webhook endpoints accessible to Make.com
- [ ] SSL/HTTPS enabled for secure access
- [ ] Performance optimized for production load

**Tasks:**
- [ ] Configure production environment variables
- [ ] Set up database connection for production
- [ ] Configure webhook URL endpoints
- [ ] Test public accessibility
- [ ] Optimize bundle size and loading performance
- [ ] Set up error monitoring and logging

### Epic 6.2: Monitoring and Observability

#### User Story 6.2.1: System Health Monitoring
**As a** system administrator  
**I want** to monitor dashboard health and webhook delivery  
**So that** I can ensure reliable service for all users  

**Acceptance Criteria:**
- [ ] Application health endpoints for monitoring
- [ ] Webhook delivery success rate tracking
- [ ] Error logging and alerting
- [ ] Performance metrics collection
- [ ] Database connection monitoring

**Tasks:**
- [ ] Create health check endpoints
- [ ] Implement webhook delivery monitoring
- [ ] Add comprehensive error logging
- [ ] Set up performance tracking
- [ ] Create monitoring dashboard

---

## API Specifications

### Sprint Transition API
```
POST /api/advance-sprint
Authentication: Bearer token or API key
Content-Type: application/json

Response:
{
  "success": boolean,
  "message": string,
  "sprintsAdvanced": number,
  "timestamp": string
}
```

### Dashboard Data API
```
GET /api/dashboard/{username}
Response:
{
  "user": { "id": string, "username": string },
  "sprints": {
    "historic": Sprint[],
    "current": Sprint,
    "future": Sprint[]
  },
  "stats": {
    "buildCount": number,
    "testCount": number,
    "ptoCount": number,
    "uncommittedCount": number,
    "isValid": boolean,
    "daysRemaining": number
  }
}
```

### Commitment Update API
```
POST /api/dashboard/{username}/commitments
Content-Type: application/json
Body:
{
  "commitments": [
    {
      "sprintId": string,
      "type": "build" | "test" | "pto",
      "description": string?
    }
  ]
}
```

## Webhook Payload Specifications

### New Sprint Commitment Webhook
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

### Dashboard Completion Webhook
```json
{
  "user_name": "string",
  "dashboard_url": "string",
  "completion_timestamp": "ISO 8601 string"
}
```

## Risk Mitigation

### High Priority Risks
1. **Sprint Transition Failures:** Implement atomic transactions and rollback mechanisms
2. **Webhook Delivery Failures:** Add retry logic and audit trails
3. **Date Calculation Errors:** Comprehensive edge case testing with various dates
4. **Validation Logic Bugs:** Extensive unit testing of business rules

### Medium Priority Risks
1. **Performance Issues:** Database indexing and query optimization
2. **Security Vulnerabilities:** Input validation and authentication
3. **Integration Failures:** Make.com API testing and error handling

## Testing Strategy

### Unit Testing
- Sprint calculation algorithms
- Validation business rules
- Webhook payload formatting
- State change detection logic

### Integration Testing
- Database operations
- API endpoint functionality
- Webhook delivery system
- Sprint transition workflows

### End-to-End Testing
- Complete user workflows
- Make.com integration scenarios
- Error handling and recovery
- Performance under load

## Success Criteria

### Technical Metrics
- [ ] 99.9% uptime for web application
- [ ] <2 second page load times
- [ ] 95% webhook delivery success rate
- [ ] Zero data loss during sprint transitions

### User Experience Metrics
- [ ] Intuitive dashboard navigation
- [ ] Clear validation error messaging
- [ ] Responsive design across devices
- [ ] Smooth commitment editing experience

### Business Metrics
- [ ] 100% rule compliance enforcement
- [ ] Automated sprint transitions
- [ ] Comprehensive audit trail
- [ ] Seamless Make.com integration
