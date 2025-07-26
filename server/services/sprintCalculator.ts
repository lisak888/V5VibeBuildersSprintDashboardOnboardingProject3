/**
 * Interface representing comprehensive sprint information
 */
export interface SprintInfo {
  sprintNumber: number;
  startDate: Date;
  endDate: Date;
  status: "historic" | "current" | "future";
}

/**
 * Sprint calculation error types
 */
export class SprintCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SprintCalculationError';
  }
}

/**
 * SprintCalculator - Core engine for Vibe Builders Sprint Commitment Dashboard
 * 
 * This class provides all sprint date calculation functionality for the dashboard,
 * implementing the PRD requirements for dynamic sprint scheduling with a 14-day
 * cycle starting from June 20, 2025.
 * 
 * Key Features:
 * - Dynamic sprint date calculation from anchor date
 * - Automatic sprint status determination (historic/current/future)
 * - Rolling window management for historic sprints (24 max)
 * - 6-sprint future planning horizon
 * - Timezone-agnostic calculations using UTC
 * 
 * @class SprintCalculator
 * @static
 */
export class SprintCalculator {
  /** Anchor date: June 20, 2025 at 12:01 AM UTC - First sprint start */
  private static readonly ANCHOR_DATE = new Date("2025-06-20T00:01:00.000Z");
  
  /** Duration of each sprint cycle in days */
  private static readonly SPRINT_DURATION_DAYS = 14;
  
  /** Milliseconds per day for date calculations */
  private static readonly MS_PER_DAY = 24 * 60 * 60 * 1000;
  
  /** Maximum number of historic sprints to maintain */
  private static readonly MAX_HISTORIC_SPRINTS = 24;
  
  /** Number of future sprints to plan ahead */
  private static readonly FUTURE_SPRINTS_COUNT = 6;

  /**
   * Calculate the current sprint number based on today's date
   * 
   * Uses the system's current date to determine which sprint cycle we're in.
   * Sprint 0 starts on June 20, 2025. Each subsequent sprint starts 14 days later.
   * 
   * @returns The current sprint number (can be negative if before anchor date)
   * @throws {SprintCalculationError} If date calculation fails
   */
  static getCurrentSprintNumber(): number {
    try {
      const now = new Date();
      if (isNaN(now.getTime())) {
        throw new SprintCalculationError('Invalid current date');
      }
      
      const daysSinceAnchor = Math.floor((now.getTime() - this.ANCHOR_DATE.getTime()) / this.MS_PER_DAY);
      return Math.floor(daysSinceAnchor / this.SPRINT_DURATION_DAYS);
    } catch (error) {
      if (error instanceof SprintCalculationError) {
        throw error;
      }
      throw new SprintCalculationError(`Failed to calculate current sprint number: ${error}`);
    }
  }

  /**
   * Get sprint start date for a given sprint number
   */
  static getSprintStartDate(sprintNumber: number): Date {
    const daysFromAnchor = sprintNumber * this.SPRINT_DURATION_DAYS;
    return new Date(this.ANCHOR_DATE.getTime() + (daysFromAnchor * this.MS_PER_DAY));
  }

  /**
   * Get sprint end date for a given sprint number
   */
  static getSprintEndDate(sprintNumber: number): Date {
    const startDate = this.getSprintStartDate(sprintNumber);
    return new Date(startDate.getTime() + ((this.SPRINT_DURATION_DAYS - 1) * this.MS_PER_DAY) + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000));
  }

  /**
   * Determine sprint status based on current date
   */
  static getSprintStatus(sprintNumber: number): "historic" | "current" | "future" {
    const currentSprintNumber = this.getCurrentSprintNumber();
    
    if (sprintNumber < currentSprintNumber) {
      return "historic";
    } else if (sprintNumber === currentSprintNumber) {
      return "current";
    } else {
      return "future";
    }
  }

  /**
   * Get sprint info for a specific sprint number
   */
  static getSprintInfo(sprintNumber: number): SprintInfo {
    return {
      sprintNumber,
      startDate: this.getSprintStartDate(sprintNumber),
      endDate: this.getSprintEndDate(sprintNumber),
      status: this.getSprintStatus(sprintNumber),
    };
  }

  /**
   * Get historic sprint numbers (up to 24 previous sprints)
   * 
   * Returns up to 24 previous sprint numbers for dashboard display.
   * Maintains a rolling window of 1 year of sprint history.
   * Only includes sprints >= 0 (no negative sprint numbers).
   * 
   * @returns Array of historic sprint numbers in ascending order
   */
  static getHistoricSprintNumbers(): number[] {
    const currentSprintNumber = this.getCurrentSprintNumber();
    const historicSprints: number[] = [];
    
    for (let i = 1; i <= this.MAX_HISTORIC_SPRINTS; i++) {
      const sprintNumber = currentSprintNumber - i;
      if (sprintNumber >= 0) {
        historicSprints.unshift(sprintNumber);
      }
    }
    
    return historicSprints;
  }

  /**
   * Get future sprint numbers (6 upcoming sprints)
   * 
   * Returns exactly 6 future sprint numbers for planning horizon.
   * These represent the sprints that users can make commitments for.
   * 
   * @returns Array of 6 future sprint numbers
   */
  static getFutureSprintNumbers(): number[] {
    const currentSprintNumber = this.getCurrentSprintNumber();
    const futureSprints: number[] = [];
    
    for (let i = 1; i <= this.FUTURE_SPRINTS_COUNT; i++) {
      futureSprints.push(currentSprintNumber + i);
    }
    
    return futureSprints;
  }

  /**
   * Get all relevant sprint numbers for dashboard
   */
  static getAllRelevantSprintNumbers(): {
    historic: number[];
    current: number;
    future: number[];
  } {
    return {
      historic: this.getHistoricSprintNumbers(),
      current: this.getCurrentSprintNumber(),
      future: this.getFutureSprintNumbers(),
    };
  }

  /**
   * Format date for display
   */
  static formatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  /**
   * Format date range for display
   */
  static formatDateRange(startDate: Date, endDate: Date): string {
    const start = startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const end = endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${start} - ${end}`;
  }

  /**
   * Calculate days remaining in current sprint
   */
  static getDaysRemainingInCurrentSprint(): number {
    const currentSprintNumber = this.getCurrentSprintNumber();
    const endDate = this.getSprintEndDate(currentSprintNumber);
    const now = new Date();
    const msRemaining = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(msRemaining / this.MS_PER_DAY));
  }
}
