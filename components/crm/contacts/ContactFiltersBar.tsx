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
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        alignItems: 'center'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94a3b8',
            pointerEvents: 'none',
            fontSize: '13px'
          }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search name, phone, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              outline: 'none'
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              backgroundColor: '#fff',
              outline: 'none'
            }}
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
        <div>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              backgroundColor: '#fff',
              outline: 'none'
            }}
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
        <div>
          <select
            value={recency}
            onChange={(e) => setRecency(e.target.value as any)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              backgroundColor: '#fff',
              outline: 'none'
            }}
          >
            <option value="all">Any Contact Date</option>
            <option value="month">Contacted in Last 30 Days</option>
            <option value="older">Over 30 Days Ago</option>
            <option value="never">Never Contacted</option>
          </select>
        </div>
      </div>

      {/* Active Filter Chips & Counter Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '12px',
        paddingTop: '10px',
        borderTop: '1px solid #f1f5f9',
        fontSize: '12px',
        color: '#64748b'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> contacts</span>
          {category !== 'all' && (
            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
              Category: {category}
            </span>
          )}
          {sourceType !== 'all' && (
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
              Source: {sourceType}
            </span>
          )}
          {recency !== 'all' && (
            <span style={{ background: '#f3e8ff', color: '#7e22ce', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
              Recency: {recency === 'month' ? 'Last 30 Days' : recency === 'older' ? '30+ Days Ago' : 'Never'}
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            style={{
              background: 'none',
              border: 'none',
              color: '#0284c7',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              textDecoration: 'underline'
            }}
          >
            Clear All Filters
          </button>
        )}
      </div>
    </div>
  );
}
