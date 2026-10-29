/**
 * VÉRRA Authentication & Authorization Manager
 */
import { api } from './api.js';

class AuthManager {
  constructor() {
    this.userKey = 'verra_user';
    this.tokenKey = 'verra_token';
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  getUser() {
    const userStr = localStorage.getItem(this.userKey);
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  }

  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  }

  isAdmin() {
    const user = this.getUser();
    return !!user && user.role === 'admin';
  }

  async login(email, password) {
    const res = await api.post('auth/login', { email, password });
    if (res.success && res.token) {
      localStorage.setItem(this.tokenKey, res.token);
      localStorage.setItem(this.userKey, JSON.stringify(res.user));
    }
    return res;
  }

  async register(formData) {
    const res = await api.post('auth/register', formData);
    if (res.success && res.token) {
      localStorage.setItem(this.tokenKey, res.token);
      localStorage.setItem(this.userKey, JSON.stringify(res.user));
    }
    return res;
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    window.location.href = '/login.html';
  }

  // Route guard: Redirect if not logged in
  requireAuth(redirectUrl = '/login.html') {
    if (!this.isAuthenticated()) {
      window.location.href = `${redirectUrl}?redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }
    return true;
  }

  // Admin route guard: Redirect if not admin
  requireAdmin(redirectUrl = '/login.html') {
    if (!this.isAuthenticated() || !this.isAdmin()) {
      alert('Access Restricted. You must sign in with an Administrator account.');
      window.location.href = `${redirectUrl}?admin=true&redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }
    return true;
  }

  updateNavUI() {
    const accountLinks = document.querySelectorAll('.nav-auth-state');
    const user = this.getUser();

    accountLinks.forEach(el => {
      if (user) {
        el.innerHTML = `
          <div class="user-nav-dropdown">
            <span class="user-nav-name">${user.name.split(' ')[0]}</span>
            <div class="user-dropdown-menu">
              ${user.role === 'admin' ? '<a href="/admin/index.html">BI Admin Dashboard</a>' : ''}
              <a href="/account.html">My Orders</a>
              <a href="#" id="nav-logout-btn">Sign Out</a>
            </div>
          </div>
        `;
        const logoutBtn = el.querySelector('#nav-logout-btn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
          });
        }
      } else {
        el.innerHTML = `<a href="/login.html" class="nav-link">Sign In</a>`;
      }
    });
  }
}

export const auth = new AuthManager();
