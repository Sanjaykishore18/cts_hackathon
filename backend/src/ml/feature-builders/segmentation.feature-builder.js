class SegmentationFeatureBuilder {
  /**
   * Build the exact 44-feature object expected by the Segmentation model.
   */
  buildFeatures({ profile, enrollments = [], claims = [], copayClaims = [], interactions = [] }) {
    if (!profile) {
      throw new Error('Patient profile is required for feature engineering');
    }

    const cutoffDate = new Date('2026-08-15');

    // 1-15: Demographics & Baseline Profile Info
    const Patient_ID = profile.Patient_ID;
    const Age = profile.Age !== null && profile.Age !== undefined ? Number(profile.Age) : null;
    const Gender = profile.Gender || 'Unknown';
    const Age_Group = profile.Age_Group || 'Unknown';
    const Region = profile.Region || 'Unknown';
    const State = profile.State || 'Unknown';
    const City_Market = profile.City_Market || 'Unknown';
    const Insurance_Type = profile.Insurance_Type || 'Unknown';
    const Insurance_Plan = profile.Insurance_Plan || 'Unknown';
    const Disease_Condition = profile.Disease_Condition || 'Unknown';
    const Baseline_Risk = profile.Baseline_Risk !== null && profile.Baseline_Risk !== undefined ? Number(profile.Baseline_Risk) : null;
    const Patient_Start_Date = profile.Patient_Start_Date 
      ? new Date(profile.Patient_Start_Date).toISOString().split('T')[0] 
      : 'Unknown';
    const Income_Band = profile.Income_Band || 'Unknown';
    const Financial_Assistance_Eligible = !!(profile.Financial_Assistance_Eligible === true || profile.Financial_Assistance_Eligible === 1);
    const Employment_Status = profile.Employment_Status || 'Unknown';

    // 16-22: Enrollment calculations
    let Total_Enrollment_Duration = 0;
    for (const e of enrollments) {
      const start = new Date(e.Program_Start_Date || e.Enrollment_Date);
      let end = e.Exit_Date || e.Program_End_Date ? new Date(e.Exit_Date || e.Program_End_Date) : cutoffDate;
      if (end > cutoffDate) end = cutoffDate;
      const diffDays = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
      Total_Enrollment_Duration += diffDays;
    }

    const Num_Programs_Enrolled = new Set(
      enrollments.filter(e => e.Enrollment_Status === 'Enrolled').map(e => e.Program_ID)
    ).size;
    const Total_Enrollments = enrollments.length;
    const Num_Withdrawals = enrollments.filter(e => e.Enrollment_Status === 'Withdrawn').length;
    const Num_Discontinuations = enrollments.filter(e => e.Enrollment_Status === 'Discontinued').length;
    const Primary_Enrollment_Channel = enrollments[0] ? enrollments[0].Enrollment_Channel : 'Not Enrolled';
    const Primary_Enrollment_Reason = enrollments[0] ? enrollments[0].Enrollment_Reason : 'Not Enrolled';

    // 23-29: Pharmacy Behavior calculations
    const Num_Claims = claims.length;
    const Num_Refills = claims.filter(c => c.Refill_Number > 0).length;
    
    let totalDaysSupply = 0;
    let totalPatientPaid = 0.0;
    claims.forEach(c => {
      totalDaysSupply += Number(c.Days_Supply || 0);
      totalPatientPaid += Number(c.Patient_Paid_Amount || 0.0);
    });
    
    const Average_Days_Supply = Num_Claims > 0 ? totalDaysSupply / Num_Claims : 0.0;
    const Total_Patient_Paid = totalPatientPaid;
    const Average_Patient_Paid = Num_Claims > 0 ? totalPatientPaid / Num_Claims : 0.0;

    // Refill Gap calculations (sequential claims)
    let Average_Refill_Gap = 0.0;
    let Maximum_Refill_Gap = 0.0;
    if (claims.length > 1) {
      // Sort copy of claims by claim date
      const sortedClaims = [...claims].sort((a, b) => new Date(a.Claim_Date) - new Date(b.Claim_Date));
      const gaps = [];
      for (let i = 1; i < sortedClaims.length; i++) {
        const prev = sortedClaims[i - 1];
        const curr = sortedClaims[i];
        const prevDate = new Date(prev.Claim_Date);
        const currDate = new Date(curr.Claim_Date);
        const prevDaysSupply = Number(prev.Days_Supply || 0);
        
        const diffDays = Math.max(0, Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24)));
        const gap = Math.max(0, diffDays - prevDaysSupply);
        gaps.push(gap);
      }
      
      if (gaps.length > 0) {
        Average_Refill_Gap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
        Maximum_Refill_Gap = Math.max(...gaps);
      }
    }

    // 30-34: Copay Support calculations
    const Copay_Claims_Count = copayClaims.length;
    const Total_Copay_Used = copayClaims.reduce((sum, cc) => sum + Number(cc.Copay_Used || 0.0), 0.0);
    const Total_Copay_Savings = copayClaims.reduce((sum, cc) => sum + Number(cc.Patient_Savings || 0.0), 0.0);
    
    const Fund_Exhausted_Any = copayClaims.some(cc => cc.Fund_Exhausted_Flag === true || cc.Fund_Exhausted_Flag === 1) ? 1.0 : 0.0;
    
    let maxAnnualCap = 0.0;
    copayClaims.forEach(cc => {
      const cap = Number(cc.Annual_Copay_Max || 0.0);
      if (cap > maxAnnualCap) maxAnnualCap = cap;
    });
    const Copay_Utilization_Rate = maxAnnualCap > 0 ? Total_Copay_Used / maxAnnualCap : 0.0;

    // 35-41: Support Interactions calculations
    const Num_Interactions = interactions.length;
    const Num_Financial_Assistance_Interactions = interactions.filter(i => i.Interaction_Type === 'Financial Assistance').length;
    const Num_Adherence_Counseling_Interactions = interactions.filter(i => i.Interaction_Type === 'Adherence Counseling').length;
    
    let Follow_Up_Rate = 0.0;
    let Resolution_Rate = 0.0;
    let No_Response_Rate = 0.0;
    let Escalation_Rate = 0.0;

    if (Num_Interactions > 0) {
      Follow_Up_Rate = interactions.filter(i => i.Follow_Up_Required === true || i.Follow_Up_Required === 1).length / Num_Interactions;
      Resolution_Rate = interactions.filter(i => i.Interaction_Status === 'Resolved').length / Num_Interactions;
      No_Response_Rate = interactions.filter(i => i.Interaction_Status === 'No Response').length / Num_Interactions;
      Escalation_Rate = interactions.filter(i => i.Interaction_Status === 'Escalated').length / Num_Interactions;
    }

    // 42-44: Outcomes Behavior (let preprocessor impute nulls if missing)
    const PDC = profile.PDC !== null && profile.PDC !== undefined ? Number(profile.PDC) : null;
    const Persistence_Days = profile.Persistence_Days !== null && profile.Persistence_Days !== undefined ? Number(profile.Persistence_Days) : null;
    
    let Persistence_Months = null;
    if (profile.Persistence_Months !== null && profile.Persistence_Months !== undefined) {
      Persistence_Months = Number(profile.Persistence_Months);
    } else if (Persistence_Days !== null) {
      Persistence_Months = Persistence_Days / 30.0;
    }

    return {
      Patient_ID,
      Age,
      Gender,
      Age_Group,
      Region,
      State,
      City_Market,
      Insurance_Type,
      Insurance_Plan,
      Disease_Condition,
      Baseline_Risk,
      Patient_Start_Date,
      Income_Band,
      Financial_Assistance_Eligible,
      Employment_Status,
      Total_Enrollment_Duration,
      Num_Programs_Enrolled,
      Total_Enrollments,
      Num_Withdrawals,
      Num_Discontinuations,
      Primary_Enrollment_Channel,
      Primary_Enrollment_Reason,
      Num_Claims,
      Num_Refills,
      Average_Days_Supply,
      Total_Patient_Paid,
      Average_Patient_Paid,
      Average_Refill_Gap,
      Maximum_Refill_Gap,
      Copay_Claims_Count,
      Total_Copay_Used,
      Total_Copay_Savings,
      Fund_Exhausted_Any,
      Copay_Utilization_Rate,
      Num_Interactions,
      Num_Financial_Assistance_Interactions,
      Num_Adherence_Counseling_Interactions,
      Follow_Up_Rate,
      Resolution_Rate,
      No_Response_Rate,
      Escalation_Rate,
      PDC,
      Persistence_Days,
      Persistence_Months
    };
  }
}

module.exports = new SegmentationFeatureBuilder();
