import 'dotenv/config';
import { db } from '../src/config/db.config';

const CATEGORIES = [
   {
      name: 'Electronics',
      slug: 'electronics',
      icon: 'device',
   },
   {
      name: 'Fashion & Apparel',
      slug: 'fashion-apparel',
      icon: 'shirt',
   },
   {
      name: 'Home & Furniture',
      slug: 'home-furniture',
      icon: 'sofa',
   },
   {
      name: 'Books & Stationery',
      slug: 'books-stationery',
      icon: 'book',
   },
   {
      name: 'Phones & Tablets',
      slug: 'phones-tablets',
      icon: 'phone',
   },
   {
      name: 'Vehicles & Parts',
      slug: 'vehicles-parts',
      icon: 'car',
   },
   {
      name: 'Sports & Fitness',
      slug: 'sports-fitness',
      icon: 'dumbbell',
   },
   {
      name: 'Beauty & Personal Care',
      slug: 'beauty-personal-care',
      icon: 'sparkles',
   },
   {
      name: 'Kids & Baby',
      slug: 'kids-baby',
      icon: 'baby',
   },
   {
      name: 'Appliances',
      slug: 'appliances',
      icon: 'washing-machine',
   },
   {
      name: 'Tools & Equipment',
      slug: 'tools-equipment',
      icon: 'wrench',
   },
   {
      name: 'Services',
      slug: 'services',
      icon: 'handshake',
   },
   {
      name: 'Food & Groceries',
      slug: 'food-groceries',
      icon: 'shopping-basket',
   },
   {
      name: 'Other',
      slug: 'other',
      icon: 'grid',
   },
];

async function main() {
   for (const category of CATEGORIES) {
      await db.category.upsert({
         where: { slug: category.slug },
         update: {},
         create: {
            ...category,
            isActive: true,
         },
      });
   }
   console.log(
      `Seeded ${CATEGORIES.length} categories.`,
   );
}

main()
   .catch((err) => {
      console.error(
         'Seed failed:',
         err,
      );
      process.exit(1);
   })
   .finally(() => db.$disconnect());
