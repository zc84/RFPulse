import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';

const SUPERADMIN = {
  name: 'd.sharstabitau',
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
    client_name: 'NHS',
    classification: 'A',
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
    client_name: 'Barclays',
    classification: 'A',
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
    client_name: 'Tesco',
    classification: 'B',
    description: 'Real-time supply chain analytics and demand forecasting platform for UK operations.',
    documents: [],
  },
  {
    name: 'Oxford University LMS Upgrade',
    status: 'New',
    due_date: '2025-03-10',
    budget: 310000,
    domain: 'Education',
    client_name: 'Oxford University',
    classification: 'B',
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
    client_name: 'HMRC',
    classification: 'A',
    description: 'Complete rebuild of the online tax portal with improved UX and security features.',
    documents: [
      { name: 'Tax_Portal_Specs.pdf', size: '4.2 MB', uploaded_at: '2024-11-15' },
      { name: 'Security_Requirements.docx', size: '890 KB', uploaded_at: '2024-11-18' },
    ],
  },
  {
    name: 'Airbus Manufacturing IoT Platform',
    status: 'In Progress',
    due_date: '2025-02-28',
    budget: 1800000,
    domain: 'Manufacturing',
    client_name: 'Airbus',
    classification: 'A',
    description: 'IoT platform for real-time monitoring of manufacturing processes and predictive maintenance.',
    documents: [
      { name: 'IoT_Architecture.pdf', size: '2.1 MB', uploaded_at: '2024-11-25' },
    ],
  },
  {
    name: 'Spotify Content Delivery Network',
    status: 'New',
    due_date: '2025-05-15',
    budget: 3200000,
    domain: 'Technology',
    client_name: 'Spotify',
    classification: 'A',
    description: 'Global content delivery network infrastructure for improved streaming performance.',
    documents: [
      { name: 'CDN_Requirements.pdf', size: '1.5 MB', uploaded_at: '2024-12-05' },
    ],
  },
  {
    name: 'BP Energy Trading Dashboard',
    status: 'Lost',
    due_date: '2024-12-15',
    budget: 950000,
    domain: 'Fintech',
    client_name: 'BP',
    classification: 'B',
    description: 'Real-time energy trading analytics dashboard for global operations.',
    documents: [
      { name: 'Trading_Specs.pdf', size: '2.8 MB', uploaded_at: '2024-10-20' },
    ],
  },
  {
    name: 'Sainsbury\'s Customer Loyalty App',
    status: 'TBC',
    due_date: '2025-06-01',
    budget: 450000,
    domain: 'Retail',
    client_name: 'Sainsbury\'s',
    classification: 'C',
    description: 'Mobile application for customer loyalty program with personalised offers.',
    documents: [],
  },
  {
    name: 'Cambridge University Research Portal',
    status: 'Won',
    due_date: '2025-01-20',
    budget: 280000,
    domain: 'Education',
    client_name: 'Cambridge University',
    classification: 'C',
    description: 'Research collaboration and grant management portal for academic departments.',
    documents: [
      { name: 'Research_Portal.pdf', size: '1.9 MB', uploaded_at: '2024-11-30' },
    ],
  },
  {
    name: 'Ministry of Defence Cybersecurity',
    status: 'In Progress',
    due_date: '2025-07-01',
    budget: 7500000,
    domain: 'Government',
    client_name: 'Ministry of Defence',
    classification: 'A',
    description: 'Comprehensive cybersecurity framework for defence systems and networks.',
    documents: [
      { name: 'Cyber_Security_Specs.pdf', size: '5.5 MB', uploaded_at: '2024-11-10' },
      { name: 'Compliance_Doc.pdf', size: '1.2 MB', uploaded_at: '2024-11-12' },
    ],
  },
  {
    name: 'Rolls-Royce Engine Analytics',
    status: 'New',
    due_date: '2025-03-30',
    budget: 2100000,
    domain: 'Manufacturing',
    client_name: 'Rolls-Royce',
    classification: 'A',
    description: 'Engine performance analytics and predictive maintenance platform for aerospace division.',
    documents: [
      { name: 'Engine_Analytics.pdf', size: '3.2 MB', uploaded_at: '2024-12-08' },
    ],
  },
  {
    name: 'Netflix Content Management',
    status: 'TBC',
    due_date: '2025-08-01',
    budget: 4100000,
    domain: 'Technology',
    client_name: 'Netflix',
    classification: 'A',
    description: 'Content management and asset tracking system for global streaming operations.',
    documents: [],
  },
  {
    name: 'Lloyds Banking Mobile App',
    status: 'In Progress',
    due_date: '2025-02-10',
    budget: 1500000,
    domain: 'Fintech',
    client_name: 'Lloyds Banking',
    classification: 'B',
    description: 'Mobile banking application with enhanced security and user experience.',
    documents: [
      { name: 'Mobile_App_Specs.pdf', size: '2.3 MB', uploaded_at: '2024-11-22' },
    ],
  },
  {
    name: 'Aldi Inventory Management',
    status: 'Won',
    due_date: '2025-01-10',
    budget: 380000,
    domain: 'Retail',
    client_name: 'Aldi',
    classification: 'C',
    description: 'Automated inventory management system for UK warehouse operations.',
    documents: [
      { name: 'Inventory_Specs.pdf', size: '1.6 MB', uploaded_at: '2024-11-28' },
    ],
  },
  {
    name: 'Imperial College Data Platform',
    status: 'New',
    due_date: '2025-04-15',
    budget: 520000,
    domain: 'Education',
    client_name: 'Imperial College',
    classification: 'B',
    description: 'Research data management platform for scientific collaboration.',
    documents: [],
  },
  {
    name: 'Department of Health NHS App',
    status: 'In Progress',
    due_date: '2025-05-30',
    budget: 2800000,
    domain: 'Government',
    client_name: 'Department of Health',
    classification: 'A',
    description: 'National health service application for appointments, prescriptions, and health records.',
    documents: [
      { name: 'NHS_App_Specs.pdf', size: '4.1 MB', uploaded_at: '2024-11-05' },
    ],
  },
  {
    name: 'Siemens Smart Factory',
    status: 'TBC',
    due_date: '2025-09-01',
    budget: 6200000,
    domain: 'Manufacturing',
    client_name: 'Siemens',
    classification: 'A',
    description: 'Smart factory automation and digital twin implementation for production facilities.',
    documents: [
      { name: 'Smart_Factory.pdf', size: '6.3 MB', uploaded_at: '2024-10-15' },
    ],
  },
  {
    name: 'Meta AI Infrastructure',
    status: 'New',
    due_date: '2025-10-15',
    budget: 12000000,
    domain: 'Technology',
    client_name: 'Meta',
    classification: 'A',
    description: 'Large-scale AI training infrastructure for generative AI models.',
    documents: [
      { name: 'AI_Infrastructure.pdf', size: '8.7 MB', uploaded_at: '2024-12-12' },
    ],
  },
];

async function seed() {
  try {
    const passwordHash = await bcrypt.hash(SUPERADMIN.password, 10);

    const userResult = await query(
      `INSERT INTO users (name, email, role, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [SUPERADMIN.name, SUPERADMIN.email, SUPERADMIN.role, passwordHash]
    );

    const superadminId = userResult.rows[0].id;
    console.log(`Seeded superadmin user ${SUPERADMIN.name} (id=${superadminId})`);

    for (const deal of MOCK_DEALS) {
      const dealResult = await query(
        `INSERT INTO deals (name, status, due_date, budget, domain, client_name, classification, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [deal.name, deal.status, deal.due_date, deal.budget, deal.domain, deal.client_name || null, deal.classification || null, deal.description || null]
      );

      if (dealResult.rows.length === 0) continue;
      const dealId = dealResult.rows[0].id;

      for (const doc of deal.documents) {
        await query(
          `INSERT INTO documents (deal_id, name, size, filename, uploaded_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [dealId, doc.name, doc.size, null, doc.uploaded_at]
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
