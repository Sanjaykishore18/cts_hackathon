/**
 * Validation middlewares for request validation.
 */

const validatePatientId = (req, res, next) => {
  const patientId = req.params.patientId || req.query.patientId;
  if (patientId && !/^(PAT-\d+|P\d+)$/i.test(patientId)) {
    const error = new Error('Invalid Patient ID format. Expected format: PAT-XXX or PXXXXX');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = [{ field: 'patientId', message: 'Invalid Patient ID format. Expected format: PAT-XXX or PXXXXX' }];
    return next(error);
  }
  next();
};

const validateProgramId = (req, res, next) => {
  const programId = req.params.programId || req.query.programId;
  if (programId && !/^(PROG-\d+|PG\d+)$/i.test(programId)) {
    const error = new Error('Invalid Program ID format. Expected format: PROG-XXX or PGXX');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = [{ field: 'programId', message: 'Invalid Program ID format. Expected format: PROG-XXX or PGXX' }];
    return next(error);
  }
  next();
};

const validateFilters = (req, res, next) => {
  const details = [];
  const { enrollmentStatus, insuranceType, region, timePeriod, programType } = req.query;

  // Validate Enrollment Status
  if (enrollmentStatus) {
    const allowedStatuses = ['enrolled', 'dropped', 'non-enrolled'];
    if (!allowedStatuses.includes(enrollmentStatus.toLowerCase())) {
      details.push({
        field: 'enrollmentStatus',
        message: `Invalid enrollment status. Allowed values: ${allowedStatuses.join(', ')}`
      });
    }
  }

  // Validate Insurance Type
  if (insuranceType) {
    const allowedInsurances = ['commercial', 'medicare', 'medicaid', 'uninsured'];
    if (!allowedInsurances.includes(insuranceType.toLowerCase())) {
      details.push({
        field: 'insuranceType',
        message: `Invalid insurance type. Allowed values: ${allowedInsurances.join(', ')}`
      });
    }
  }

  // Validate Program Type
  if (programType) {
    const allowedProgramTypes = ['copay card', 'alternative funding', 'bridge program', 'patient assistance program (pap)'];
    if (!allowedProgramTypes.includes(programType.toLowerCase())) {
      details.push({
        field: 'programType',
        message: `Invalid program type. Allowed values: ${allowedProgramTypes.join(', ')}`
      });
    }
  }

  // Validate Region
  if (region) {
    const allowedRegions = ['northeast', 'southeast', 'midwest', 'west'];
    if (!allowedRegions.includes(region.toLowerCase())) {
      details.push({
        field: 'region',
        message: `Invalid region. Allowed values: ${allowedRegions.join(', ')}`
      });
    }
  }

  // Validate Time Period (e.g., Q1-2026, Q2-2026)
  if (timePeriod) {
    if (!/^Q[1-4]-\d{4}$/i.test(timePeriod)) {
      details.push({
        field: 'timePeriod',
        message: 'Invalid time period format. Expected format: QX-YYYY (e.g. Q1-2026)'
      });
    }
  }

  if (details.length > 0) {
    const error = new Error('Validation failed');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
    return next(error);
  }

  next();
};

const validateEnrollmentPayload = (req, res, next) => {
  const details = [];
  const {
    patientId,
    programId,
    programType,
    insuranceType,
    enrollmentStatus,
    enrollmentChannel,
    copayCoverageAmount,
    annualBenefitCap,
    benefitUtilizedAmount,
    numberOfFillsWithAssistance,
    adherenceRate,
    persistencyDays,
    dropoutReason
  } = req.body;

  // Required checks
  if (!patientId) details.push({ field: 'patientId', message: 'patientId is required' });
  else if (!/^(PAT-\d+|P\d+)$/i.test(patientId)) details.push({ field: 'patientId', message: 'Invalid Patient ID format' });

  if (!programId) details.push({ field: 'programId', message: 'programId is required' });
  else if (!/^(PROG-\d+|PG\d+)$/i.test(programId)) details.push({ field: 'programId', message: 'Invalid Program ID format' });

  if (!programType) details.push({ field: 'programType', message: 'programType is required' });
  if (!insuranceType) details.push({ field: 'insuranceType', message: 'insuranceType is required' });
  if (!enrollmentStatus) details.push({ field: 'enrollmentStatus', message: 'enrollmentStatus is required' });
  if (!enrollmentChannel) details.push({ field: 'enrollmentChannel', message: 'enrollmentChannel is required' });

  // Enrollment status enum validation
  if (enrollmentStatus) {
    const allowed = ['enrolled', 'dropped', 'non-enrolled'];
    if (!allowed.includes(enrollmentStatus.toLowerCase())) {
      details.push({ field: 'enrollmentStatus', message: 'Invalid enrollment status. Allowed values: Enrolled, Dropped, Non-Enrolled' });
    } else if (enrollmentStatus.toLowerCase() === 'dropped' && !dropoutReason) {
      details.push({ field: 'dropoutReason', message: 'dropoutReason is required when status is Dropped' });
    }
  }

  // Optional Numeric validations
  if (copayCoverageAmount !== undefined) {
    const val = parseFloat(copayCoverageAmount);
    if (isNaN(val) || val < 0) details.push({ field: 'copayCoverageAmount', message: 'Must be a non-negative number' });
  }
  if (annualBenefitCap !== undefined) {
    const val = parseFloat(annualBenefitCap);
    if (isNaN(val) || val < 0) details.push({ field: 'annualBenefitCap', message: 'Must be a non-negative number' });
  }
  if (benefitUtilizedAmount !== undefined) {
    const val = parseFloat(benefitUtilizedAmount);
    if (isNaN(val) || val < 0) details.push({ field: 'benefitUtilizedAmount', message: 'Must be a non-negative number' });
  }
  if (numberOfFillsWithAssistance !== undefined) {
    const val = parseInt(numberOfFillsWithAssistance, 10);
    if (isNaN(val) || val < 0) details.push({ field: 'numberOfFillsWithAssistance', message: 'Must be a non-negative integer' });
  }
  if (adherenceRate !== undefined) {
    const val = parseFloat(adherenceRate);
    if (isNaN(val) || val < 0 || val > 100) details.push({ field: 'adherenceRate', message: 'Must be a percentage between 0 and 100' });
  }
  if (persistencyDays !== undefined) {
    const val = parseInt(persistencyDays, 10);
    if (isNaN(val) || val < 0) details.push({ field: 'persistencyDays', message: 'Must be a non-negative integer' });
  }

  if (details.length > 0) {
    const error = new Error('Validation failed');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
    return next(error);
  }

  next();
};

const validateEnrollmentUpdatePayload = (req, res, next) => {
  const details = [];
  const {
    enrollmentStatus,
    dropoutReason,
    benefitUtilizedAmount,
    numberOfFillsWithAssistance,
    adherenceRate,
    persistencyDays
  } = req.body;

  // Enrollment status enum validation
  if (enrollmentStatus) {
    const allowed = ['enrolled', 'dropped', 'non-enrolled'];
    if (!allowed.includes(enrollmentStatus.toLowerCase())) {
      details.push({ field: 'enrollmentStatus', message: 'Invalid enrollment status. Allowed values: Enrolled, Dropped, Non-Enrolled' });
    } else if (enrollmentStatus.toLowerCase() === 'dropped' && !dropoutReason) {
      details.push({ field: 'dropoutReason', message: 'dropoutReason is required when status is Dropped' });
    }
  }

  // Numeric validations
  if (benefitUtilizedAmount !== undefined) {
    const val = parseFloat(benefitUtilizedAmount);
    if (isNaN(val) || val < 0) details.push({ field: 'benefitUtilizedAmount', message: 'Must be a non-negative number' });
  }
  if (numberOfFillsWithAssistance !== undefined) {
    const val = parseInt(numberOfFillsWithAssistance, 10);
    if (isNaN(val) || val < 0) details.push({ field: 'numberOfFillsWithAssistance', message: 'Must be a non-negative integer' });
  }
  if (adherenceRate !== undefined) {
    const val = parseFloat(adherenceRate);
    if (isNaN(val) || val < 0 || val > 100) details.push({ field: 'adherenceRate', message: 'Must be a percentage between 0 and 100' });
  }
  if (persistencyDays !== undefined) {
    const val = parseInt(persistencyDays, 10);
    if (isNaN(val) || val < 0) details.push({ field: 'persistencyDays', message: 'Must be a non-negative integer' });
  }

  if (details.length > 0) {
    const error = new Error('Validation failed');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
    return next(error);
  }

  next();
};

const validateBatchId = (req, res, next) => {
  const batchId = req.params.batchId || req.query.batchId;
  if (!batchId || !/^B\d{8}T\d{6}Z-[a-f0-9]{6}$/.test(batchId)) {
    const error = new Error('Invalid Batch ID format. Expected format: B{yyyyMMdd}T{HHmmss}Z-{6 lowercase hex}');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = [{ field: 'batchId', message: 'Invalid Batch ID format. Expected format: B{yyyyMMdd}T{HHmmss}Z-{6 lowercase hex}' }];
    return next(error);
  }
  next();
};

module.exports = {
  validatePatientId,
  validateProgramId,
  validateFilters,
  validateEnrollmentPayload,
  validateEnrollmentUpdatePayload,
  validateBatchId
};
