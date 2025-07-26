export interface SprintInfo {
  sprintNumber: number;
  startDate: Date;
  endDate: Date;
  status: "historic" | "current" | "future";
}

export class SprintCalculator {
  private static readonly ANCHOR_DATE = new Date("2025-06-20T00:01:00.000Z"); // June 20, 2025, 12:01 AM UTC
  private static readonly SPRINT_DURATION_DAYS = 14;
  private static readonly MS_PER_DAY = 24 * 60 * 60 * 1000;

  /**
   * Calculate the current sprint number based on today's date
   */
  static getCurrentSprintNumber(): number {
    const now = new Date();
    const daysSinceAnchor = Math.floor((now.getTime() - this.ANCHOR_DATE.getTime()) / this.MS_PER_DAY);
    return Math.floor(daysSinceAnchor / this.SPRINT_DURATION_DAYS);
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
   */
  static getHistoricSprintNumbers(): number[] {
    const currentSprintNumber = this.getCurrentSprintNumber();
    const historicSprints: number[] = [];
    
    for (let i = 1; i <= 24; i++) {
      const sprintNumber = currentSprintNumber - i;
      if (sprintNumber >= 0) {
        historicSprints.unshift(sprintNumber);
      }
    }
    
    return historicSprints;
  }

  /**
   * Get future sprint numbers (6 upcoming sprints)
   */
  static getFutureSprintNumbers(): number[] {
    const currentSprintNumber = this.getCurrentSprintNumber();
    const futureSprints: number[] = [];
    
    for (let i = 1; i <= 6; i++) {
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
