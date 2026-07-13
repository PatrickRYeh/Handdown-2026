// Seed demo users + listings so the feed has content before Phase 3 (Sell).
// Idempotent: re-running updates existing demo data instead of duplicating it.
// Usage: node scripts/seed.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = {};
  const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_PASSWORD = 'handdown-demo-123';

const DEMO_USERS = [
  {
    email: 'jamie.demo@berkeley.edu',
    full_name: 'Jamie Chen',
    class_year: 2026,
    major: 'Mechanical Engineering',
    campus_region: 'Southside',
  },
  {
    email: 'sam.demo@berkeley.edu',
    full_name: 'Sam Rivera',
    class_year: 2027,
    major: 'Economics',
    campus_region: 'Northside',
  },
];

// Listings keyed by owner email. price is in dollars; converted to cents below.
const CURATED_LISTINGS = {
  'jamie.demo@berkeley.edu': [
    { title: 'IKEA desk — great condition', description: 'White MICKE desk, barely used. Perfect for a dorm. Pickup near Southside.', price: 45, condition: 'like_new', category: 'furniture', region_id: 'Southside' },
    { title: 'Mini fridge', description: 'Compact 1.7 cu ft fridge, works perfectly. Moving out, must sell.', price: 60, condition: 'good', category: 'electronics', region_id: 'Southside' },
    { title: 'Organic Chemistry textbook (Klein)', description: '3rd edition, some highlighting. Saved me in Chem 3A.', price: 30, condition: 'good', category: 'books', region_id: 'Southside' },
  ],
  'sam.demo@berkeley.edu': [
    { title: 'Desk chair — ergonomic', description: 'Adjustable height, comfy for long study sessions. Northside pickup.', price: 35, condition: 'good', category: 'furniture', region_id: 'Northside' },
    { title: 'Noise-cancelling headphones', description: 'Sony WH-1000XM4, includes case and cable. Amazing for the library.', price: 120, condition: 'like_new', category: 'electronics', region_id: 'Northside' },
    { title: 'Winter jacket (M)', description: 'North Face, warm and barely worn. Berkeley winters covered.', price: 50, condition: 'like_new', category: 'apparel', region_id: 'Northside' },
  ],
};

// Generated filler so the feed has enough rows (>40) to exercise infinite
// scroll (page size is 20). Deterministic, so re-runs produce the same set.
const FILLER_ITEMS = [
  ['Bookshelf, 5-tier', 'furniture', 25], ['Futon with frame', 'furniture', 80],
  ['Bedside lamp', 'furniture', 10], ['Full-length mirror', 'furniture', 15],
  ['Storage ottoman', 'furniture', 20], ['Folding table', 'furniture', 18],
  ['TI-84 calculator', 'electronics', 55], ['27" monitor', 'electronics', 90],
  ['Mechanical keyboard', 'electronics', 40], ['Desk fan', 'electronics', 12],
  ['Electric kettle', 'electronics', 15], ['Bluetooth speaker', 'electronics', 25],
  ['Cal hoodie (L)', 'apparel', 20], ['Rain boots (W8)', 'apparel', 15],
  ['Denim jacket (M)', 'apparel', 22], ['Running shoes (M10)', 'apparel', 30],
  ['Backpack — North Face', 'apparel', 35], ['Beanie, never worn', 'apparel', 8],
  ['CS 61A course reader', 'books', 12], ['Physics 7A textbook', 'books', 40],
  ['Econ 1 textbook bundle', 'books', 35], ['Stats 20 notes + book', 'books', 18],
  ['Spanish 1 workbook', 'books', 10], ['GRE prep set', 'books', 25],
  ['Yoga mat', 'other', 10], ['Skateboard', 'other', 45],
  ['Tennis racket', 'other', 30], ['Rice cooker', 'other', 20],
  ['String lights', 'other', 8], ['Plant + ceramic pot', 'other', 12],
  ['Area rug 5x7', 'furniture', 40], ['Clip-on desk light', 'electronics', 9],
  ['Formal blazer (S)', 'apparel', 28], ['Bio 1A lab manual', 'books', 15],
  ['Mini vacuum', 'other', 22], ['Shoe rack', 'furniture', 12],
  ['HDMI + USB-C cables', 'electronics', 10], ['Sun hat', 'apparel', 7],
  ['Poetry anthology', 'books', 9], ['Board game bundle', 'other', 25],
];
const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'used'];
const REGIONS = ['Southside', 'Northside', 'Downtown', 'Westbrae'];

function fillerListings(startIndex) {
  return FILLER_ITEMS.filter((_, i) => i % 2 === startIndex).map(
    ([title, category, price], i) => ({
      title,
      description: `${title} in solid shape — pickup on campus, message me for details.`,
      price,
      condition: CONDITIONS[i % CONDITIONS.length],
      category,
      region_id: REGIONS[i % REGIONS.length],
    }),
  );
}

const DEMO_LISTINGS = {
  'jamie.demo@berkeley.edu': [
    ...CURATED_LISTINGS['jamie.demo@berkeley.edu'],
    ...fillerListings(0),
  ],
  'sam.demo@berkeley.edu': [
    ...CURATED_LISTINGS['sam.demo@berkeley.edu'],
    ...fillerListings(1),
  ],
};

async function findUserByEmail(email) {
  // Fine for a small demo project; paginates 1000 at a time.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function upsertUser(u) {
  let user = await findUserByEmail(u.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (error) throw error;
    user = data.user;
    console.log(`  created auth user ${u.email}`);
  } else {
    console.log(`  auth user ${u.email} already exists`);
  }

  // The signup trigger created a bare profile; enrich it.
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: u.full_name,
      class_year: u.class_year,
      major: u.major,
      campus_region: u.campus_region,
      rating: 4.8,
      rating_count: 12,
    })
    .eq('uid', user.id);
  if (error) throw error;

  return user;
}

async function seedListings(email, ownerId) {
  // Clear this demo owner's listings first so re-runs don't pile up.
  await admin.from('listings').delete().eq('offering_uid', ownerId);

  for (const l of DEMO_LISTINGS[email]) {
    const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(l.title)}/600/600`;
    const { data: listing, error } = await admin
      .from('listings')
      .insert({
        offering_uid: ownerId,
        title: l.title,
        description: l.description,
        price_cents: l.price * 100,
        condition: l.condition,
        category: l.category,
        region_id: l.region_id,
        thumbnail_url: imageUrl,
        status: 'active',
      })
      .select('id')
      .single();
    if (error) throw error;

    const { error: imgErr } = await admin.from('listing_images').insert([
      { listing_id: listing.id, image_url: imageUrl, position: 0 },
      { listing_id: listing.id, image_url: `${imageUrl}?v=2`, position: 1 },
    ]);
    if (imgErr) throw imgErr;
  }
  console.log(`  seeded ${DEMO_LISTINGS[email].length} listings for ${email}`);
}

console.log('Seeding demo data…');
for (const u of DEMO_USERS) {
  const user = await upsertUser(u);
  await seedListings(u.email, user.id);
}
console.log(`\n🎉 Done. Demo login: ${DEMO_USERS[0].email} / ${DEMO_PASSWORD}`);
process.exit(0);
