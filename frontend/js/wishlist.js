/**
 * VÉRRA Wishlist & Saved Formulas Manager
 */
class WishlistManager {
  constructor() {
    this.storageKey = 'verra_wishlist';
    this.items = this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    this.updateUI();
  }

  isInWishlist(id) {
    return this.items.some(item => (item._id === id || item.id === id));
  }

  toggle(product) {
    const id = product._id || product.id;
    const idx = this.items.findIndex(item => (item._id === id || item.id === id));
    if (idx > -1) {
      this.items.splice(idx, 1);
      this.save();
      return false; // Removed
    } else {
      this.items.push({
        _id: id,
        id: id,
        name: product.name,
        price: product.price,
        sizeMl: product.sizeMl,
        image: product.image,
        sku: product.sku,
        category: product.category,
        stockQuantity: product.stockQuantity
      });
      this.save();
      return true; // Added
    }
  }

  updateUI() {
    // Update heart icons on cards
    document.querySelectorAll('.wishlist-toggle-btn').forEach(btn => {
      const pId = btn.getAttribute('data-id');
      const isSaved = this.isInWishlist(pId);
      btn.classList.toggle('active', isSaved);
      btn.innerHTML = isSaved
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-gold)" stroke="var(--color-gold)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    });

    // Update wishlist counters
    const count = this.items.length;
    document.querySelectorAll('.wishlist-count').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'inline-flex' : 'none';
    });
  }
}

export const wishlist = new WishlistManager();
window.verraWishlist = wishlist;
