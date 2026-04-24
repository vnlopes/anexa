import React, { useState, useEffect } from 'react';
import Dropzone from './components/Dropzone';
import { analyzeAndGeneratePrompt, generateImage, generateVariations } from './services/geminiService';
import { AppState, HistoryItem, ReferenceImage, SubjectImage, TextLayerData, Persona } from './types';
import { getHistoryFromDB, saveHistoryItemToDB, getPersonasFromDB, savePersonaToDB, deletePersonaFromDB, clearHistoryDB } from './services/dbService';

// Subject Details Options
const SUBJECT_OPTIONS = [
    {
        id: 'skin',
        title: 'Textura da Pele (Múltipla Escolha)',
        stateKey: 'selectedSkinTexture',
        items: [
            { value: 'Ultra Realista (Padrão)', label: 'Ultra Realista', desc: 'Equilíbrio natural de poros e textura.' },
            { value: 'Poros Visíveis (Raw)', label: 'Poros Visíveis', desc: 'Foco macro na textura da pele (Raw).' },
            { value: 'Imperfeições Realistas', label: 'Imperfeições', desc: 'Manchas, acne leve, textura orgânica.' },
            { value: 'Linhas de Expressão', label: 'Pele Madura', desc: 'Rugas e marcas do tempo visíveis.' },
            { value: 'Pele de Porcelana', label: 'Suave / Beauty', desc: 'Pele limpa, estilo maquiagem/retoque.' },
            { value: 'Suada / Glow', label: 'Suada / Glow', desc: 'Pele úmida, brilhante ou pós-treino.' },
        ]
    },
    {
        id: 'expression',
        title: 'Expressão Facial (Múltipla Escolha)',
        stateKey: 'selectedExpression',
        items: [
            { value: 'Neutra', label: 'Neutra', desc: 'Séria e calma.' },
            { value: 'Sorrindo', label: 'Sorrindo', desc: 'Feliz e amigável.' },
            { value: 'Intensa', label: 'Intensa', desc: 'Foco e determinação.' },
            { value: 'Surpresa', label: 'Surpresa', desc: 'Boca aberta, choque.' },
            { value: 'Melancólica', label: 'Melancólica', desc: 'Triste e reflexiva.' },
            { value: 'Sedutora', label: 'Carismática', desc: 'Charme e confiança.' },
        ]
    },
    {
        id: 'gaze',
        title: 'Direção do Olhar (Múltipla Escolha)',
        stateKey: 'selectedGaze',
        items: [
            { value: 'Para a Câmera', label: 'Para a Câmera', desc: 'Contato visual direto.' },
            { value: 'Para Esquerda', label: 'Esquerda', desc: 'Olhando para o lado esquerdo.' },
            { value: 'Para Direita', label: 'Direita', desc: 'Olhando para o lado direito.' },
            { value: 'Para Cima', label: 'Para Cima', desc: 'Olhar elevado/inspirado.' },
            { value: 'Para Baixo', label: 'Para Baixo', desc: 'Olhar tímido ou pensativo.' },
            { value: 'Olhos Fechados', label: 'Olhos Fechados', desc: 'Serenidade ou sono.' },
        ]
    }
];

// Photo Options Data
const PHOTO_OPTIONS = [
    {
        id: 'framing',
        title: '1. Distância (Enquadramento)',
        stateKey: 'selectedFraming',
        items: [
            { value: 'Extreme Close-up', label: 'Macro / Detalhe', desc: 'Foco extremo em olhos ou textura.' },
            { value: 'Close-up (Rosto)', label: 'Close-up', desc: 'Rosto preenche o quadro.' },
            { value: 'Medium Shot (Cintura)', label: 'Plano Médio', desc: 'Da cintura para cima.' },
            { value: 'Cowboy Shot (Joelhos)', label: 'Plano Americano', desc: 'Dos joelhos para cima.' },
            { value: 'Full Body', label: 'Corpo Inteiro', desc: 'O sujeito inteiro visível.' },
            { value: 'Wide Shot', label: 'Plano Aberto', desc: 'Sujeito pequeno, cenário vasto.' },
        ]
    },
    {
        id: 'style',
        title: '2. Estilos de Imagem (Vibe)',
        stateKey: 'selectedStyle',
        items: [
            { value: 'Fotorrealista', label: 'Fotorrealista', desc: 'Texturas reais e imperfeições naturais.' },
            { value: 'Cinematográfico', label: 'Cinematográfico', desc: 'Luz dramática, cores de cinema.' },
            { value: 'Hiper-realista', label: 'Hiper-realista', desc: 'Retrato cinematográfico 8K, pele ultra detalhada.' },
            { value: 'Cartoonesco Pixar', label: 'Cartoon 3D', desc: 'Estilo Pixar, fofo e perfeito.' },
            { value: 'Editorial Fashion', label: 'Editorial de Moda', desc: 'High-end, pose e luz de revista.' },
            { value: '3D CGI AAA', label: '3D CGI AAA (Game)', desc: 'Unreal Engine 5, Frostbite, hiper-realista.' },
        ]
    },
    {
        id: 'lens',
        title: '3. Lentes de Câmera',
        stateKey: 'selectedLens',
        items: [
            { value: '35mm', label: '35mm (Olho Humano)', desc: 'Natural, versátil, documental.' },
            { value: '50mm', label: '50mm (Retrato)', desc: 'Padrão para retratos, sem distorção.' },
            { value: '85mm', label: '85mm (Beauty)', desc: 'Compressão facial, fundo desfocado.' },
            { value: '24mm', label: '24mm (Grande Angular)', desc: 'Cenários amplos, distorção leve.' },
            { value: 'Macro 100mm', label: 'Macro 100mm', desc: 'Detalhes extremos, textura.' },
            { value: 'Fisheye', label: 'Olho de Peixe', desc: 'Distorção esférica extrema.' },
        ]
    },
    {
        id: 'special_effects',
        title: '4. Luzes Surrealistas & FX',
        stateKey: 'selectedSpecialEffects',
        items: [
            { value: 'Dreamy Bloom', label: 'Bloom Etéreo', desc: 'Brilho suave e onírico.' },
            { value: 'Rear Flash', label: 'Flash Traseiro', desc: 'Estilo paparazzi, luz dura frontal.' },
            { value: 'Double Exposure', label: 'Dupla Exposição', desc: 'Sobreposição artística.' },
            { value: 'Bioluminescence', label: 'Bioluminescência', desc: 'Brilho neon orgânico.' },
            { value: 'Prism Refraction', label: 'Prisma / Refração', desc: 'Fragmentação de luz e arco-íris.' },
            { value: 'God Rays', label: 'God Rays', desc: 'Feixes de luz divina atravessando.' },
            { value: 'Glitch Art', label: 'Glitch Digital', desc: 'Distorção digital.' },
        ]
    },
    {
        id: 'angle',
        title: '5. Ângulos de Câmera',
        stateKey: 'selectedAngle',
        items: [
            { value: 'Visão de Drone', label: 'Drone (Aérea)', desc: 'Visão total de cima para baixo.' },
            { value: 'Low Angle', label: 'Low Angle', desc: 'De baixo para cima, visual heróico.' },
            { value: 'High Angle', label: 'High Angle', desc: 'De cima, sujeito parece menor.' },
            { value: 'Primeira Pessoa (POV)', label: 'POV', desc: 'Visão pelos olhos do observador.' },
            { value: 'Nível dos Olhos', label: 'Nível dos Olhos', desc: 'Neutro e natural.' },
        ]
    },
    {
        id: 'lighting',
        title: '6. Iluminação Base',
        stateKey: 'selectedLighting',
        items: [
            { value: 'Hora Dourada', label: 'Hora Dourada', desc: 'Luz solar quente.' },
            { value: 'Luz de Estúdio', label: 'Estúdio (Softbox)', desc: 'Suave, perfeita, sem sombras duras.' },
            { value: 'Luz Dramática', label: 'Dramática', desc: 'Alto contraste, sombras escuras.' },
            { value: 'Neon Cyberpunk', label: 'Neon', desc: 'Luzes coloridas, futurista.' },
            { value: 'Luz Natural Difusa', label: 'Nublado/Suave', desc: 'Luz branca uniforme.' },
        ]
    }
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState & { lastGeneratedTextLayers: TextLayerData[] }>({
    currentTab: 'editor',
    personas: [],
    selectedPersonaId: null,
    
    mainIdea: "",
    referenceImages: [], 
    
    // Subject Defaults
    subjectType: 'person',
    subjectImages: [], // Now an array
    subjectDescription: "",
    subjectPosition: 'center',

    keepText: false,
    aspectRatio: "4:5",
    imageCount: 1,
    colorMode: "original",
    color1: "#ffffff",
    color2: "#000000",
    color3: "#808080",
    
    selectedModel: 'gemini-3-pro-image-preview',

    lastGeneratedPrompt: "",
    lastGeneratedTextLayers: [],
    isProcessing: false,
    loadingStep: "",
    loadingProgress: 0,
    results: [],
    history: [],
    isHistoryOpen: false,
    viewingImage: null,
    
    selectedStyle: "",
    selectedAngle: "",
    selectedFocus: "",
    selectedLens: "",
    selectedLighting: "",
    selectedFraming: "", 
    selectedSpecialEffects: "",
    
    selectedGaze: [],
    selectedExpression: [],
    selectedSkinTexture: [],
    floatingElements: "",

    error: null,
    statusMessage: null
  });

  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggleSection = (id: string) => setOpenSection(openSection === id ? null : id);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showApiInput, setShowApiInput] = useState(false);
  const [apiInputValue, setApiInputValue] = useState('');

  useEffect(() => {
    checkApiKey();
    loadCacheData();
  }, []);

  const loadCacheData = async () => {
    try {
      const dbHistory = await getHistoryFromDB();
      const dbPersonas = await getPersonasFromDB();
      setState(prev => ({
        ...prev,
        history: dbHistory.sort((a, b) => b.timestamp - a.timestamp),
        personas: dbPersonas
      }));
    } catch (e) {
      console.error('Error loading db', e);
    }
  };

  const checkApiKey = async () => {
     const aistudio = (window as any).aistudio;
     if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
     } else {
         const localKey = localStorage.getItem('vercel_gemini_api_key');
         if (localKey) {
             setHasApiKey(true);
         } else {
             setHasApiKey(false);
             setShowApiInput(true);
         }
     }
  };

  const handleSelectKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
          await aistudio.openSelectKey();
          setHasApiKey(true);
      } else {
          setShowApiInput(true);
      }
  };

  const saveApiKey = () => {
      if (apiInputValue && apiInputValue.trim() !== '') {
          localStorage.setItem('vercel_gemini_api_key', apiInputValue.trim());
          setHasApiKey(true);
          setShowApiInput(false);
          setApiInputValue('');
          showStatus('success', 'API Key salva com sucesso!');
      }
  };

  const clearApiKey = () => {
      localStorage.removeItem('vercel_gemini_api_key');
      setHasApiKey(false);
      showStatus('success', 'API Key removida do cache.');
      setShowApiInput(true);
  };

  const showStatus = (type: 'success' | 'error', text: string) => {
    setState(prev => ({ ...prev, statusMessage: { type, text } }));
    setTimeout(() => {
      setState(prev => ({ ...prev, statusMessage: null }));
    }, 4000);
  };

  const addToHistory = (urls: string[], prompt: string, textLayers?: TextLayerData[]) => {
    const newItems: HistoryItem[] = urls.map(url => ({
      id: crypto.randomUUID(),
      url,
      timestamp: Date.now(),
      prompt,
      textLayers: textLayers || []
    }));
    
    // Save each to DB
    newItems.forEach(item => saveHistoryItemToDB(item));

    setState(prev => ({
      ...prev,
      history: [...newItems, ...prev.history].slice(0, 50)
    }));
  };

  const deleteHistoryItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setState(prev => ({
      ...prev,
      history: prev.history.filter(item => item.id !== id),
      viewingImage: prev.viewingImage?.id === id ? null : prev.viewingImage
    }));
  };

  // Reference Image Handlers
  const addReferenceImage = () => {
      setState(prev => ({
          ...prev,
          referenceImages: [
              ...prev.referenceImages,
              { id: crypto.randomUUID(), base64: null, instruction: "" }
          ]
      }));
  };

  const updateReferenceImage = (id: string, field: 'base64' | 'instruction', value: string | null) => {
      setState(prev => ({
          ...prev,
          referenceImages: prev.referenceImages.map(img => 
              img.id === id ? { ...img, [field]: value } : img
          )
      }));
  };

  const removeReferenceImage = (id: string) => {
      setState(prev => ({
          ...prev,
          referenceImages: prev.referenceImages.filter(img => img.id !== id)
      }));
  };

  // Subject Image Handlers
  const addSubjectImage = () => {
      setState(prev => ({
          ...prev,
          subjectImages: [
              ...prev.subjectImages,
              { id: crypto.randomUUID(), base64: null }
          ]
      }));
  };

  const updateSubjectImage = (id: string, field: 'base64' | 'description', value: string | null) => {
      setState(prev => ({
          ...prev,
          subjectImages: prev.subjectImages.map(img => 
              img.id === id ? { ...img, [field]: value } : img
          )
      }));
  };

  const removeSubjectImage = (id: string) => {
      setState(prev => ({
          ...prev,
          subjectImages: prev.subjectImages.filter(img => img.id !== id)
      }));
  };


  const handleGenerate = async () => {
    let finalSubjectImages = [...state.subjectImages];
    if (state.selectedPersonaId) {
        const persona = state.personas.find(p => p.id === state.selectedPersonaId);
        if (persona) {
            finalSubjectImages = persona.images.map((img, i) => ({
                id: crypto.randomUUID(),
                base64: img,
                description: i === 0 ? "Foto principal do Preset." : "Ângulo do Preset."
            }));
        }
    }

    // Check if at least one subject image exists OR user wrote an idea
    const hasSubject = finalSubjectImages.some(img => img.base64 !== null);
    
    if (!state.mainIdea && !hasSubject) {
      showStatus('error', 'Descreva uma ideia ou adicione um sujeito (ou selecione um preset).');
      return;
    }
    if (!hasApiKey && (window as any).aistudio) {
        showStatus('error', 'API Key necessária.');
        return;
    }

    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
      results: [],
      loadingStep: 'Iniciando...',
      loadingProgress: 5
    }));

    try {
      setState(prev => ({ ...prev, loadingStep: 'Criando Prompt Detalhado (Gemini 3.0)', loadingProgress: 25 }));
      
      const { prompt, textLayers } = await analyzeAndGeneratePrompt(
        state.mainIdea,
        state.subjectType,
        finalSubjectImages,
        state.subjectDescription,
        state.subjectPosition,
        state.referenceImages,
        state.colorMode,
        state.color1,
        state.color2,
        state.color3,
        state.keepText,
        state.aspectRatio,
        {
            style: state.selectedStyle,
            angle: state.selectedAngle,
            focus: state.selectedFocus,
            lens: state.selectedLens,
            lighting: state.selectedLighting,
            framing: state.selectedFraming,
            specialEffects: state.selectedSpecialEffects,
            floatingElements: state.floatingElements
        },
        {
            gaze: state.selectedGaze,
            expression: state.selectedExpression,
            skinTexture: state.selectedSkinTexture
        }
      );

      setState(prev => ({ 
        ...prev, 
        lastGeneratedPrompt: prompt,
        lastGeneratedTextLayers: textLayers,
        loadingStep: `Renderizando Visual...`, 
        loadingProgress: 60 
      }));

      const newImages: string[] = [];
      for (let i = 0; i < state.imageCount; i++) {
         setState(prev => ({ ...prev, loadingStep: `Renderizando Visual (${i + 1}/${state.imageCount})...` }));
         try {
             const img = await generateImage(
                 prompt,
                 finalSubjectImages,
                 state.referenceImages, 
                 state.aspectRatio,
                 state.selectedModel
             );
             newImages.push(img);
         } catch (err) {
             console.error(`Error generating image ${i + 1}:`, err);
             if (i === 0) throw err; // If the first one fails, abort
         }
      }
      
      addToHistory(newImages, prompt, textLayers);

      setState(prev => ({
        ...prev,
        isProcessing: false,
        results: newImages,
        loadingProgress: 100,
        loadingStep: 'Concluído'
      }));
      showStatus('success', 'Geração concluída.');

    } catch (err: any) {
      console.error(err);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: err.message || 'Erro desconhecido',
        loadingProgress: 0
      }));
      showStatus('error', err.message || 'Falha na geração.');
    }
  };

  const handleVariations = async (imageUrl: string, prompt: string) => {
      setState(prev => ({
          ...prev,
          isProcessing: true,
          loadingStep: 'Gerando Variação...',
          loadingProgress: 10
      }));

      try {
          const newImage = await generateVariations(imageUrl, prompt, state.aspectRatio);
          
          setState(prev => ({
              ...prev,
              results: [newImage, ...prev.results],
              isProcessing: false,
              loadingProgress: 100,
              loadingStep: 'Concluído'
          }));
          showStatus('success', 'Variação gerada!');
      } catch (err: any) {
          console.error(err);
          setState(prev => ({
              ...prev,
              isProcessing: false,
              error: err.message || 'Erro ao gerar variação',
              loadingProgress: 0
          }));
          showStatus('error', 'Falha na variação.');
      }
  };

  const copyPrompt = (text: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
      showStatus('success', 'Prompt copiado!');
    }
  };

  const openImage = (url: string, id?: string, prompt?: string, textLayers?: TextLayerData[]) => {
     setState(prev => ({
         ...prev,
         viewingImage: {
             url,
             id: id || 'temp',
             timestamp: Date.now(),
             prompt: prompt || prev.lastGeneratedPrompt,
             textLayers: textLayers || prev.lastGeneratedTextLayers || []
         }
     }));
  };

  // Helper labels
  const getLabel = () => {
      if (state.subjectType === 'person_with_object') return "Pessoa ou Objeto";
      if (state.subjectType === 'object') return "Objeto / Produto";
      return "Pessoa (Modelo)";
  };
  const getIcon = () => {
      if (state.subjectType === 'object') return 'fa-cube';
      return 'fa-user';
  };

  // Multi-select handler
  const toggleMultiSelect = (key: 'selectedGaze' | 'selectedExpression' | 'selectedSkinTexture', value: string) => {
      setState(prev => {
          const current = prev[key];
          const exists = current.includes(value);
          return {
              ...prev,
              [key]: exists ? current.filter(item => item !== value) : [...current, value]
          };
      });
  };

  const handleAddPersonaImages = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (event) => {
              const base64 = event.target?.result as string;
              setNewPersonaImages(prev => [...prev, base64]);
          };
          reader.readAsDataURL(file);
      });
  };

  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaImages, setNewPersonaImages] = useState<string[]>([]);

  const handleSavePersona = () => {
      if (!newPersonaName.trim()) {
          showStatus('error', 'Dê um nome ao modelo.');
          return;
      }
      if (newPersonaImages.length === 0) {
          showStatus('error', 'Adicione pelo menos uma imagem.');
          return;
      }

      const persona: Persona = {
          id: crypto.randomUUID(),
          name: newPersonaName.trim(),
          images: newPersonaImages
      };

      savePersonaToDB(persona);
      setState(prev => ({
          ...prev,
          personas: [...prev.personas, persona],
          currentTab: 'editor'
      }));
      setNewPersonaName("");
      setNewPersonaImages([]);
      showStatus('success', 'Modelo salvo com sucesso!');
  };

  const removeNewPersonaImage = (index: number) => {
      setNewPersonaImages(prev => prev.filter((_, i) => i !== index));
  };

  const renderPersonasTab = () => (
      <div className="max-w-[1000px] mx-auto px-4 py-12">
          <h2 className="text-3xl font-bold text-white mb-2">Treinar Novo Modelo</h2>
          <p className="text-gray-400 mb-8 text-sm">Adicione imagens do rosto de uma pessoa em diferentes ângulos para que a IA possa preservá-la em futuras gerações.</p>

          <div className="space-y-6">
              <div className="glass-panel p-6 rounded-sm border border-white/5">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 block">Nome do Modelo</label>
                  <input
                      type="text"
                      className="w-full bg-black/50 border border-white/10 rounded-sm p-3 text-white focus:outline-none focus:border-neon-500 font-mono text-sm"
                      placeholder="Ex: João Silva"
                      value={newPersonaName}
                      onChange={(e) => setNewPersonaName(e.target.value)}
                  />
              </div>

              <div className="glass-panel p-6 rounded-sm border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                      <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold block">Imagens de Treinamento</label>
                      <span className="text-[9px] uppercase tracking-widest text-neon-500 bg-neon-500/10 px-2 py-1 rounded-sm">Recomendado: 6 ângulos diferentes</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {newPersonaImages.map((img, i) => (
                          <div key={i} className="relative aspect-square border border-white/10 group rounded-sm overflow-hidden bg-black/50">
                              <img src={img} className="w-full h-full object-cover opacity-80" />
                              <button onClick={() => removeNewPersonaImage(i)} className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs">
                                  <i className="fas fa-times"></i>
                              </button>
                          </div>
                      ))}
                      <div className="aspect-square border border-dashed border-white/20 rounded-sm flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-neon-500 transition-colors relative bg-black/20 cursor-pointer">
                          <input type="file" multiple accept="image/*" onChange={handleAddPersonaImages} className="opacity-0 absolute inset-0 cursor-pointer" />
                          <i className="fas fa-plus mb-2"></i>
                          <span className="text-[10px] uppercase tracking-widest font-bold">Adicionar</span>
                      </div>
                  </div>
              </div>

              <div className="flex justify-end pt-4">
                  <button onClick={handleSavePersona} className="bg-neon-500 text-black px-8 py-3 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-neon-400 transition-colors shadow-[0_0_20px_rgba(226,231,131,0.2)]">
                      Salvar Modelo
                  </button>
              </div>
          </div>
          
          {state.personas.length > 0 && (
              <div className="mt-16">
                  <h3 className="text-xl font-bold text-white mb-6 border-b border-white/5 pb-4">Modelos Salvos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {state.personas.map(persona => (
                          <div key={persona.id} className="glass-panel p-4 border border-white/5 rounded-sm relative group flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-black">
                                  {persona.images[0] && <img src={persona.images[0]} className="w-full h-full object-cover" />}
                              </div>
                              <div className="flex-1">
                                  <h4 className="text-sm font-bold text-white">{persona.name}</h4>
                                  <span className="text-[10px] text-gray-500 font-mono">{persona.images.length} imagens</span>
                              </div>
                              <button onClick={() => {
                                  deletePersonaFromDB(persona.id);
                                  setState(prev => ({...prev, personas: prev.personas.filter(p => p.id !== persona.id)}));
                              }} className="text-red-500/50 hover:text-red-500 transition-colors">
                                  <i className="fas fa-trash"></i>
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>
  );

  const handleSelectPersona = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      if (!id) {
          setState(prev => ({ ...prev, selectedPersonaId: null }));
          return;
      }
      setState(prev => ({ ...prev, selectedPersonaId: id }));
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen flex flex-col selection:bg-neon-500/30 selection:text-white bg-background text-gray-200 overflow-x-hidden relative">
      
      {/* API Key Modal Overlay */}
      {showApiInput && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
              <div className="bg-[#111] border border-white/10 p-8 rounded-sm max-w-md w-full shadow-2xl">
                  <h2 className="text-2xl text-white font-bold mb-4 tracking-tight">Bem-vindo ao Anexa</h2>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                      Para utilizar a geração de imagens, por favor, insira sua chave da API do Google Gemini. A chave ficará salva no cache do seu navegador.
                  </p>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-2 block">Gemini API Key</label>
                  <input 
                      type="password" 
                      value={apiInputValue}
                      onChange={(e) => setApiInputValue(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-black border border-white/10 rounded-sm px-4 py-3 text-white text-sm focus:outline-none focus:border-neon-500 transition-colors mb-6 font-mono"
                  />
                  <div className="flex justify-end gap-4">
                      {hasApiKey && (
                          <button onClick={() => setShowApiInput(false)} className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
                              Cancelar
                          </button>
                      )}
                      <button 
                          onClick={saveApiKey}
                          disabled={!apiInputValue.trim()}
                          className="px-6 py-2 bg-neon-500 text-black text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-neon-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          Salvar e Continuar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- BACKGROUND AMBIENCE --- */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] radial-glow-electric opacity-30 blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] radial-glow-neon opacity-20 blur-[100px]"></div>
      </div>

      {/* Lightbox Modal */}
      {state.viewingImage && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-fade-in p-4">
              <div className="absolute top-6 right-6 z-[110] flex gap-3">
                  <button onClick={() => copyPrompt(state.viewingImage!.prompt)} className="w-12 h-12 rounded-full glass-panel text-white flex items-center justify-center hover:bg-electric-500 hover:text-white transition-colors border border-white/10" title="Copiar Prompt">
                      <i className="fas fa-copy"></i>
                  </button>
                  <a href={state.viewingImage.url} download={`design_${state.viewingImage.id.substring(0,6)}.png`} className="w-12 h-12 rounded-full glass-panel text-white flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10">
                      <i className="fas fa-download"></i>
                  </a>
                  <button onClick={() => setState(prev => ({...prev, viewingImage: null}))} className="w-12 h-12 rounded-full glass-panel text-white flex items-center justify-center hover:bg-red-500/20 hover:border-red-500 transition-colors border border-white/10">
                      <i className="fas fa-times"></i>
                  </button>
              </div>
              <div className="relative max-h-[90vh] max-w-full flex justify-center items-center">
                  <img src={state.viewingImage.url} className="max-h-[90vh] max-w-full object-contain rounded-sm shadow-2xl border border-white/10" alt="Full View" />
              </div>
          </div>
      )}

      {/* --- NAVBAR --- */}
      <nav className="border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-50 h-16 w-full">
        <div className="max-w-[1400px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="40" viewBox="0 0 657 462" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M647.64 185.93C658.941 189.25 660.354 204.686 649.843 210.003L155.69 459.993C141.564 467.139 129.352 447.612 141.961 438.039L412.294 232.792C420.64 226.455 418.443 213.354 408.487 210.086L140.737 122.215C129.731 118.603 119.853 130.105 125.086 140.44L137.942 165.832C145.2 180.167 125.101 192.335 115.764 179.258L2.47371 20.5886C-4.70405 10.5357 4.86682 -2.92036 16.7182 0.561658L647.64 185.93Z" fill="url(#paint0_linear_573_26)"/>
<path d="M647.64 185.93C658.941 189.25 660.354 204.686 649.843 210.003L155.69 459.993C141.564 467.139 129.352 447.612 141.961 438.039L412.294 232.792C420.64 226.455 418.443 213.354 408.487 210.086L140.737 122.215C129.731 118.603 119.853 130.105 125.086 140.44L137.942 165.832C145.2 180.167 125.101 192.335 115.764 179.258L2.47371 20.5886C-4.70405 10.5357 4.86682 -2.92036 16.7182 0.561658L647.64 185.93Z" fill="url(#paint1_radial_573_26)"/>
<defs>
<linearGradient id="paint0_linear_573_26" x1="212.337" y1="-31.3238" x2="901.305" y2="215.731" gradientUnits="userSpaceOnUse">
<stop stopColor="#0236C5"/>
<stop offset="1" stopColor="#011A5F"/>
</linearGradient>
<radialGradient id="paint1_radial_573_26" cx="0" cy="0" r="1" gradientTransform="matrix(1457.74 -908.718 62.2982 2067.16 -536.637 776.684)" gradientUnits="userSpaceOnUse">
<stop offset="0.0948243" stopColor="#000801"/>
<stop offset="0.337489" stopColor="#001652"/>
<stop offset="0.576717" stopColor="#0236C5"/>
<stop offset="1" stopColor="#7DA0FF"/>
</radialGradient>
</defs>
</svg>
            <h1 className="text-3xl font-sans font-normal text-white">
              anexa
            </h1>
          </div>

          {/* Center Navigation */}
          <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10">
              <button 
                  onClick={() => setState(prev => ({...prev, currentTab: 'editor'}))}
                  className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${state.currentTab === 'editor' ? 'bg-neon-500 text-black shadow-[0_0_15px_rgba(226,231,131,0.4)]' : 'text-gray-400 hover:text-white'}`}
              >
                  Studio
              </button>
              <button 
                  onClick={() => setState(prev => ({...prev, currentTab: 'personas'}))}
                  className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${state.currentTab === 'personas' ? 'bg-neon-500 text-black shadow-[0_0_15px_rgba(226,231,131,0.4)]' : 'text-gray-400 hover:text-white'}`}
              >
                  Treinar Modelo
              </button>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
             {!hasApiKey ? (
                  <button onClick={handleSelectKey} className="text-neon-500 animate-pulse font-bold tracking-widest">
                      [ INSERT_KEY ]
                  </button>
              ) : (
                  <button onClick={clearApiKey} className="text-gray-400 hover:text-red-400 transition-colors uppercase tracking-wide flex items-center gap-2" title="Limpar Cache de API Key">
                      <i className="fas fa-key"></i>
                      <span className="hidden sm:inline text-[9px]">API</span>
                  </button>
              )}
            
            <button 
                onClick={() => setState(prev => ({...prev, isHistoryOpen: !prev.isHistoryOpen}))}
                className={`text-gray-400 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-wide`}
            >
                <i className="fas fa-history"></i>
                <span className="hidden sm:inline">Histórico</span>
            </button>
          </div>
        </div>
      </nav>

      {/* --- MAIN LAYOUT --- */}
      <div className="flex-1 overflow-y-auto z-10 custom-scrollbar relative">
            
            <div style={{ display: state.currentTab === 'editor' ? 'block' : 'none' }}>
                {/* --- HERO SECTION --- */}
            <header className="relative w-full pt-20 pb-12 text-center px-4 overflow-hidden">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-white/5 bg-white/5 mb-8 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-500 animate-pulse"></span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Sistema Online v3.3</span>
                </div>
                
                <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-white animate-fade-in leading-tight">
                    O futuro <span className="text-gradient-main">do Design</span><br />
                    <span className="text-gradient-blue">Começa aqui!</span>
                </h1>
                
                <p className="text-gray-500 max-w-xl mx-auto text-sm mb-10 animate-fade-in leading-relaxed font-light">
                    Otimização visual via IA generativa. Escreva uma ideia simples ou use referências visuais para criar imagens de alta fidelidade.
                </p>
                
                <div className="flex justify-center gap-6 animate-fade-in">
                    <button onClick={() => document.getElementById('workspace')?.scrollIntoView({behavior: 'smooth'})} className="btn-hover-effect bg-white text-black px-10 py-4 rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-neon-500 transition-colors">
                        Iniciar Sistema
                    </button>
                </div>
            </header>

            {/* --- WORKSPACE --- */}
            <div id="workspace" className="max-w-[1400px] mx-auto px-4 md:px-8 pb-20">
                
                {state.statusMessage && (
                <div className={`fixed top-24 right-10 px-6 py-4 rounded-sm border-l-4 flex items-center gap-4 transition-all duration-300 z-50 shadow-2xl backdrop-blur-xl animate-fade-in ${state.statusMessage.type === 'error' ? 'bg-black/90 border-red-500 text-red-400' : 'bg-black/90 border-neon-500 text-neon-400'}`}>
                    <i className={`fas ${state.statusMessage.type === 'error' ? 'fa-exclamation-triangle' : 'fa-check-square'}`}></i>
                    <span className="text-xs font-mono uppercase">{state.statusMessage.text}</span>
                </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                    {/* LEFT PANEL - CONFIGURATION */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="glass-panel p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-500 to-electric-500 opacity-50"></div>

                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">
                                    // Parâmetros de Criação
                                </h3>
                                <i className="fas fa-sliders-h text-gray-600"></i>
                            </div>

                            {/* Main Idea Input */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-3 bg-neon-500"></div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Sua Ideia / Criação (Cenário e Ação)</p>
                                </div>
                                <textarea 
                                    value={state.mainIdea}
                                    onChange={(e) => setState(prev => ({...prev, mainIdea: e.target.value}))}
                                    placeholder="Ex: Um gato cibernético em Tóquio à noite, luzes neon..."
                                    className="w-full h-24 bg-black/20 border border-white/10 text-xs text-gray-300 p-3 focus:outline-none focus:border-neon-500/50 focus:bg-black/40 transition-all resize-none font-mono placeholder:text-gray-700"
                                ></textarea>
                                <p className="text-[9px] text-gray-600 mt-1 italic">Nossa IA transformará isso em um prompt detalhado.</p>
                            </div>

                            {/* Floating Elements Input */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-3 bg-neon-500"></div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Elementos Flutuantes (Surrealismo)</p>
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Ex: Pétalas de rosa, triângulos neon, folhas secas, bolhas..." 
                                    value={state.floatingElements}
                                    onChange={(e) => setState(prev => ({...prev, floatingElements: e.target.value}))}
                                    className="w-full bg-black/20 border border-white/10 text-xs text-gray-300 p-3 focus:outline-none focus:border-neon-500/50 focus:bg-black/40 transition-all font-mono placeholder:text-gray-700"
                                />
                                <p className="text-[9px] text-gray-600 mt-1 italic">A IA distribuirá esses elementos com profundidade de campo.</p>
                            </div>

                            {/* Specific Subject Input */}
                            <div className="mb-6 border-t border-white/5 pt-6">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-3 bg-electric-500"></div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Sujeito Principal (Opcional)</p>
                                    </div>
                                    {!state.selectedPersonaId && (
                                        <button onClick={addSubjectImage} className="text-[9px] uppercase font-bold text-electric-400 hover:text-white transition-colors border border-electric-500/30 px-2 py-1 hover:bg-electric-500/10">
                                            <i className="fas fa-plus mr-1"></i> Adicionar Foto
                                        </button>
                                    )}
                                </div>

                                {/* Subject Position Toggle */}
                                <div className="mb-4">
                                    <p className="text-[9px] uppercase font-bold text-gray-500 mb-2 tracking-widest">Posicionamento</p>
                                    <div className="flex bg-black/40 border border-white/5 rounded-none overflow-hidden">
                                        <button 
                                            onClick={() => setState(prev => ({...prev, subjectPosition: 'left'}))} 
                                            className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${state.subjectPosition === 'left' ? 'bg-electric-900 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                        >
                                            <i className="fas fa-align-left"></i> Esquerda
                                        </button>
                                        <div className="w-px bg-white/5"></div>
                                        <button 
                                            onClick={() => setState(prev => ({...prev, subjectPosition: 'center'}))} 
                                            className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${state.subjectPosition === 'center' ? 'bg-electric-900 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                        >
                                            <i className="fas fa-align-center"></i> Centro
                                        </button>
                                        <div className="w-px bg-white/5"></div>
                                        <button 
                                            onClick={() => setState(prev => ({...prev, subjectPosition: 'right'}))} 
                                            className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${state.subjectPosition === 'right' ? 'bg-electric-900 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                        >
                                            <i className="fas fa-align-right"></i> Direita
                                        </button>
                                    </div>
                                </div>

                                {/* Subject Type Toggle */}
                                <div className="flex bg-black/40 border border-white/5 mb-4 rounded-none overflow-hidden">
                                    <button 
                                        onClick={() => setState(prev => ({...prev, subjectType: 'person'}))} 
                                        className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${state.subjectType === 'person' ? 'bg-electric-900 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                    >
                                        <i className="fas fa-user"></i> Pessoa
                                    </button>
                                    <div className="w-px bg-white/5"></div>
                                    <button 
                                        onClick={() => setState(prev => ({...prev, subjectType: 'object'}))} 
                                        className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${state.subjectType === 'object' ? 'bg-electric-900 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                    >
                                        <i className="fas fa-cube"></i> Objeto
                                    </button>
                                    <div className="w-px bg-white/5"></div>
                                    <button 
                                        onClick={() => setState(prev => ({...prev, subjectType: 'person_with_object'}))} 
                                        className={`flex-1 py-2 text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${state.subjectType === 'person_with_object' ? 'bg-neon-500 text-black' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                        title="Pessoa + Objeto"
                                    >
                                        <i className="fas fa-hand-holding"></i> Mix
                                    </button>
                                </div>
                                
                                {state.personas.length > 0 && state.subjectType.includes('person') && (
                                    <div className="mb-4">
                                        <p className="text-[9px] uppercase font-bold text-neon-500 mb-2 tracking-widest flex items-center gap-2">
                                            <i className="fas fa-magic"></i> Modelos Treinados
                                        </p>
                                        <select 
                                            value={state.selectedPersonaId || ""}
                                            onChange={handleSelectPersona}
                                            className="w-full bg-black/40 border border-neon-500/30 text-[10px] text-white p-2 rounded-sm focus:outline-none focus:border-neon-500"
                                        >
                                            <option value="">-- Sem Preset / Criar Novo --</option>
                                            {state.personas.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.images.length} fotos)</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                
                                {state.subjectImages.length === 0 && !state.selectedPersonaId && (
                                    <div className="text-center p-3 border border-dashed border-white/10 rounded-sm mb-2 mt-4">
                                        <p className="text-[9px] text-gray-600">Sem sujeitos. A IA criará uma pessoa/objeto genérico.</p>
                                    </div>
                                )}

                                {!state.selectedPersonaId && (
                                    <div className="space-y-2 mb-2 mt-4">
                                        {state.subjectImages.map((img, index) => (
                                            <div key={img.id} className="relative group">
                                                 <button onClick={() => removeSubjectImage(img.id)} className="absolute top-1 right-1 bg-black/50 text-white w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500 transition-colors z-10 text-[10px]">
                                                    <i className="fas fa-times"></i>
                                                </button>
                                                <Dropzone 
                                                    id={`sub-${img.id}`} 
                                                    label={`${getLabel()} #${index + 1}`} 
                                                    icon={getIcon()}
                                                    heightClass="h-32" 
                                                    image={img.base64} 
                                                    onImageChange={(val) => updateSubjectImage(img.id, 'base64', val)} 
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="Detalhes deste sujeito..." 
                                                    value={img.description || ""} 
                                                    onChange={(e) => updateSubjectImage(img.id, 'description', e.target.value)}
                                                    className="w-full mt-1 bg-black/40 border border-white/10 text-[10px] text-gray-300 p-2 focus:outline-none focus:border-electric-500/50"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {state.selectedPersonaId && (
                                    <div className="text-center p-5 border border-neon-500/20 bg-neon-500/5 rounded-sm mt-4">
                                        <i className="fas fa-user-check text-neon-500 text-2xl mb-2 flex items-center justify-center"></i>
                                        <p className="text-xs text-white font-bold">{state.personas.find(p => p.id === state.selectedPersonaId)?.name}</p>
                                        <p className="text-[9px] text-neon-500/70 mt-1 uppercase tracking-widest font-mono">Preset Selecionado</p>
                                        <p className="text-[8px] text-gray-400 mt-2">({state.personas.find(p => p.id === state.selectedPersonaId)?.images.length} imagens treinadas internamente)</p>
                                    </div>
                                )}
                            </div>

                            {/* Dynamic References */}
                            <div className="space-y-4 mb-8 pt-4 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-3 bg-white/50"></div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Referências de Estilo (Opcional)</p>
                                    </div>
                                    <button onClick={addReferenceImage} className="text-[9px] uppercase font-bold text-neon-500 hover:text-white transition-colors border border-neon-500/30 px-2 py-1 hover:bg-neon-500/10">
                                        <i className="fas fa-plus mr-1"></i> Adicionar
                                    </button>
                                </div>

                                {state.referenceImages.length === 0 && (
                                    <div className="text-center p-4 border border-dashed border-white/10 rounded-sm">
                                        <p className="text-[10px] text-gray-600">Nenhuma referência de estilo adicionada.</p>
                                    </div>
                                )}

                                {state.referenceImages.map((ref, index) => (
                                    <div key={ref.id} className="bg-white/[0.02] border border-white/5 p-3 relative animate-fade-in group">
                                        <button onClick={() => removeReferenceImage(ref.id)} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 transition-colors z-10">
                                            <i className="fas fa-times"></i>
                                        </button>
                                        <p className="text-[9px] uppercase font-bold text-gray-500 mb-2">Referência #{index + 1}</p>
                                        
                                        <Dropzone 
                                            id={`ref-${ref.id}`} 
                                            label=""
                                            heightClass="h-24"
                                            image={ref.base64}
                                            onImageChange={(val) => updateReferenceImage(ref.id, 'base64', val)}
                                        />
                                        
                                        <input 
                                            type="text" 
                                            placeholder="O que aproveitar desta imagem? (Ex: Cores, Pose, Estilo)" 
                                            value={ref.instruction}
                                            onChange={(e) => updateReferenceImage(ref.id, 'instruction', e.target.value)}
                                            className="w-full mt-2 bg-black/40 border border-white/10 text-[10px] text-gray-300 p-2 focus:outline-none focus:border-electric-500/50"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="w-full h-px bg-white/5 my-8"></div>

                            {/* Controls */}
                            <div className="space-y-6">
                                {/* Text Toggle */}
                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setState(prev => ({...prev, keepText: !prev.keepText}))}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full transition-colors ${state.keepText ? 'bg-neon-500 shadow-[0_0_10px_#E2E783]' : 'bg-gray-700'}`}></div>
                                        <span className="text-xs font-medium text-gray-300 group-hover:text-white uppercase tracking-wide">Preservar Texto (Se houver)</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-600">{state.keepText ? 'ON' : 'OFF'}</span>
                                </div>

                                {/* Model Selection */}
                                <div className="mb-4">
                                    <p className="text-[9px] uppercase font-bold text-gray-500 mb-2 tracking-widest">Modelo de IA</p>
                                    <div className="flex flex-col gap-2">
                                        <button 
                                            onClick={() => setState(prev => ({...prev, selectedModel: 'gemini-3-pro-image-preview'}))} 
                                            className={`w-full py-2 px-3 text-[10px] font-mono transition-all border border-white/5 text-left flex items-center justify-between ${state.selectedModel === 'gemini-3-pro-image-preview' ? 'bg-white/10 text-white border-neon-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                        >
                                            <span>Gemini 3.0 Pro Image</span>
                                            {state.selectedModel === 'gemini-3-pro-image-preview' && <i className="fas fa-check text-neon-500"></i>}
                                        </button>
                                        <button 
                                            onClick={() => setState(prev => ({...prev, selectedModel: 'gemini-2.5-flash-image'}))} 
                                            className={`w-full py-2 px-3 text-[10px] font-mono transition-all border border-white/5 text-left flex items-center justify-between ${state.selectedModel === 'gemini-2.5-flash-image' ? 'bg-white/10 text-white border-neon-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                        >
                                            <span>Nano Banana (Padrão)</span>
                                            {state.selectedModel === 'gemini-2.5-flash-image' && <i className="fas fa-check text-neon-500"></i>}
                                        </button>
                                    </div>
                                </div>

                                {/* Formato & Count */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] uppercase font-bold text-gray-600 mb-2 block tracking-wider">Formato</label>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => setState(prev => ({...prev, aspectRatio: '1:1'}))} className={`py-2 px-3 text-[10px] font-mono transition-all border border-white/5 text-left ${state.aspectRatio === '1:1' ? 'bg-white/10 text-white border-neon-500/30' : 'text-gray-500 hover:text-gray-300'}`}>Feed (Quadrado)</button>
                                            <button onClick={() => setState(prev => ({...prev, aspectRatio: '4:5'}))} className={`py-2 px-3 text-[10px] font-mono transition-all border border-white/5 text-left ${state.aspectRatio === '4:5' ? 'bg-white/10 text-white border-neon-500/30' : 'text-gray-500 hover:text-gray-300'}`}>Instagram (4:5)</button>
                                            <button onClick={() => setState(prev => ({...prev, aspectRatio: '9:16'}))} className={`py-2 px-3 text-[10px] font-mono transition-all border border-white/5 text-left ${state.aspectRatio === '9:16' ? 'bg-white/10 text-white border-neon-500/30' : 'text-gray-500 hover:text-gray-300'}`}>Story (Vertical)</button>
                                            <button onClick={() => setState(prev => ({...prev, aspectRatio: '16:9'}))} className={`py-2 px-3 text-[10px] font-mono transition-all border border-white/5 text-left ${state.aspectRatio === '16:9' ? 'bg-white/10 text-white border-neon-500/30' : 'text-gray-500 hover:text-gray-300'}`}>Cinema (Horizontal)</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] uppercase font-bold text-gray-600 mb-2 block tracking-wider">Quantidade</label>
                                        <div className="flex bg-black/40 border border-white/5">
                                            {[1, 2, 3, 4].map(n => (
                                                <button key={n} onClick={() => setState(prev => ({...prev, imageCount: n}))} className={`flex-1 py-2 text-[10px] font-mono transition-all border-r border-white/5 last:border-none ${state.imageCount === n ? 'bg-electric-900 text-electric-400' : 'text-gray-500 hover:text-gray-300'}`}>{n}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Colors */}
                                <div>
                                    <label className="text-[9px] uppercase font-bold text-gray-600 mb-2 block tracking-wider">Cromatismo</label>
                                    <div className="flex bg-black/40 border border-white/5 mb-3">
                                        {[{id:'original',l:'Original'},{id:'single',l:'Mono'},{id:'dual',l:'Duo'},{id:'tri',l:'Tri'}].map(m => (
                                            <button key={m.id} onClick={() => setState(prev => ({...prev, colorMode: m.id as any}))} className={`flex-1 py-2 text-[10px] uppercase font-bold transition-all border-r border-white/5 last:border-none ${state.colorMode === m.id ? 'bg-neon-500 text-black' : 'text-gray-500 hover:text-gray-300'}`}>{m.l}</button>
                                        ))}
                                    </div>
                                    {state.colorMode !== 'original' && (
                                        <div className="space-y-2 animate-fade-in">
                                            {[
                                                { k: 'color1', l: 'Pri' },
                                                ...(state.colorMode === 'dual' || state.colorMode === 'tri' ? [{ k: 'color2', l: 'Sec' }] : []),
                                                ...(state.colorMode === 'tri' ? [{ k: 'color3', l: 'Ter' }] : [])
                                            ].map((c) => (
                                                <div key={c.k} className="flex items-center gap-0 border border-white/10 bg-black/40">
                                                    <div className="px-3 py-2 bg-white/5 border-r border-white/10">
                                                        <span className="text-[9px] uppercase font-bold text-gray-500">{c.l}</span>
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        value={(state as any)[c.k]} 
                                                        onChange={(e) => setState(prev => ({...prev, [c.k]: e.target.value}))} 
                                                        className="flex-1 bg-transparent border-none text-[10px] font-mono text-gray-300 px-3 focus:outline-none uppercase"
                                                        placeholder="#000000"
                                                    />
                                                    <input type="color" value={(state as any)[c.k]} onChange={(e) => setState(prev => ({...prev, [c.k]: e.target.value}))} className="h-8 w-10 cursor-pointer bg-transparent border-none p-1" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Photo Settings - Accordions */}
                                <div className="mt-4 border-t border-white/10 pt-4">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Configuração de Câmera & Estilo</h4>
                                    <div className="space-y-1">
                                        
                                        {/* Subject Details */}
                                        <div className="border border-white/5 bg-white/[0.02] rounded-none overflow-hidden hover:border-white/10 transition-colors mb-2">
                                            <button onClick={() => toggleSection('subject_details')} className="w-full flex items-center justify-between px-3 py-3 text-[10px] uppercase font-bold text-neon-500 hover:text-neon-400 transition-colors tracking-wide bg-black/20">
                                                <span><i className="fas fa-user-tag mr-2"></i> Detalhes Humanos</span>
                                                <i className={`fas fa-chevron-right text-[9px] transition-transform duration-300 ${openSection === 'subject_details' ? 'rotate-90 text-neon-500' : 'text-gray-600'}`}></i>
                                            </button>
                                            {openSection === 'subject_details' && (
                                                <div className="p-2 bg-black/40 border-t border-white/5 animate-fade-in space-y-4">
                                                    {SUBJECT_OPTIONS.map((sub) => (
                                                        <div key={sub.id}>
                                                            <p className="text-[9px] font-bold text-gray-500 mb-2 uppercase">{sub.title}</p>
                                                            <div className="grid grid-cols-2 gap-1">
                                                                {sub.items.map((item) => {
                                                                    const isSelected = (state as any)[sub.stateKey].includes(item.value);
                                                                    return (
                                                                        <button 
                                                                            key={item.value} 
                                                                            onClick={() => toggleMultiSelect(sub.stateKey as any, item.value)}
                                                                            className={`text-[9px] py-1.5 px-2 text-left border transition-all ${isSelected ? 'bg-electric-900 text-white border-electric-500' : 'text-gray-400 border-white/5 hover:border-white/20'}`}
                                                                        >
                                                                            {item.label}
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {PHOTO_OPTIONS.map((section) => (
                                            <div key={section.id} className="border border-white/5 bg-white/[0.02] rounded-none overflow-hidden hover:border-white/10 transition-colors">
                                                <button onClick={() => toggleSection(section.id)} className="w-full flex items-center justify-between px-3 py-3 text-[10px] uppercase font-bold text-gray-300 hover:text-white transition-colors tracking-wide bg-black/20">
                                                    <span>{section.title}</span>
                                                    <i className={`fas fa-chevron-right text-[9px] transition-transform duration-300 ${openSection === section.id ? 'rotate-90 text-neon-500' : 'text-gray-600'}`}></i>
                                                </button>
                                                
                                                {openSection === section.id && (
                                                    <div className="p-2 grid grid-cols-1 gap-1 bg-black/40 border-t border-white/5 animate-fade-in">
                                                        {section.items.map((item) => {
                                                            const isSelected = (state as any)[section.stateKey] === item.value;
                                                            return (
                                                                <div key={item.value} onClick={() => setState(prev => ({...prev, [section.stateKey]: isSelected ? '' : item.value}))} className={`group px-3 py-2 cursor-pointer border transition-all flex flex-col gap-1 ${isSelected ? 'bg-electric-900/40 border-electric-500/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-neon-400' : 'text-gray-400 group-hover:text-gray-200'}`}>{item.label}</span>
                                                                        {isSelected && <i className="fas fa-check text-[8px] text-neon-500"></i>}
                                                                    </div>
                                                                    <span className="text-[9px] text-gray-600 group-hover:text-gray-500 leading-tight">{item.desc}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <button onClick={handleGenerate} disabled={state.isProcessing || !hasApiKey} className="flex-1 bg-gradient-to-r from-neon-500 to-electric-500 hover:from-white hover:to-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 shadow-[0_0_20px_rgba(226,231,131,0.3)] flex justify-center items-center gap-2 text-xs uppercase tracking-widest transition-all transform active:scale-95">
                                    {state.isProcessing ? <><i className="fas fa-sync fa-spin"></i> Processando</> : <span>Gerar Visual <i className="fas fa-bolt ml-1"></i></span>}
                                </button>
                                {state.isProcessing && (
                                    <button onClick={() => setState(prev => ({...prev, isProcessing: false, loadingStep: 'Cancelado', loadingProgress: 0}))} className="w-12 bg-red-500/20 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center rounded-sm" title="Cancelar">
                                        <i className="fas fa-stop"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL - RESULTS */}
                    <div className="lg:col-span-8">
                        <div className="glass-panel h-full min-h-[600px] flex flex-col relative">
                            
                            {/* Header */}
                            <div className="h-12 border-b border-white/5 flex justify-between items-center px-6 bg-black/20">
                                <div className="flex gap-4">
                                    <span className="text-[10px] font-mono text-neon-500 uppercase">Output_Stream</span>
                                    <span className="text-[10px] font-mono text-gray-600">|</span>
                                    <span className="text-[10px] font-mono text-gray-500">
                                        {state.aspectRatio === '1:1' ? '1080x1080' : state.aspectRatio === '4:5' ? '1080x1350' : state.aspectRatio === '9:16' ? '1080x1920' : '1920x1080'}
                                    </span>
                                </div>
                                <div className="flex gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-grow bg-black/40 relative flex items-center justify-center p-8 overflow-y-auto">
                            
                            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>

                            {!state.isProcessing && state.results.length === 0 && (
                                <div className="text-center max-w-sm relative z-10 p-8 border border-white/5 bg-black/40 backdrop-blur-sm">
                                    <div className="w-12 h-12 bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                                        <i className="fas fa-magic text-gray-600 text-lg"></i>
                                    </div>
                                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-2">Aguardando Input</h3>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Configure os parâmetros à esquerda e inicie a geração. O sistema criará variações de alta fidelidade baseadas na sua ideia.
                                    </p>
                                </div>
                            )}

                            {state.isProcessing && (
                                <div className="text-center relative z-10">
                                    <div className="w-16 h-16 border-2 border-white/10 border-t-neon-500 rounded-full animate-spin mx-auto mb-6 shadow-[0_0_30px_rgba(226,231,131,0.2)]"></div>
                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2 animate-pulse">{state.loadingStep}</h3>
                                    <div className="w-64 h-1 bg-gray-800 mx-auto rounded-full overflow-hidden">
                                        <div className="h-full bg-neon-500 transition-all duration-500 ease-out" style={{width: `${state.loadingProgress}%`}}></div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2 font-mono">{state.loadingProgress}% Complete</p>
                                </div>
                            )}

                            {state.results.length > 0 && !state.isProcessing && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                                    {state.results.map((url, idx) => (
                                        <div 
                                            key={idx} 
                                            className="group relative bg-black/50 border border-white/10 overflow-hidden hover:border-neon-500/50 transition-all duration-500"
                                            style={{ 
                                                aspectRatio: state.aspectRatio.replace(':', '/'),
                                                containerType: 'inline-size'
                                            }}
                                        >
                                            <img src={url} alt={`Result ${idx}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                            
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-6 z-20">
                                                <div className="flex gap-3">
                                                    <button onClick={() => openImage(url, `gen-${Date.now()}-${idx}`, state.lastGeneratedPrompt, state.lastGeneratedTextLayers)} className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-neon-500 transition-colors">
                                                        <i className="fas fa-expand text-xs"></i>
                                                    </button>
                                                    <button onClick={() => handleVariations(url, state.lastGeneratedPrompt)} className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/20 flex items-center justify-center hover:bg-neon-500 hover:text-black transition-colors" title="Gerar Variação">
                                                        <i className="fas fa-random text-xs"></i>
                                                    </button>
                                                </div>
                                                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Gen_0{idx+1}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            
            {state.currentTab === 'personas' && renderPersonasTab()}

            {/* History Floating Sidebar */}
            <div className={`fixed right-0 top-0 bottom-0 w-80 bg-black/95 backdrop-blur-md border-l border-white/10 transition-transform duration-300 z-50 shadow-2xl ${state.isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">LOGS</h3>
                        {state.history.length > 0 && (
                            <button onClick={() => {
                                clearHistoryDB();
                                setState(prev => ({...prev, history: []}));
                                showStatus('success', 'Histórico apagado com sucesso.');
                            }} className="text-[9px] uppercase tracking-widest text-red-500 hover:text-red-400 font-bold border border-red-500/30 px-2 py-1 rounded-sm">
                                Limpar
                            </button>
                        )}
                    </div>
                    <button onClick={() => setState(prev => ({...prev, isHistoryOpen: false}))} className="text-gray-500 hover:text-neon-500 transition-colors"><i className="fas fa-times"></i></button>
                </div>
                <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-70px)] custom-scrollbar">
                    {state.history.map(item => (
                        <div key={item.id} className="relative group border border-white/5 cursor-pointer hover:border-neon-500/50 transition-all" onClick={() => openImage(item.url, item.id, item.prompt, item.textLayers)}>
                            <img src={item.url} className="w-full h-32 object-cover opacity-60 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" />
                            <div className="absolute bottom-0 left-0 w-full bg-black/80 p-2 border-t border-white/5">
                                <p className="text-[9px] font-mono text-gray-400">{new Date(item.timestamp).toLocaleTimeString()}</p>
                            </div>
                            <button onClick={(e) => deleteHistoryItem(item.id, e)} className="absolute top-2 right-2 w-6 h-6 bg-red-900/80 flex items-center justify-center text-white text-[10px] opacity-0 group-hover:opacity-100"><i className="fas fa-trash"></i></button>
                        </div>
                    ))}
                </div>
            </div>

      </div>
    </div>
  );
};

export default App;