/**
 * VÉRRA Store Catalog Logic
 */
import { api } from './api.js';
import { cart } from './cart.js';
import { auth } from './auth.js';

// Authoritative sample formulations matching seed.js for preview mode
const SAMPLE_PREVIEW_PRODUCTS = [
  {
    _id: "preview_rro_050",
    name: "Root Revival Oil",
    sku: "VR-RRO-050",
    category: "Scalp Rituals",
    sizeMl: 50,
    price: 1299,
    unitCost: 380,
    description: "An invigorating botanical scalp treatment infused with steam-distilled Mediterranean rosemary, cold-pressed jojoba, and peppermint leaf to nourish follicles and promote hair vitality.",
    keyIngredients: ["Rosemary Leaf Extract", "Cold-Pressed Jojoba", "Peppermint Essential Oil", "Pumpkin Seed Oil"],
    image: "assets/images/product_root_revival.jpg",
    stockQuantity: 145,
    reorderThreshold: 25,
    featured: true
  },
  {
    _id: "preview_sel_050",
    name: "Silk Elixir",
    sku: "VR-SEL-050",
    category: "Smoothing Rituals",
    sizeMl: 50,
    price: 1599,
    unitCost: 460,
    description: "A weightless botanical glossing nectar crafted from Moroccan cold-pressed argan, camellia seed, and evening primrose to banish frizz and restore mirror-like shine.",
    keyIngredients: ["Virgin Moroccan Argan Oil", "Camellia Japonica Seed", "Evening Primrose Oil", "Vitamin E Acetate"],
    image: "assets/images/product_silk_elixir.jpg",
    stockQuantity: 88,
    reorderThreshold: 20,
    featured: true
  },
  {
    _id: "preview_bno_100",
    name: "Botanical Nourish Oil",
    sku: "VR-BNO-100",
    category: "Nourishing Rituals",
    sizeMl: 100,
    price: 1099,
    unitCost: 320,
    description: "An ancient restorative blend uniting sun-dried amla berries and false daisy (bhringraj) with rich sesame and sweet almond oils to fortify hair strands.",
    keyIngredients: ["Organic Amla Berry Extract", "Eclipta Alba (Bhringraj)", "Cold-Pressed Black Sesame", "Sweet Almond Oil"],
    image: "assets/images/product_botanical_nourish.jpg",
    stockQuantity: 110,
    reorderThreshold: 30,
    featured: true
  },
  {
    _id: "preview_cst_100",
    name: "Coco Silk Treatment",
    sku: "VR-CST-100",
    category: "Pre-Wash Rituals",
    sizeMl: 100,
    price: 899,
    unitCost: 240,
    description: "A deeply conditioning pre-shampoo oil elixir made from virgin unrefined coconut, marula, and avocado oil that penetrates the hair cortex to prevent protein loss.",
    keyIngredients: ["Virgin Coconut Oil", "Cold-Pressed Marula Oil", "Persea Gratissima (Avocado)", "Hibiscus Flower Infusion"],
    image: "assets/images/product_coco_silk.jpg",
    stockQuantity: 19,
    reorderThreshold: 20,
    featured: true
  }
];

let allProducts = [];

export const initStore = async () => {
  auth.updateNavUI();
  const productGrid = document.getElementById('store-product-grid');
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  const sortSelect = document.getElementById('sort-select');
  const countIndicator = document.getElementById('product-count-indicator');

  if (!productGrid) return;

  // Check URL category query param
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category');
  if (categoryFilter && initialCategory) {
    categoryFilter.value = initialCategory;
  }

  try {
    const res = await api.get('products');
    if (res.success && res.data && res.data.length > 0) {
      allProducts = res.data;
      renderProducts(allProducts);
    } else {
      // Backend connected but database is empty / not seeded
      showPreviewBanner('Database empty. Displaying catalog formulations. Run `npm run seed` in backend to populate MongoDB Atlas.');
      allProducts = SAMPLE_PREVIEW_PRODUCTS;
      renderProducts(allProducts);
    }
  } catch (error) {
    // Backend offline or database disconnected
    showPreviewBanner('MongoDB Atlas pending connection. Showing botanical catalog in preview mode. Set MONGODB_URI in backend/.env to activate live persistence.');
    allProducts = SAMPLE_PREVIEW_PRODUCTS;
    renderProducts(allProducts);
  }

  function showPreviewBanner(msg) {
    const mainContainer = document.querySelector('main .container') || document.body;
    let banner = document.getElementById('store-preview-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'store-preview-banner';
      banner.className = 'alert alert-info';
      banner.style.marginBottom = '24px';
      banner.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <div>
          <strong>Catalog Notice:</strong> ${msg}
        </div>
      `;
      const filterToolbar = document.querySelector('main .container div[style*="background: var(--color-surface)"]') || productGrid;
      filterToolbar.parentNode.insertBefore(banner, filterToolbar);
    }
  }

  // Filter and Search Event Handlers
  const applyFilters = () => {
    let filtered = [...allProducts];

    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (term) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.description.toLowerCase().includes(term) ||
        (p.keyIngredients && p.keyIngredients.some(ing => ing.toLowerCase().includes(term)))
      );
    }

    const category = categoryFilter ? categoryFilter.value : 'all';
    if (category && category !== 'all') {
      filtered = filtered.filter(p => p.category === category);
    }

    const sort = sortSelect ? sortSelect.value : 'default';
    if (sort === 'price-low') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sort === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    renderProducts(filtered);
  };

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
  if (sortSelect) sortSelect.addEventListener('change', applyFilters);

  if (initialCategory) {
    applyFilters();
  }

  function renderProducts(products) {
    if (countIndicator) {
      countIndicator.textContent = `Showing ${products.length} botanical formulation${products.length === 1 ? '' : 's'}`;
    }

    if (products.length === 0) {
      productGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 0;">
          <h3 style="margin-bottom: 8px;">No formulations matched your search</h3>
          <p>Try refining your search keyword or clearing category filters.</p>
        </div>
      `;
      return;
    }

    productGrid.innerHTML = products.map(product => `
      <div class="product-card" data-id="${product._id}">
        <div class="product-image-container" onclick="window.location.href='/product.html?id=${product._id}'">
          <img src="/${product.image}" alt="${product.name}" class="product-image" loading="lazy" onerror="this.src='/assets/images/hero_editorial.jpg'">
          <span class="product-badge-overlay badge badge-forest">${product.category}</span>
        </div>
        <div class="product-content">
          <div class="product-volume">${product.sizeMl} ml • Cold-Pressed Botanical</div>
          <h3 class="product-name">
            <a href="/product.html?id=${product._id}">${product.name}</a>
          </h3>
          <p class="product-desc">${product.description}</p>
          <div class="product-footer">
            <div class="product-price">₹${product.price.toLocaleString('en-IN')}</div>
            <button class="btn btn-primary btn-sm add-to-cart-btn" data-product='${JSON.stringify({
              _id: product._id,
              name: product.name,
              price: product.price,
              sizeMl: product.sizeMl,
              image: product.image,
              sku: product.sku,
              stockQuantity: product.stockQuantity
            })}'>
              Add to Bag
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Attach Add to Cart Listeners
    productGrid.querySelectorAll('.add-to-cart-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const productData = JSON.parse(button.getAttribute('data-product'));
        cart.addItem(productData, 1);
        
        // Micro-interaction button feedback
        const originalText = button.textContent;
        button.textContent = 'Added ✓';
        button.style.backgroundColor = 'var(--color-gold)';
        button.style.borderColor = 'var(--color-gold)';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.backgroundColor = '';
          button.style.borderColor = '';
        }, 1200);
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', initStore);
