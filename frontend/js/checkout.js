/**
 * VÉRRA Demo Checkout Flow
 */
import { api } from './api.js';
import { cart } from './cart.js';
import { auth } from './auth.js';

export const initCheckout = () => {
  auth.updateNavUI();
  const user = auth.getUser();

  // Populate user form if logged in
  if (user) {
    const nameInput = document.getElementById('checkout-name');
    const emailInput = document.getElementById('checkout-email');
    const phoneInput = document.getElementById('checkout-phone');
    const streetInput = document.getElementById('checkout-street');
    const cityInput = document.getElementById('checkout-city');
    const stateInput = document.getElementById('checkout-state');
    const zipInput = document.getElementById('checkout-zip');

    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (user.address) {
      if (streetInput) streetInput.value = user.address.street || '';
      if (cityInput) cityInput.value = user.address.city || '';
      if (stateInput) stateInput.value = user.address.state || '';
      if (zipInput) zipInput.value = user.address.postalCode || '';
    }
  }

  renderCheckoutSummary();

  // Coupon Form
  const couponForm = document.getElementById('checkout-coupon-form');
  const couponInput = document.getElementById('checkout-coupon-input');
  if (couponForm && couponInput) {
    couponForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = couponInput.value.trim();
      const result = cart.applyCoupon(code);
      alert(result.message);
      renderCheckoutSummary();
    });
  }

  // Checkout Form Submission
  const checkoutForm = document.getElementById('checkout-form');
  const submitBtn = document.getElementById('place-order-btn');
  const errorBox = document.getElementById('checkout-error-box');

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorBox) errorBox.style.display = 'none';

      if (cart.items.length === 0) {
        alert('Your ritual bag is empty. Please add items before checkout.');
        window.location.href = '/shop.html';
        return;
      }

      // Guard against synthetic preview items when API was offline
      const hasPreviewItems = cart.items.some(item => !item.id || String(item.id).startsWith('preview_') || String(item.id).length !== 24);
      if (hasPreviewItems) {
        showError('Live catalog synchronization required. Preview formulation items cannot be placed into orders. Please remove preview items from your bag and refresh the shop catalog.');
        return;
      }

      // Collect customer details
      const customerInfo = {
        name: document.getElementById('checkout-name').value.trim(),
        email: document.getElementById('checkout-email').value.trim(),
        phone: document.getElementById('checkout-phone').value.trim(),
        street: document.getElementById('checkout-street').value.trim(),
        city: document.getElementById('checkout-city').value.trim(),
        state: document.getElementById('checkout-state').value.trim(),
        postalCode: document.getElementById('checkout-zip').value.trim(),
        country: 'India'
      };

      const payload = {
        items: cart.items.map(item => ({
          productId: item.id,
          quantity: item.quantity
        })),
        customerInfo,
        couponCode: cart.coupon ? cart.coupon.code : null
      };

      // Set loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner" style="width:18px;height:18px;margin-right:8px;"></span> Validating & Placing Order...`;
      }

      try {
        const res = await api.post('orders', payload);

        if (res.success && res.data) {
          // Clear cart
          cart.clearCart();

          // Show confirmation modal
          showConfirmationModal(res.data);
        } else {
          showError(res.message || 'Failed to process order.');
        }
      } catch (err) {
        showError(err.message || 'Unable to communicate with order server. Ensure backend is running.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Place Demonstration Order (₹${cart.getTotals().total.toLocaleString('en-IN')})`;
        }
      }
    });
  }

  function showError(msg) {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    } else {
      alert(`Order Notice: ${msg}`);
    }
  }

  function showConfirmationModal(order) {
    const modal = document.getElementById('order-confirmation-modal');
    if (!modal) {
      alert(`Order Placed Successfully! Your Order Number is: ${order.orderNumber}`);
      window.location.href = '/account.html';
      return;
    }

    const orderNumEl = document.getElementById('confirm-order-number');
    const orderTotalEl = document.getElementById('confirm-order-total');
    const orderEmailEl = document.getElementById('confirm-order-email');

    if (orderNumEl) orderNumEl.textContent = order.orderNumber;
    if (orderTotalEl) orderTotalEl.textContent = `₹${order.totalAmount.toLocaleString('en-IN')}`;
    if (orderEmailEl) orderEmailEl.textContent = order.customerInfo.email;

    modal.classList.add('active');
  }
};

export const renderCheckoutSummary = () => {
  const summaryContainer = document.getElementById('checkout-items-list');
  const subtotalEl = document.getElementById('summary-subtotal');
  const discountEl = document.getElementById('summary-discount');
  const shippingEl = document.getElementById('summary-shipping');
  const taxEl = document.getElementById('summary-tax');
  const totalEl = document.getElementById('summary-total');
  const placeOrderBtn = document.getElementById('place-order-btn');

  if (!summaryContainer) return;

  const totals = cart.getTotals();

  if (cart.items.length === 0) {
    summaryContainer.innerHTML = `<p style="padding: 20px; text-align: center; color: var(--color-text-secondary);">Your ritual bag is empty.</p>`;
    return;
  }

  summaryContainer.innerHTML = cart.items.map(item => `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--color-border-subtle);">
      <div style="display:flex; gap:12px; align-items:center;">
        <img src="/${item.image}" alt="${item.name}" style="width:48px; height:48px; object-fit:cover; border-radius:4px;" onerror="this.src='/assets/images/hero_editorial.jpg'">
        <div>
          <div style="font-weight:600; font-size:0.9rem; color:var(--color-forest-dark);">${item.name}</div>
          <div style="font-size:0.75rem; color:var(--color-taupe);">${item.sizeMl} ml × ${item.quantity}</div>
        </div>
      </div>
      <div style="font-weight:600; font-size:0.9rem; color:var(--color-forest);">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
    </div>
  `).join('');

  if (subtotalEl) subtotalEl.textContent = `₹${totals.grossSales.toLocaleString('en-IN')}`;
  if (discountEl) discountEl.textContent = `-₹${totals.discount.toLocaleString('en-IN')}`;
  if (shippingEl) shippingEl.textContent = totals.shipping === 0 ? 'FREE' : `₹${totals.shipping}`;
  if (taxEl) taxEl.textContent = `₹${totals.tax.toLocaleString('en-IN')}`;
  if (totalEl) totalEl.textContent = `₹${totals.total.toLocaleString('en-IN')}`;
  if (placeOrderBtn) placeOrderBtn.textContent = `Place Demonstration Order (₹${totals.total.toLocaleString('en-IN')})`;
};

document.addEventListener('DOMContentLoaded', initCheckout);
