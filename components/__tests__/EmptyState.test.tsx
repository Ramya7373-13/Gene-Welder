import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { Search, History } from 'lucide-react';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders headline and icon', () => {
    render(<EmptyState icon={Search} headline="No results found" />);
    
    expect(screen.getByText('No results found')).toBeInTheDocument();
    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });

  it('renders subtext when provided', () => {
    render(
      <EmptyState 
        icon={History} 
        headline="No history" 
        subtext="Your recent analyses will appear here" 
      />
    );
    
    expect(screen.getByText('No history')).toBeInTheDocument();
    expect(screen.getByText('Your recent analyses will appear here')).toBeInTheDocument();
  });

  it('renders compact variant correctly', () => {
    render(
      <EmptyState 
        icon={Search} 
        headline="Empty" 
        size="compact" 
      />
    );
    
    const container = screen.getByText('Empty').parentElement;
    expect(container).toHaveClass('py-8');
  });
});
