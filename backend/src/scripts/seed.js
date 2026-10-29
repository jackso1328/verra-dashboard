const mongoose = require('mongoose');
const dns = require('dns');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const InventoryMovement = require('../models/InventoryMovement');
const Expense = require('../models/Expense');
const Review = require('../models/Review');

// Ensure reliable SRV DNS resolution on Windows environments
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const seedDatabase = async () => {
  try {
    if (!env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set in environment.');
      process.exit(1);
    }

    console.log('🌿 [VÉRRA Seeder] Connecting to MongoDB Atlas...');
    const conn = await mongoose.connect(env.MONGODB_URI, {
      dbName: env.DB_NAME,
      serverSelectionTimeoutMS: 10000
    });

    const activeDb = conn.connection.db;
    const dbName = activeDb.databaseName;
    console.log(`✨ [VÉRRA Seeder] Connected to database: "${dbName}"`);

    // Verify it targets verra_bi
    if (dbName !== 'verra_bi') {
      console.error(`❌ Security Check Failed: Expected database "verra_bi", but connected to "${dbName}". Aborting.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // Step 2: Safely reset ONLY the 6 application collections
    console.log('🧹 [VÉRRA Seeder] Safely clearing application collections in verra_bi...');
    await Promise.all([
      Product.deleteMany({}),
      User.deleteMany({}),
      Order.deleteMany({}),
      InventoryMovement.deleteMany({}),
      Expense.deleteMany({}),
      Review.deleteMany({})
    ]);

    // Step 3A: Seed Administrator and Diverse Fictional Patrons for RFM Analytics
    console.log('👤 [VÉRRA Seeder] Creating administrator and customer accounts...');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('VerraAdmin2026!', salt);
    const customerPasswordHash = await bcrypt.hash('Ritual2026!', salt);

    const adminUser = await User.create({
      name: 'Eleanor Vance',
      email: 'admin@verra.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      phone: '+91 98200 12345',
      address: {
        street: '88 Heritage Boulevard',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India'
      }
    });

    // 8 diverse fictional patrons across Indian metros to allow rich RFM clustering
    const customers = await User.insertMany([
      {
        name: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        passwordHash: customerPasswordHash,
        role: 'customer',
        phone: '+91 98111 22334',
        address: { street: '14 Gulmohar Lane', city: 'Mumbai', state: 'Maharashtra', postalCode: '400050', country: 'India' }
      },
      {
        name: 'Ananya Iyer',
        email: 'ananya.iyer@example.com',
        passwordHash: customerPasswordHash,
        role: 'customer',
        phone: '+91 98400 33445',
        address: { street: '27 Palm Grove Road', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600028', country: 'India' }
      },
      {
        name: 'Aarav Mehta',
        email: 'aarav.mehta@example.com',
        passwordHash: customerPasswordHash,
        role: 'customer',
        phone: '+91 98765 44321',
        address: { street: '52 Vasant Kunj', city: 'New Delhi', state: 'Delhi', postalCode: '110070', country: 'India' }
      },
      {
        name: 'Tara Mukherjee',
        email: 'tara.mukherjee@example.com',
        passwordHash: customerPasswordHash,
        role: 'customer',
        phone: '+91 98300 55667',
        address: { street: '9 Ballygunge Place', city: 'Kolkata', state: 'West Bengal', postalCode: '700019', country: 'India' }
      },
      {
        name: 'Rohan Deshmukh',
        email: 'rohan.deshmukh@example.com',
        passwordHash: customerPasswordHash,
        role: 'customer',
        phone: '+91 98900 66778',
        address: { street: '18 Koregaon Park', city: 'Pune', state: 'Maharashtra', postalCode: '411001', country: 'India' }
      },
      {
        name: 'Kavita Reddy',
        email: 'kavita.reddy@example.com',
        passwordHash: customerPasswordHash,
        role: 'customer',
        phone: '+91 98490 77889',
        address: { street: '4 Jubilee Hills', city: 'Hyderabad', state: 'Telangana', postalCode: '500033', country: 'India' }
      },
      {
        name: 'Siddharth Verma',
        email: 'siddharth.verma@example.com',
        passwordHash: customerPasswordHash,
        role: 'customer',
        phone: '+91 98100 88990',
        address: { street: '72 Civil Lines', city: 'Jaipur', state: 'Rajasthan', postalCode: '302006', country: 'India' }
      },
      {
        name: 'Meera Nambiar',
        email: 'meera.nambiar@example.com',
        passwordHash: customerPasswordHash,
        role: 'customer',
        phone: '+91 98470 99001',
        address: { street: '31 Marine Drive', city: 'Kochi', state: 'Kerala', postalCode: '682011', country: 'India' }
      }
    ]);

    console.log(`✅ Created 1 Admin and ${customers.length} Customer accounts.`);

    // Step 3B: Seed the 4 Standardized Products with Initial Stock Targets
    console.log('🧴 [VÉRRA Seeder] Inserting product catalog...');
    const initialProductConfigs = [
      {
        name: 'Root Revival Oil',
        sku: 'VR-RRO-050',
        category: 'Scalp Rituals',
        sizeMl: 50,
        price: 1299,
        unitCost: 380,
        description: 'An invigorating botanical scalp treatment infused with steam-distilled Mediterranean rosemary, cold-pressed jojoba, and peppermint leaf to nourish dormant follicles and promote hair vitality.',
        keyIngredients: ['Rosemary Leaf Extract', 'Cold-Pressed Jojoba', 'Peppermint Essential Oil', 'Pumpkin Seed Oil'],
        ritualDirections: 'Dispense 1-2 full pipettes onto fingertips. Part hair and massage deeply into dry scalp using circular motions. Leave on for 45 minutes or overnight before shampooing.',
        image: 'assets/images/product_root_revival.jpg',
        reorderThreshold: 25,
        isActive: true,
        featured: true
      },
      {
        name: 'Silk Elixir',
        sku: 'VR-SEL-050',
        category: 'Smoothing Rituals',
        sizeMl: 50,
        price: 1599,
        unitCost: 460,
        description: 'A weightless botanical glossing nectar crafted from Moroccan cold-pressed argan, camellia seed, and evening primrose to banish frizz, restore mirror-like shine, and shield hair from heat styling.',
        keyIngredients: ['Virgin Moroccan Argan Oil', 'Camellia Japonica Seed', 'Evening Primrose Oil', 'Vitamin E Acetate'],
        ritualDirections: 'Warm 2-3 drops between palms. Smooth through damp mid-lengths to ends before blow-drying, or apply as a finishing touch to dry hair for glass-like radiance.',
        image: 'assets/images/product_silk_elixir.jpg',
        reorderThreshold: 20,
        isActive: true,
        featured: true
      },
      {
        name: 'Botanical Nourish Oil',
        sku: 'VR-BNO-100',
        category: 'Nourishing Rituals',
        sizeMl: 100,
        price: 1099,
        unitCost: 320,
        description: 'An ancient restorative blend uniting sun-dried amla berries and false daisy (bhringraj) with rich sesame and sweet almond oils to fortify hair strands, soften brittle texture, and preserve natural luster.',
        keyIngredients: ['Organic Amla Berry Extract', 'Eclipta Alba (Bhringraj)', 'Cold-Pressed Black Sesame', 'Sweet Almond Oil'],
        ritualDirections: 'Warm 1-2 tablespoons in a bowl. Thoroughly coat hair strands from roots to tips. Wrap in a warm towel for 30 minutes for an intensive botanical replenishment ritual.',
        image: 'assets/images/product_botanical_nourish.jpg',
        reorderThreshold: 30,
        isActive: true,
        featured: true
      },
      {
        name: 'Coco Silk Treatment',
        sku: 'VR-CST-100',
        category: 'Pre-Wash Rituals',
        sizeMl: 100,
        price: 899,
        unitCost: 240,
        description: 'A deeply conditioning pre-shampoo oil elixir made from virgin unrefined coconut, marula, and avocado oil that penetrates the hair cortex to prevent protein loss and detangle dry curls.',
        keyIngredients: ['Virgin Coconut Oil', 'Cold-Pressed Marula Oil', 'Persea Gratissima (Avocado)', 'Hibiscus Flower Infusion'],
        ritualDirections: 'Apply generously to dry hair 20 minutes prior to bathing. Detangle gently with a wide-tooth comb, then rinse with lukewarm water followed by your botanical shampoo.',
        image: 'assets/images/product_coco_silk.jpg',
        reorderThreshold: 20,
        isActive: true,
        featured: true
      }
    ];

    const products = [];
    for (const p of initialProductConfigs) {
      // Start with a provisional stock placeholder that will reconcile exactly after orders
      const prod = await Product.create({ ...p, stockQuantity: 200 });
      products.push(prod);
    }

    // Step 3C: Seed Product Reviews
    console.log('⭐ [VÉRRA Seeder] Inserting product reviews...');
    await Review.insertMany([
      {
        product: products[0]._id,
        authorName: 'Priya S.',
        rating: 5,
        headline: 'Transformative for scalp health and volume',
        comment: 'The botanical aroma of rosemary and peppermint is divine. After three weeks of the ritual, my scalp feels so revitalized and shedding has reduced noticeably.',
        isVerified: true,
        moderationStatus: 'approved'
      },
      {
        product: products[1]._id,
        authorName: 'Ananya I.',
        rating: 5,
        headline: 'Non-greasy, pure liquid silk',
        comment: 'Unlike silicone serums, Silk Elixir absorbs instantly without weighing my fine hair down. Leaves a glass-like finish that smells luxurious all day.',
        isVerified: true,
        moderationStatus: 'approved'
      },
      {
        product: products[2]._id,
        authorName: 'Tara M.',
        rating: 5,
        headline: 'Authentic Ayurvedic excellence',
        comment: 'Rich, potent, and beautifully formulated. The amla and bhringraj have brought back bounce and softness to my chemically treated hair.',
        isVerified: true,
        moderationStatus: 'approved'
      },
      {
        product: products[3]._id,
        authorName: 'Dr. Radhika K.',
        rating: 4,
        headline: 'Wonderful deep pre-wash nourishment',
        comment: 'A lovely coconut oil treatment that washes out cleanly without leaving sticky residue. Hair feels dramatically softer.',
        isVerified: true,
        moderationStatus: 'approved'
      }
    ]);

    // Step 3D: Generate 180 Synthetic Orders spanning 12 months with Realistic BI Distribution
    console.log('📦 [VÉRRA Seeder] Synthesizing 180 realistic orders across the previous 12 months...');
    const channels = ['Storefront Online', 'Storefront Online', 'Storefront Online', 'Direct Ritual Concierge', 'Instagram Shop'];
    const regions = ['South India', 'South India', 'North India', 'North India', 'West India', 'East India', 'Central India'];
    const couponOptions = [null, null, null, 'VERRA10', 'RITUAL15'];

    // Track total sold units per product to reconcile stock and inventory movements exactly
    const unitsSoldCounter = {
      [products[0]._id]: 0,
      [products[1]._id]: 0,
      [products[2]._id]: 0,
      [products[3]._id]: 0
    };

    const unitsReturnedCounter = {
      [products[0]._id]: 0,
      [products[1]._id]: 0,
      [products[2]._id]: 0,
      [products[3]._id]: 0
    };

    const ordersToInsert = [];
    const now = new Date();
    let orderSeq = 1000;

    for (let i = 0; i < 180; i++) {
      orderSeq++;
      // Distribute evenly across 365 days with slight holiday/festive peaks (months 8-11)
      const dayOffset = Math.floor(Math.pow(i / 180, 1.25) * 365);
      const orderDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);

      // Select 1 to 3 items per order
      const itemCount = (i % 5 === 0) ? 3 : ((i % 3 === 0) ? 2 : 1);
      const prodSub = [...products].sort(() => 0.5 - Math.random()).slice(0, itemCount);

      let grossSales = 0;
      let orderCOGS = 0;
      const orderItems = [];

      prodSub.forEach(prod => {
        const qty = (i % 7 === 0) ? 2 : 1;
        const subtotal = prod.price * qty;
        const cost = prod.unitCost * qty;

        grossSales += subtotal;
        orderCOGS += cost;

        orderItems.push({
          product: prod._id,
          name: prod.name,
          sku: prod.sku,
          sizeMl: prod.sizeMl,
          quantity: qty,
          unitPrice: prod.price,
          unitCost: prod.unitCost, // Snapshot of unit cost at sale
          subtotal
        });
      });

      // Discount determination
      const coupon = couponOptions[i % couponOptions.length];
      let discountAmount = 0;
      if (coupon === 'VERRA10') discountAmount = Math.round(grossSales * 0.10);
      else if (coupon === 'RITUAL15') discountAmount = Math.round(grossSales * 0.15);

      const netSales = grossSales - discountAmount;
      const shippingFee = netSales >= 1500 ? 0 : 99;
      const taxAmount = Math.round(netSales * 0.05);
      const totalAmount = netSales + shippingFee;

      // Realistic Status distribution:
      // ~86% delivered, ~4% shipped, ~3% processing, ~4% refunded, ~3% cancelled
      let orderStatus = 'delivered';
      let paymentStatus = 'paid';

      if (i % 25 === 0) {
        orderStatus = 'refunded';
        paymentStatus = 'refunded';
      } else if (i % 35 === 0) {
        orderStatus = 'cancelled';
        paymentStatus = 'pending';
      } else if (dayOffset <= 5 && i % 4 === 0) {
        orderStatus = 'processing';
      } else if (dayOffset <= 12 && i % 5 === 0) {
        orderStatus = 'shipped';
      }

      // Assign customer (mix of repeat customers and single purchasers for RFM variance)
      // First 4 customers are frequent repeat buyers (Priya, Ananya, Aarav, Tara)
      let customer;
      if (i % 2 === 0) {
        customer = customers[i % 4]; // Highly active patrons (Champions / Loyal)
      } else {
        customer = customers[Math.floor(Math.random() * customers.length)];
      }

      const salesChannel = channels[i % channels.length];
      const region = regions[i % regions.length];
      const orderNumber = `VR-2026-${orderSeq}`;

      // Update unit counters for inventory audit trail
      if (orderStatus !== 'cancelled') {
        orderItems.forEach(it => {
          unitsSoldCounter[it.product] += it.quantity;
          if (orderStatus === 'refunded') {
            unitsReturnedCounter[it.product] += it.quantity;
          }
        });
      }

      ordersToInsert.push({
        orderNumber,
        customer: customer._id,
        customerInfo: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          street: customer.address.street,
          city: customer.address.city,
          state: customer.address.state,
          postalCode: customer.address.postalCode,
          country: 'India'
        },
        items: orderItems,
        grossSales,
        discountAmount,
        couponCode: coupon,
        shippingFee,
        taxAmount,
        totalAmount,
        totalCOGS: orderCOGS,
        paymentStatus,
        paymentMethod: 'Demonstration Luxury Gateway',
        orderStatus,
        salesChannel,
        region,
        orderDate
      });
    }

    const createdOrders = await Order.insertMany(ordersToInsert);
    console.log(`✅ Created ${createdOrders.length} synthetic orders.`);

    // Step 3E: Reconcile Inventory and Build Inventory Movements
    console.log('📊 [VÉRRA Seeder] Generating reconciled inventory movements and stock levels...');
    const inventoryMovements = [];

    // Starting production batches 12 months ago
    const startingStockConfig = {
      [products[0]._id]: 220, // Root Revival
      [products[1]._id]: 170, // Silk Elixir
      [products[2]._id]: 190, // Botanical Nourish
      [products[3]._id]: 110  // Coco Silk
    };

    // Intermediate harvest restocks 6 months ago
    const restockBatchConfig = {
      [products[0]._id]: 80,
      [products[1]._id]: 60,
      [products[2]._id]: 70,
      [products[3]._id]: 20
    };

    for (const prod of products) {
      const pId = prod._id;
      const initialBatch = startingStockConfig[pId];
      const restockBatch = restockBatchConfig[pId];

      // 1. Initial Batch
      inventoryMovements.push({
        product: pId,
        movementType: 'restock',
        quantityChange: initialBatch,
        previousStock: 0,
        newStock: initialBatch,
        reason: 'Initial botanical production harvest',
        performedBy: 'Master Blender',
        date: new Date(now.getTime() - 360 * 24 * 60 * 60 * 1000)
      });

      // 2. Mid-year Replenishment
      inventoryMovements.push({
        product: pId,
        movementType: 'restock',
        quantityChange: restockBatch,
        previousStock: initialBatch,
        newStock: initialBatch + restockBatch,
        reason: 'Q2 botanical infusion restock',
        performedBy: 'Inventory Manager',
        date: new Date(now.getTime() - 175 * 24 * 60 * 60 * 1000)
      });

      // 3. Reconciled Current Stock:
      // Final Stock = (initialBatch + restockBatch) - (sold - returned)
      const netSold = unitsSoldCounter[pId] - unitsReturnedCounter[pId];
      const finalStock = (initialBatch + restockBatch) - netSold;

      await Product.findByIdAndUpdate(pId, { stockQuantity: finalStock });
    }

    // 4. Sales movements for sample recent orders
    createdOrders.slice(0, 40).forEach(ord => {
      if (ord.orderStatus !== 'cancelled') {
        ord.items.forEach(it => {
          inventoryMovements.push({
            product: it.product,
            movementType: 'sale',
            quantityChange: -it.quantity,
            previousStock: 100,
            newStock: 100 - it.quantity,
            reason: `Customer order ${ord.orderNumber}`,
            relatedOrder: ord._id,
            performedBy: 'Order Service',
            date: ord.orderDate
          });
        });
      }
    });

    await InventoryMovement.insertMany(inventoryMovements);
    console.log(`✅ Logged ${inventoryMovements.length} inventory audit movements.`);

    // Step 3F: Monthly Operating Expenses across all 12 months for P&L
    console.log('💰 [VÉRRA Seeder] Generating 12 months of categorized operating expenses...');
    const expenseTemplates = [
      { category: 'marketing', desc: 'Editorial Social Campaigns & Search Acquisition', base: 18500, spread: 4500 },
      { category: 'packaging', desc: 'Custom Amber Glass Bottles & Travertine Packaging', base: 13000, spread: 3000 },
      { category: 'shipping_carrier', desc: 'DHL Express & BlueDart Premium Courier Subsidies', base: 8200, spread: 2200 },
      { category: 'salaries', desc: 'Ayurvedic Formulator & Customer Concierge Compensation', base: 26000, spread: 0 },
      { category: 'operational', desc: 'Laboratory Analytical Testing & Organic Certification', base: 5200, spread: 1200 },
      { category: 'utilities', desc: 'Climate-controlled Botanical Storage & Studio Overhead', base: 3800, spread: 600 }
    ];

    const expensesToInsert = [];
    for (let m = 0; m < 12; m++) {
      const expDate = new Date(now.getFullYear(), now.getMonth() - m, 15);
      expenseTemplates.forEach(tmpl => {
        const amount = tmpl.base + Math.floor(Math.random() * tmpl.spread);
        expensesToInsert.push({
          category: tmpl.category,
          amount,
          description: tmpl.desc,
          date: expDate,
          campaignOrVendor: `BATCH-M${12 - m}`,
          recordedBy: 'Financial Controller'
        });
      });
    }

    await Expense.insertMany(expensesToInsert);
    console.log(`✅ Created ${expensesToInsert.length} operating expense entries.`);

    console.log('\n🌿 ====================================================');
    console.log('✨ [VÉRRA Seeder] SEEDING COMPLETED SUCCESSFULLY!');
    console.log('🌿 ====================================================');
    console.log(`Database: verra_bi`);
    console.log(`Products:            ${products.length}`);
    console.log(`Users:               ${customers.length + 1} (1 Admin, ${customers.length} Customers)`);
    console.log(`Orders:              ${createdOrders.length}`);
    console.log(`Inventory Movements: ${inventoryMovements.length}`);
    console.log(`Operating Expenses:  ${expensesToInsert.length}`);
    console.log(`Reviews:             4`);
    console.log('🌿 ====================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeder encountered error:', err.message);
    process.exit(1);
  }
};

seedDatabase();
