# Vibe Builders Sprint Commitment Dashboard

## Overview

This is a personal sprint commitment dashboard for the Vibe Builders Collective - a hybrid web application built with React and Express.js. The system manages sprint cycles on a 14-day schedule starting from June 20, 2025, allowing users to commit to Build, Test, or PTO designations with intelligent validation rules and webhook integration with Make.com for automation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **API Design**: RESTful API with JSON responses
- **Session Management**: Connect-pg-simple for PostgreSQL session storage

## Key Components

### Sprint Management System
- **Sprint Calculator Service**: Calculates sprint dates dynamically from June 20, 2025 anchor date
- **Sprint Status Logic**: Automatically determines if sprints are historic, current, or future
- **Commitment Validation**: Enforces business rules (max 2 PTO, min 2 Build per 6-sprint window)

### Database Schema
- **Users**: Store user credentials and metadata
- **Sprints**: Track individual sprint periods with dates, types, and descriptions
- **Sprint Commitments**: Link users to their sprint commitments with validation flags
- **Webhook Logs**: Audit trail for external integrations

### Webhook Integration
- **Webhook Service**: Handles communication with Make.com automation platform
- **Event Types**: New commitment notifications and dashboard completion events
- **Payload Structure**: Standardized JSON format for external consumption

## Data Flow

1. **Initial Load**: User accesses dashboard, system calculates current sprint based on date
2. **Sprint Calculation**: Dynamic computation of 24 historic + 1 current + 6 future sprints
3. **Data Persistence**: Sprint commitments stored in PostgreSQL with real-time validation
4. **Webhook Notifications**: Commitment changes trigger external automation via Make.com
5. **Sprint Transitions**: External scheduler calls API endpoint to advance sprint cycles

### Sprint Transition Logic
- Future sprint → Current sprint
- Current sprint → Historic sprint
- New future sprint added to maintain 6-sprint planning horizon
- User commitments preserved during transitions

## External Dependencies

### Database
- **Neon Database**: Serverless PostgreSQL hosting
- **Connection**: WebSocket-based connection pooling for serverless compatibility

### Third-Party Services
- **Make.com**: Automation platform for webhook processing
- **Webhook URL**: Configurable endpoint for sprint commitment notifications

### UI Libraries
- **Radix UI**: Accessible component primitives
- **Lucide Icons**: Icon library
- **Date-fns**: Date manipulation utilities
- **Embla Carousel**: Carousel component

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds optimized React bundle to `dist/public`
- **Backend**: ESBuild compiles TypeScript server code to `dist/index.js`
- **Database**: Drizzle Kit handles schema migrations

### Environment Configuration
- **Development**: Hot module replacement with Vite dev server
- **Production**: Static file serving with Express
- **Database URL**: Required environment variable for PostgreSQL connection
- **Webhook URL**: Optional environment variable for Make.com integration

### Replit-Specific Features
- **Runtime Error Overlay**: Development error handling
- **Cartographer Plugin**: Replit-specific development tooling
- **Dev Banner**: Replit branding in development mode

The architecture balances simplicity with functionality, using modern web technologies while maintaining clear separation between frontend presentation, backend logic, and external integrations. The system is designed for easy deployment on Replit while supporting the hybrid automation approach with Make.com.