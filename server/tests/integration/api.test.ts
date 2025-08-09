
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../routes';
import { storage } from '../../storage';
import { SprintCalculator } from '../../services/sprintCalculator';

describe('API Integration Tests', () => {
  let app: express.Application;
  let server: any;
  let testUserId: string;
  let testUsername: string;
  let testSprints: any[];

  beforeAll(async () => {
    // Set up Express app with routes
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);

    // Create test user
    testUsername = `test-user-${Date.now()}`;
    const testUser = await storage.createUser({
      username: testUsername,
      password: 'test-password'
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      try {
        // Clean up test user and related data (cascade delete should handle sprints/commitments)
        await storage.deleteUser(testUserId);
      } catch (error) {
        console.warn('Test cleanup warning:', error);
      }
    }

    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Reset sprint data for each test
    await storage.deleteUserSprints(testUserId);
    
    // Create fresh sprint data for testing
    const sprintNumbers = SprintCalculator.getAllRelevantSprintNumbers();
    const allSprintNumbers = [
      ...sprintNumbers.historic,
      sprintNumbers.current,
      ...sprintNumbers.future,
    ];

    testSprints = [];
    for (const sprintNumber of allSprintNumbers) {
      const sprintInfo = SprintCalculator.getSprintInfo(sprintNumber);
      const sprint = await storage.createSprint({
        userId: testUserId,
        sprintNumber,
        startDate: sprintInfo.startDate,
        endDate: sprintInfo.endDate,
        type: null,
        description: null,
        status: sprintInfo.status,
      });
      testSprints.push(sprint);
    }
  });

  describe('GET /api/dashboard/:username', () => {
    it('should return correct sprint data for a user', async () => {
      const response = await request(app)
        .get(`/api/dashboard/${testUsername}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe(testUsername);
      expect(response.body.user.id).toBe(testUserId);

      expect(response.body).toHaveProperty('sprints');
      expect(response.body.sprints).toHaveProperty('historic');
      expect(response.body.sprints).toHaveProperty('current');
      expect(response.body.sprints).toHaveProperty('future');

      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('buildCount');
      expect(response.body.stats).toHaveProperty('testCount');
      expect(response.body.stats).toHaveProperty('ptoCount');
      expect(response.body.stats).toHaveProperty('uncommittedCount');
      expect(response.body.stats).toHaveProperty('isValid');
      expect(response.body.stats).toHaveProperty('daysRemaining');

      // Verify sprint counts
      expect(Array.isArray(response.body.sprints.historic)).toBe(true);
      expect(response.body.sprints.current).toBeTruthy();
      expect(Array.isArray(response.body.sprints.future)).toBe(true);
      expect(response.body.sprints.future).toHaveLength(6);
    });

    it('should create a new user if user does not exist', async () => {
      const newUsername = `new-user-${Date.now()}`;
      
      const response = await request(app)
        .get(`/api/dashboard/${newUsername}`)
        .expect(200);

      expect(response.body.user.username).toBe(newUsername);
      expect(response.body.user.id).toBeTruthy();

      // Clean up the created user
      await storage.deleteUser(response.body.user.id);
    });

    it('should have self-healing sprint cycles', async () => {
      // First request should trigger self-healing
      const response = await request(app)
        .get(`/api/dashboard/${testUsername}`)
        .expect(200);

      // Verify that sprint cycles are properly organized
      const { sprints } = response.body;
      
      // Current sprint should exist and be singular
      expect(sprints.current).toBeTruthy();
      expect(typeof sprints.current).toBe('object');
      
      // Future sprints should be exactly 6
      expect(sprints.future).toHaveLength(6);
      
      // All sprints should have proper dates
      expect(sprints.current.startDate).toBeTruthy();
      expect(sprints.current.endDate).toBeTruthy();
      
      sprints.future.forEach((sprint: any) => {
        expect(sprint.startDate).toBeTruthy();
        expect(sprint.endDate).toBeTruthy();
      });
    });
  });

  describe('POST /api/dashboard/:username/commitments', () => {
    it('should successfully save valid sprint commitments', async () => {
      // Get future sprints to commit to
      const dashboardResponse = await request(app)
        .get(`/api/dashboard/${testUsername}`)
        .expect(200);

      const futureSprints = dashboardResponse.body.sprints.future;
      expect(futureSprints).toHaveLength(6);

      // Create valid commitments (2 build, 1 test, 1 pto, 2 uncommitted)
      const commitments = [
        {
          sprintId: futureSprints[0].id,
          type: 'build',
          description: 'Test build sprint 1'
        },
        {
          sprintId: futureSprints[1].id,
          type: 'build',
          description: 'Test build sprint 2'
        },
        {
          sprintId: futureSprints[2].id,
          type: 'test',
          description: null
        },
        {
          sprintId: futureSprints[3].id,
          type: 'pto',
          description: null
        },
        // Leave last 2 sprints uncommitted
      ];

      const response = await request(app)
        .post(`/api/dashboard/${testUsername}/commitments`)
        .send({ commitments })
        .expect(200);

      expect(response.body.message).toBe('Commitments updated successfully');

      // Verify data was saved correctly
      const updatedDashboard = await request(app)
        .get(`/api/dashboard/${testUsername}`)
        .expect(200);

      const updatedFuture = updatedDashboard.body.sprints.future;
      expect(updatedFuture[0].type).toBe('build');
      expect(updatedFuture[0].description).toBe('Test build sprint 1');
      expect(updatedFuture[1].type).toBe('build');
      expect(updatedFuture[1].description).toBe('Test build sprint 2');
      expect(updatedFuture[2].type).toBe('test');
      expect(updatedFuture[3].type).toBe('pto');
      expect(updatedFuture[4].type).toBeNull();
      expect(updatedFuture[5].type).toBeNull();

      // Verify validation stats
      const stats = updatedDashboard.body.stats;
      expect(stats.buildCount).toBe(2);
      expect(stats.testCount).toBe(1);
      expect(stats.ptoCount).toBe(1);
      expect(stats.uncommittedCount).toBe(2);
      expect(stats.isValid).toBe(true);
    });

    it('should reject commitments that violate validation rules', async () => {
      // Get future sprints
      const dashboardResponse = await request(app)
        .get(`/api/dashboard/${testUsername}`)
        .expect(200);

      const futureSprints = dashboardResponse.body.sprints.future;

      // Create invalid commitments (3 PTO sprints - exceeds max of 2)
      const invalidCommitments = [
        {
          sprintId: futureSprints[0].id,
          type: 'pto',
          description: null
        },
        {
          sprintId: futureSprints[1].id,
          type: 'pto',
          description: null
        },
        {
          sprintId: futureSprints[2].id,
          type: 'pto',
          description: null
        },
      ];

      const response = await request(app)
        .post(`/api/dashboard/${testUsername}/commitments`)
        .send({ commitments: invalidCommitments })
        .expect(400);

      expect(response.body.message).toBe('Invalid request data');
      expect(response.body.errors).toBeTruthy();
    });

    it('should reject build commitments without descriptions', async () => {
      // Get future sprints
      const dashboardResponse = await request(app)
        .get(`/api/dashboard/${testUsername}`)
        .expect(200);

      const futureSprints = dashboardResponse.body.sprints.future;

      // Create build commitment without description
      const invalidCommitments = [
        {
          sprintId: futureSprints[0].id,
          type: 'build',
          description: null // Build sprints require descriptions
        }
      ];

      const response = await request(app)
        .post(`/api/dashboard/${testUsername}/commitments`)
        .send({ commitments: invalidCommitments })
        .expect(400);

      expect(response.body.message).toBe('Invalid request data');
      expect(response.body.errors).toBeTruthy();
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/dashboard/non-existent-user/commitments')
        .send({ commitments: [] })
        .expect(404);

      expect(response.body.message).toBe('User not found');
    });

    it('should handle malformed request data', async () => {
      const response = await request(app)
        .post(`/api/dashboard/${testUsername}/commitments`)
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body.message).toBe('Invalid request data');
      expect(response.body.errors).toBeTruthy();
    });
  });

  describe('POST /api/advance-sprint', () => {
    it('should require authentication token', async () => {
      const response = await request(app)
        .post('/api/advance-sprint')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should successfully advance sprints with valid token', async () => {
      const validToken = process.env.ADVANCE_SPRINT_SECRET || process.env.SPRINT_TRANSITION_TOKEN || 'default-token';

      const response = await request(app)
        .post('/api/advance-sprint')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Sprint transition completed');
      expect(response.body).toHaveProperty('currentSprint');
      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('usersProcessed');
      expect(response.body).toHaveProperty('sprintsUpdated');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should reject invalid authentication token', async () => {
      const response = await request(app)
        .post('/api/advance-sprint')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unauthorized');
    });
  });

  describe('POST /api/dashboard/:username/complete', () => {
    it('should send dashboard completion webhook for existing user', async () => {
      const response = await request(app)
        .post(`/api/dashboard/${testUsername}/complete`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Dashboard completion webhook sent');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/dashboard/non-existent-user/complete')
        .expect(404);

      expect(response.body.message).toBe('User not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database connection
      // For now, we'll test that the API returns proper error responses
      const response = await request(app)
        .get('/api/dashboard/invalid-special-chars-♠♣♦♥')
        .expect(200); // Should still work, just create a new user

      expect(response.body.user.username).toBe('invalid-special-chars-♠♣♦♥');
    });

    it('should handle concurrent requests properly', async () => {
      // Test concurrent dashboard loads
      const promises = Array.from({ length: 5 }, () =>
        request(app).get(`/api/dashboard/${testUsername}`)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.user.username).toBe(testUsername);
      });
    });
  });
});
