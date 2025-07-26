
/**
 * Validation Engine - Centralized sprint commitment validation for Vibe Builders Dashboard
 * 
 * This service enforces all business rules for sprint commitments including:
 * - Maximum 2 PTO sprints per 6-sprint rolling window
 * - Minimum 2 Build sprints per 6-sprint rolling window  
 * - No constraints on Test sprint quantity
 * - Build sprints require descriptions
 * 
 * @class ValidationEngine
 * @static
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SprintCommitmentData {
  sprintId: string;
  sprintNumber: number;
  type: "build" | "test" | "pto" | null;
  description?: string | null;
  status: "historic" | "current" | "future";
}

export interface ValidationContext {
  userId: string;
  commitments: SprintCommitmentData[];
  rollingWindowSize: number;
}

/**
 * Validation error types for specific rule violations
 */
export enum ValidationErrorType {
  PTO_MAXIMUM_EXCEEDED = "PTO_MAXIMUM_EXCEEDED",
  BUILD_MINIMUM_NOT_MET = "BUILD_MINIMUM_NOT_MET", 
  BUILD_MISSING_DESCRIPTION = "BUILD_MISSING_DESCRIPTION",
  INVALID_COMMITMENT_TYPE = "INVALID_COMMITMENT_TYPE",
  MISSING_SPRINT_DATA = "MISSING_SPRINT_DATA"
}

export class ValidationError extends Error {
  constructor(
    public type: ValidationErrorType,
    message: string,
    public sprintId?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ValidationEngine {
  /** Maximum PTO sprints allowed in rolling window */
  private static readonly MAX_PTO_SPRINTS = 2;
  
  /** Minimum Build sprints required in rolling window */
  private static readonly MIN_BUILD_SPRINTS = 2;
  
  /** Default rolling window size (6 sprints) */
  private static readonly DEFAULT_ROLLING_WINDOW = 6;

  /**
   * Validate all sprint commitments for a user
   * 
   * Performs comprehensive validation of sprint commitments including:
   * - PTO maximum constraint checking
   * - Build minimum constraint checking
   * - Build description requirements
   * - Data integrity validation
   * 
   * @param context - Validation context with user data and commitments
   * @returns ValidationResult with status and detailed error/warning messages
   */
  static validateSprintCommitments(context: ValidationContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Input validation
      this.validateInput(context);

      // Get future and current sprint commitments for rolling window validation
      const rollingWindowCommitments = this.getRollingWindowCommitments(
        context.commitments,
        context.rollingWindowSize
      );

      // Validate PTO maximum constraint
      const ptoValidation = this.validatePTOMaximum(rollingWindowCommitments);
      if (!ptoValidation.isValid) {
        errors.push(...ptoValidation.errors);
      }

      // Validate Build minimum constraint  
      const buildValidation = this.validateBuildMinimum(rollingWindowCommitments);
      if (!buildValidation.isValid) {
        errors.push(...buildValidation.errors);
      }

      // Validate Build sprint descriptions
      const descriptionValidation = this.validateBuildDescriptions(rollingWindowCommitments);
      if (!descriptionValidation.isValid) {
        errors.push(...descriptionValidation.errors);
      }

      // Validate commitment types
      const typeValidation = this.validateCommitmentTypes(rollingWindowCommitments);
      if (!typeValidation.isValid) {
        errors.push(...typeValidation.errors);
      }

      // Generate warnings for potential issues
      const potentialWarnings = this.generateWarnings(rollingWindowCommitments);
      warnings.push(...potentialWarnings);

    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error.message);
      } else {
        errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate PTO maximum constraint (max 2 PTO per rolling window)
   */
  static validatePTOMaximum(commitments: SprintCommitmentData[]): ValidationResult {
    const errors: string[] = [];
    
    const ptoCount = commitments.filter(c => c.type === "pto").length;
    
    if (ptoCount > this.MAX_PTO_SPRINTS) {
      errors.push(
        `Maximum ${this.MAX_PTO_SPRINTS} PTO sprints allowed per ${commitments.length}-sprint window. Found ${ptoCount} PTO commitments.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Validate Build minimum constraint (min 2 Build per rolling window)
   */
  static validateBuildMinimum(commitments: SprintCommitmentData[]): ValidationResult {
    const errors: string[] = [];
    
    const buildCount = commitments.filter(c => c.type === "build").length;
    
    if (buildCount < this.MIN_BUILD_SPRINTS) {
      errors.push(
        `Minimum ${this.MIN_BUILD_SPRINTS} Build sprints required per ${commitments.length}-sprint window. Found ${buildCount} Build commitments.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Validate Build sprint descriptions (all Build sprints must have descriptions)
   */
  static validateBuildDescriptions(commitments: SprintCommitmentData[]): ValidationResult {
    const errors: string[] = [];
    
    const buildSprints = commitments.filter(c => c.type === "build");
    const buildSprintsWithoutDescription = buildSprints.filter(c => 
      !c.description || c.description.trim() === ""
    );

    if (buildSprintsWithoutDescription.length > 0) {
      errors.push(
        `All Build sprints require a description. ${buildSprintsWithoutDescription.length} Build sprint(s) missing descriptions.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Validate commitment types are valid
   */
  static validateCommitmentTypes(commitments: SprintCommitmentData[]): ValidationResult {
    const errors: string[] = [];
    const validTypes = ["build", "test", "pto", null];
    
    const invalidCommitments = commitments.filter(c => 
      c.type !== null && !validTypes.includes(c.type)
    );

    if (invalidCommitments.length > 0) {
      errors.push(
        `Invalid commitment types found. Valid types are: Build, Test, PTO, or null/empty.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Get commitments within the rolling window for validation
   * 
   * The rolling window includes:
   * - Current sprint (if exists)
   * - All future sprints (typically 6)
   * 
   * @param commitments - All sprint commitments
   * @param windowSize - Size of rolling window
   * @returns Commitments within the rolling window
   */
  static getRollingWindowCommitments(
    commitments: SprintCommitmentData[],
    windowSize: number = this.DEFAULT_ROLLING_WINDOW
  ): SprintCommitmentData[] {
    // For validation purposes, we focus on current and future sprints
    // as these are the ones users can modify and commit to
    const relevantCommitments = commitments.filter(c => 
      c.status === "current" || c.status === "future"
    );

    // Sort by sprint number to ensure proper ordering
    const sortedCommitments = relevantCommitments.sort((a, b) => 
      a.sprintNumber - b.sprintNumber
    );

    // Take up to windowSize commitments for validation
    return sortedCommitments.slice(0, windowSize);
  }

  /**
   * Generate warnings for potential issues
   */
  static generateWarnings(commitments: SprintCommitmentData[]): string[] {
    const warnings: string[] = [];
    
    // Check for uncommitted future sprints
    const uncommittedCount = commitments.filter(c => 
      c.status === "future" && c.type === null
    ).length;
    
    if (uncommittedCount > 0) {
      warnings.push(
        `${uncommittedCount} future sprint(s) remain uncommitted.`
      );
    }

    // Check for balanced work distribution
    const buildCount = commitments.filter(c => c.type === "build").length;
    const testCount = commitments.filter(c => c.type === "test").length;
    const ptoCount = commitments.filter(c => c.type === "pto").length;
    
    if (buildCount > testCount + ptoCount) {
      warnings.push(
        "Consider balancing Build sprints with Test or PTO sprints for sustainable workload."
      );
    }

    return warnings;
  }

  /**
   * Validate input data integrity
   */
  private static validateInput(context: ValidationContext): void {
    if (!context.userId || context.userId.trim() === "") {
      throw new ValidationError(
        ValidationErrorType.MISSING_SPRINT_DATA,
        "User ID is required for validation"
      );
    }

    if (!Array.isArray(context.commitments)) {
      throw new ValidationError(
        ValidationErrorType.MISSING_SPRINT_DATA,
        "Commitments array is required for validation"
      );
    }

    if (context.rollingWindowSize < 1 || context.rollingWindowSize > 24) {
      throw new ValidationError(
        ValidationErrorType.MISSING_SPRINT_DATA,
        "Rolling window size must be between 1 and 24"
      );
    }

    // Validate each commitment has required fields
    for (const commitment of context.commitments) {
      if (!commitment.sprintId || typeof commitment.sprintNumber !== "number") {
        throw new ValidationError(
          ValidationErrorType.MISSING_SPRINT_DATA,
          "All commitments must have valid sprintId and sprintNumber",
          commitment.sprintId
        );
      }
    }
  }

  /**
   * Quick validation check for single commitment change
   * Used for real-time validation during form interaction
   */
  static validateSingleCommitment(
    commitment: SprintCommitmentData,
    existingCommitments: SprintCommitmentData[]
  ): ValidationResult {
    const errors: string[] = [];
    
    // Validate Build description requirement
    if (commitment.type === "build" && (!commitment.description || commitment.description.trim() === "")) {
      errors.push("Build sprints require a description");
    }

    // Validate commitment type
    if (commitment.type && !["build", "test", "pto"].includes(commitment.type)) {
      errors.push("Invalid commitment type. Must be Build, Test, or PTO");
    }

    // Create updated commitments list for rolling window validation
    const updatedCommitments = existingCommitments.map(c => 
      c.sprintId === commitment.sprintId ? commitment : c
    );

    // Perform rolling window validation
    const context: ValidationContext = {
      userId: "temp", // Not needed for this validation
      commitments: updatedCommitments,
      rollingWindowSize: this.DEFAULT_ROLLING_WINDOW
    };

    const fullValidation = this.validateSprintCommitments(context);
    errors.push(...fullValidation.errors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: fullValidation.warnings
    };
  }

  /**
   * Get validation summary for dashboard display
   */
  static getValidationSummary(context: ValidationContext): {
    buildCount: number;
    testCount: number;
    ptoCount: number;
    uncommittedCount: number;
    isValid: boolean;
    criticalErrors: string[];
  } {
    const rollingWindowCommitments = this.getRollingWindowCommitments(
      context.commitments,
      context.rollingWindowSize
    );

    const buildCount = rollingWindowCommitments.filter(c => c.type === "build").length;
    const testCount = rollingWindowCommitments.filter(c => c.type === "test").length;
    const ptoCount = rollingWindowCommitments.filter(c => c.type === "pto").length;
    const uncommittedCount = rollingWindowCommitments.filter(c => c.type === null).length;

    const validation = this.validateSprintCommitments(context);
    
    // Filter critical errors (those that prevent form submission)
    const criticalErrors = validation.errors.filter(error => 
      error.includes("Maximum") || 
      error.includes("Minimum") || 
      error.includes("require a description")
    );

    return {
      buildCount,
      testCount,
      ptoCount,
      uncommittedCount,
      isValid: validation.isValid,
      criticalErrors
    };
  }
}
