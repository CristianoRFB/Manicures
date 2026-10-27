import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.GCLOUD_PROJECT ||= 'manicure-demo';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

initializeApp({ projectId: process.env.GCLOUD_PROJECT, credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

async function ensureUser(uid, email, password, displayName) {
  try { return await auth.getUser(uid); }
  catch { return auth.createUser({ uid, email, password, displayName, emailVerified: true }); }
}

const platform = await ensureUser('platform-demo', 'platform@example.test', 'Demo123!Demo123!', 'Platform Owner Demo');
const ownerA = await ensureUser('owner-a', 'owner-a@example.test', 'Demo123!Demo123!', 'Owner A');
const ownerB = await ensureUser('owner-b', 'owner-b@example.test', 'Demo123!Demo123!', 'Owner B');

const tenants = [
  { id:'tenant-demo-a', slug:'demo', name:'Studio Demo Nails A — DEMONSTRAÇÃO', status:'active', kind:'demo', branding:{primary:'#5b2b73',accent:'#d49adf',background:'#fff9ff',logoText:'DA'}, contact:{}, businessSettings:{timezone:'America/Sao_Paulo',bookingHorizonDays:45,minLeadMinutes:60} },
  { id:'tenant-demo-b', slug:'demo-b', name:'Ateliê Demo B — DEMONSTRAÇÃO', status:'active', kind:'demo', branding:{primary:'#24476b',accent:'#90c2e7',background:'#f6fbff',logoText:'DB'}, contact:{}, businessSettings:{timezone:'America/Sao_Paulo',bookingHorizonDays:30,minLeadMinutes:90} },
];
for (const tenant of tenants) {
  await db.doc(`tenants/${tenant.id}`).set(tenant);
  await db.doc(`tenantSlugs/${tenant.slug}`).set({ tenantId: tenant.id, status: tenant.status });
}
await db.doc(`tenants/tenant-demo-a/services/manicure-classica`).set({ tenantId:'tenant-demo-a', name:'Manicure clássica', description:'Cuidado das unhas e esmaltação.', priceCents:4000, durationMin:60, active:true });
await db.doc(`tenants/tenant-demo-a/services/esmaltacao-gel`).set({ tenantId:'tenant-demo-a', name:'Esmaltação em gel', description:'Preparação e esmaltação em gel.', priceCents:7000, durationMin:90, active:true });
await db.doc(`tenants/tenant-demo-a/professionals/pro-a1`).set({ tenantId:'tenant-demo-a', name:'Profissional Demo A1', active:true, serviceIds:['manicure-classica','esmaltacao-gel'] });
await db.doc(`tenants/tenant-demo-b/services/pedicure-b`).set({ tenantId:'tenant-demo-b', name:'Pedicure Demo B', description:'Serviço isolado do Tenant B.', priceCents:5500, durationMin:60, active:true });
await db.doc(`tenants/tenant-demo-b/professionals/pro-b1`).set({ tenantId:'tenant-demo-b', name:'Profissional Demo B1', active:true, serviceIds:['pedicure-b'] });
await db.doc(`platformUsers/${platform.uid}`).set({ role:'platform_owner', status:'active' });
await db.doc(`memberships/tenant-demo-a_${ownerA.uid}`).set({ userId:ownerA.uid, tenantId:'tenant-demo-a', role:'tenant_owner', status:'active' });
await db.doc(`memberships/tenant-demo-b_${ownerB.uid}`).set({ userId:ownerB.uid, tenantId:'tenant-demo-b', role:'tenant_owner', status:'active' });
console.log('EMULATOR_SEED_PASS');
