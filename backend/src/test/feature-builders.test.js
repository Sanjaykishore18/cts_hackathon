const assert = require('assert');
const churnBuilder = require('../ml/feature-builders/churn.feature-builder');
const segmentationBuilder = require('../ml/feature-builders/segmentation.feature-builder');
const strategyBuilder = require('../ml/feature-builders/strategy.feature-builder');

// Mock Patient Data Fixture
const mockProfile = {
  Patient_ID: 'PAT-TEST-01',
  Age: 45,
  Age_Group: '45-59',
  Gender: 'Female',
  Region: 'Midwest',
  State: 'Illinois',
  City_Market: 'Chicago Metro',
  Insurance_Type: 'Commercial',
  Insurance_Plan: 'Blue Cross Blue Shield',
  Disease_Condition: 'Plaque Psoriasis',
  Baseline_Risk: 0.35,
  Financial_Assistance_Eligible: 1,
  Employment_Status: 'Self-Employed',
  Patient_Status: 'Active',
  Patient_Start_Date: '2026-01-10T00:00:00.000Z',
  PDC: 0.85,
  Persistence_Days: 180,
  Persistence_Months: 6
};

const mockEnrollments = [
  {
    Enrollment_ID: 'ENR-01',
    Patient_ID: 'PAT-TEST-01',
    Program_ID: 'PG01',
    Enrollment_Date: '2026-01-10T00:00:00.000Z',
    Enrollment_Status: 'Enrolled',
    Program_Start_Date: '2026-01-10T00:00:00.000Z',
    Enrollment_Channel: 'HCP Referral',
    Enrollment_Reason: 'Provider Recommendation',
    Variable_Cost_Per_Patient: 150.0,
    Copay_Max_Per_Patient: 250.0
  },
  {
    Enrollment_ID: 'ENR-02',
    Patient_ID: 'PAT-TEST-01',
    Program_ID: 'PG02',
    Enrollment_Date: '2026-02-15T00:00:00.000Z',
    Enrollment_Status: 'Withdrawn',
    Program_Start_Date: '2026-02-15T00:00:00.000Z',
    Enrollment_Channel: 'Patient Self-Enrollment',
    Enrollment_Reason: 'Newly Diagnosed',
    Variable_Cost_Per_Patient: 100.0,
    Copay_Max_Per_Patient: 150.0
  }
];

const mockClaims = [
  {
    Claim_ID: 'CLM-01',
    Patient_ID: 'PAT-TEST-01',
    Claim_Date: '2026-01-15T00:00:00.000Z',
    Days_Supply: 30,
    Refill_Number: 0,
    Patient_Paid_Amount: 50.0
  },
  {
    Claim_ID: 'CLM-02',
    Patient_ID: 'PAT-TEST-01',
    Claim_Date: '2026-02-20T00:00:00.000Z',
    Days_Supply: 30,
    Refill_Number: 1,
    Patient_Paid_Amount: 50.0
  }
];

const mockCopayClaims = [
  {
    Copay_Claim_ID: 'COP-01',
    Patient_ID: 'PAT-TEST-01',
    Claim_Date: '2026-01-15T00:00:00.000Z',
    Copay_Used: 100.0,
    Patient_Savings: 80.0,
    Annual_Copay_Max: 1000.0,
    Fund_Exhausted_Flag: 0
  }
];

const mockInteractions = [
  {
    Interaction_ID: 'INT-01',
    Patient_ID: 'PAT-TEST-01',
    Interaction_Date: '2026-01-12T00:00:00.000Z',
    Interaction_Type: 'Financial Assistance',
    Interaction_Status: 'Resolved',
    Follow_Up_Required: 0
  },
  {
    Interaction_ID: 'INT-02',
    Patient_ID: 'PAT-TEST-01',
    Interaction_Date: '2026-02-05T00:00:00.000Z',
    Interaction_Type: 'Adherence Counseling',
    Interaction_Status: 'Resolved',
    Follow_Up_Required: 1
  }
];

const mockEligibilities = [
  {
    Eligibility_ID: 'ELG-01',
    Patient_ID: 'PAT-TEST-01',
    Program_ID: 'PG01',
    Eligible_Flag: 1
  },
  {
    Eligibility_ID: 'ELG-02',
    Patient_ID: 'PAT-TEST-01',
    Program_ID: 'PG02',
    Eligible_Flag: 1
  }
];

function runTests() {
  console.log('--- Running Feature Builder Unit Tests ---');

  // Test 1: Churn Feature Builder
  try {
    const churnFeatures = churnBuilder.buildFeatures({
      profile: mockProfile,
      enrollments: mockEnrollments,
      interactions: mockInteractions,
      eligibilities: mockEligibilities
    });

    const expectedChurnKeys = [
      'age', 'gender', 'region', 'insuranceType', 'diseaseCondition', 'baselineRisk',
      'numProgramsEnrolled', 'numEnrollments', 'numWithdrawn', 'enrollmentChannel',
      'enrollmentReason', 'totalInteractions', 'pctFollowUpRequired', 'pctResolved',
      'pctNoResponse', 'pctEscalated', 'numFinancialAssistInteractions',
      'numAdherenceCounseling', 'numProgramsEligible', 'pctEnrollmentEligible'
    ];

    console.log('Verifying Churn Features...');
    assert.strictEqual(Object.keys(churnFeatures).length, 20, 'Churn must have exactly 20 features');
    for (const key of expectedChurnKeys) {
      assert.ok(key in churnFeatures, `Missing expected key: ${key}`);
    }

    assert.strictEqual(churnFeatures.age, 45);
    assert.strictEqual(churnFeatures.numProgramsEnrolled, 1); // Only ENR-01 is 'Enrolled'
    assert.strictEqual(churnFeatures.numWithdrawn, 1); // ENR-02 is 'Withdrawn'
    assert.strictEqual(churnFeatures.enrollmentChannel, 'HCP Referral'); // Earliest
    assert.strictEqual(churnFeatures.pctFollowUpRequired, 0.5); // 1 out of 2
    assert.strictEqual(churnFeatures.pctResolved, 1.0); // 2 out of 2
    assert.strictEqual(churnFeatures.pctNoResponse, 0.0);
    
    // Leakage check
    const leakageFields = ['pdc', 'pdc_30d', 'persistence_days', 'persistence_months', 'discontinuation_date'];
    for (const leak of leakageFields) {
      assert.strictEqual(churnFeatures[leak], undefined, `Leakage field found: ${leak}`);
    }

    console.log('✅ Churn Feature Builder tests passed.');
  } catch (err) {
    console.error('❌ Churn Feature Builder tests failed:', err.message);
    process.exit(1);
  }

  // Test 2: Segmentation Feature Builder
  try {
    const segFeatures = segmentationBuilder.buildFeatures({
      profile: mockProfile,
      enrollments: mockEnrollments,
      claims: mockClaims,
      copayClaims: mockCopayClaims,
      interactions: mockInteractions
    });

    console.log('Verifying Segmentation Features...');
    assert.strictEqual(Object.keys(segFeatures).length, 44, 'Segmentation must have exactly 44 features');
    
    assert.strictEqual(segFeatures.Patient_ID, 'PAT-TEST-01');
    assert.strictEqual(segFeatures.Num_Claims, 2);
    assert.strictEqual(segFeatures.Num_Refills, 1); // CLM-02 refill number > 0
    assert.strictEqual(segFeatures.Total_Copay_Used, 100.0);
    assert.strictEqual(segFeatures.Copay_Utilization_Rate, 0.1); // 100 / 1000 max cap
    assert.strictEqual(segFeatures.Financial_Assistance_Eligible, true);
    
    // Refill Gap: CLM-02 (Feb 20) - CLM-01 (Jan 15) = 36 days. Supply = 30. Gap = 6.
    assert.strictEqual(segFeatures.Average_Refill_Gap, 6);
    assert.strictEqual(segFeatures.Maximum_Refill_Gap, 6);

    console.log('✅ Segmentation Feature Builder tests passed.');
  } catch (err) {
    console.error('❌ Segmentation Feature Builder tests failed:', err.message);
    process.exit(1);
  }

  // Test 3: Strategy Feature Builder
  try {
    // 30d window: PG01 enrollment is within window, PG02 is outside (if we test relative to '2026-02-28')
    const strategyFeatures = strategyBuilder.buildFeatures({
      profile: mockProfile,
      enrollments: mockEnrollments,
      claims: mockClaims,
      copayClaims: mockCopayClaims,
      interactions: mockInteractions,
      segmentName: 'Commercially Insured / Copay Dependent',
      treatmentStartDate: '2026-02-28'
    });

    console.log('Verifying Strategy Features...');
    assert.strictEqual(Object.keys(strategyFeatures).length, 43, 'Strategy must have exactly 43 features');

    assert.strictEqual(strategyFeatures.Age, 45);
    assert.strictEqual(strategyFeatures.Segment_Name, 'Commercially Insured / Copay Dependent');
    
    // Claims in window (Feb 20 is inside [Jan 29, Feb 28], Jan 15 is outside)
    assert.strictEqual(strategyFeatures.Num_Claims_30d, 1);
    assert.strictEqual(strategyFeatures.Num_Refills_30d, 1);
    
    // Enrolled PG01 & PG02
    assert.strictEqual(strategyFeatures.Enrolled_PG01, 1.0); // Active during window
    assert.strictEqual(strategyFeatures.Enrolled_PG02, 0.0); // Withdrawn in PG02

    console.log('✅ Strategy Feature Builder tests passed.');
  } catch (err) {
    console.error('❌ Strategy Feature Builder tests failed:', err.message);
    process.exit(1);
  }

  console.log('--- All Feature Builder Unit Tests Passed successfully! ---');
}

runTests();
