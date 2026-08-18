class StrategyFeatureBuilder {
  /**
   * Build the exact 43-feature object expected by the Strategy Effectiveness model.
   */
  buildFeatures({ profile, enrollments = [], claims = [], copayClaims = [], interactions = [], segmentName, treatmentStartDate = '2026-08-15' }) {
    if (!profile) {
      throw new Error('Patient profile is required for feature engineering');
    }

    const endDate = new Date(treatmentStartDate);
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter events falling strictly inside the 30-day window [startDate, endDate]
    const enrollmentsInWindow = enrollments.filter(e => {
      const start = new Date(e.Program_Start_Date || e.Enrollment_Date);
      const end = e.Exit_Date || e.Program_End_Date ? new Date(e.Exit_Date || e.Program_End_Date) : null;
      return start <= endDate && (end === null || end >= startDate);
    });

    const claimsInWindow = claims.filter(c => {
      const date = new Date(c.Claim_Date);
      return date >= startDate && date <= endDate;
    });

    const copayClaimsInWindow = copayClaims.filter(cc => {
      const date = new Date(cc.Claim_Date);
      return date >= startDate && date <= endDate;
    });

    const interactionsInWindow = interactions.filter(i => {
      const date = new Date(i.Interaction_Date);
      return date >= startDate && date <= endDate;
    });

    // 1-2: Demographics
    const Age = Number(profile.Age);
    const Baseline_Risk = Number(profile.Baseline_Risk || 0.0);

    // 3-8: PG01-PG06 enrollment flags
    const Enrolled_PG01 = enrollmentsInWindow.some(e => e.Program_ID === 'PG01' && e.Enrollment_Status === 'Enrolled') ? 1.0 : 0.0;
    const Enrolled_PG02 = enrollmentsInWindow.some(e => e.Program_ID === 'PG02' && e.Enrollment_Status === 'Enrolled') ? 1.0 : 0.0;
    const Enrolled_PG03 = enrollmentsInWindow.some(e => e.Program_ID === 'PG03' && e.Enrollment_Status === 'Enrolled') ? 1.0 : 0.0;
    const Enrolled_PG04 = enrollmentsInWindow.some(e => e.Program_ID === 'PG04' && e.Enrollment_Status === 'Enrolled') ? 1.0 : 0.0;
    const Enrolled_PG05 = enrollmentsInWindow.some(e => e.Program_ID === 'PG05' && e.Enrollment_Status === 'Enrolled') ? 1.0 : 0.0;
    const Enrolled_PG06 = enrollmentsInWindow.some(e => e.Program_ID === 'PG06' && e.Enrollment_Status === 'Enrolled') ? 1.0 : 0.0;

    // 9: Variable cost per patient 30d
    let Variable_Cost_Per_Patient_30d = 0.0;
    enrollmentsInWindow.forEach(e => {
      if (e.Enrollment_Status === 'Enrolled') {
        Variable_Cost_Per_Patient_30d += Number(e.Variable_Cost_Per_Patient || 0.0);
      }
    });

    // 10: Copay Max
    const Copay_Max_Per_Patient_30d = copayClaimsInWindow.length > 0 
      ? Math.max(...copayClaimsInWindow.map(cc => Number(cc.Copay_Used || 0.0))) 
      : 0.0;

    // 11-15: 30d Pharmacy calculations
    const Num_Claims_30d = claimsInWindow.length;
    const Num_Refills_30d = claimsInWindow.filter(c => c.Refill_Number > 0).length;
    
    let totalDaysSupply = 0;
    let totalPatientPaid = 0.0;
    claimsInWindow.forEach(c => {
      totalDaysSupply += Number(c.Days_Supply || 0);
      totalPatientPaid += Number(c.Patient_Paid_Amount || 0.0);
    });

    const Average_Days_Supply_30d = Num_Claims_30d > 0 ? totalDaysSupply / Num_Claims_30d : 0.0;
    const Total_Patient_Paid_30d = totalPatientPaid;
    const Average_Patient_Paid_30d = Num_Claims_30d > 0 ? totalPatientPaid / Num_Claims_30d : 0.0;

    // Refill Gap 30d
    let Average_Refill_Gap_30d = 0.0;
    let Maximum_Refill_Gap_30d = 0.0;
    if (claimsInWindow.length > 1) {
      const sortedClaims = [...claimsInWindow].sort((a, b) => new Date(a.Claim_Date) - new Date(b.Claim_Date));
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
        Average_Refill_Gap_30d = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
        Maximum_Refill_Gap_30d = Math.max(...gaps);
      }
    }

    // 18-22: 30d Copay calculations
    const Copay_Claims_Count_30d = copayClaimsInWindow.length;
    const Total_Copay_Used_30d = copayClaimsInWindow.reduce((sum, cc) => sum + Number(cc.Copay_Used || 0.0), 0.0);
    const Total_Copay_Savings_30d = copayClaimsInWindow.reduce((sum, cc) => sum + Number(cc.Patient_Savings || 0.0), 0.0);
    const Fund_Exhausted_Any_30d = copayClaimsInWindow.some(cc => cc.Fund_Exhausted_Flag === true || cc.Fund_Exhausted_Flag === 1) ? 1.0 : 0.0;

    let maxAnnualCap = 0.0;
    copayClaimsInWindow.forEach(cc => {
      const cap = Number(cc.Annual_Copay_Max || 0.0);
      if (cap > maxAnnualCap) maxAnnualCap = cap;
    });
    const Copay_Utilization_Rate_30d = maxAnnualCap > 0 ? Total_Copay_Used_30d / maxAnnualCap : 0.0;

    // 23-29: 30d Support calculations
    const Num_Interactions_30d = interactionsInWindow.length;
    const Num_Financial_Assistance_Interactions_30d = interactionsInWindow.filter(i => i.Interaction_Type === 'Financial Assistance').length;
    const Num_Adherence_Counseling_Interactions_30d = interactionsInWindow.filter(i => i.Interaction_Type === 'Adherence Counseling').length;

    let Follow_Up_Rate_30d = 0.0;
    let Resolution_Rate_30d = 0.0;
    let No_Response_Rate_30d = 0.0;
    let Escalation_Rate_30d = 0.0;

    if (Num_Interactions_30d > 0) {
      Follow_Up_Rate_30d = interactionsInWindow.filter(i => i.Follow_Up_Required === true || i.Follow_Up_Required === 1).length / Num_Interactions_30d;
      Resolution_Rate_30d = interactionsInWindow.filter(i => i.Interaction_Status === 'Resolved').length / Num_Interactions_30d;
      No_Response_Rate_30d = interactionsInWindow.filter(i => i.Interaction_Status === 'No Response').length / Num_Interactions_30d;
      Escalation_Rate_30d = interactionsInWindow.filter(i => i.Interaction_Status === 'Escalated').length / Num_Interactions_30d;
    }

    // 30-43: Demographics & Enrollment
    const Gender = profile.Gender || 'Unknown';
    
    // Map Age to exact categories expected by Strategy categorical schema
    let Age_Group = '30-44';
    if (Age >= 18 && Age <= 29) Age_Group = '18-29';
    else if (Age >= 30 && Age <= 44) Age_Group = '30-44';
    else if (Age >= 45 && Age <= 59) Age_Group = '45-59';
    else if (Age >= 60 && Age <= 74) Age_Group = '60-74';
    else if (Age >= 75) Age_Group = '75+';

    const Region = profile.Region || 'Unknown';
    const State = profile.State || 'Unknown';
    const City_Market = profile.City_Market || 'Unknown';
    const Insurance_Type = profile.Insurance_Type || 'Unknown';
    const Insurance_Plan = profile.Insurance_Plan || 'Unknown';
    const Disease_Condition = profile.Disease_Condition || 'Unknown';
    const Income_Band = profile.Income_Band || 'Unknown';
    const Financial_Assistance_Eligible = !!(profile.Financial_Assistance_Eligible === true || profile.Financial_Assistance_Eligible === 1);
    const Employment_Status = profile.Employment_Status || 'Unknown';

    // Segment Name directly from segmentation API output
    const Segment_Name = segmentName || 'Sub-adherent / High Follow-Up Needs';

    const Primary_Enrollment_Channel = enrollments[0] ? enrollments[0].Enrollment_Channel : 'Not Enrolled';
    const Primary_Enrollment_Reason = enrollments[0] ? enrollments[0].Enrollment_Reason : 'Not Enrolled';

    return {
      Age,
      Baseline_Risk,
      Enrolled_PG01,
      Enrolled_PG02,
      Enrolled_PG03,
      Enrolled_PG04,
      Enrolled_PG05,
      Enrolled_PG06,
      Variable_Cost_Per_Patient_30d,
      Copay_Max_Per_Patient_30d,
      Num_Claims_30d,
      Num_Refills_30d,
      Average_Days_Supply_30d,
      Total_Patient_Paid_30d,
      Average_Patient_Paid_30d,
      Average_Refill_Gap_30d,
      Maximum_Refill_Gap_30d,
      Copay_Claims_Count_30d,
      Total_Copay_Used_30d,
      Total_Copay_Savings_30d,
      Fund_Exhausted_Any_30d,
      Copay_Utilization_Rate_30d,
      Num_Interactions_30d,
      Num_Financial_Assistance_Interactions_30d,
      Num_Adherence_Counseling_Interactions_30d,
      Follow_Up_Rate_30d,
      Resolution_Rate_30d,
      No_Response_Rate_30d,
      Escalation_Rate_30d,
      Gender,
      Age_Group,
      Region,
      State,
      City_Market,
      Insurance_Type,
      Insurance_Plan,
      Disease_Condition,
      Income_Band,
      Financial_Assistance_Eligible,
      Employment_Status,
      Segment_Name,
      Primary_Enrollment_Channel,
      Primary_Enrollment_Reason
    };
  }
}

module.exports = new StrategyFeatureBuilder();
