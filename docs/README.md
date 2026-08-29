# MutationMechanic

AI-driven protein engineering dashboard for analyzing pathogenicity, structural impact, and splicing defects.

## Features

*   **Variant Explainer:** Visualizes AlphaFold 3 structures with per-residue confidence (pLDDT) heatmaps. Compare Wild-Type vs Mutant structures side-by-side.
*   **Compensatory Design:** AI-suggested stabilizing mutations to rescue protein function.
*   **Splicing Decoder:** Deep learning integration (AlphaGenome/DeepSplicer) to predict exon skipping and cryptic splice site activation. Includes MedGemma clinical interpretation.
*   **Interactive 3D Viewer:** WebGL-based structure viewer using `3Dmol.js` with molecular surface and confidence coloring.

## Tech Stack

*   **Frontend:** React 18, TypeScript, Tailwind CSS, Recharts, Lucide React
*   **3D Visualization:** 3Dmol.js
*   **AI Integration:** Google GenAI SDK (Gemini 2.5), ESMFold (Proxy for structure generation)
*   **Build:** Vite (Assumed) or Create React App

## Prerequisites

*   Node.js 18+
*   NPM or Yarn

## Setup & Run

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Configuration**
    Create a `.env` file in the root:
    ```env
    # Optional: For Live AI Analysis
    REACT_APP_GEMINI_API_KEY=your_key_here
    ```
    *Note: The app runs in "Simulation Mode" with mock data if no keys are provided.*

3.  **Start Development Server**
    ```bash
    npm start
    # or
    npm run dev
    ```

4.  **Run Tests**
    ```bash
    npm test
    ```

## Key Components

*   `VariantExplainerTab`: Main dashboard for structural analysis.
*   `ProteinStructureViewer`: Wrapper around 3Dmol.js for rendering PDB data.
*   `SplicingDecoderTab`: Visualizer for intron/exon junctions and splicing scores.

## License

Research Use Only.
