/**
 * VÉRRA Store Catalog Logic with Search, Filters, Badges & Wishlist
 */
import { api } from './api.js';
import { cart } from './cart.js';
import { auth } from './auth.js';
import { wishlist } from './wishlist.js';

// Authoritative formulations for preview mode
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
    stockQuantity: 316,
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
    stockQuantity: 237,
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
    stockQuantity: 273,
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
    stockQuantity: 344,
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
  const priceFilter = document.getElementById('price-filter');
  const stockFilter = document.getElementById('stock-filter');
  const sortSelect = document.getElementById('sort-select');
  const resetBtn = document.getElementById('reset-filters-btn');
  const countIndicator = document.getElementById('product-count-indicator');

  if (!productGrid) return;

  // Check URL category query param
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category');
  if (categoryFilter && initialCategory) {
    categoryFilter.value = initialCategory;
  }

  let isPreviewCatalog = false;
  try {
    const res = await api.get('products');
    if (res.success && res.data && res.data.length > 0) {
      allProducts = res.data;
      renderProducts(allProducts);
    } else {
      isPreviewCatalog = true;
      allProducts = SAMPLE_PREVIEW_PRODUCTS.map(p => ({ ...p, isPreview: true }));
      renderProducts(allProducts, true);
    }
  } catch (error) {
    isPreviewCatalog = true;
    allProducts = SAMPLE_PREVIEW_PRODUCTS.map(p => ({ ...p, isPreview: true }));
    renderProducts(allProducts, true);
  }


  // Filter and Search Engine
  const applyFilters = () => {
    let filtered = [...allProducts];

    // Search term
    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (term) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.description.toLowerCase().includes(term) ||
        (p.keyIngredients && p.keyIngredients.some(ing => ing.toLowerCase().includes(term)))
      );
    }

    // Category
    const category = categoryFilter ? categoryFilter.value : 'all';
    if (category && category !== 'all') {
      filtered = filtered.filter(p => p.category === category);
    }

    // Price Filter
    const priceVal = priceFilter ? priceFilter.value : 'all';
    if (priceVal === 'under-1000') {
      filtered = filtered.filter(p => p.price < 1000);
    } else if (priceVal === '1000-1300') {
      filtered = filtered.filter(p => p.price >= 1000 && p.price <= 1300);
    } else if (priceVal === 'above-1300') {
      filtered = filtered.filter(p => p.price > 1300);
    }

    // Stock Availability Filter
    const stockVal = stockFilter ? stockFilter.value : 'all';
    if (stockVal === 'in-stock') {
      filtered = filtered.filter(p => p.stockQuantity > 0);
    }

    // Sorting
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
  if (priceFilter) priceFilter.addEventListener('change', applyFilters);
  if (stockFilter) stockFilter.addEventListener('change', applyFilters);
  if (sortSelect) sortSelect.addEventListener('change', applyFilters);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (categoryFilter) categoryFilter.value = 'all';
      if (priceFilter) priceFilter.value = 'all';
      if (stockFilter) stockFilter.value = 'all';
      if (sortSelect) sortSelect.value = 'default';
      applyFilters();
    });
  }

  if (initialCategory) {
    applyFilters();
  }

  function getProductBadge(product) {
    if (product.stockQuantity <= product.reorderThreshold && product.stockQuantity > 0) {
      return `<span class="product-badge-overlay badge badge-warning">Low Stock</span>`;
    }
    if (product.name.includes('Root Revival')) {
      return `<span class="product-badge-overlay badge badge-gold">Bestseller</span>`;
    }
    if (product.name.includes('Silk Elixir')) {
      return `<span class="product-badge-overlay badge badge-forest">Editor's Choice</span>`;
    }
    if (product.name.includes('Botanical Nourish')) {
      return `<span class="product-badge-overlay badge badge-forest">Ayurvedic Heritage</span>`;
    }
    return `<span class="product-badge-overlay badge badge-forest">${product.category}</span>`;
  }

  function renderProducts(products, isPreview = false) {
    if (countIndicator) {
      countIndicator.textContent = `Showing ${products.length} botanical formulation${products.length === 1 ? '' : 's'}${isPreview ? ' (Catalog Offline Preview)' : ''}`;
    }

    if (products.length === 0) {
      productGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-md);">
          <div style="font-size: 2.5rem; margin-bottom: 12px; color: var(--color-gold);">✦</div>
          <h3 style="margin-bottom: 8px; font-family: var(--font-serif); color: var(--color-forest-dark);">No formulations match your selection</h3>
          <p style="color: var(--color-text-secondary); max-width: 480px; margin: 0 auto 20px;">Try adjusting your price range, clearing search terms, or resetting category filters to discover our complete collection.</p>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('reset-filters-btn').click()">Reset All Filters</button>
        </div>
      `;
      return;
    }

    const previewBanner = isPreview ? `
      <div style="grid-column: 1/-1; background: var(--color-surface); border: 1px solid var(--color-gold); border-radius: var(--radius-md); padding: 18px 24px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
        <div style="max-width: 780px;">
          <h4 style="color: var(--color-forest-dark); font-size: 1rem; margin-bottom: 4px;">✦ Catalog Preview Mode — Live API Sync Required</h4>
          <p style="color: var(--color-text-secondary); font-size: 0.85rem; margin: 0;">Live database catalog is currently synchronizing. Synthetic preview formulations are displayed for viewing. Checkout is guarded until the backend live catalog connects.</p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="window.location.reload()">Retry Live Connection</button>
      </div>
    ` : '';

    productGrid.innerHTML = previewBanner + products.map(product => {
      const isSaved = wishlist.isInWishlist(product._id);
      const isOutOfStock = product.stockQuantity === 0;
      const isPreviewItem = Boolean(product.isPreview || String(product._id).startsWith('preview_'));

      return `
        <div class="product-card" data-id="${product._id}">
          <div class="product-image-container" onclick="window.location.href='/product.html?id=${product._id}'">
            <img src="/${product.image}" alt="${product.name}" class="product-image" loading="lazy" onerror="this.src='/assets/images/hero_editorial.jpg'">
            ${isPreviewItem ? '<span class="product-badge-overlay badge badge-gold">Catalog Preview</span>' : getProductBadge(product)}
            <button class="wishlist-toggle-btn ${isSaved ? 'active' : ''}" data-id="${product._id}" title="${isSaved ? 'Remove from Saved' : 'Save to Ritual Wishlist'}" onclick="event.stopPropagation();">
              ${isSaved
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-gold)" stroke="var(--color-gold)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
              }
            </button>
          </div>
          <div class="product-content">
            <div class="product-volume">${product.sizeMl} ml • Cold-Pressed Botanical</div>
            <h3 class="product-name">
              <a href="/product.html?id=${product._id}">${product.name}</a>
            </h3>
            <p class="product-desc">${product.description}</p>
            <div class="product-footer">
              <div class="product-price">₹${product.price.toLocaleString('en-IN')}</div>
              <button class="btn btn-primary btn-sm add-to-cart-btn" ${isOutOfStock || isPreviewItem ? 'disabled' : ''} title="${isPreviewItem ? 'Live catalog sync required for checkout' : ''}" data-product='${JSON.stringify({
                _id: product._id,
                name: product.name,
                price: product.price,
                sizeMl: product.sizeMl,
                image: product.image,
                sku: product.sku,
                stockQuantity: product.stockQuantity,
                isPreview: isPreviewItem
              })}'>
                ${isOutOfStock ? 'Sold Out' : (isPreviewItem ? 'Preview Only' : 'Add to Bag')}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach Add to Cart Listeners
    productGrid.querySelectorAll('.add-to-cart-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const productData = JSON.parse(button.getAttribute('data-product'));
        if (productData.isPreview || String(productData._id).startsWith('preview_')) {
          alert('Live catalog synchronization is required. Preview formulations cannot be placed into orders until the live database is reached.');
          return;
        }
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


    // Attach Wishlist Listeners
    productGrid.querySelectorAll('.wishlist-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = btn.getAttribute('data-id');
        const product = allProducts.find(p => String(p._id) === String(pId));
        if (product) {
          const added = wishlist.toggle(product);
          btn.classList.toggle('active', added);
          btn.innerHTML = added
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-gold)" stroke="var(--color-gold)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
        }
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', initStore);
