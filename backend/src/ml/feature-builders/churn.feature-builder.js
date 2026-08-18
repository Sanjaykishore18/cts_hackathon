class ChurnFeatureBuilder {
  /**
   * Build the exact 20-feature object expected by the Churn Prediction model.
   */
  buildFeatures({ profile, enrollments = [], interactions = [], eligibilities = [] }) {
    if (!profile) {
      throw new Error('Patient profile is required for feature engineering');
    }

    const age = Number(profile.Age);
    const gender = profile.Gender || 'Unknown';
    const region = profile.Region || 'Unknown';
    const insuranceType = profile.Insurance_Type || 'Unknown';
    const diseaseCondition = profile.Disease_Condition || 'Unknown';
    const baselineRisk = profile.Baseline_Risk !== null && profile.Baseline_Risk !== undefined ? Number(profile.Baseline_Risk) : 0.0;

    // Enrolled status check
    const enrolledPrograms = new Set(
      enrollments
        .filter(e => e.Enrollment_Status === 'Enrolled')
        .map(e => e.Program_ID)
    );
    const numProgramsEnrolled = enrolledPrograms.size;
    const numEnrollments = enrollments.length;
    const numWithdrawn = enrollments.filter(e => e.Enrollment_Status === 'Withdrawn').length;

    // Earliest enrollment logic
    const earliestEnrollment = enrollments[0] || {};
    const enrollmentChannel = earliestEnrollment.Enrollment_Channel || 'Unknown';
    const enrollmentReason = earliestEnrollment.Enrollment_Reason || 'Unknown';

    // Support interaction calculations
    const totalInteractions = interactions.length;
    let pctFollowUpRequired = 0.0;
    let pctResolved = 0.0;
    let pctNoResponse = 0.0;
    let pctEscalated = 0.0;

    if (totalInteractions > 0) {
      const followUpCount = interactions.filter(i => i.Follow_Up_Required === true || i.Follow_Up_Required === 1).length;
      const resolvedCount = interactions.filter(i => i.Interaction_Status === 'Resolved').length;
      const noResponseCount = interactions.filter(i => i.Interaction_Status === 'No Response').length;
      const escalatedCount = interactions.filter(i => i.Interaction_Status === 'Escalated').length;

      pctFollowUpRequired = followUpCount / totalInteractions;
      pctResolved = resolvedCount / totalInteractions;
      pctNoResponse = noResponseCount / totalInteractions;
      pctEscalated = escalatedCount / totalInteractions;
    }

    const numFinancialAssistInteractions = interactions.filter(i => i.Interaction_Type === 'Financial Assistance').length;
    const numAdherenceCounseling = interactions.filter(i => i.Interaction_Type === 'Adherence Counseling').length;

    // Eligibility calculations
    const eligiblePrograms = new Set(
      eligibilities
        .filter(el => el.Eligible_Flag === true || el.Eligible_Flag === 1)
        .map(el => el.Program_ID)
    );
    const numProgramsEligible = eligiblePrograms.size;
    const pctEnrollmentEligible = numProgramsEligible > 0 ? numProgramsEnrolled / numProgramsEligible : 0.0;

    return {
      age,
      gender,
      region,
      insuranceType,
      diseaseCondition,
      baselineRisk,
      numProgramsEnrolled,
      numEnrollments,
      numWithdrawn,
      enrollmentChannel,
      enrollmentReason,
      totalInteractions,
      pctFollowUpRequired,
      pctResolved,
      pctNoResponse,
      pctEscalated,
      numFinancialAssistInteractions,
      numAdherenceCounseling,
      numProgramsEligible,
      pctEnrollmentEligible
    };
  }
}

module.exports = new ChurnFeatureBuilder();
