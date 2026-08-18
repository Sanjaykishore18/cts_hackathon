/**
 * Validation middleware for Patient Segmentation ML endpoint.
 */

const NUMERICAL_FIELDS = [
  'Num_Programs_Enrolled', 'Total_Enrollment_Duration', 'Total_Enrollments', 'Num_Withdrawals', 'Num_Discontinuations',
  'Num_Claims', 'Num_Refills', 'Average_Days_Supply', 'Total_Patient_Paid', 'Average_Patient_Paid', 'Average_Refill_Gap',
  'Maximum_Refill_Gap', 'Copay_Claims_Count', 'Total_Copay_Used', 'Total_Copay_Savings', 'Fund_Exhausted_Any',
  'Num_Interactions', 'Num_Financial_Assistance_Interactions', 'Num_Adherence_Counseling_Interactions', 'Persistence_Days',
  'Persistence_Months'
];

const RATE_FIELDS = [
  'Baseline_Risk', 'Copay_Utilization_Rate', 'Follow_Up_Rate', 'Resolution_Rate', 'No_Response_Rate', 'Escalation_Rate', 'PDC'
];

const CATEGORICAL_SCHEMAS = {
  Gender: ['Female', 'Male'],
  Region: ['Midwest', 'Northeast', 'Southeast', 'Southwest', 'West'],
  Insurance_Type: ['Commercial', 'Employer', 'Medicaid', 'Medicare'],
  Income_Band: ['$100K-$150K', '$30K-$60K', '$60K-$100K', '<$30K', '>$150K'],
  Employment_Status: ['Employed Full-Time', 'Employed Part-Time', 'Retired', 'Self-Employed', 'Unemployed'],
  Primary_Enrollment_Channel: ['Call Center', 'HCP Referral', 'Not Enrolled', 'Patient Self-Enrollment', 'Specialty Pharmacy Referral', 'Web Enrollment'],
  Primary_Enrollment_Reason: ['Affordability Barrier', 'Insurance Coverage Gap', 'Newly Diagnosed', 'Not Enrolled', 'Provider Recommendation', 'Therapy Complexity']
};

const STRING_FIELDS = [
  'Age_Group', 'State', 'City_Market', 'Insurance_Plan', 'Disease_Condition', 'Patient_Start_Date'
];

const validateSegmentationInput = (req, res, next) => {
  const details = [];
  const body = req.body || {};

  // Bypass validations if it's a database-driven request (Age is missing but Patient_ID is present and other fields are omitted)
  const isDbDriven = body.Patient_ID && body.Age === undefined && Object.keys(body).length < 5;
  if (isDbDriven) {
    return next();
  }

  // 1. Patient_ID: required non-empty string
  const { Patient_ID } = body;
  if (Patient_ID === undefined || typeof Patient_ID !== 'string' || Patient_ID.trim() === '') {
    details.push({
      field: 'Patient_ID',
      message: 'Patient_ID is required and must be a non-empty string'
    });
  }

  // 2. Age: positive number between 1 and 120
  const { Age } = body;
  if (Age === undefined || typeof Age !== 'number' || Age <= 0 || Age > 120) {
    details.push({
      field: 'Age',
      message: 'Age must be a positive number representing a reasonable age (1-120)'
    });
  }

  // 3. Numerical fields (non-negative)
  for (const field of NUMERICAL_FIELDS) {
    const val = body[field];
    if (val === undefined || typeof val !== 'number' || val < 0) {
      details.push({
        field,
        message: `${field} must be a non-negative number`
      });
    }
  }

  // 4. Rate/proportion fields (0 to 1 range)
  for (const field of RATE_FIELDS) {
    const val = body[field];
    if (val === undefined || typeof val !== 'number' || val < 0 || val > 1) {
      details.push({
        field,
        message: `${field} must be a number between 0 and 1 (inclusive)`
      });
    }
  }

  // 5. Categorical schemas with specified options
  for (const [field, allowedValues] of Object.entries(CATEGORICAL_SCHEMAS)) {
    const val = body[field];
    if (val === undefined || typeof val !== 'string' || !allowedValues.includes(val)) {
      details.push({
        field,
        message: `${field} must be one of: ${allowedValues.join(', ')}`
      });
    }
  }

  // 6. General string fields
  for (const field of STRING_FIELDS) {
    const val = body[field];
    if (val === undefined || typeof val !== 'string' || val.trim() === '') {
      details.push({
        field,
        message: `${field} must be a non-empty string`
      });
    }
  }

  // 7. Financial_Assistance_Eligible: boolean
  const fae = body.Financial_Assistance_Eligible;
  if (fae === undefined || typeof fae !== 'boolean') {
    details.push({
      field: 'Financial_Assistance_Eligible',
      message: 'Financial_Assistance_Eligible must be a boolean (true or false)'
    });
  }

  if (details.length > 0) {
    const error = new Error('Invalid patient segmentation input');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
    return next(error);
  }

  next();
};

module.exports = {
  validateSegmentationInput
};
