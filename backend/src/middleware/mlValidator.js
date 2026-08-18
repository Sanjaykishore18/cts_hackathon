/**
 * Validation middleware for ML Churn Prediction endpoint.
 */

const validateChurnPredictionInput = (req, res, next) => {
  const details = [];
  const body = req.body || {};

  // Bypass validations if Patient_ID or patientId is supplied for live Fabric feature construction
  if (body.Patient_ID || body.patientId) {
    return next();
  }

  // 1. age: numeric and reasonable positive value
  const { age } = body;
  if (age === undefined || typeof age !== 'number' || age <= 0 || age > 120) {
    details.push({
      field: 'age',
      message: 'Age must be a positive number representing a reasonable age (1-120)'
    });
  }

  // 2. Numeric range [0, 1] fields
  const rangeFields = [
    'baselineRisk',
    'pctFollowUpRequired',
    'pctResolved',
    'pctNoResponse',
    'pctEscalated',
    'pctEnrollmentEligible'
  ];

  for (const field of rangeFields) {
    const val = body[field];
    if (val === undefined || typeof val !== 'number' || val < 0 || val > 1) {
      details.push({
        field,
        message: `${field} must be a number between 0 and 1 (inclusive)`
      });
    }
  }

  // 3. Non-negative integers
  const integerFields = [
    'numProgramsEnrolled',
    'numEnrollments',
    'numWithdrawn',
    'totalInteractions',
    'numFinancialAssistInteractions',
    'numAdherenceCounseling',
    'numProgramsEligible'
  ];

  for (const field of integerFields) {
    const val = body[field];
    if (val === undefined || typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
      details.push({
        field,
        message: `${field} must be a non-negative integer`
      });
    }
  }

  // 4. Non-empty strings
  const stringFields = [
    'gender',
    'region',
    'insuranceType',
    'diseaseCondition',
    'enrollmentChannel',
    'enrollmentReason'
  ];

  for (const field of stringFields) {
    const val = body[field];
    if (val === undefined || typeof val !== 'string' || val.trim() === '') {
      details.push({
        field,
        message: `${field} must be a non-empty string`
      });
    }
  }

  if (details.length > 0) {
    const error = new Error('Invalid churn prediction input');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
    return next(error);
  }

  next();
};

module.exports = {
  validateChurnPredictionInput
};
