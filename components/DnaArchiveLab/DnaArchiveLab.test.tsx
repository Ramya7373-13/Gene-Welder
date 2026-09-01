import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DNA_ARCHIVE_DISCLAIMER } from '../../types/dnaStorage';
import OverviewScreen from './OverviewScreen';
import NewExperimentWizard from './NewExperimentWizard';
import EncodingVisualizer from './EncodingVisualizer';
import ErrorSimulatorScreen from './ErrorSimulatorScreen';
import DecodeVerifyScreen from './DecodeVerifyScreen';
import CompareScreen from './CompareScreen';
import HistoryScreen from './HistoryScreen';
import DocumentationScreen from './DocumentationScreen';
import FutureLabIntegrationsScreen from './FutureLabIntegrationsScreen';
import DnaArchiveLabTab from './DnaArchiveLabTab';

vi.mock('../../services/dnaArchiveLabService', () => ({
  dnaArchiveLabService: {
    createExperiment: vi.fn(),
    uploadFile: vi.fn(),
    encodeExperiment: vi.fn(),
    simulateExperiment: vi.fn(),
    decodeExperiment: vi.fn(),
    getExperiment: vi.fn(),
    getStrands: vi.fn(),
    getReport: vi.fn(),
    listExperiments: vi.fn().mockResolvedValue([]),
    deleteExperiment: vi.fn(),
  },
}));

const screens: Array<[string, React.ReactElement]> = [
  ['Overview', <OverviewScreen key="o" />],
  ['New experiment', <NewExperimentWizard key="n" />],
  ['Encode', <EncodingVisualizer key="e" experimentId={null} />],
  ['Error simulation', <ErrorSimulatorScreen key="s" experimentId={null} uniqueStrands={0} />],
  ['Decode', <DecodeVerifyScreen key="d" experimentId={null} />],
  ['Compare', <CompareScreen key="c" />],
  ['History', <HistoryScreen key="h" />],
  ['Documentation', <DocumentationScreen key="doc" />],
  ['Future', <FutureLabIntegrationsScreen key="f" />],
];

describe('DNA Archive Lab screens', () => {
  it.each(screens)('%s carries the research disclaimer footer', (_name, node) => {
    render(node);
    expect(screen.getAllByText(DNA_ARCHIVE_DISCLAIMER).length).toBeGreaterThan(0);
  });

  it('overview explains the computational flow and archival (not RAM/SSD) role', () => {
    render(<OverviewScreen />);
    expect(screen.getByText(/Digital file/i)).toBeInTheDocument();
    expect(screen.getByText(/channel error simulation/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not a replacement for RAM\/SSDs/i).length).toBeGreaterThan(0);
  });

  it('wizard walks through five named steps', async () => {
    const user = userEvent.setup();
    render(<NewExperimentWizard />);
    expect(screen.getByText(/Experiment name/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Experiment name/i), 'Fixture run');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    expect(screen.getByText(/Upload/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sample payload/i })).toBeInTheDocument();
  });

  it('compare page lists the eight spec metrics', () => {
    render(<CompareScreen />);
    const labels = [
      'Encoding overhead',
      'Total bases',
      'Estimated storage density',
      'Number of strands',
      'Dropout tolerance',
      'Recovery success',
      'Recovered checksum match',
      'Effective payload rate',
    ];
    for (const label of labels) {
      expect(screen.getByText(new RegExp(label, 'i'))).toBeInTheDocument();
    }
    expect(screen.getByText(/theoretical\/simulation-derived/i)).toBeInTheDocument();
  });

  it('error simulator names simulated channel error, not mutation prediction', () => {
    render(<ErrorSimulatorScreen experimentId={null} uniqueStrands={4} />);
    expect(screen.getAllByText(/simulated channel error/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/mutation prediction/i)).not.toBeInTheDocument();
  });

  it('future integrations is a disabled Coming later placeholder', () => {
    render(<FutureLabIntegrationsScreen />);
    expect(screen.getAllByText(/Coming later/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/disabled/i).length).toBeGreaterThan(0);
  });

  it('tab shell exposes all nine screens', async () => {
    const user = userEvent.setup();
    render(<DnaArchiveLabTab />);
    const names = [
      'Overview',
      'New experiment',
      'Encode',
      'Error simulation',
      'Decode and verify',
      'Compare',
      'History',
      'Documentation',
      'Future integrations',
    ];
    for (const name of names) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: /Documentation/i }));
    expect(screen.getAllByText(DNA_ARCHIVE_DISCLAIMER).length).toBeGreaterThan(0);
  });
});
