import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ConstraintEditor,
  ConstraintEditorDraft,
  ParameterControls,
  RunStatusBadge,
  StudioSpinner,
  toConstraintDtos,
  parseResiduePositions,
  parseResidueNumbers,
} from './DesignStudioShared';
import { ConstraintType, DesignRunStatus } from '../../services/designStudioService';

describe('DesignStudio shared — residue parsing', () => {
  it('parseResiduePositions turns comma-separated text into chain-tagged positions', () => {
    expect(parseResiduePositions('12, 46, 50, junk, ', 'A')).toEqual([
      { chain: 'A', position: 12 },
      { chain: 'A', position: 46 },
      { chain: 'A', position: 50 },
    ]);
  });

  it('parseResiduePositions returns [] for empty/invalid text', () => {
    expect(parseResiduePositions('', 'B')).toEqual([]);
    expect(parseResiduePositions('abc,,', 'B')).toEqual([]);
  });

  it('parseResidueNumbers filters non-positive entries', () => {
    expect(parseResidueNumbers('790, 0, -3, 791')).toEqual([790, 791]);
    expect(parseResidueNumbers('')).toEqual([]);
  });
});

describe('DesignStudio shared — constraint DTO conversion', () => {
  it('converts hotspot, interface and burial-depth drafts to typed DTOs', () => {
    const drafts: ConstraintEditorDraft[] = [
      { type: ConstraintType.HOTSPOT, key: 'h1', chain: 'A', positions: '12,13' },
      { type: ConstraintType.INTERFACE, key: 'i1', chain: 'B', residues: '790, 791', shapeComplementarity: 0.7 },
      { type: ConstraintType.BURY_DEPTH, key: 'b1', chain: 'A', positions: '144', minDepth: 2.5, maxDepth: 8 },
    ];

    const dtos = toConstraintDtos(drafts);

    expect(dtos).toHaveLength(3);
    expect(dtos[0]).toEqual({ type: ConstraintType.HOTSPOT, residues: [{ chain: 'A', position: 12 }, { chain: 'A', position: 13 }] });
    expect(dtos[1]).toEqual({ type: ConstraintType.INTERFACE, chain: 'B', residues: [790, 791], shapeComplementarity: 0.7 });
    expect(dtos[2]).toEqual({ type: ConstraintType.BURY_DEPTH, residues: [{ chain: 'A', position: 144 }], minDepth: 2.5, maxDepth: 8 });
  });

  it('drops drafts that resolve to no residues or non-positive depth', () => {
    const drafts: ConstraintEditorDraft[] = [
      { type: ConstraintType.HOTSPOT, key: 'empty', chain: 'A', positions: '  ,' },
      { type: ConstraintType.BURY_DEPTH, key: 'bd0', chain: 'A', positions: '5', minDepth: 0 },
      { type: ConstraintType.INTERFACE, key: 'i1', chain: 'A', residues: '3' },
    ];
    expect(toConstraintDtos(drafts)).toEqual([{ type: ConstraintType.INTERFACE, chain: 'A', residues: [3] }]);
  });
});

describe('DesignStudio shared — small presentational bits', () => {
  it('RunStatusBadge renders the status text for each lifecycle state', () => {
    const { rerender } = render(<RunStatusBadge status={DesignRunStatus.QUEUED} />);
    expect(screen.getByText('QUEUED')).toBeInTheDocument();
    rerender(<RunStatusBadge status={DesignRunStatus.RUNNING} />);
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    rerender(<RunStatusBadge status={DesignRunStatus.VALIDATING} />);
    expect(screen.getByText('VALIDATING')).toBeInTheDocument();
    rerender(<RunStatusBadge status={DesignRunStatus.COMPLETED} />);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    rerender(<RunStatusBadge status={DesignRunStatus.FAILED} />);
    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });

  it('StudioSpinner exposes a screen-reader label', () => {
    render(<StudioSpinner label="Loading design studio…" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading design studio…')).toBeInTheDocument();
  });

  it('ParameterControls shows all RFD3 fields and pushes updates', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ParameterControls parameters={{ numDesigns: 4, diffusionSteps: 50 }} onChange={onChange} />);

    const numDesigns = screen.getByLabelText('Num designs');
    expect(numDesigns).toHaveValue(4);
    fireEvent.change(numDesigns, { target: { value: '8' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ numDesigns: 8, diffusionSteps: 50 }));
  });

  it('ConstraintEditor can add and remove a hotspot constraint', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<ConstraintEditor constraints={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Add/i }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: ConstraintType.HOTSPOT, chain: 'A' }),
    ]);

    const added: ConstraintEditorDraft[] = [
      { type: ConstraintType.HOTSPOT, key: 'c-1', chain: 'A', positions: '12' },
    ];
    rerender(<ConstraintEditor constraints={added} onChange={onChange} />);
    expect(screen.getByText('hotspot')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Remove hotspot constraint/i }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});