/**
 * Validation middleware for ML Strategy Effectiveness Prediction endpoint.
 */

const NUMERICAL_FIELDS = [
  'Age', 'Baseline_Risk', 'Enrolled_PG01', 'Enrolled_PG02', 'Enrolled_PG03', 'Enrolled_PG04', 'Enrolled_PG05', 'Enrolled_PG06',
  'Variable_Cost_Per_Patient_30d', 'Copay_Max_Per_Patient_30d', 'Num_Claims_30d', 'Num_Refills_30d', 'Average_Days_Supply_30d',
  'Total_Patient_Paid_30d', 'Average_Patient_Paid_30d', 'Average_Refill_Gap_30d', 'Maximum_Refill_Gap_30d', 'Copay_Claims_Count_30d',
  'Total_Copay_Used_30d', 'Total_Copay_Savings_30d', 'Fund_Exhausted_Any_30d', 'Copay_Utilization_Rate_30d', 'Num_Interactions_30d',
  'Num_Financial_Assistance_Interactions_30d', 'Num_Adherence_Counseling_Interactions_30d', 'Follow_Up_Rate_30d', 'Resolution_Rate_30d',
  'No_Response_Rate_30d', 'Escalation_Rate_30d'
];

const RANGE_FIELDS = [
  'Baseline_Risk', 'Copay_Utilization_Rate_30d', 'Follow_Up_Rate_30d', 'Resolution_Rate_30d', 'No_Response_Rate_30d', 'Escalation_Rate_30d'
];

const CATEGORICAL_SCHEMAS = {
  Gender: ['Female', 'Male'],
  Age_Group: ['18-29', '30-44', '45-59', '60-74', '75+'],
  Region: ['Midwest', 'Northeast', 'Southeast', 'Southwest', 'West'],
  Insurance_Type: ['Commercial', 'Employer', 'Medicaid', 'Medicare'],
  Income_Band: ['$100K-$150K', '$30K-$60K', '$60K-$100K', '<$30K', '>$150K'],
  Employment_Status: ['Employed Full-Time', 'Employed Part-Time', 'Retired', 'Self-Employed', 'Unemployed'],
  Segment_Name: ['Commercially Insured / Copay Dependent', 'Government Insured / Stable Adherent', 'Sub-adherent / High Follow-Up Needs', 'Unengaged / High Clinical Risk'],
  Primary_Enrollment_Channel: ['Call Center', 'HCP Referral', 'Not Enrolled', 'Patient Self-Enrollment', 'Specialty Pharmacy Referral', 'Web Enrollment'],
  Primary_Enrollment_Reason: ['Affordability Barrier', 'Insurance Coverage Gap', 'Newly Diagnosed', 'Not Enrolled', 'Provider Recommendation', 'Therapy Complexity']
};

const STRING_FIELDS = [
  'State', 'City_Market', 'Insurance_Plan', 'Disease_Condition'
];

const validateStrategyInput = (req, res, next) => {
  const details = [];
  const body = req.body || {};

  // Bypass validations if it's a database-driven request (Age is missing but Patient_ID / patientId is present and other fields are omitted)
  const isDbDriven = (body.Patient_ID || body.patientId) && body.Age === undefined && Object.keys(body).length < 5;
  if (isDbDriven) {
    return next();
  }

  // 1. Validate numerical fields
  for (const field of NUMERICAL_FIELDS) {
    const val = body[field];
    if (val === undefined || typeof val !== 'number') {
      details.push({
        field,
        message: `${field} must be a valid number`
      });
    } else if (RANGE_FIELDS.includes(field) && (val < 0 || val > 1)) {
      details.push({
        field,
        message: `${field} must be a number between 0 and 1 (inclusive)`
      });
    }
  }

  // 2. Validate categorical schemas (known options)
  for (const [field, allowedValues] of Object.entries(CATEGORICAL_SCHEMAS)) {
    const val = body[field];
    if (val === undefined || typeof val !== 'string' || !allowedValues.includes(val)) {
      details.push({
        field,
        message: `${field} must be one of: ${allowedValues.join(', ')}`
      });
    }
  }

  // 3. Validate general string fields (not hardcoded categories)
  for (const field of STRING_FIELDS) {
    const val = body[field];
    if (val === undefined || typeof val !== 'string' || val.trim() === '') {
      details.push({
        field,
        message: `${field} must be a non-empty string`
      });
    }
  }

  // 4. Validate Financial_Assistance_Eligible
  const fae = body.Financial_Assistance_Eligible;
  if (fae === undefined || typeof fae !== 'boolean') {
    details.push({
      field: 'Financial_Assistance_Eligible',
      message: 'Financial_Assistance_Eligible must be a boolean (true or false)'
    });
  }

  if (details.length > 0) {
    const error = new Error('Invalid strategy effectiveness input');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
    return next(error);
  }

  next();
};

module.exports = {
  validateStrategyInput
};
