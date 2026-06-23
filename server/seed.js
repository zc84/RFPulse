import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';

const SUPERADMIN = {
  name: 'Superadmin',
  email: 'd.sharstabitau@andersenlab.com',
  password: 'Toriabra909',
  role: 'Superadmin',
};

const MOCK_DEALS = [
  {
    name: 'NHS Digital Transformation Initiative',
    status: 'New',
    due_date: '2025-02-15',
    budget: 850000,
    domain: 'Healthcare',
    description: 'Comprehensive digital transformation program for NHS trusts across the North West region, including EHR integration and patient portal development.',
    documents: [
      { name: 'RFP_NHS_Digital.pdf', size: '2.4 MB', uploaded_at: '2024-12-01' },
      { name: 'Technical_Requirements.docx', size: '1.1 MB', uploaded_at: '2024-12-03' },
    ],
  },
  {
    name: 'Barclays Core Banking Modernisation',
    status: 'In Progress',
    due_date: '2025-01-30',
    budget: 2400000,
    domain: 'Fintech',
    description: 'Legacy core banking system migration to cloud-native microservices architecture.',
    documents: [
      { name: 'Scope_of_Work.pdf', size: '3.8 MB', uploaded_at: '2024-11-20' },
    ],
  },
  {
    name: 'Tesco Supply Chain Analytics Platform',
    status: 'Won',
    due_date: '2024-12-31',
    budget: 620000,
    domain: 'Retail',
    description: 'Real-time supply chain analytics and demand forecasting platform for UK operations.',
    documents: [],
  },
  {
    name: 'Oxford University LMS Upgrade',
    status: 'New',
    due_date: '2025-03-10',
    budget: 310000,
    domain: 'Education',
    description: 'Learning management system upgrade with AI-powered personalisation features.',
    documents: [
      { name: 'LMS_Requirements.pdf', size: '1.7 MB', uploaded_at: '2024-12-10' },
    ],
  },
  {
    name: 'HMRC Tax Portal Rebuild',
    status: 'In Progress',
    due_date: '2025-04-01',
    budget: 5200000,
    domain: 'Government',
    description: 'Complete rebuild of the self-assessment tax portal with improved UX and accessibility.',
    documents: [
      { name: 'HMRC_ITT.pdf', size: '8.2 MB', uploaded_at: '2024-11-05' },
      { name: 'Security_Requirements.pdf', size: '2.1 MB', uploaded_at: '2024-11-06' },
    ],
  },
  {
    name: 'Siemens Manufacturing IoT Dashboard',
    status: 'TBC',
    due_date: '2025-05-20',
    budget: 480000,
    domain: 'Manufacturing',
    description: 'IoT-enabled production monitoring dashboard for German automotive manufacturing facilities.',
    documents: [],
  },
  {
    name: 'Lloyds Bank Fraud Detection AI',
    status: 'Lost',
    due_date: '2024-11-15',
    budget: 1800000,
    domain: 'Fintech',
    description: 'Machine learning-based real-time fraud detection system integration.',
    documents: [
      { name: 'Fraud_Detection_Spec.pdf', size: '4.5 MB', uploaded_at: '2024-09-15' },
    ],
  },
  {
    name: 'Manchester City Council Digital Services',
    status: 'New',
    due_date: '2025-02-28',
    budget: 730000,
    domain: 'Government',
    description: 'Citizen-facing digital services portal for council tax, planning applications, and benefits.',
    documents: [],
  },
  {
    name: 'ASOS Personalisation Engine',
    status: 'In Progress',
    due_date: '2025-03-15',
    budget: 920000,
    domain: 'Retail',
    description: 'AI-powered product recommendation and personalisation engine for fashion e-commerce platform.',
    documents: [
      { name: 'Technical_Proposal.pdf', size: '5.1 MB', uploaded_at: '2024-11-25' },
    ],
  },
  {
    name: 'University of Edinburgh Student Portal',
    status: 'Won',
    due_date: '2024-12-20',
    budget: 275000,
    domain: 'Education',
    description: 'Unified student services portal integrating timetabling, grades, and library systems.',
    documents: [],
  },
  {
    name: 'AstraZeneca Clinical Trial Management',
    status: 'New',
    due_date: '2025-06-01',
    budget: 3100000,
    domain: 'Healthcare',
    description: 'Clinical trial management system with regulatory compliance and data integrity features.',
    documents: [
      { name: 'Clinical_Trial_RFP.pdf', size: '6.3 MB', uploaded_at: '2024-12-14' },
    ],
  },
  {
    name: 'HSBC Open Banking API Gateway',
    status: 'TBC',
    due_date: '2025-07-15',
    budget: 1450000,
    domain: 'Fintech',
    description: 'PSD2-compliant open banking API gateway with developer portal and sandbox environment.',
    documents: [],
  },
  {
    name: 'Rolls-Royce Digital Twin Platform',
    status: 'In Progress',
    due_date: '2025-08-30',
    budget: 4700000,
    domain: 'Manufacturing',
    description: 'Digital twin simulation platform for jet engine performance monitoring and predictive maintenance.',
    documents: [
      { name: 'Digital_Twin_ITT.pdf', size: '9.7 MB', uploaded_at: '2024-12-02' },
    ],
  },
  {
    name: 'Cambridge Assessment Online Exam Platform',
    status: 'Lost',
    due_date: '2024-10-30',
    budget: 540000,
    domain: 'Education',
    description: 'Secure online examination platform with AI proctoring and accessibility features.',
    documents: [],
  },
  {
    name: 'Vodafone Network Operations Centre',
    status: 'New',
    due_date: '2025-04-15',
    budget: 2200000,
    domain: 'Technology',
    description: 'Next-generation network operations centre with automated incident response and AI-assisted NOC management.',
    documents: [
      { name: 'NOC_Requirements.pdf', size: '3.2 MB', uploaded_at: '2024-12-09' },
    ],
  },
  {
    name: 'John Lewis Supply Chain Integration',
    status: 'TBC',
    due_date: '2025-09-01',
    budget: 890000,
    domain: 'Retail',
    description: 'End-to-end supply chain integration connecting suppliers, warehouses, and retail outlets.',
    documents: [],
  },
  {
    name: 'DVLA Vehicle Registration Modernisation',
    status: 'Won',
    due_date: '2025-01-15',
    budget: 1650000,
    domain: 'Government',
    description: 'Modernisation of vehicle registration and licensing systems with real-time ANPR integration.',
    documents: [
      { name: 'DVLA_Tender.pdf', size: '4.8 MB', uploaded_at: '2024-10-01' },
    ],
  },
  {
    name: 'Pfizer Drug Discovery Analytics',
    status: 'In Progress',
    due_date: '2025-10-01',
    budget: 6800000,
    domain: 'Healthcare',
    description: 'Advanced analytics platform for accelerating drug discovery through molecular simulation data.',
    documents: [
      { name: 'Discovery_Analytics_RFP.pdf', size: '7.4 MB', uploaded_at: '2024-12-06' },
    ],
  },
];

async function seed() {
  try {
    const passwordHash = await bcrypt.hash(SUPERADMIN.password, 10);

    const userResult = await query(
      `INSERT INTO users (name, email, role, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [SUPERADMIN.name, SUPERADMIN.email, SUPERADMIN.role, passwordHash]
    );

    const superadminId = userResult.rows[0].id;
    console.log(`Seeded superadmin user ${SUPERADMIN.email} (id=${superadminId})`);

    for (const deal of MOCK_DEALS) {
      const dealResult = await query(
        `INSERT INTO deals (name, status, due_date, budget, domain, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [deal.name, deal.status, deal.due_date, deal.budget, deal.domain, deal.description || null]
      );

      if (dealResult.rows.length === 0) continue;
      const dealId = dealResult.rows[0].id;

      for (const doc of deal.documents) {
        await query(
          `INSERT INTO documents (deal_id, name, size, uploaded_at)
           VALUES ($1, $2, $3, $4)`,
          [dealId, doc.name, doc.size, doc.uploaded_at]
        );
      }
    }

    console.log(`Seeded ${MOCK_DEALS.length} deals`);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
