// Demo seed data (docs/demo-seed-plan.md). Fictional people; photos are
// Unsplash (free licence), downloaded into ./images by the seed script.
//
// Category slugs: electronics, fashion-apparel, home-furniture,
// vehicles-parts, sports-fitness, books-stationery, kids-baby, services, other.

export type Slug =
   | 'electronics'
   | 'fashion-apparel'
   | 'home-furniture'
   | 'vehicles-parts'
   | 'sports-fitness'
   | 'books-stationery'
   | 'kids-baby'
   | 'services'
   | 'other';

export interface Listing {
   key: string;
   title: string;
   description: string;
   category: Slug;
   condition: 'new' | 'good' | 'fair' | 'poor';
   /** USD, the owner's declared value. */
   value: number;
   /** Up to 3, in rank order. */
   wants: [Slug, Slug, Slug];
   /** File in ./images. */
   photo: string;
   /** Unsplash photo id (download if the file is missing). */
   unsplash: string;
   isService?: boolean;
}

export interface Person {
   key: string;
   firstName: string;
   lastName: string;
   location: string;
   bio: string;
   /** Names searched on Qloo for the taste profile (exact name preferred,
    *  else the top result); the type comes from INTEREST_TYPES, else brand. */
   interests: string[];
   listings: Listing[];
}

/** Interests that are not brands (searched under this Qloo type). */
export const INTEREST_TYPES: Record<string, 'artist' | 'movie'> = {
   'Burna Boy': 'artist',
   Wizkid: 'artist',
   Beyoncé: 'artist',
   Davido: 'artist',
   Rihanna: 'artist',
   'Tiwa Savage': 'artist',
   'Black Panther': 'movie',
};

const E: Slug = 'electronics';
const F: Slug = 'fashion-apparel';
const H: Slug = 'home-furniture';
const V: Slug = 'vehicles-parts';
const S: Slug = 'sports-fitness';
const B: Slug = 'books-stationery';
const K: Slug = 'kids-baby';
const SV: Slug = 'services';
const O: Slug = 'other';

/** The three judge accounts share this setup (judge1–3@example.com). */
export const JUDGE = {
   firstName: 'Demo',
   location: 'Lagos, Nigeria',
   bio: 'Demo account for the Qloo hackathon judges. Try Home, People like you and Draft an offer.',
   interests: ['Apple', 'Nike', 'Adidas', 'Burna Boy', 'Black Panther', 'PlayStation'],
   listings: [
      {
         key: 'iphone',
         title: 'iPhone 12 128GB',
         description: 'Unlocked iPhone 12, 128GB, battery health 86%. Small scratch on the back, screen is perfect. Comes with case and cable.',
         category: E,
         condition: 'good',
         value: 330,
         wants: [F, S, H],
         photo: 'judge-iphone.jpg',
         unsplash: '7mMvHZePkT8',
      },
      {
         key: 'canon',
         title: 'Canon EOS 2000D camera',
         description: 'Canon EOS 2000D DSLR with 18–55mm kit lens, two batteries and a 32GB card. Low shutter count, works perfectly.',
         category: E,
         condition: 'good',
         value: 280,
         wants: [E, O, B],
         photo: 'judge-canon.jpg',
         unsplash: 'gGgoDJRD2WM',
      },
      {
         key: 'ultraboost',
         title: 'Adidas Ultraboost sneakers (UK 9)',
         description: 'Black Adidas Ultraboost, size UK 9 / EU 43. Worn a handful of times, original box.',
         category: F,
         condition: 'good',
         value: 95,
         wants: [E, S, F],
         photo: 'judge-adidas.jpg',
         unsplash: '46t8J6BxKM0',
      },
      {
         key: 'jbl-pulse',
         title: 'JBL Pulse 4 speaker',
         description: 'JBL Pulse 4 Bluetooth speaker with the light show. Loud, waterproof, about 12 hours of battery.',
         category: E,
         condition: 'good',
         value: 120,
         wants: [E, F, O],
         photo: 'judge-jbl-pulse.jpg',
         unsplash: 'zxvnrxl5OXc',
      },
   ] as Listing[],
};

/** The judges' listing that receives the waiting offer (in Inbox). */
export const JUDGE_OFFER_TARGET = 'jbl-pulse';

export const TRADERS: Person[] = [
   {
      key: 'ada',
      firstName: 'Ada',
      lastName: 'Okafor',
      location: 'Lekki, Lagos',
      bio: 'Sneakers, gadgets and good music. Happy to swap.',
      interests: ['Nike', 'Adidas', 'Wizkid', 'Burna Boy', 'Samsung'],
      listings: [
         { key: 'airmax', title: 'Nike Air Max 90 (UK 7)', description: 'Nike Air Max 90 in white and red, UK 7. Worn twice, clean soles.', category: F, condition: 'good', value: 85, wants: [E, S, F], photo: 'ada-nike-airmax.jpg', unsplash: 'J2-wAQDckus' },
         { key: 's21', title: 'Samsung Galaxy S21 128GB', description: 'Samsung Galaxy S21, 128GB, unlocked. Screen protector since day one, no cracks.', category: E, condition: 'good', value: 210, wants: [F, E, K], photo: 'ada-samsung-s21.jpg', unsplash: 'V-iFRXuuBeQ' },
         { key: 'jbl-flip', title: 'JBL Flip 5 speaker', description: 'JBL Flip 5 in black. Great bass, waterproof, charger included.', category: E, condition: 'good', value: 70, wants: [E, F, O], photo: 'ada-jbl.jpg', unsplash: 'g5Y5kjOwGwQ' },
         { key: 'puma-bag', title: 'Puma backpack', description: 'Black Puma backpack with laptop sleeve. Barely used.', category: F, condition: 'new', value: 35, wants: [E, B, S], photo: 'ada-puma-backpack.jpg', unsplash: '_H0fjILH5Vw' },
         { key: 'fisher-price', title: 'Fisher-Price learning toys set', description: 'Box of Fisher-Price learning toys: shapes, stacking cups and a train. All pieces there.', category: K, condition: 'good', value: 40, wants: [K, H, E], photo: 'ada-fisherprice.jpg', unsplash: 'gDiRwIYAMA8' },
      ],
   },
   {
      key: 'tunde',
      firstName: 'Tunde',
      lastName: 'Bakare',
      location: 'Yaba, Lagos',
      bio: 'Gamer and weekend footballer. Looking for fair swaps.',
      interests: ['PlayStation', 'Sony', 'Adidas', 'Burna Boy', 'Arsenal F.C.'],
      listings: [
         { key: 'ps5', title: 'PlayStation 5 + DualSense controller', description: 'PS5 disc edition with one DualSense controller and all cables. Runs quietly.', category: E, condition: 'good', value: 380, wants: [E, S, F], photo: 'tunde-ps5.jpg', unsplash: 'NVD_32BBZFE' },
         { key: 'sony-xm4', title: 'Sony WH-1000XM4 headphones', description: 'Sony WH-1000XM4 noise-cancelling headphones, black, with case.', category: E, condition: 'good', value: 170, wants: [E, F, O], photo: 'tunde-sony-headphones.jpg', unsplash: 'lUMj2Zv5HUE' },
         { key: 'predator', title: 'Adidas Predator football boots (UK 10)', description: 'Adidas Predator firm-ground boots, UK 10. Used for one season.', category: S, condition: 'fair', value: 60, wants: [E, F, S], photo: 'tunde-adidas-boots.jpg', unsplash: '_AOL4_fDQ3M' },
         { key: 'spalding', title: 'Spalding Legacy basketball', description: 'Spalding indoor/outdoor basketball, size 7. Good grip.', category: S, condition: 'good', value: 25, wants: [S, E, F], photo: 'tunde-spalding.jpg', unsplash: 'IBAv9uZmANg' },
         { key: 'hp', title: 'HP Pavilion laptop (i5, 8GB)', description: 'HP Pavilion 14", Core i5, 8GB RAM, 256GB SSD. Good for school and office work.', category: E, condition: 'good', value: 300, wants: [E, B, O], photo: 'tunde-hp-laptop.jpg', unsplash: 'Gi3iUJ1FwxI' },
      ],
   },
   {
      key: 'chiamaka',
      firstName: 'Chiamaka',
      lastName: 'Eze',
      location: 'London, UK',
      bio: 'Designer by day, reader by night. Swapping what I no longer use.',
      interests: ['Apple', 'Zara', 'IKEA', 'Beyoncé'],
      listings: [
         { key: 'macbook', title: 'MacBook Air M1 (8GB, 256GB)', description: 'MacBook Air M1 in silver, 8GB / 256GB. Battery cycle count under 200.', category: E, condition: 'good', value: 520, wants: [E, F, H], photo: 'chiamaka-macbook.jpg', unsplash: 'UkpTGYox6RM' },
         { key: 'levis-jacket', title: "Levi's trucker denim jacket (M)", description: "Classic Levi's trucker jacket, size M, mid wash.", category: F, condition: 'good', value: 55, wants: [E, F, O], photo: 'chiamaka-levis-jacket.jpg', unsplash: 'QRN47la37gw' },
         { key: 'ikea-lamp', title: 'IKEA desk lamp', description: 'Grey IKEA balanced-arm desk lamp. Adjustable, bulb included.', category: H, condition: 'good', value: 25, wants: [H, E, B], photo: 'chiamaka-ikea-lamp.jpg', unsplash: '3A4XZUopCJA' },
         { key: 'casio', title: 'Casio vintage digital watch', description: 'Casio A158 vintage digital watch, silver strap, new battery.', category: F, condition: 'good', value: 30, wants: [E, F, S], photo: 'chiamaka-casio.jpg', unsplash: 'dB3pkARCxHI' },
         { key: 'kindle', title: 'Kindle Paperwhite (10th gen)', description: 'Kindle Paperwhite, 8GB, waterproof, with a cover.', category: B, condition: 'good', value: 70, wants: [B, E, K], photo: 'chiamaka-kindle.jpg', unsplash: 'Nk2MhI826MI' },
      ],
   },
   {
      key: 'emeka',
      firstName: 'Emeka',
      lastName: 'Nwosu',
      location: 'Port Harcourt, Nigeria',
      bio: 'Car parts and tools. I fix things and swap what I do not need.',
      interests: ['Toyota', 'Michelin', 'Samsung', 'Manchester United', 'Davido'],
      listings: [
         { key: 'toyota-wheels', title: 'Toyota alloy wheels (set of 4, 16")', description: 'Original Toyota 16" alloy wheels, set of four, no cracks or bends.', category: V, condition: 'good', value: 260, wants: [V, E, O], photo: 'emeka-toyota-wheels.jpg', unsplash: '6hgJSR2JX78' },
         { key: 'michelin', title: 'Michelin tyres 205/55 R16 (set of 4)', description: 'Michelin Primacy tyres, 205/55 R16, about 70% tread left.', category: V, condition: 'fair', value: 180, wants: [V, E, SV], photo: 'emeka-michelin.jpg', unsplash: '-gqb3xbGa5Y' },
         { key: 'dewalt', title: 'DeWalt 20V cordless drill', description: 'DeWalt 20V drill/driver with two batteries and charger.', category: V, condition: 'good', value: 110, wants: [E, V, H], photo: 'emeka-dewalt.jpg', unsplash: 'QvEXI1xquRY' },
         { key: 'samsung-tv', title: 'Samsung 43" smart TV', description: 'Samsung 43" 4K smart TV with remote and stand. Netflix and YouTube built in.', category: E, condition: 'good', value: 240, wants: [E, H, V], photo: 'emeka-samsung-tv.jpg', unsplash: '2RyHepsRFqE' },
         { key: 'anker', title: 'Anker 20,000mAh power bank', description: 'Anker PowerCore 20,000mAh, charges a phone 4–5 times.', category: E, condition: 'good', value: 35, wants: [E, F, O], photo: 'emeka-anker.jpg', unsplash: 'APdfyW0Aq-E' },
      ],
   },
   {
      key: 'zainab',
      firstName: 'Zainab',
      lastName: 'Mensah',
      location: 'Accra, Ghana',
      bio: 'Runner, tech lover, tidy-upper. Open to swaps across Accra.',
      interests: ['Apple', 'Nike', 'Michael Kors', 'Rihanna', 'LEGO'],
      listings: [
         { key: 'thinkpad', title: 'Lenovo ThinkPad T14 (i7, 16GB)', description: 'Lenovo ThinkPad T14, Core i7, 16GB RAM, 512GB SSD. Great keyboard.', category: E, condition: 'good', value: 450, wants: [E, F, O], photo: 'zainab-thinkpad.jpg', unsplash: 'EOB6SlufEFc' },
         { key: 'mk-bag', title: 'Michael Kors leather tote', description: 'Brown Michael Kors woven leather tote. Used lightly, no marks.', category: F, condition: 'good', value: 120, wants: [E, F, H], photo: 'zainab-mk-handbag.jpg', unsplash: 'tcVH_BwHtrc' },
         { key: 'apple-watch', title: 'Apple Watch Series 6 (44mm)', description: 'Apple Watch Series 6, 44mm, space grey, sport band. Battery 88%.', category: E, condition: 'good', value: 160, wants: [E, S, F], photo: 'zainab-apple-watch.jpg', unsplash: 'hbTKIbuMmBI' },
         { key: 'pegasus', title: 'Nike Pegasus running shoes (UK 6)', description: 'Nike Pegasus, UK 6, neon green. Under 50 km on them.', category: S, condition: 'good', value: 70, wants: [S, E, F], photo: 'zainab-nike-pegasus.jpg', unsplash: 'kP6knT7tjn4' },
         { key: 'lego', title: 'LEGO Classic bricks box (1,500 pieces)', description: 'Big LEGO Classic box, about 1,500 bricks, sorted and clean.', category: K, condition: 'good', value: 45, wants: [K, E, B], photo: 'zainab-lego.jpg', unsplash: 'kn-UmDZQDjM' },
      ],
   },
   {
      key: 'daniel',
      firstName: 'Daniel',
      lastName: 'Kim',
      location: 'Toronto, Canada',
      bio: 'Musician and home cook. I also repair phones.',
      interests: ['Yamaha', 'Philips', 'Wizkid', 'Reebok'],
      listings: [
         { key: 'tecno', title: 'Tecno Camon 20 (256GB)', description: 'Tecno Camon 20, 256GB, dual SIM. Great camera, minor wear on the frame.', category: E, condition: 'good', value: 140, wants: [E, F, SV], photo: 'kunle-tecno.jpg', unsplash: 'w33-zg-dNL4' },
         { key: 'yamaha', title: 'Yamaha PSR keyboard (61 keys)', description: 'Yamaha PSR-series keyboard, 61 keys, stand and power adapter included.', category: O, condition: 'good', value: 150, wants: [E, O, B], photo: 'kunle-yamaha.jpg', unsplash: '70vI3A82S0E' },
         { key: 'reebok', title: 'Reebok hex dumbbells (2 × 10kg)', description: 'Pair of Reebok 10kg hex dumbbells. Rubber coated, no rust.', category: S, condition: 'good', value: 50, wants: [S, E, H], photo: 'kunle-reebok.jpg', unsplash: 'H-qxKCedhcc' },
         { key: 'novels', title: 'Novels bundle: Achebe & Adichie (6 books)', description: 'Six paperbacks: Things Fall Apart, Arrow of God, Half of a Yellow Sun, Americanah and more.', category: B, condition: 'good', value: 30, wants: [B, E, F], photo: 'kunle-novels.jpg', unsplash: 'RCQ3OFg1hQA' },
         { key: 'airfryer', title: 'Philips air fryer (4.1L)', description: 'Philips Essential air fryer, 4.1L. Cleaned, works perfectly.', category: H, condition: 'good', value: 75, wants: [H, E, K], photo: 'kunle-philips-airfryer.jpg', unsplash: 'tdUOpMLDPGo' },
         { key: 'phone-repair', title: 'Phone screen repair (any model)', description: 'I replace phone screens and batteries. Swap me something and I will fix your phone.', category: SV, condition: 'new', value: 40, wants: [E, SV, O], photo: 'kunle-phone-repair.jpg', unsplash: 'tlJcIAfVgxw', isService: true },
      ],
   },
   {
      key: 'amina',
      firstName: 'Amina',
      lastName: 'Wanjiru',
      location: 'Nairobi, Kenya',
      bio: 'New mum and freelance designer. Swapping baby gear and gadgets.',
      interests: ['Apple', "Levi's", 'Samsonite', 'Tiwa Savage', 'Black Panther'],
      listings: [
         { key: 'ipad', title: 'iPad 9th generation (64GB)', description: 'iPad 9th gen, 64GB, Wi-Fi, space grey. Screen protector and case.', category: E, condition: 'good', value: 200, wants: [E, F, B], photo: 'ifeoma-ipad.jpg', unsplash: 'RVHtHpedipQ' },
         { key: 'levis-jeans', title: "Levi's 501 jeans (2 pairs, W30)", description: "Two pairs of Levi's 501, W30 L32, light and mid wash.", category: F, condition: 'good', value: 45, wants: [F, E, S], photo: 'ifeoma-levis-jeans.jpg', unsplash: 'aWLTXw6kbDw' },
         { key: 'samsonite', title: 'Samsonite cabin suitcase', description: 'Blue Samsonite hard-shell cabin case, 4 wheels, TSA lock.', category: O, condition: 'good', value: 90, wants: [E, O, F], photo: 'ifeoma-samsonite.jpg', unsplash: '166umbWL6Ec' },
         { key: 'chicco', title: 'Chicco stroller', description: 'Chicco lightweight stroller, folds flat, rain cover included.', category: K, condition: 'good', value: 110, wants: [K, E, H], photo: 'ifeoma-chicco.jpg', unsplash: 'VwcQugHISd0' },
         { key: 'design', title: 'Logo & flyer design', description: 'I will design a logo and two flyers for your business. Three revisions.', category: SV, condition: 'new', value: 60, wants: [E, SV, F], photo: 'ifeoma-design.jpg', unsplash: 'BM3U_D2lygo', isService: true },
      ],
   },
];

/** Items that only exist in past trades (status traded / in_trade). */
export interface HistoryItem {
   owner: string;
   title: string;
   category: Slug;
   value: number;
   photo: string;
}

export interface HistoryTrade {
   proposer: string;
   receiver: string;
   proposerItem: HistoryItem;
   receiverItem: HistoryItem;
   topUp?: number;
   status: 'completed' | 'accepted';
   daysAgo: number;
   /** [proposer → receiver score, receiver → proposer score] (completed only). */
   ratings?: [number, number];
   reviews?: [string, string];
   messages?: [string, string][]; // [sender key, body]
}

export const HISTORY: HistoryTrade[] = [
   {
      proposer: 'ada', receiver: 'tunde', status: 'completed', daysAgo: 21,
      proposerItem: { owner: 'ada', title: 'Nike Air Force 1 (UK 8)', category: F, value: 70, photo: 'ada-nike-airmax.jpg' },
      receiverItem: { owner: 'tunde', title: 'Xbox wireless controller', category: E, value: 45, photo: 'tunde-ps5.jpg' },
      ratings: [5, 4], reviews: ['Smooth swap, controller was exactly as described.', 'Good trader, quick to reply.'],
   },
   {
      proposer: 'chiamaka', receiver: 'zainab', status: 'completed', daysAgo: 14,
      proposerItem: { owner: 'chiamaka', title: 'Zara wool blazer (S)', category: F, value: 60, photo: 'chiamaka-levis-jacket.jpg' },
      receiverItem: { owner: 'zainab', title: 'Kindle Oasis', category: B, value: 90, photo: 'chiamaka-kindle.jpg' },
      topUp: 30, ratings: [5, 5], reviews: ['Lovely to deal with, would swap again.', 'Blazer is perfect, thank you!'],
   },
   {
      proposer: 'emeka', receiver: 'daniel', status: 'completed', daysAgo: 9,
      proposerItem: { owner: 'emeka', title: 'Bosch jigsaw', category: V, value: 55, photo: 'emeka-dewalt.jpg' },
      receiverItem: { owner: 'daniel', title: 'Samsung Galaxy Buds Live', category: E, value: 65, photo: 'ada-jbl.jpg' },
      topUp: 10, ratings: [4, 5], reviews: ['Buds work great.', 'Fair trade and honest description.'],
   },
   {
      proposer: 'amina', receiver: 'ada', status: 'completed', daysAgo: 5,
      proposerItem: { owner: 'amina', title: 'Polaroid Now camera', category: E, value: 80, photo: 'judge-canon.jpg' },
      receiverItem: { owner: 'ada', title: 'Ray-Ban Wayfarer sunglasses', category: F, value: 85, photo: 'zainab-mk-handbag.jpg' },
      ratings: [5, 4], reviews: ['Exactly as pictured, thanks Ada!', 'Camera works well.'],
   },
   {
      proposer: 'tunde', receiver: 'emeka', status: 'accepted', daysAgo: 1,
      proposerItem: { owner: 'tunde', title: 'Nintendo Switch Lite', category: E, value: 150, photo: 'tunde-ps5.jpg' },
      receiverItem: { owner: 'emeka', title: 'Garmin Forerunner 55 watch', category: S, value: 140, photo: 'zainab-apple-watch.jpg' },
      messages: [
         ['tunde', 'Deal! When are you free to meet?'],
         ['emeka', 'I am in Lagos on Saturday. Ikeja City Mall in the afternoon?'],
         ['tunde', 'Perfect, 3pm at the food court.'],
         ['emeka', 'See you then. I will bring the charger too.'],
      ],
   },
];

/** The offer waiting for each judge (Inbox → Offers, "Your turn"). */
export const JUDGE_OFFER = {
   from: 'ada',
   item: { owner: 'ada', title: 'Samsung Galaxy Buds2', category: E as Slug, value: 85, photo: 'ada-samsung-s21.jpg' },
   topUp: 20,
   message: 'Hi! Would you swap your JBL Pulse 4 for my Galaxy Buds2? I can add $20 to balance it.',
};
