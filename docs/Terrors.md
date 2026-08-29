 VITE v6.4.3  ready in 319 ms

  ➜  Local:   http://localhost:3001/
  ➜  Network: http://192.168.1.3:3001/
  ➜  Network: http://172.22.32.1:3001/
  ➜  press h + enter to show help
4:18:34 am [vite] (client) hmr update /components/VariantExplainerTab.tsx
4:18:52 am [vite] (client) hmr update /components/Analytics/HistoryTable.tsx, /components/DiseaseTracerTab.tsx, /components/VariantExplainerTab.tsx
4:19:28 am [vite] (client) hmr update /components/ProteinStructureViewer.tsx
4:19:49 am [vite] (client) hmr update /components/ProteinStructureViewer.tsx (x2)
4:20:38 am [vite] (client) hmr update /components/ProteinStructureViewer.tsx (x3)
4:20:39 am [vite] Internal server error: E:\MutationMechanic\components\ProteinStructureViewer.tsx: Identifier 'backendService' has already been declared. (6:9)

  4 | import { backendService } from '../services/backendService';
  5 | import { UNIPROT_MAP } from '../constants';
> 6 | import { backendService } from '../services/backendService';
    |          ^
  7 | import { UNIPROT_MAP } from '../constants';
  8 |
  9 | export type RenderStyle = 'cartoon' | 'sphere' | 'stick';
  Plugin: vite:react-babel
  File: E:/MutationMechanic/components/ProteinStructureViewer.tsx:6:9
  4  |  import { backendService } from '../services/backendService';
  5  |  import { UNIPROT_MAP } from '../constants';
  6  |  import { backendService } from '../services/backendService';
     |                ^
  7  |  import { UNIPROT_MAP } from '../constants';