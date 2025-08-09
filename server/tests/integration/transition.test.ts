
import request from 'supertest';
import express from 'express';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { registerRoutes } from '../../routes';
import { storage } from '../../storage';
import { SprintCalculator } from '../../services/sprintCalculator';

const app = express();
app.use(express.json());

describe('Sprint Transition API', () => {
  let server: any;
  const testUsername = 'transition-test-user';
  const authToken = process.env.ADVANCE_SPRINT_SECRET || process.env.SPRINT_TRANSITION_TOKEN || 'default-token';

  beforeAll(async () => {
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    // Clean up test data
    try {
      const user = await storage.getUserByUsername(testUsername);
      if (user) {
        const sprints = await storage.getUserSprints(user.id);
        for (const sprint of sprints) {
          await storage.deleteSprint(sprint.id);
        }
        await storage.deleteUser(user.id);
      }
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  beforeEach(async () => {
    // Clean up any existing test data
    try {
      const user = await storage.getUserByUsername(testUsername);
      if (user) {
        const sprints = await storage.getUserSprints(user.id);
        for (const sprint of sprints) {
          await storage.deleteSprint(sprint.id);
        }
        await storage.deleteUser(user.id);
      }
    } catch (error) {
      // User doesn't exist, that's fine
    }
  });

  describe('POST /api/advance-sprint', () => {
    it('should successfully transition sprints from out-of-date state', async () => {
      // Create test user
      const user = await storage.createUser({
        username: testUsername,
        password: 'test-password-123'
      });

      // Get current sprint calculations
      const currentSprintNumber = SprintCalculator.getCurrentSprintNumber();
      const outdatedCurrentSprintNumber = currentSprintNumber - 1; // One cycle behind
      const futureSprintNumbers = [];
      
      // Create 6 future sprints relative to the outdated current
      for (let i = 1; i <= 6; i++) {
        futureSprintNumbers.push(outdatedCurrentSprintNumber + i);
      }

      // Seed database with outdated sprint data
      // Create one historic sprint (two cycles behind)
      const historicSprintInfo = SprintCalculator.getSprintInfo(outdatedCurrentSprintNumber - 1);
      await storage.createSprint({
        userId: user.id,
        sprintNumber: historicSprintInfo.sprintNumber,
        startDate: historicSprintInfo.startDate,
        endDate: historicSprintInfo.endDate,
        type: 'build',
        description: 'Historic build sprint',
        status: 'historic',
      });

      // Create outdated "current" sprint (should become historic)
      const outdatedCurrentSprintInfo = SprintCalculator.getSprintInfo(outdatedCurrentSprintNumber);
      const outdatedCurrentSprint = await storage.createSprint({
        userId: user.id,
        sprintNumber: outdatedCurrentSprintNumber,
        startDate: outdatedCurrentSprintInfo.startDate,
        endDate: outdatedCurrentSprintInfo.endDate,
        type: 'build',
        description: 'Outdated current sprint',
        status: 'current', // This should become historic
      });

      // Create future sprints (first one should become current)
      const futureSprintIds = [];
      for (let i = 0; i < futureSprintNumbers.length; i++) {
        const sprintNumber = futureSprintNumbers[i];
        const sprintInfo = SprintCalculator.getSprintInfo(sprintNumber);
        const futureSprint = await storage.createSprint({
          userId: user.id,
          sprintNumber,
          startDate: sprintInfo.startDate,
          endDate: sprintInfo.endDate,
          type: i === 0 ? 'test' : null, // First future sprint has a commitment
          description: i === 0 ? 'Test sprint commitment' : null,
          status: 'future',
        });
        futureSprintIds.push(futureSprint.id);
      }

      // Verify initial state
      const initialSprints = await storage.getUserSprints(user.id);
      const initialCurrent = initialSprints.find(s => s.status === 'current');
      expect(initialCurrent).toBeDefined();
      expect(initialCurrent!.sprintNumber).toBe(outdatedCurrentSprintNumber);

      // Make API call to advance sprint
      const response = await request(app)
        .post('/api/advance-sprint')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify API response
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Sprint transition completed');
      expect(response.body.currentSprint).toBe(currentSprintNumber);
      expect(response.body.totalUsers).toBeGreaterThan(0);
      expect(response.body.usersProcessed).toBeGreaterThan(0);
      expect(response.body.sprintsUpdated).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('timestamp');

      // Fetch updated sprint data
      const updatedSprints = await storage.getUserSprints(user.id);
      
      // Assert that the old "current" sprint is now historic
      const formerCurrentSprint = updatedSprints.find(s => s.id === outdatedCurrentSprint.id);
      expect(formerCurrentSprint).toBeDefined();
      expect(formerCurrentSprint!.status).toBe('historic');
      expect(formerCurrentSprint!.sprintNumber).toBe(outdatedCurrentSprintNumber);

      // Assert that the first future sprint is now current
      const newCurrentSprint = updatedSprints.find(s => s.status === 'current');
      expect(newCurrentSprint).toBeDefined();
      expect(newCurrentSprint!.sprintNumber).toBe(currentSprintNumber);
      expect(newCurrentSprint!.type).toBe('test'); // Should preserve the commitment
      expect(newCurrentSprint!.description).toBe('Test sprint commitment');

      // Verify sprint status distribution
      const historicSprints = updatedSprints.filter(s => s.status === 'historic');
      const currentSprints = updatedSprints.filter(s => s.status === 'current');
      const futureSprints = updatedSprints.filter(s => s.status === 'future');

      expect(currentSprints).toHaveLength(1);
      expect(futureSprints).toHaveLength(6); // Should maintain 6 future sprints
      expect(historicSprints.length).toBeGreaterThan(0);

      // Verify that a new future sprint was created
      const maxFutureSprintNumber = Math.max(...futureSprints.map(s => s.sprintNumber));
      expect(maxFutureSprintNumber).toBe(currentSprintNumber + 6);
    });

    it('should handle authentication correctly', async () => {
      // Test without authorization header
      await request(app)
        .post('/api/advance-sprint')
        .expect(401);

      // Test with invalid token
      const response = await request(app)
        .post('/api/advance-sprint')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should handle multiple users during transition', async () => {
      // Create multiple test users with outdated sprint data
      const user1 = await storage.createUser({
        username: `${testUsername}-1`,
        password: 'test-password-123'
      });

      const user2 = await storage.createUser({
        username: `${testUsername}-2`,
        password: 'test-password-123'
      });

      const currentSprintNumber = SprintCalculator.getCurrentSprintNumber();
      const outdatedSprintNumber = currentSprintNumber - 1;

      // Create outdated current sprints for both users
      for (const user of [user1, user2]) {
        const sprintInfo = SprintCalculator.getSprintInfo(outdatedSprintNumber);
        await storage.createSprint({
          userId: user.id,
          sprintNumber: outdatedSprintNumber,
          startDate: sprintInfo.startDate,
          endDate: sprintInfo.endDate,
          type: 'build',
          description: 'Outdated current sprint',
          status: 'current',
        });
      }

      // Execute transition
      const response = await request(app)
        .post('/api/advance-sprint')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify both users were processed
      expect(response.body.success).toBe(true);
      expect(response.body.usersProcessed).toBeGreaterThanOrEqual(2);

      // Verify both users have correct sprint states
      for (const user of [user1, user2]) {
        const userSprints = await storage.getUserSprints(user.id);
        const currentSprint = userSprints.find(s => s.status === 'current');
        expect(currentSprint).toBeDefined();
        expect(currentSprint!.sprintNumber).toBe(currentSprintNumber);
      }

      // Cleanup additional test users
      for (const user of [user1, user2]) {
        const sprints = await storage.getUserSprints(user.id);
        for (const sprint of sprints) {
          await storage.deleteSprint(sprint.id);
        }
        await storage.deleteUser(user.id);
      }
    });

    it('should be idempotent - no changes when already up to date', async () => {
      // Create user with up-to-date sprint data
      const user = await storage.createUser({
        username: testUsername,
        password: 'test-password-123'
      });

      // First, trigger the dashboard endpoint to create proper sprint structure
      await request(app)
        .get(`/api/dashboard/${testUsername}`)
        .expect(200);

      // Get initial state
      const initialSprints = await storage.getUserSprints(user.id);
      const initialSprintCount = initialSprints.length;

      // Execute transition when already up to date
      const response = await request(app)
        .post('/api/advance-sprint')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify successful response but no changes
      expect(response.body.success).toBe(true);
      
      // Verify no sprints were modified
      const finalSprints = await storage.getUserSprints(user.id);
      expect(finalSprints).toHaveLength(initialSprintCount);

      // Verify sprint states remain unchanged
      const currentSprint = finalSprints.find(s => s.status === 'current');
      expect(currentSprint).toBeDefined();
      expect(currentSprint!.sprintNumber).toBe(SprintCalculator.getCurrentSprintNumber());
    });
  });
});
