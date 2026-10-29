/**
 * VÉRRA Shopping Cart Manager
 */

class CartManager {
  constructor() {
    this.storageKey = 'verra_cart';
    this.couponKey = 'verra_coupon';
    this.items = this.loadCart();
    this.coupon = this.loadCoupon();
    this.initDrawerUI();
  }

  loadCart() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveCart() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    this.updateCartBadge();
    this.renderDrawer();
  }

  loadCoupon() {
    try {
      return JSON.parse(localStorage.getItem(this.couponKey)) || null;
    } catch (e) {
      return null;
    }
  }

  saveCoupon(coupon) {
    this.coupon = coupon;
    if (coupon) {
      localStorage.setItem(this.couponKey, JSON.stringify(coupon));
    } else {
      localStorage.removeItem(this.couponKey);
    }
  }

  addItem(product, quantity = 1) {
    const qty = parseInt(quantity, 10) || 1;
    const existingIndex = this.items.findIndex(item => item.id === product._id || item.id === product.id);

    if (existingIndex > -1) {
      const currentQty = this.items[existingIndex].quantity;
      const maxStock = product.stockQuantity || 999;
      if (currentQty + qty > maxStock) {
        alert(`Cannot add more units. Maximum available stock is ${maxStock}.`);
        return false;
      }
      this.items[existingIndex].quantity += qty;
    } else {
      this.items.push({
        id: product._id || product.id,
        name: product.name,
        price: product.price,
        sizeMl: product.sizeMl,
        image: product.image,
        sku: product.sku,
        stockQuantity: product.stockQuantity,
        quantity: qty
      });
    }

    this.saveCart();
    this.openDrawer();
    return true;
  }

  updateQuantity(productId, quantity) {
    const qty = parseInt(quantity, 10);
    const item = this.items.find(i => i.id === productId);

    if (!item) return;

    if (qty <= 0) {
      this.removeItem(productId);
      return;
    }

    if (item.stockQuantity && qty > item.stockQuantity) {
      alert(`Only ${item.stockQuantity} units available.`);
      item.quantity = item.stockQuantity;
    } else {
      item.quantity = qty;
    }

    this.saveCart();
  }

  removeItem(productId) {
    this.items = this.items.filter(item => item.id !== productId);
    this.saveCart();
  }

  clearCart() {
    this.items = [];
    this.coupon = null;
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.couponKey);
    this.saveCart();
  }

  applyCoupon(code) {
    const upper = (code || '').toUpperCase().trim();
    if (upper === 'VERRA10') {
      this.saveCoupon({ code: 'VERRA10', percent: 10, name: 'Welcome 10% Discount' });
      return { success: true, message: '10% Welcome discount applied!' };
    } else if (upper === 'RITUAL15') {
      this.saveCoupon({ code: 'RITUAL15', percent: 15, name: '15% Botanical Ritual Discount' });
      return { success: true, message: '15% Ritual discount applied!' };
    } else {
      return { success: false, message: 'Invalid or expired promotional code.' };
    }
  }

  removeCoupon() {
    this.saveCoupon(null);
  }

  getTotals() {
    const grossSales = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;
    if (this.coupon) {
      discount = Math.round(grossSales * (this.coupon.percent / 100));
    }

    const net = Math.max(0, grossSales - discount);
    const shipping = net >= 1500 || net === 0 ? 0 : 99;
    const tax = Math.round(net * 0.05);
    const total = net + shipping;

    return {
      grossSales,
      discount,
      shipping,
      tax,
      total,
      itemCount: this.items.reduce((sum, item) => sum + item.quantity, 0),
      coupon: this.coupon
    };
  }

  updateCartBadge() {
    const badges = document.querySelectorAll('.cart-count');
    const count = this.items.reduce((sum, item) => sum + item.quantity, 0);
    badges.forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  openDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-drawer-overlay');
    if (drawer && overlay) {
      drawer.classList.add('open');
      overlay.classList.add('open');
    }
  }

  closeDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-drawer-overlay');
    if (drawer && overlay) {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
    }
  }

  initDrawerUI() {
    document.addEventListener('DOMContentLoaded', () => {
      this.updateCartBadge();

      // Open drawer triggers
      document.querySelectorAll('.open-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.openDrawer();
        });
      });

      // Close drawer triggers
      const closeBtn = document.getElementById('close-cart-btn');
      const overlay = document.getElementById('cart-drawer-overlay');
      if (closeBtn) closeBtn.addEventListener('click', () => this.closeDrawer());
      if (overlay) overlay.addEventListener('click', () => this.closeDrawer());

      this.renderDrawer();
    });
  }

  renderDrawer() {
    const container = document.getElementById('cart-drawer-items');
    const subtotalEl = document.getElementById('cart-drawer-subtotal');
    if (!container) return;

    if (this.items.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 16px;">
          <p style="font-size: 1.1rem; color: var(--color-forest-dark); margin-bottom: 8px;">Your ritual bag is empty</p>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 24px;">Discover our botanical hair oils and elevate your hair care ritual.</p>
          <a href="/shop.html" class="btn btn-secondary btn-sm" onclick="verraCart.closeDrawer()">Explore The Collection</a>
        </div>
      `;
      if (subtotalEl) subtotalEl.textContent = '₹0';
      return;
    }

    const { grossSales } = this.getTotals();
    if (subtotalEl) subtotalEl.textContent = `₹${grossSales.toLocaleString('en-IN')}`;

    container.innerHTML = this.items.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <img src="/${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.src='/assets/images/hero_editorial.jpg'">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div style="font-size: 0.75rem; color: var(--color-taupe); margin-bottom: 4px;">${item.sizeMl} ml</div>
          <div class="cart-item-price">₹${item.price.toLocaleString('en-IN')}</div>
          <div class="qty-control" style="margin-top: 8px;">
            <button class="qty-btn dec-qty" data-id="${item.id}">-</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn inc-qty" data-id="${item.id}">+</button>
          </div>
        </div>
        <button class="remove-item-btn" data-id="${item.id}" style="background:none; border:none; color:var(--color-text-muted); cursor:pointer; font-size:1.1rem; align-self:flex-start;">&times;</button>
      </div>
    `).join('');

    // Attach quantity and remove handlers
    container.querySelectorAll('.inc-qty').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = this.items.find(i => i.id === id);
        if (item) this.updateQuantity(id, item.quantity + 1);
      });
    });

    container.querySelectorAll('.dec-qty').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = this.items.find(i => i.id === id);
        if (item) this.updateQuantity(id, item.quantity - 1);
      });
    });

    container.querySelectorAll('.remove-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.removeItem(id);
      });
    });
  }
}

export const cart = new CartManager();
window.verraCart = cart;
