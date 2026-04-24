
export interface TextLayerData {
    id: string;
    text: string;
    x: number; // Percentage 0-100
    y: number; // Percentage 0-100
    fontSize: number;
    fontFamily: string;
    color: string;
    fontWeight?: string;
    fontStyle?: string;
    letterSpacing?: number;
    textTransform?: string;
    align?: 'left' | 'center' | 'right';
    textShadow?: string; // CSS text-shadow value
}

export interface HistoryItem {
  id: string;
  url: string;
  timestamp: number;
  prompt: string;
  textLayers: TextLayerData[];
}

export interface ReferenceImage {
    id: string;
    base64: string | null;
    instruction: string; // "O que pegar dessa imagem?"
}

export interface SubjectImage {
    id: string;
    base64: string | null;
    description?: string;
}

export interface Persona {
  id: string;
  name: string;
  images: string[];
}

export interface AppState {
  currentTab: 'editor' | 'personas';
  personas: Persona[];
  selectedPersonaId: string | null;

  // New Dynamic Input System
  mainIdea: string; // Ideia simples do usuário (Cenário/Ação)
  referenceImages: ReferenceImage[]; // Lista dinâmica de imagens (Estilo)

  // Dynamic Subject Specifics
  subjectType: 'person' | 'object' | 'person_with_object';
  subjectImages: SubjectImage[]; // Lista dinâmica de sujeitos (Antes era fixo)
  subjectDescription: string; // "Como quer o sujeito?"
  subjectPosition: 'center' | 'left' | 'right'; // Posicionamento do sujeito

  keepText: boolean; // Toggle de Texto
  aspectRatio: string;
  imageCount: number;
  colorMode: 'original' | 'single' | 'dual' | 'tri';
  color1: string;
  color2: string;
  color3: string;
  
  lastGeneratedPrompt: string;
  isProcessing: boolean;
  loadingStep: string;
  loadingProgress: number;
  results: string[];
  history: HistoryItem[];
  isHistoryOpen: boolean;
  viewingImage: HistoryItem | null;
  
  // Photography Settings
  selectedStyle: string;
  selectedAngle: string;
  selectedFocus: string;
  selectedLens: string; // New field
  selectedLighting: string;
  selectedFraming: string;
  selectedSpecialEffects: string;

  // Subject Details (Now Arrays for Multi-select)
  selectedGaze: string[];
  selectedExpression: string[];
  selectedSkinTexture: string[];
  floatingElements: string;

  selectedModel: 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image';

  error: string | null;
  statusMessage: { type: 'success' | 'error', text: string } | null;
}

export interface GeneratedImage {
    url: string;
    id: string;
}