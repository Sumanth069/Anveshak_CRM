"use client";

import React from 'react';

interface ContactFiltersBarProps {
  search: string;
  setSearch: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  sourceType: string;
  setSourceType: (val: string) => void;
  recency: 'all' | 'never' | 'month' | 'older';
  setRecency: (val: 'all' | 'never' | 'month' | 'older') => void;
  totalCount: number;
  filteredCount: number;
  onReset: () => void;
}

export default function ContactFiltersBar({
  search,
  setSearch,
  category,
  setCategory,
  sourceType,
  setSourceType,
  recency,
  setRecency,
  totalCount,
  filteredCount,
  onReset
}: ContactFiltersBarProps) {
  const hasActiveFilters = !!search || category !== 'all' || sourceType !== 'all' || recency !== 'all';

  return (
    <div className="contact-filters-panel">
      <div className="contact-filters-grid">
        {/* Search Input */}
        <div className="contact-search-box">
          <span className="contact-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search name, phone, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="contact-search-input"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="contact-search-clear"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdowns Row */}
        <div className="contact-dropdowns-row">
          {/* Category Filter */}
          <div className="contact-dropdown-wrap">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="contact-filter-select"
            >
              <option value="all">All Categories</option>
              <option value="Prospect">Prospect</option>
              <option value="Customer">Customer</option>
              <option value="Partner">Partner</option>
              <option value="Vendor">Vendor</option>
              <option value="VIP">VIP</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Source Type Filter */}
          <div className="contact-dropdown-wrap">
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="contact-filter-select"
            >
              <option value="all">All Sources</option>
              <option value="Visiting Card">Visiting Card</option>
              <option value="Excel Import">Excel Import</option>
              <option value="Event / Expo">Event / Expo</option>
              <option value="Website">Website</option>
              <option value="Referral">Referral</option>
              <option value="Direct">Direct Entry</option>
            </select>
          </div>

          {/* Recency Filter */}
          <div className="contact-dropdown-wrap">
            <select
              value={recency}
              onChange={(e) => setRecency(e.target.value as any)}
              className="contact-filter-select"
            >
              <option value="all">Any Activity</option>
              <option value="month">Last 30 Days</option>
              <option value="older">30+ Days Inactive</option>
              <option value="never">Never Contacted</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="contact-filters-status">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> contacts
          </span>
          {hasActiveFilters && (
            <span style={{
              background: '#eff6ff',
              color: '#1e40af',
              border: '1px solid #bfdbfe',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700'
            }}>
              Filtered Active
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            style={{
              background: 'none',
              border: 'none',
              color: '#d49b38',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ↺ Reset Filters
          </button>
        )}
      </div>

      <style jsx>{`
        .contact-filters-panel {
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 16px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
        }

        .contact-filters-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .contact-search-box {
          position: relative;
          width: 100%;
        }

        .contact-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
          font-size: 13px;
        }

        .contact-search-input {
          width: 100%;
          padding: 10px 32px 10px 36px;
          font-size: 13.5px;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: #f8fafc;
          outline: none;
          transition: all 0.2s ease;
        }

        .contact-search-input:focus {
          background: #ffffff;
          border-color: #1e40af;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.08);
        }

        .contact-search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 12px;
          padding: 4px;
        }

        .contact-dropdowns-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .contact-dropdown-wrap {
          min-width: 0;
        }

        .contact-filter-select {
          width: 100%;
          padding: 8px 10px;
          font-size: 12.5px;
          font-weight: 500;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background-color: #f8fafc;
          color: var(--text-main);
          outline: none;
          cursor: pointer;
        }

        .contact-filter-select:focus {
          border-color: #1e40af;
          background-color: #ffffff;
        }

        .contact-filters-status {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        @media (max-width: 768px) {
          .contact-filters-panel {
            padding: 12px;
            border-radius: 12px;
          }

          .contact-dropdowns-row {
            grid-template-columns: 1fr 1fr;
          }

          .contact-dropdown-wrap:last-child {
            grid-column: 1 / -1;
          }

          .contact-filter-select {
            padding: 9px 10px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
