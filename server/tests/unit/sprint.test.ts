
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SprintCalculator } from '../../services/sprintCalculator';
import { ValidationEngine, ValidationContext, SprintCommitmentData } from '../../services/validationEngine';

describe('Sprint Application Logic', () => {
  // Mock Date.now() and Date constructor for consistent testing
  const mockDate = (dateString: string) => {
    const mockTime = new Date(dateString).getTime();
    vi.spyOn(Date, 'now').mockImplementation(() => mockTime);
    vi.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
      if (args.length === 0) {
        return new Date(dateString) as any;
      }
      return new (vi.importActual('Date') as any).Date(...args);
    });
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SprintCalculator - Date Calculation Engine', () => {
    describe('getCurrentSprintNumber', () => {
      it('should correctly identify sprint 0 for anchor date (June 20, 2025)', () => {
        mockDate('2025-06-20T00:01:00.000Z');
        expect(SprintCalculator.getCurrentSprintNumber()).toBe(0);
      });

      it('should correctly identify sprint 0 for dates within first sprint cycle', () => {
        mockDate('2025-06-25T12:00:00.000Z');
        expect(SprintCalculator.getCurrentSprintNumber()).toBe(0);
        
        mockDate('2025-07-03T23:59:59.000Z');
        expect(SprintCalculator.getCurrentSprintNumber()).toBe(0);
      });

      it('should correctly identify sprint 1 for second sprint cycle', () => {
        mockDate('2025-07-04T00:01:00.000Z');
        expect(SprintCalculator.getCurrentSprintNumber()).toBe(1);
        
        mockDate('2025-07-10T12:00:00.000Z');
        expect(SprintCalculator.getCurrentSprintNumber()).toBe(1);
      });

      it('should correctly calculate sprint numbers for future dates', () => {
        mockDate('2025-12-05T12:00:00.000Z');
        const expectedSprint = Math.floor(
          (new Date('2025-12-05').getTime() - new Date('2025-06-20T00:01:00.000Z').getTime()) 
          / (14 * 24 * 60 * 60 * 1000)
        );
        expect(SprintCalculator.getCurrentSprintNumber()).toBe(expectedSprint);
      });

      it('should handle dates before anchor date (negative sprint numbers)', () => {
        mockDate('2025-06-01T12:00:00.000Z');
        expect(SprintCalculator.getCurrentSprintNumber()).toBeLessThan(0);
      });
    });

    describe('getSprintStartDate', () => {
      it('should return anchor date for sprint 0', () => {
        const startDate = SprintCalculator.getSprintStartDate(0);
        expect(startDate.toISOString()).toBe('2025-06-20T00:01:00.000Z');
      });

      it('should correctly calculate start date for sprint 1', () => {
        const startDate = SprintCalculator.getSprintStartDate(1);
        expect(startDate.toISOString()).toBe('2025-07-04T00:01:00.000Z');
      });

      it('should correctly calculate start dates for multiple sprints', () => {
        const sprint5Start = SprintCalculator.getSprintStartDate(5);
        const sprint10Start = SprintCalculator.getSprintStartDate(10);
        
        // Each sprint should be exactly 14 days apart
        const expectedSprint5 = new Date('2025-06-20T00:01:00.000Z');
        expectedSprint5.setDate(expectedSprint5.getDate() + (5 * 14));
        
        expect(sprint5Start.getTime()).toBe(expectedSprint5.getTime());
        
        const daysBetween = (sprint10Start.getTime() - sprint5Start.getTime()) / (24 * 60 * 60 * 1000);
        expect(daysBetween).toBe(5 * 14); // 5 sprints * 14 days each
      });
    });

    describe('getSprintEndDate', () => {
      it('should return correct end date for sprint 0', () => {
        const endDate = SprintCalculator.getSprintEndDate(0);
        expect(endDate.toISOString()).toBe('2025-07-03T23:59:59.000Z');
      });

      it('should ensure end date is exactly 13 days, 23:59:59 after start date', () => {
        const sprintNumber = 5;
        const startDate = SprintCalculator.getSprintStartDate(sprintNumber);
        const endDate = SprintCalculator.getSprintEndDate(sprintNumber);
        
        const expectedEndDate = new Date(startDate);
        expectedEndDate.setDate(expectedEndDate.getDate() + 13);
        expectedEndDate.setHours(23, 59, 59, 0);
        
        expect(endDate.getTime()).toBe(expectedEndDate.getTime());
      });
    });

    describe('getSprintStatus', () => {
      beforeEach(() => {
        // Set current date to be in sprint 10
        mockDate('2025-12-05T12:00:00.000Z');
      });

      it('should return "historic" for past sprints', () => {
        expect(SprintCalculator.getSprintStatus(5)).toBe('historic');
        expect(SprintCalculator.getSprintStatus(9)).toBe('historic');
      });

      it('should return "current" for the current sprint', () => {
        expect(SprintCalculator.getSprintStatus(10)).toBe('current');
      });

      it('should return "future" for upcoming sprints', () => {
        expect(SprintCalculator.getSprintStatus(11)).toBe('future');
        expect(SprintCalculator.getSprintStatus(15)).toBe('future');
      });
    });

    describe('getHistoricSprintNumbers', () => {
      it('should return empty array when current sprint is 0', () => {
        mockDate('2025-06-20T12:00:00.000Z');
        expect(SprintCalculator.getHistoricSprintNumbers()).toEqual([]);
      });

      it('should return correct historic sprints for sprint 5', () => {
        mockDate('2025-09-26T12:00:00.000Z'); // Sprint 5
        const historic = SprintCalculator.getHistoricSprintNumbers();
        expect(historic).toEqual([0, 1, 2, 3, 4]);
      });

      it('should limit to 24 historic sprints maximum', () => {
        mockDate('2026-12-25T12:00:00.000Z'); // Much later date
        const historic = SprintCalculator.getHistoricSprintNumbers();
        expect(historic.length).toBeLessThanOrEqual(24);
      });

      it('should return sprints in ascending order', () => {
        mockDate('2025-12-05T12:00:00.000Z');
        const historic = SprintCalculator.getHistoricSprintNumbers();
        
        for (let i = 1; i < historic.length; i++) {
          expect(historic[i]).toBeGreaterThan(historic[i - 1]);
        }
      });
    });

    describe('getFutureSprintNumbers', () => {
      it('should always return exactly 6 future sprints', () => {
        mockDate('2025-07-10T12:00:00.000Z');
        const future = SprintCalculator.getFutureSprintNumbers();
        expect(future).toHaveLength(6);
      });

      it('should return consecutive sprint numbers starting from current + 1', () => {
        mockDate('2025-07-10T12:00:00.000Z'); // Sprint 1 is current
        const future = SprintCalculator.getFutureSprintNumbers();
        expect(future).toEqual([2, 3, 4, 5, 6, 7]);
      });

      it('should work correctly for sprint 0', () => {
        mockDate('2025-06-20T12:00:00.000Z');
        const future = SprintCalculator.getFutureSprintNumbers();
        expect(future).toEqual([1, 2, 3, 4, 5, 6]);
      });
    });

    describe('getAllRelevantSprintNumbers', () => {
      it('should return organized sprint data', () => {
        mockDate('2025-08-15T12:00:00.000Z'); // Sprint 2 is current
        
        const result = SprintCalculator.getAllRelevantSprintNumbers();
        
        expect(result).toEqual({
          historic: [0, 1],
          current: 2,
          future: [3, 4, 5, 6, 7, 8]
        });
      });
    });
  });

  describe('ValidationEngine - Business Rules', () => {
    let mockCommitments: SprintCommitmentData[];
    let validationContext: ValidationContext;

    beforeEach(() => {
      // Set up a base context with 6 future sprints for testing
      mockCommitments = [
        {
          sprintId: 'sprint-1',
          sprintNumber: 1,
          type: 'build',
          description: 'Valid build sprint',
          status: 'current'
        },
        {
          sprintId: 'sprint-2',
          sprintNumber: 2,
          type: null,
          description: null,
          status: 'future'
        },
        {
          sprintId: 'sprint-3',
          sprintNumber: 3,
          type: null,
          description: null,
          status: 'future'
        },
        {
          sprintId: 'sprint-4',
          sprintNumber: 4,
          type: null,
          description: null,
          status: 'future'
        },
        {
          sprintId: 'sprint-5',
          sprintNumber: 5,
          type: null,
          description: null,
          status: 'future'
        },
        {
          sprintId: 'sprint-6',
          sprintNumber: 6,
          type: null,
          description: null,
          status: 'future'
        }
      ];

      validationContext = {
        userId: 'test-user-123',
        commitments: mockCommitments,
        rollingWindowSize: 6
      };
    });

    describe('PTO Maximum Constraint (max 2 PTO per 6-sprint window)', () => {
      it('should reject more than 2 PTO sprints in rolling window', () => {
        // Set up 3 PTO sprints
        validationContext.commitments[1].type = 'pto';
        validationContext.commitments[2].type = 'pto';
        validationContext.commitments[3].type = 'pto';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          expect.stringContaining('Maximum 2 PTO sprints allowed')
        );
        expect(result.errors).toContain(
          expect.stringContaining('Found 3 PTO commitments')
        );
      });

      it('should allow exactly 2 PTO sprints', () => {
        // Set up exactly 2 PTO sprints and 2 build sprints
        validationContext.commitments[1].type = 'pto';
        validationContext.commitments[2].type = 'pto';
        validationContext.commitments[3].type = 'build';
        validationContext.commitments[3].description = 'Another build sprint';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        // Should not have PTO-related errors
        const ptoErrors = result.errors.filter(error => error.includes('PTO'));
        expect(ptoErrors).toHaveLength(0);
      });

      it('should allow 1 or 0 PTO sprints', () => {
        // Set up 1 PTO sprint and fill with build/test
        validationContext.commitments[1].type = 'pto';
        validationContext.commitments[2].type = 'build';
        validationContext.commitments[2].description = 'Build sprint';
        validationContext.commitments[3].type = 'test';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        const ptoErrors = result.errors.filter(error => error.includes('Maximum') && error.includes('PTO'));
        expect(ptoErrors).toHaveLength(0);
      });
    });

    describe('Build Minimum Constraint (min 2 Build per 6-sprint window)', () => {
      it('should reject fewer than 2 Build sprints in rolling window', () => {
        // Set up only 1 build sprint (current one)
        validationContext.commitments[1].type = 'test';
        validationContext.commitments[2].type = 'test';
        validationContext.commitments[3].type = 'pto';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          expect.stringContaining('Minimum 2 Build sprints required')
        );
        expect(result.errors).toContain(
          expect.stringContaining('Found 1 Build commitments')
        );
      });

      it('should require 0 Build sprints to fail minimum', () => {
        // Remove build from current sprint
        validationContext.commitments[0].type = 'test';
        validationContext.commitments[1].type = 'test';
        validationContext.commitments[2].type = 'pto';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          expect.stringContaining('Found 0 Build commitments')
        );
      });

      it('should allow exactly 2 Build sprints', () => {
        // Set up exactly 2 build sprints
        validationContext.commitments[1].type = 'build';
        validationContext.commitments[1].description = 'Second build sprint';
        validationContext.commitments[2].type = 'test';
        validationContext.commitments[3].type = 'pto';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        const buildErrors = result.errors.filter(error => error.includes('Minimum') && error.includes('Build'));
        expect(buildErrors).toHaveLength(0);
      });

      it('should allow more than 2 Build sprints', () => {
        // Set up 4 build sprints
        validationContext.commitments[1].type = 'build';
        validationContext.commitments[1].description = 'Build 2';
        validationContext.commitments[2].type = 'build';
        validationContext.commitments[2].description = 'Build 3';
        validationContext.commitments[3].type = 'build';
        validationContext.commitments[3].description = 'Build 4';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        const buildErrors = result.errors.filter(error => error.includes('Minimum') && error.includes('Build'));
        expect(buildErrors).toHaveLength(0);
      });
    });

    describe('Build Description Requirement', () => {
      it('should require descriptions for all Build sprints', () => {
        // Create build sprints without descriptions
        validationContext.commitments[1].type = 'build';
        validationContext.commitments[1].description = null;
        validationContext.commitments[2].type = 'build';
        validationContext.commitments[2].description = '';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          expect.stringContaining('All Build sprints require a description')
        );
        expect(result.errors).toContain(
          expect.stringContaining('2 Build sprint(s) missing descriptions')
        );
      });

      it('should allow Build sprints with valid descriptions', () => {
        validationContext.commitments[1].type = 'build';
        validationContext.commitments[1].description = 'Valid description';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        const descriptionErrors = result.errors.filter(error => 
          error.includes('description') || error.includes('Description')
        );
        expect(descriptionErrors).toHaveLength(0);
      });

      it('should not require descriptions for Test or PTO sprints', () => {
        validationContext.commitments[1].type = 'test';
        validationContext.commitments[1].description = null;
        validationContext.commitments[2].type = 'pto';
        validationContext.commitments[2].description = '';
        validationContext.commitments[3].type = 'build';
        validationContext.commitments[3].description = 'Valid build description';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        const descriptionErrors = result.errors.filter(error => 
          error.includes('description') || error.includes('Description')
        );
        expect(descriptionErrors).toHaveLength(0);
      });
    });

    describe('Valid Sprint Commitment Scenarios', () => {
      it('should pass validation with valid commitment distribution', () => {
        // Set up a valid distribution: 2 Build, 1 Test, 1 PTO, 2 uncommitted
        validationContext.commitments[0].type = 'build';
        validationContext.commitments[0].description = 'Current build sprint';
        validationContext.commitments[1].type = 'build';
        validationContext.commitments[1].description = 'Future build sprint';
        validationContext.commitments[2].type = 'test';
        validationContext.commitments[3].type = 'pto';
        // commitments[4] and [5] remain null (uncommitted)

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should pass validation with minimum required commitments', () => {
        // Exactly 2 builds, 0 PTO, rest uncommitted
        validationContext.commitments[0].type = 'build';
        validationContext.commitments[0].description = 'Build 1';
        validationContext.commitments[1].type = 'build';
        validationContext.commitments[1].description = 'Build 2';
        // Rest remain null

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should pass validation with maximum PTO and minimum builds', () => {
        // 2 builds, 2 PTO, 2 uncommitted
        validationContext.commitments[0].type = 'build';
        validationContext.commitments[0].description = 'Build 1';
        validationContext.commitments[1].type = 'build';
        validationContext.commitments[1].description = 'Build 2';
        validationContext.commitments[2].type = 'pto';
        validationContext.commitments[3].type = 'pto';
        // commitments[4] and [5] remain null

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Edge Cases and Invalid Inputs', () => {
      it('should handle empty commitments array', () => {
        validationContext.commitments = [];

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          expect.stringContaining('Minimum 2 Build sprints required')
        );
      });

      it('should reject invalid commitment types', () => {
        (validationContext.commitments[1] as any).type = 'invalid-type';

        const result = ValidationEngine.validateSprintCommitments(validationContext);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          expect.stringContaining('Invalid commitment types found')
        );
      });

      it('should require valid user ID', () => {
        validationContext.userId = '';

        expect(() => {
          ValidationEngine.validateSprintCommitments(validationContext);
        }).toThrow('User ID is required for validation');
      });

      it('should validate rolling window size bounds', () => {
        validationContext.rollingWindowSize = 0;

        expect(() => {
          ValidationEngine.validateSprintCommitments(validationContext);
        }).toThrow('Rolling window size must be between 1 and 24');

        validationContext.rollingWindowSize = 25;

        expect(() => {
          ValidationEngine.validateSprintCommitments(validationContext);
        }).toThrow('Rolling window size must be between 1 and 24');
      });
    });

    describe('getValidationSummary', () => {
      it('should return correct validation summary', () => {
        // Set up known distribution
        validationContext.commitments[0].type = 'build';
        validationContext.commitments[0].description = 'Build 1';
        validationContext.commitments[1].type = 'build';
        validationContext.commitments[1].description = 'Build 2';
        validationContext.commitments[2].type = 'test';
        validationContext.commitments[3].type = 'pto';
        // [4] and [5] remain null (uncommitted)

        const summary = ValidationEngine.getValidationSummary(validationContext);

        expect(summary).toEqual({
          buildCount: 2,
          testCount: 1,
          ptoCount: 1,
          uncommittedCount: 2,
          isValid: true,
          criticalErrors: []
        });
      });

      it('should identify critical errors in summary', () => {
        // Set up invalid distribution (3 PTO, 1 Build)
        validationContext.commitments[0].type = 'build';
        validationContext.commitments[0].description = 'Only build';
        validationContext.commitments[1].type = 'pto';
        validationContext.commitments[2].type = 'pto';
        validationContext.commitments[3].type = 'pto';

        const summary = ValidationEngine.getValidationSummary(validationContext);

        expect(summary.isValid).toBe(false);
        expect(summary.criticalErrors.length).toBeGreaterThan(0);
        expect(summary.criticalErrors.some(error => error.includes('Maximum'))).toBe(true);
        expect(summary.criticalErrors.some(error => error.includes('Minimum'))).toBe(true);
      });
    });
  });
});
