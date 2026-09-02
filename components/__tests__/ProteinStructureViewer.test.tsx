import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import ProteinStructureViewer from '../ProteinStructureViewer';

// Mock 3Dmol global
const mockViewer = {
  clear: vi.fn(),
  addModel: vi.fn(() => ({
    selectedAtoms: vi.fn(() => [])
  })),
  setStyle: vi.fn(),
  addStyle: vi.fn(),
  addLabel: vi.fn(),
  zoomTo: vi.fn(),
  render: vi.fn(),
  zoom: vi.fn(),
  setHoverable: vi.fn()
};

const mockCreateViewer = vi.fn(() => mockViewer);

beforeAll(() => {
  // @ts-ignore
  window.$3Dmol = {
    createViewer: mockCreateViewer
  };
});

describe('ProteinStructureViewer', () => {
  const mockPdbData = 'ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 90.00           N';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with no structure data', () => {
    // When pdbData, structurePath, and gene are all null, the component
    // shows "No structure data loaded" regardless of loading prop
    const { rerender } = render(<ProteinStructureViewer pdbData={null} loading={true} />);
    expect(screen.getByText(/No structure data loaded/i)).toBeInTheDocument();

    rerender(<ProteinStructureViewer pdbData={null} loading={false} />);
    expect(screen.getByText(/No structure data loaded/i)).toBeInTheDocument();
  });

  it('initializes 3Dmol viewer when PDB data is provided', async () => {
    render(<ProteinStructureViewer pdbData={mockPdbData} />);
    
    await waitFor(() => {
      expect(mockCreateViewer).toHaveBeenCalled();
      expect(mockViewer.addModel).toHaveBeenCalledWith(mockPdbData, "pdb");
      expect(mockViewer.zoomTo).toHaveBeenCalled();
      expect(mockViewer.render).toHaveBeenCalled();
    });
  });

  it('applies confidence coloring style correctly', async () => {
    render(<ProteinStructureViewer pdbData={mockPdbData} colorBy="confidence" />);
    
    await waitFor(() => {
      expect(mockViewer.setStyle).toHaveBeenCalledWith({}, expect.objectContaining({
        cartoon: expect.objectContaining({
          colorfunc: expect.any(Function)
        })
      }));
    });
    
    // Verify Legend is present
    expect(screen.getByText(/>90 High/i)).toBeInTheDocument();
  });

  it('highlights residue when highlightResidue prop is provided', async () => {
    render(<ProteinStructureViewer pdbData={mockPdbData} highlightResidue={50} />);
    
    await waitFor(() => {
      expect(mockViewer.addStyle).toHaveBeenCalledWith(
        { resi: 50 },
        expect.objectContaining({ stick: expect.any(Object) })
      );
      expect(mockViewer.addLabel).toHaveBeenCalledWith(
        expect.stringContaining("Mut 50"),
        expect.anything()
      );
    });
  });

  it('calls onResidueHover when hovering', async () => {
    const onHoverMock = vi.fn();
    render(<ProteinStructureViewer pdbData={mockPdbData} onResidueHover={onHoverMock} />);
    
    await waitFor(() => {
      expect(mockViewer.setHoverable).toHaveBeenCalled();
    });

    // Simulate the callback passed to setHoverable
    const hoverCallback = mockViewer.setHoverable.mock.calls[0][2];
    const mockAtom = { resn: 'ALA', resi: 10, b: 95 };
    
    // Trigger hover
    hoverCallback(mockAtom, mockViewer, {}, {});
    
    expect(onHoverMock).toHaveBeenCalledWith({
      residue: 'ALA',
      position: 10,
      confidence: 95
    });
  });

  it('handles zoom controls', async () => {
    render(<ProteinStructureViewer pdbData={mockPdbData} />);
    
    await waitFor(() => expect(mockViewer.render).toHaveBeenCalled());

    const zoomInBtn = screen.getByTitle('Zoom In');
    fireEvent.click(zoomInBtn);
    expect(mockViewer.zoom).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
  });
});
