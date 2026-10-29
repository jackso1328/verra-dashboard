# VÉRRA — Premium Botanical Hair Care & Business Intelligence Platform

An international luxury botanical hair-care e-commerce storefront and executive Business Intelligence (BI) analytics platform with Indian Rupee (INR / ₹) pricing.

Built as a full-stack academic Business Intelligence final-year project combining luxury editorial beauty UI/UX, responsive shopping workflows, authoritative server-side order calculation, role-based JWT authentication, and MongoDB Atlas aggregation analytics.

---

## 1. Brand Identity & Visual System

- **Brand Name**: VÉRRA
- **Emblem**: Custom botanical root & gold filigree "V" crest with champagne gold brushed typography plaque (extracted with clean transparency).
- **Aesthetic**: Warm, light-themed luxury editorial beauty (No dark mode).
- **Curated Light Color Palette**:
  - Warm Ivory Background: `#F8F6F0`
  - Pure White Surfaces: `#FFFFFF`
  - Forest Green Primary: `#284B3E`
  - Muted Sage: `#DDE5D8`
  - Champagne Gold Accents: `#C6AA72`
  - Warm Taupe: `#B7A99A`
  - Primary Text: `#292C28`
  - Subtle Borders: `#E8E6DF`
- **Typography**: Editorial serif headings (`Playfair Display`, `Cormorant Garamond`) paired with modern sans-serif body and tables (`Plus Jakarta Sans`).

---

## 2. Product Catalog (Sample Botanical Formulations)

| Formulation | Category | Size | Retail Price (₹) | COGS Unit Cost (₹) | Gross Margin | Key Active Botanicals |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Root Revival Oil** | Scalp Rituals | 50 ml | ₹1,299 | ₹380 | 70.7% | Mediterranean Rosemary, Cold-Pressed Jojoba, Peppermint Leaf |
| **Silk Elixir** | Smoothing Rituals | 50 ml | ₹1,599 | ₹460 | 71.2% | Virgin Moroccan Argan, Camellia Japonica, Evening Primrose |
| **Botanical Nourish Oil** | Restorative Rituals | 100 ml | ₹1,099 | ₹320 | 70.9% | Sun-Dried Amla Berry, Bhringraj, Black Sesame, Sweet Almond |
| **Coco Silk Treatment** | Pre-Wash Rituals | 100 ml | ₹899 | ₹240 | 73.3% | Virgin Cold-Pressed Coconut, Marula Oil, Avocado |

*All product photography is custom-generated in high-resolution studio lighting with amber glass dropper bottles, travertine podiums, and fresh botanical ingredients.*

---

## 3. Technology Stack & Architecture

### Frontend
- **Structure**: Semantic HTML5 with accessibility best practices.
- **Styling**: Vanilla CSS3 design system with CSS custom properties (`variables.css`, `global.css`, `storefront.css`, `dashboard.css`).
- **Logic**: Vanilla JavaScript using modern ES modules (`api.js`, `auth.js`, `cart.js`, `store.js`, `checkout.js`, `account.js`, `admin.js`, `charts.js`).
- **Data Visualizations**: Chart.js 4.x for interactive, responsive business intelligence charts.
- **Deployability**: Static build ready for GitHub Pages.

### Backend
- **Runtime**: Node.js (v18+) with Express.js.
- **Database**: MongoDB Atlas cloud persistence (or local MongoDB) using Mongoose ODM.
- **Security**: 
  - `bcryptjs` for salted password hashing.
  - `jsonwebtoken` (JWT) with server-enforced role-based access control (RBAC).
  - `helmet` security headers.
  - `cors` with configurable origin validation.
  - `express-rate-limit` on authentication endpoints.
- **Architecture**: Clean MVC separation (`controllers/`, `services/`, `models/`, `routes/`, `middleware/`, `config/`).

---

## 4. Directory Structure

```
Verra-dashboard/
├── frontend/
│   ├── index.html              # Luxury editorial homepage with featured quartet
│   ├── shop.html               # Catalog with keyword search, ritual filter & sorting
│   ├── product.html            # High-res product view, rituals & client reviews
│   ├── cart.html               # Dedicated shopping bag with real-time totals
│   ├── checkout.html           # Demonstration checkout with server price verification
│   ├── login.html              # Patron & Admin authentication screen
│   ├── account.html            # Patron profile and receipt inspection
│   ├── admin/
│   │   ├── index.html          # Executive BI Overview (12 KPI cards & trend line)
│   │   ├── sales.html          # Sales Analytics (timeline, channels & Indian regions)
│   │   ├── products.html       # Product performance matrix & margin breakdown
│   │   ├── finance.html        # Statement of P&L & operating expense logger
│   │   ├── inventory.html      # Inventory valuation, reorder alerts & movement logs
│   │   ├── customers.html      # Patron frequency, LTV & RFM cohort distribution
│   │   └── reports.html        # Audited sales ledger with live table & CSV export
│   ├── assets/
│   │   └── images/             # Transparent brand logos, hero editorial, product photography
│   ├── css/                    # Modular light theme stylesheets
│   └── js/                     # ES module services (API, Auth, Cart, BI Charts, Admin)
│
├── backend/
│   ├── server.js               # Express server listener
│   ├── src/
│   │   ├── app.js              # Express app, middleware, routes mount
│   │   ├── config/             # Environment & MongoDB Atlas connection
│   │   ├── models/             # Product, User, Order, InventoryMovement, Expense, Review
│   │   ├── controllers/        # Auth, Product, Order, Admin, Expense controllers
│   │   ├── services/           # BI Analytics Aggregation Service
│   │   ├── middleware/         # JWT protect, requireRole('admin'), errorHandler
│   │   └── scripts/
│   │       └── seed.js         # 180 synthetic historical orders over 12 months & seed data
│   ├── tests/                  # Node.js native test runner test suite
│   ├── .env.example            # Environment configuration template
│   └── package.json            # Node.js dependencies
│
├── .gitignore
└── README.md
```

---

## 5. Getting Started Locally

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Create your `backend/.env` file from `.env.example`:
```bash
cp .env.example .env
```
Default local settings:
```ini
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/verra_bi
DB_NAME=verra_bi
JWT_SECRET=verra_luxury_secret_jwt_key_2026_botanical
JWT_EXPIRES_IN=7d
FRONTEND_ORIGIN=*
```

### 3. Start the Backend Server
```bash
# In the backend directory:
npm start
# Or for development with auto-reload:
npm run dev
```
The server will initialize on `http://localhost:5000`. Verify with `http://localhost:5000/api/health`.

### 4. Serve the Frontend
You can serve the `frontend/` directory using any static web server:
```bash
# From workspace root:
python -m http.server 3000 --directory frontend
```
Visit `http://localhost:3000` in your web browser.

---

## 6. MongoDB Atlas Setup & Database Seeding

To connect persistent cloud storage:

1. **Create a Free Cluster**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
   - Create a free **M0 Sandbox** cluster.
2. **Network Access**:
   - Under **Security > Network Access**, click **Add IP Address** and choose **Allow Access from Anywhere** (`0.0.0.0/0`) for development.
3. **Database User**:
   - Under **Security > Database Access**, add a user (e.g. `verra_admin` with a strong password).
4. **Get Connection String**:
   - Click **Connect > Drivers**, copy your SRV connection string:
     ```
     mongodb+srv://<username>:<password>@<cluster>.mongodb.net/verra_bi?retryWrites=true&w=majority
     ```
5. **Update `backend/.env`**:
   - Paste the URI into `MONGODB_URI` in `backend/.env`.
6. **Run Database Seeder**:
   ```bash
   cd backend
   npm run seed
   ```

### Seeded Credentials

#### Administrator Account
- **Email**: `admin@verra.com`
- **Password**: `VerraAdmin2026!`
- **Role**: `admin`
- **Permissions**: Full access to all 7 Business Intelligence dashboard views, financial expense logging, restocking, and CSV export.

#### Sample Patron Account
- **Email**: `priya.sharma@example.com`
- **Password**: `Ritual2026!`
- **Role**: `customer`
- **Permissions**: Storefront checkout, profile viewing, and personal order history tracking.

---

## 7. Business Intelligence (BI) Metrics & Calculations

Every metric in the VÉRRA BI platform is calculated via backend services using consistent formulas:

| Metric | Formulation | BI Significance |
| :--- | :--- | :--- |
| **Gross Sales** | $\sum (\text{Selling Price} \times \text{Qty Sold})$ | Top-line retail demand before promotional deductions. |
| **Net Revenue** | $\text{Gross Sales} - \text{Discounts}$ | Realized operational turnover. Excludes cancelled orders. |
| **COGS** | $\sum (\text{Unit Cost at Sale} \times \text{Qty Sold})$ | Direct formula and packaging materials cost. Snapshotted per item. |
| **Gross Profit** | $\text{Net Revenue} - \text{COGS}$ | Contribution margin available to cover operating overheads. |
| **Gross Margin %** | $(\text{Gross Profit} / \text{Net Revenue}) \times 100$ | Product formulation pricing efficiency (~70-73%). |
| **Operating Expenses (OpEx)** | $\sum (\text{Marketing} + \text{Packaging} + \text{Carrier} + \text{Salaries} + \text{Ops})$ | Total operating overhead recorded in the period. |
| **Net Operating Profit** | $\text{Gross Profit} - \text{OpEx}$ | Estimated operating earnings before income tax. |
| **Average Order Value (AOV)** | $\text{Net Revenue} / \text{Qualifying Order Count}$ | Average basket size in Indian Rupees (₹). |
| **Refund Rate %** | $(\text{Refunded Orders} / \text{Total Placed}) \times 100$ | Customer satisfaction and packaging transit benchmark. |
| **Inventory Valuation** | $\sum (\text{Current Stock} \times \text{Unit Cost})$ | Current capital tied up in warehouse formulations. |

---

## 8. REST API Reference

### Public Catalog
- `GET /api/health` — Service health & live MongoDB Atlas connection status
- `GET /api/products` — Filterable product catalog (`category`, `search`, `sort`)
- `GET /api/products/:id` — Single formulation detail with verified patron reviews

### Authentication
- `POST /api/auth/register` — Create patron account (Role strictly locked to `customer`)
- `POST /api/auth/login` — Authenticate and retrieve JWT token
- `POST /api/auth/logout` — End session
- `GET /api/auth/me` — Current user profile *(Private)*

### Patron & Order Processing
- `POST /api/orders` — Submit demonstration order *(Server recalculates prices and decrements stock)*
- `GET /api/orders/my-orders` — Authenticated patron order history *(Private)*
- `GET /api/orders/my-orders/:id` — Specific order receipt *(Private)*

### Administrative Business Intelligence *(Role: admin required)*
- `GET /api/admin/overview` — 12 Executive KPIs and comparison against previous period
- `GET /api/admin/sales-trend` — Time series timeline, sales channels, and geographical regions
- `GET /api/admin/product-performance` — Product comparative matrix, ASP, and margin %
- `GET /api/admin/financials` — Statement of Profit & Loss and OpEx categorization
- `GET /api/admin/inventory` — Stock levels, valuation, low-stock warnings, and audit logs
- `GET /api/admin/customers` — Repeat purchase rates and RFM cohort segmentation
- `GET /api/admin/reports/sales` — Order ledger records & CSV export (`?format=csv`)
- `POST /api/admin/expenses` — Record an operational expense into P&L
- `PATCH /api/admin/products/:id` — Update stock levels or product details
- `PATCH /api/admin/orders/:id/status` — Modify order status (processing, shipped, delivered, refunded)

---

## 9. Deployment Guide

### Static Frontend (GitHub Pages)
1. Push repository to GitHub.
2. In `frontend/js/api.js`, set `API_BASE_URL` to your production backend URL, or leave dynamic configuration via `localStorage.setItem('verra_api_url', 'https://your-backend.onrender.com/api')`.
3. In GitHub repository settings, enable **GitHub Pages** pointing to `/frontend` or root.

### Express Backend (Render / Railway / AWS / Heroku)
1. Deploy the `backend/` directory as a Node.js web service.
2. Set Environment Variables in the hosting dashboard:
   - `NODE_ENV=production`
   - `PORT=5000`
   - `MONGODB_URI=your_atlas_connection_string`
   - `DB_NAME=verra_bi`
   - `JWT_SECRET=your_secure_random_key`
   - `FRONTEND_ORIGIN=https://your-github-username.github.io`
3. Trigger build and run `npm run seed` via the platform console or terminal to populate sample data.

---

## 10. Automated Testing
Run backend unit tests:
```bash
cd backend
npm test
```
Validates financial metric calculations, shipping fee policies, security role enforcement, and inventory valuation formulas.
