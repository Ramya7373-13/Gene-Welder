Project Analysis Report
Generated: September 03, 2026
Target File: docs/project-analysis.md

1. Executive Summary
This analysis covers four primary repositories (MutationMechanic, CropHealthMonitor, Sampada-Store, and gods-eye-view) with focus on PostgreSQL schema design, codebase health, and integration opportunities. CropHealthMonitor and Sampada-Store lack production-ready database schemas despite having backend infrastructure, representing the highest priority gap. gods-eye-view offers reusable geospatial visualization components under MIT license that could accelerate CropHealthMonitor's mapping features. A single full-time developer should prioritize database implementation (40-60 hours), followed by security hardening and API completion (30-40 hours), with external integrations in the 60-90 day window.

2. Scope and Assumptions
Repositories Analyzed
MutationMechanic (binods1313/MutationMechanic) – Reference implementation with Prisma/PostgreSQL backend

CropHealthMonitor (binods1313/CropHealthMonitor) – Agriculture monitoring app with server routes but no DB schema

Sampada-Store (binods1313/Sampada-Store) – E-commerce Next.js app with Sanity CMS, partial API routes

gods-eye-view (bilawalsidhu/gods-eye-view) – Geospatial dashboard (MIT licensed)

Optional Repositories Noted
koala73/worldmonitor – Not accessible for analysis; licensing and integration details unknown

Conway-Research/automaton – Not accessible for analysis; licensing and integration details unknown

Key Assumptions
PostgreSQL 15+ is the target database version

No access to running database instances, cloud accounts, or environment variables

Single full-time developer with Python/Node.js and PostgreSQL expertise

Object storage (S3-compatible) available for image assets

Existing Sanity CMS schemas in Sampada-Store should be mirrored to PostgreSQL where needed

CropHealthMonitor's server routes (Express/Fastify) will be extended with database connectivity

Missing Runtime Details
Database connection strings and credentials

Object storage bucket names and access policies

Third-party API keys (payment processors, SMS, email)

Deployment environment (Vercel, GCP, self-hosted)

3. Database Design (PostgreSQL)
3.1 CropHealthMonitor Schema
Purpose: Store user accounts, monitored sites, sensor readings, crop health alerts, and AI analysis results.

sql
-- CropHealthMonitor Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (authentication & profiles)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'farmer' CHECK (role IN ('farmer', 'agronomist', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- Regions (administrative/geographic areas)
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    state_province VARCHAR(255),
    geometry GEOGRAPHY(POLYGON, 4326),  -- PostGIS required
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites (individual farms/fields)
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    region_id UUID REFERENCES regions(id),
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    area_hectares DECIMAL(10, 2),
    crop_type VARCHAR(100),
    planting_date DATE,
    geometry GEOGRAPHY(POLYGON, 4326),  -- PostGIS required
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_coordinates CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
);

-- Sensor readings (soil moisture, temperature, etc.)
CREATE TABLE sensor_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    reading_timestamp TIMESTAMPTZ NOT NULL,
    soil_moisture_percent DECIMAL(5, 2),  -- 0-100%
    soil_temperature_c DECIMAL(5, 2),
    air_temperature_c DECIMAL(5, 2),
    humidity_percent DECIMAL(5, 2),
    rainfall_mm DECIMAL(6, 2),
    ndvi_value DECIMAL(4, 3),  -- Normalized Difference Vegetation Index
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crop health alerts
CREATE TABLE crop_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,  -- 'drought', 'pest', 'disease', 'nutrient_deficiency'
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    detected_at TIMESTAMPTZ NOT NULL,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI analysis results (disease detection, yield prediction)
CREATE TABLE ai_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    analysis_type VARCHAR(100) NOT NULL,  -- 'disease_detection', 'yield_prediction', 'pest_identification'
    model_version VARCHAR(50),
    confidence_score DECIMAL(5, 4),  -- 0.0000-1.0000
    result_summary TEXT,
    result_data JSONB DEFAULT '{}',
    image_url VARCHAR(500),  -- Reference to object storage
    processed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weather data cache (daily aggregates)
CREATE TABLE weather_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    temp_min_c DECIMAL(5, 2),
    temp_max_c DECIMAL(5, 2),
    temp_avg_c DECIMAL(5, 2),
    humidity_avg_percent DECIMAL(5, 2),
    rainfall_mm DECIMAL(6, 2),
    wind_speed_kmh DECIMAL(5, 2),
    source VARCHAR(100),  -- API source name
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, date)
);

-- Indexes
CREATE INDEX idx_sites_user_id ON sites(user_id);
CREATE INDEX idx_sites_region_id ON sites(region_id);
CREATE INDEX idx_sites_geometry ON sites USING GIST(geometry);
CREATE INDEX idx_sensor_readings_site_id ON sensor_readings(site_id);
CREATE INDEX idx_sensor_readings_timestamp ON sensor_readings(reading_timestamp DESC);
CREATE INDEX idx_crop_alerts_site_id ON crop_alerts(site_id);
CREATE INDEX idx_crop_alerts_severity ON crop_alerts(severity);
CREATE INDEX idx_crop_alerts_detected_at ON crop_alerts(detected_at DESC);
CREATE INDEX idx_ai_analyses_site_id ON ai_analyses(site_id);
CREATE INDEX idx_ai_analyses_type ON ai_analyses(analysis_type);
CREATE INDEX idx_weather_cache_site_date ON weather_cache(site_id, date);

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sites_updated_at BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
3.2 Sampada-Store Schema
Purpose: E-commerce operations including products, orders, customers, payments, and inventory.

sql
-- Sampada-Store Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    is_guest BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_order_at TIMESTAMPTZ,
    total_orders INTEGER DEFAULT 0,
    total_spent_cents INTEGER DEFAULT 0
);

-- Customer addresses
CREATE TABLE customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    address_type VARCHAR(20) CHECK (address_type IN ('shipping', 'billing')),
    full_name VARCHAR(255) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(255) NOT NULL,
    state_province VARCHAR(255),
    postal_code VARCHAR(20),
    country_code VARCHAR(2) NOT NULL,
    phone VARCHAR(50),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product catalog (mirrors Sanity schema)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sanity_id VARCHAR(255) UNIQUE,  -- Reference to Sanity CMS
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price_cents INTEGER NOT NULL,
    compare_at_price_cents INTEGER,
    currency VARCHAR(3) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    category VARCHAR(100),
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product variants (size, color, etc.)
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    price_cents INTEGER,  -- NULL uses product base_price
    inventory_quantity INTEGER DEFAULT 0,
    weight_grams INTEGER,
    options JSONB DEFAULT '{}',  -- {"size": "M", "color": "blue"}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product images (references to object storage)
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    position INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    guest_email VARCHAR(255),  -- For guest checkout
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    subtotal_cents INTEGER NOT NULL,
    shipping_cost_cents INTEGER DEFAULT 0,
    tax_cents INTEGER DEFAULT 0,
    discount_cents INTEGER DEFAULT 0,
    total_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    shipping_address_id UUID REFERENCES customer_addresses(id),
    billing_address_id UUID REFERENCES customer_addresses(id),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method VARCHAR(50),  -- 'razorpay', 'stripe', 'cod'
    payment_id VARCHAR(255),  -- Payment gateway transaction ID
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    product_name VARCHAR(255) NOT NULL,  -- Snapshot at order time
    variant_name VARCHAR(255),
    sku VARCHAR(100),
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- Inventory transactions (audit trail)
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    transaction_type VARCHAR(50) NOT NULL,  -- 'sale', 'restock', 'adjustment', 'return'
    quantity_change INTEGER NOT NULL,
    reference_type VARCHAR(50),  -- 'order', 'manual', 'return'
    reference_id UUID,  -- Order ID or other reference
    reason TEXT,
    created_by UUID,  -- User ID if applicable
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discounts and promo codes
CREATE TABLE discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping')),
    discount_value INTEGER NOT NULL,  -- Percentage (1-100) or fixed amount in cents
    min_order_cents INTEGER DEFAULT 0,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    applicable_products UUID[],  -- NULL = all products
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_inventory_transactions_product_id ON inventory_transactions(product_id);
CREATE INDEX idx_discounts_code ON discounts(code);
CREATE INDEX idx_discounts_active ON discounts(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
3.3 Storage Strategy
Images and Large Objects:

Do NOT store images in PostgreSQL as BYTEA or large objects

Use object storage (AWS S3, GCP Cloud Storage, Cloudflare R2)

Store only URLs/references in database (image_url VARCHAR(500))

Implement CDN for image delivery

JSONB Usage:

metadata columns for flexible, schema-less data

Product variant options ({"size": "M", "color": "blue"})

AI analysis results with varying structures

Order metadata (shipping tracking, custom fields)

Backward Compatibility:

Add new columns with ALTER TABLE ... ADD COLUMN ... DEFAULT NULL

Use migrations for schema changes (see migration approach below)

Maintain Sanity CMS as source of truth for product content during transition

3.4 Migration Approach
bash
# Using Prisma Migrate (if adopting Prisma)
npx prisma migrate dev --name init

# OR raw SQL migrations
psql -U postgres -d crop_health_monitor -f migrations/001_initial_schema.sql

# Verify migration
psql -U postgres -d crop_health_monitor -c "\dt"
psql -U postgres -d crop_health_monitor -c "SELECT COUNT(*) FROM users;"
4. Codebase Health & Gaps
Repository	Priority	Finding	Remediation Notes
CropHealthMonitor	HIGH	No database schema or connection logic	Implement PostgreSQL schema (Section 3.1); add connection pooling in server
CropHealthMonitor	HIGH	.env.example missing critical DB variables	Add DATABASE_URL, POSTGRES_USER, POSTGRES_PASSWORD to .env.example
CropHealthMonitor	MEDIUM	Server routes incomplete (only climate.ts visible)	Add routes for sites, sensors, alerts, AI analyses with CRUD operations
CropHealthMonitor	MEDIUM	No authentication middleware	Implement JWT or session-based auth; protect /api/* routes
CropHealthMonitor	LOW	TypeScript errors in tsc_output.txt (830 bytes)	Run tsc --noEmit and fix type errors; update tsconfig.json
Sampada-Store	HIGH	No PostgreSQL schema for e-commerce	Implement schema (Section 3.2); integrate with existing Sanity data
Sampada-Store	HIGH	Payment webhook handlers incomplete	Review test-razorpay.js; implement production webhook endpoints with signature verification
Sampada-Store	MEDIUM	Extensive docs (100+ files) but fragmented	Consolidate into single README.md or docs/INDEX.md; archive outdated files
Sampada-Store	MEDIUM	API keys in docs (docs/API_KEYS_REFERENCE.md)	BLOCKING: Rotate all exposed credentials immediately; use environment variables only
Sampada-Store	LOW	Test files (test-*.js) not in CI	Add Jest/Vitest tests to GitHub Actions workflow
MutationMechanic	LOW	Reference implementation complete	Use as template for Prisma setup and seed scripts
gods-eye-view	LOW	Standalone dashboard; integration unclear	Evaluate reusable components (maps, data visualization) for CropHealthMonitor
5. Feature Enhancements & Roadmap
Prioritized Feature List
Feature	Repository	Priority	Effort (hours)	Implementation Notes
PostgreSQL schema + migrations	CropHealthMonitor, Sampada-Store	BLOCKING	24	Implement schemas from Section 3; write migration scripts; test with seed data
Database connection layer	CropHealthMonitor, Sampada-Store	BLOCKING	16	Add pg or Prisma client; implement connection pooling; create repository pattern
Authentication system	CropHealthMonitor	HIGH	20	JWT-based auth; password hashing (bcrypt); refresh tokens; middleware for protected routes
Payment webhook handlers	Sampada-Store	HIGH	12	Razorpay/Stripe webhook endpoints; signature verification; idempotency handling
Sensor data ingestion API	CropHealthMonitor	HIGH	16	POST /api/sites/:id/readings; validate sensor data; batch insert support
Crop alert generation	CropHealthMonitor	MEDIUM	12	Background job to analyze sensor readings; create alerts based on thresholds
AI analysis pipeline	CropHealthMonitor	MEDIUM	24	Integrate with existing aiLogic.ts; store results in ai_analyses table; async processing
Inventory management	Sampada-Store	MEDIUM	16	Decrement inventory on order; restock API; low-stock alerts
Order status workflow	Sampada-Store	MEDIUM	12	State machine for order status; email notifications on status changes
Admin dashboard API	Both	LOW	20	Aggregation queries; analytics endpoints; pagination and filtering
30/60/90-Day Roadmap
Days 1-30 (Foundation):

Week 1-2: Implement PostgreSQL schemas for both apps; run migrations

Week 3: Add database connection layer (Prisma or pg)

Week 4: Build authentication system for CropHealthMonitor

Milestone: Both apps can read/write to database; user signup/login functional

Days 31-60 (Core Features):

Week 5-6: Sensor data ingestion API + crop alert generation

Week 7: Payment webhook handlers + inventory management

Week 8: AI analysis pipeline integration

Milestone: End-to-end data flow from sensors to alerts; payments processing

Days 61-90 (Polish & Scale):

Week 9-10: Admin dashboard APIs; analytics queries

Week 11: Performance optimization (indexes, query caching)

Week 12: Testing, documentation, deployment automation

Milestone: Production-ready deployment with monitoring

6. Integration Opportunities
6.1 gods-eye-view Integration
License: MIT (permissive; allows commercial use, modification, distribution)

Reusable Components:

Geospatial Map Visualization

Leaflet/Mapbox integration for farm site mapping

Overlay sensor data as heatmaps

Reuse: src/components/map/ directory (if exists)

Data Dashboard Widgets

Time-series charts for sensor readings

Alert notification panels

Reuse: Chart components with CropHealthMonitor data

API Integration Patterns

Study data fetching architecture

Adapt for CropHealthMonitor's sensor data endpoints

Integration Approach:

bash
# Option 1: Copy components
cp -r gods-eye-view/src/components/map CropHealthMonitor/src/components/

# Option 2: NPM package (if published)
npm install @bilawalsidhu/gods-eye-view-components

# Option 3: Monorepo (advanced)
# Move both projects into single repo; share components via workspace
Licensing Compliance:

Include MIT license text in your project

Add attribution: "Map components adapted from gods-eye-view (MIT)"

No obligation to open-source your modifications

6.2 worldmonitor & automaton
Status: Not accessible for analysis

Recommendations:

Request access or review public repositories

Evaluate for:

worldmonitor: Global geospatial data integration (weather, satellite imagery)

automaton: Workflow automation or state machine patterns

Alternative OSS Libraries:

Purpose	Library	License	Rationale
Geospatial (PostGIS)	postgis	GPL/PostgreSQL	Native PostgreSQL extension for geometry types
Map visualization	leaflet / maplibre	BSD-2	Lightweight, mobile-friendly maps
Time-series charts	chart.js / recharts	MIT	React-compatible; sensor data visualization
Background jobs	bull (Node) / celery (Python)	MIT/BSD	Queue-based job processing for alerts
Authentication	next-auth / passport.js	ISC/MIT	Session/JWT management
6.3 Recommended OSS Additions
Prisma ORM (if not already using)

Type-safe database queries

Auto-generated migrations

Already used in MutationMechanic

Zod for validation

Runtime type validation for API inputs

Schema inference for TypeScript types

Winston + Pino for logging

Structured logging for production debugging

Correlation IDs for request tracing

7. Actionable Checklist & Next Steps
Immediate (This Week)
BLOCKING: Rotate all API keys exposed in docs/API_KEYS_REFERENCE.md (Sampada-Store)

Create PostgreSQL databases: crop_health_monitor, sampada_store

Run schema DDL from Section 3 in both databases

Add .env files with DATABASE_URL for both projects

Short-Term (Next 2 Weeks)
Implement database connection layer (Prisma or pg)

Write seed scripts for test data (see Appendix)

Add authentication middleware to CropHealthMonitor server routes

Create GitHub issues for each feature in Section 5

Testing & QA
Write integration tests for database operations

Test API endpoints with Hoppscotch/Postman

Verify webhook signature verification (Sampada-Store)

Load test sensor data ingestion (1000+ readings/minute)

Recommended PRs/Issues to Open
CropHealthMonitor:

feat: Add PostgreSQL schema and migrations (blocks all backend work)

feat: Implement JWT authentication

feat: Sensor data ingestion API

feat: Crop alert generation service

Sampada-Store:

feat: Add PostgreSQL e-commerce schema

fix: Rotate exposed API credentials (security)

feat: Payment webhook handlers with signature verification

feat: Inventory management system

8. Appendix
8.1 Full SQL DDL (Combined)
See Section 3 for complete schemas. Copy-paste into .sql files:

crop_health_monitor_schema.sql

sampada_store_schema.sql

8.2 Example Seed Data
CropHealthMonitor:

sql
-- Seed users
INSERT INTO users (email, password_hash, full_name, role) VALUES
('farmer@example.com', '$2b$10$...', 'John Farmer', 'farmer'),
('admin@example.com', '$2b$10$...', 'Admin User', 'admin');

-- Seed regions
INSERT INTO regions (name, country_code, state_province) VALUES
('Punjab', 'IN', 'Punjab'),
('Karnataka', 'IN', 'Karnataka');

-- Seed sites
INSERT INTO sites (user_id, region_id, name, latitude, longitude, crop_type)
SELECT 
    u.id, r.id, 'Test Farm 1', 30.9010, 75.8573, 'Wheat'
FROM users u, regions r
WHERE u.email = 'farmer@example.com' AND r.name = 'Punjab';

-- Seed sensor readings
INSERT INTO sensor_readings (site_id, reading_timestamp, soil_moisture_percent, soil_temperature_c)
SELECT 
    s.id, NOW() - INTERVAL '1 day', 45.5, 28.3
FROM sites s
WHERE s.name = 'Test Farm 1';
Sampada-Store:

sql
-- Seed customers
INSERT INTO customers (email, full_name, phone) VALUES
('customer@example.com', 'Test Customer', '+91 98765 43210');

-- Seed products
INSERT INTO products (slug, name, description, base_price_cents, category, is_active) VALUES
('organic-cotton-tshirt', 'Organic Cotton T-Shirt', 'Comfortable eco-friendly t-shirt', 99900, 'Apparel', true),
('bamboo-toothbrush', 'Bamboo Toothbrush', 'Sustainable oral care', 29900, 'Personal Care', true);

-- Seed product variants
INSERT INTO product_variants (product_id, sku, name, price_cents, inventory_quantity, options)
SELECT 
    p.id, 'TSHIRT-M-BLUE', 'Medium / Blue', 99900, 100, '{"size": "M", "color": "blue"}'
FROM products p
WHERE p.slug = 'organic-cotton-tshirt';
8.3 Example psql Commands
bash
# Create database
createdb -U postgres crop_health_monitor

# Load schema
psql -U postgres -d crop_health_monitor -f crop_health_monitor_schema.sql

# Load seed data
psql -U postgres -d crop_health_monitor -f crop_health_monitor_seed.sql

# Verify tables
psql -U postgres -d crop_health_monitor -c "\dt"

# Check row counts
psql -U postgres -d crop_health_monitor -c "SELECT 'users' as table, COUNT(*) FROM users UNION ALL SELECT 'sites', COUNT(*) FROM sites;"
8.4 Sample Commit Message / PR Template
Commit Message:

text
feat: Add PostgreSQL schema for CropHealthMonitor

- Implement users, sites, sensor_readings, crop_alerts tables
- Add PostGIS extension for geospatial queries
- Create indexes for common query patterns
- Add seed data for development testing

Closes #123
PR Template:

text
## Description
Implements PostgreSQL database schema for CropHealthMonitor backend.

## Changes
- [ ] Schema DDL in `database/schema.sql`
- [ ] Seed scripts in `database/seed.sql`
- [ ] Migration script (if using Prisma: `prisma/migrations/...`)
- [ ] Updated `.env.example` with `DATABASE_URL`

## Testing
- [ ] Schema applied successfully to local database
- [ ] Seed data inserted without errors
- [ ] Connection string validated in application

## Checklist
- [ ] Code reviewed
- [ ] Tests passing
- [ ] Documentation updated
- [ ] No sensitive data committed
End of Report