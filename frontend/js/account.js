/**
 * VÉRRA Customer Account & Order History Logic
 */
import { api } from './api.js';
import { auth } from './auth.js';

export const initAccount = async () => {
  if (!auth.requireAuth('/login.html')) return;
  auth.updateNavUI();

  const user = auth.getUser();
  const userNameEl = document.getElementById('account-user-name');
  const userEmailEl = document.getElementById('account-user-email');
  const userPhoneEl = document.getElementById('account-user-phone');
  const userAddressEl = document.getElementById('account-user-address');
  const ordersContainer = document.getElementById('account-orders-list');
  const logoutBtn = document.getElementById('account-logout-btn');

  if (userNameEl) userNameEl.textContent = user.name;
  if (userEmailEl) userEmailEl.textContent = user.email;
  if (userPhoneEl) userPhoneEl.textContent = user.phone || 'Not provided';
  if (userAddressEl && user.address) {
    userAddressEl.textContent = `${user.address.street || ''}, ${user.address.city || ''}, ${user.address.state || ''} ${user.address.postalCode || ''}`.trim() || 'No address saved yet';
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      auth.logout();
    });
  }

  if (!ordersContainer) return;

  ordersContainer.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 40px 0;">
        <div class="spinner"></div>
        <p style="margin-top: 12px; color: var(--color-text-secondary);">Loading your ritual orders...</p>
      </td>
    </tr>
  `;

  try {
    const res = await api.get('orders/my-orders');
    if (res.success && res.data) {
      renderOrders(res.data);
    } else {
      ordersContainer.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px;">No orders found.</td></tr>`;
    }
  } catch (err) {
    ordersContainer.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--color-danger);">Error retrieving orders: ${err.message}</td></tr>`;
  }

  function renderOrders(orders) {
    if (orders.length === 0) {
      ordersContainer.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 48px 20px;">
            <p style="font-size: 1.1rem; color: var(--color-forest-dark); margin-bottom: 6px;">No orders placed yet</p>
            <p style="color: var(--color-text-secondary); margin-bottom: 20px;">Experience the luxury of our botanical formulas.</p>
            <a href="/shop.html" class="btn btn-primary btn-sm">Discover Collection</a>
          </td>
        </tr>
      `;
      return;
    }

    ordersContainer.innerHTML = orders.map(order => {
      const dateStr = new Date(order.orderDate).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const itemsDesc = order.items.map(i => `${i.name} (×${i.quantity})`).join(', ');

      let statusBadgeClass = 'badge-forest';
      if (order.orderStatus === 'delivered') statusBadgeClass = 'badge-success';
      else if (order.orderStatus === 'shipped') statusBadgeClass = 'badge-info';
      else if (order.orderStatus === 'refunded') statusBadgeClass = 'badge-danger';
      else if (order.orderStatus === 'processing') statusBadgeClass = 'badge-warning';

      return `
        <tr>
          <td><strong style="color: var(--color-forest-dark); font-family: monospace;">${order.orderNumber}</strong></td>
          <td>${dateStr}</td>
          <td><span style="font-size: 0.85rem; color: var(--color-text-secondary);">${itemsDesc}</span></td>
          <td><strong>₹${order.totalAmount.toLocaleString('en-IN')}</strong></td>
          <td><span class="badge ${statusBadgeClass}">${order.orderStatus}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm view-order-modal-btn" data-order='${JSON.stringify(order)}'>View Receipt</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach View Order Receipt handler
    ordersContainer.querySelectorAll('.view-order-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const order = JSON.parse(btn.getAttribute('data-order'));
        showOrderDetailsModal(order);
      });
    });
  }

  function showOrderDetailsModal(order) {
    const modal = document.getElementById('account-order-modal');
    if (!modal) return;

    document.getElementById('modal-order-number').textContent = order.orderNumber;
    document.getElementById('modal-order-date').textContent = new Date(order.orderDate).toLocaleString();
    document.getElementById('modal-order-status').textContent = order.orderStatus.toUpperCase();
    document.getElementById('modal-order-address').textContent = `${order.customerInfo.name}, ${order.customerInfo.street}, ${order.customerInfo.city}, ${order.customerInfo.state} ${order.customerInfo.postalCode}`;

    const itemsTbody = document.getElementById('modal-order-items');
    if (itemsTbody) {
      itemsTbody.innerHTML = order.items.map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.9rem;">
          <div>${item.name} (${item.sizeMl}ml) × ${item.quantity}</div>
          <div><strong>₹${item.subtotal.toLocaleString('en-IN')}</strong></div>
        </div>
      `).join('');
    }

    document.getElementById('modal-order-subtotal').textContent = `₹${order.grossSales.toLocaleString('en-IN')}`;
    document.getElementById('modal-order-discount').textContent = `-₹${order.discountAmount.toLocaleString('en-IN')}`;
    document.getElementById('modal-order-shipping').textContent = order.shippingFee === 0 ? 'FREE' : `₹${order.shippingFee}`;
    document.getElementById('modal-order-total').textContent = `₹${order.totalAmount.toLocaleString('en-IN')}`;

    modal.classList.add('active');

    const closeBtn = document.getElementById('close-account-modal');
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
  }

  // Render Saved Wishlist Items
  import('./wishlist.js').then(({ wishlist }) => {
    import('./cart.js').then(({ cart }) => {
      const wishlistGrid = document.getElementById('account-wishlist-grid');
      if (!wishlistGrid) return;

      const renderWishlist = () => {
        const items = wishlist.items;
        if (items.length === 0) {
          wishlistGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--color-text-secondary);">
              <p>You haven't saved any botanical formulations to your wishlist yet.</p>
              <a href="/shop.html" class="btn btn-secondary btn-sm" style="margin-top: 10px;">Browse The Collection</a>
            </div>
          `;
          return;
        }

        wishlistGrid.innerHTML = items.map(p => `
          <div class="product-card" data-id="${p.id || p._id}">
            <div class="product-image-container" onclick="window.location.href='/product.html?id=${p.id || p._id}'">
              <img src="/${p.image}" alt="${p.name}" class="product-image" onerror="this.src='/assets/images/hero_editorial.jpg'">
              <button class="remove-wishlist-btn" data-id="${p.id || p._id}" style="position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.9); border:none; width:30px; height:30px; border-radius:50%; font-size:1.1rem; cursor:pointer; color:var(--color-text-muted);">&times;</button>
            </div>
            <div class="product-content">
              <div class="product-volume">${p.sizeMl} ml</div>
              <h4 class="product-name"><a href="/product.html?id=${p.id || p._id}">${p.name}</a></h4>
              <div class="product-footer">
                <div class="product-price">₹${p.price.toLocaleString('en-IN')}</div>
                <button class="btn btn-primary btn-sm add-wishlist-to-cart-btn" data-product='${JSON.stringify(p)}'>Add to Bag</button>
              </div>
            </div>
          </div>
        `).join('');

        // Remove from wishlist
        wishlistGrid.querySelectorAll('.remove-wishlist-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            wishlist.toggle({ _id: id, id: id });
            renderWishlist();
          });
        });

        // Add to bag
        wishlistGrid.querySelectorAll('.add-wishlist-to-cart-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const prod = JSON.parse(btn.getAttribute('data-product'));
            cart.addItem(prod, 1);
            btn.textContent = 'Added ✓';
            setTimeout(() => { btn.textContent = 'Add to Bag'; }, 1000);
          });
        });
      };

      renderWishlist();
    });
  });
};

document.addEventListener('DOMContentLoaded', initAccount);
