
import { SprintCalculator } from '../sprintCalculator';

describe('SprintCalculator', () => {
  // Mock Date.now() for consistent testing
  const mockDate = (dateString: string) => {
    jest.spyOn(Date, 'now').mockImplementation(() => new Date(dateString).getTime());
    jest.spyOn(global, 'Date').mockImplementation((...args) => {
      if (args.length === 0) {
        return new Date(dateString);
      }
      return new (jest.requireActual('Date') as any)(...args);
    });
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getCurrentSprintNumber', () => {
    it('should return 0 for the anchor date (June 20, 2025)', () => {
      mockDate('2025-06-20T00:01:00.000Z');
      expect(SprintCalculator.getCurrentSprintNumber()).toBe(0);
    });

    it('should return 0 for dates within the first sprint cycle', () => {
      mockDate('2025-06-25T12:00:00.000Z');
      expect(SprintCalculator.getCurrentSprintNumber()).toBe(0);
    });

    it('should return 1 for the second sprint cycle', () => {
      mockDate('2025-07-04T00:01:00.000Z');
      expect(SprintCalculator.getCurrentSprintNumber()).toBe(1);
    });

    it('should return correct sprint number for dates well into the future', () => {
      mockDate('2026-01-01T12:00:00.000Z');
      const expectedSprint = Math.floor((new Date('2026-01-01').getTime() - new Date('2025-06-20T00:01:00.000Z').getTime()) / (14 * 24 * 60 * 60 * 1000));
      expect(SprintCalculator.getCurrentSprintNumber()).toBe(expectedSprint);
    });
  });

  describe('getSprintStartDate', () => {
    it('should return anchor date for sprint 0', () => {
      const startDate = SprintCalculator.getSprintStartDate(0);
      expect(startDate.toISOString()).toBe('2025-06-20T00:01:00.000Z');
    });

    it('should return correct start date for sprint 1', () => {
      const startDate = SprintCalculator.getSprintStartDate(1);
      expect(startDate.toISOString()).toBe('2025-07-04T00:01:00.000Z');
    });

    it('should return correct start date for sprint 10', () => {
      const startDate = SprintCalculator.getSprintStartDate(10);
      const expectedDate = new Date('2025-06-20T00:01:00.000Z');
      expectedDate.setDate(expectedDate.getDate() + (10 * 14));
      expect(startDate.getTime()).toBe(expectedDate.getTime());
    });
  });

  describe('getSprintEndDate', () => {
    it('should return correct end date for sprint 0', () => {
      const endDate = SprintCalculator.getSprintEndDate(0);
      expect(endDate.toISOString()).toBe('2025-07-03T23:59:59.000Z');
    });

    it('should return correct end date for sprint 1', () => {
      const endDate = SprintCalculator.getSprintEndDate(1);
      expect(endDate.toISOString()).toBe('2025-07-17T23:59:59.000Z');
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

  describe('getSprintInfo', () => {
    it('should return complete sprint information', () => {
      mockDate('2025-07-10T12:00:00.000Z'); // Sprint 1 is current
      
      const sprintInfo = SprintCalculator.getSprintInfo(1);
      
      expect(sprintInfo).toEqual({
        sprintNumber: 1,
        startDate: new Date('2025-07-04T00:01:00.000Z'),
        endDate: new Date('2025-07-17T23:59:59.000Z'),
        status: 'current'
      });
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

  describe('formatDate', () => {
    it('should format dates in US locale', () => {
      const date = new Date('2025-06-20T00:01:00.000Z');
      const formatted = SprintCalculator.formatDate(date);
      expect(formatted).toBe('Jun 20, 2025');
    });

    it('should handle different months correctly', () => {
      const date = new Date('2025-12-31T23:59:59.000Z');
      const formatted = SprintCalculator.formatDate(date);
      expect(formatted).toBe('Dec 31, 2025');
    });
  });

  describe('formatDateRange', () => {
    it('should format date ranges correctly', () => {
      const startDate = new Date('2025-06-20T00:01:00.000Z');
      const endDate = new Date('2025-07-03T23:59:59.000Z');
      const formatted = SprintCalculator.formatDateRange(startDate, endDate);
      expect(formatted).toBe('Jun 20 - Jul 3, 2025');
    });

    it('should handle same month ranges', () => {
      const startDate = new Date('2025-07-04T00:01:00.000Z');
      const endDate = new Date('2025-07-17T23:59:59.000Z');
      const formatted = SprintCalculator.formatDateRange(startDate, endDate);
      expect(formatted).toBe('Jul 4 - Jul 17, 2025');
    });
  });

  describe('getDaysRemainingInCurrentSprint', () => {
    it('should return correct days remaining at start of sprint', () => {
      mockDate('2025-06-20T00:01:00.000Z'); // Start of sprint 0
      const daysRemaining = SprintCalculator.getDaysRemainingInCurrentSprint();
      expect(daysRemaining).toBe(14);
    });

    it('should return correct days remaining in middle of sprint', () => {
      mockDate('2025-06-27T12:00:00.000Z'); // Middle of sprint 0
      const daysRemaining = SprintCalculator.getDaysRemainingInCurrentSprint();
      expect(daysRemaining).toBe(7);
    });

    it('should return 0 for past end date', () => {
      mockDate('2025-07-05T12:00:00.000Z'); // After sprint 0 ends
      const daysRemaining = SprintCalculator.getDaysRemainingInCurrentSprint();
      expect(daysRemaining).toBe(0);
    });

    it('should return 1 on the last day of sprint', () => {
      mockDate('2025-07-03T12:00:00.000Z'); // Last day of sprint 0
      const daysRemaining = SprintCalculator.getDaysRemainingInCurrentSprint();
      expect(daysRemaining).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year calculations correctly', () => {
      // Test sprint calculations across leap year boundary
      mockDate('2024-02-29T12:00:00.000Z');
      expect(() => SprintCalculator.getCurrentSprintNumber()).not.toThrow();
    });

    it('should handle negative sprint numbers gracefully', () => {
      mockDate('2025-01-01T12:00:00.000Z'); // Before anchor date
      const currentSprint = SprintCalculator.getCurrentSprintNumber();
      expect(currentSprint).toBeLessThan(0);
      
      const historicSprints = SprintCalculator.getHistoricSprintNumbers();
      expect(historicSprints).toEqual([]); // No historic sprints when current < 0
    });

    it('should handle daylight saving time transitions', () => {
      // Test around DST transitions
      mockDate('2025-03-09T07:00:00.000Z'); // Spring DST transition
      expect(SprintCalculator.getCurrentSprintNumber()).toBeGreaterThanOrEqual(-1);
      
      mockDate('2025-11-02T06:00:00.000Z'); // Fall DST transition
      expect(SprintCalculator.getCurrentSprintNumber()).toBeGreaterThanOrEqual(0);
    });

    it('should maintain consistency across timezone boundaries', () => {
      // The calculator should work consistently regardless of local timezone
      // since it uses UTC internally
      const utcDate = '2025-07-04T00:01:00.000Z';
      mockDate(utcDate);
      
      const sprintNumber = SprintCalculator.getCurrentSprintNumber();
      const startDate = SprintCalculator.getSprintStartDate(sprintNumber);
      
      expect(startDate.toISOString()).toBe('2025-07-04T00:01:00.000Z');
    });
  });
});
