import { GoogleGenAI, Type } from "@google/genai";
import { ReferenceImage, SubjectImage } from "../types";


// Ensure API Key is available
const getAIClient = () => {
  let apiKey = localStorage.getItem('vercel_gemini_api_key');
  if (!apiKey) {
    apiKey = process.env.API_KEY;
  }
  
  if (!apiKey) {
    throw new Error("API Key not found in environment or local storage");
  }
  return new GoogleGenAI({ apiKey });
};


/**
 * ETAPA 1: O INTERPRETADOR DE VISÃO (Gemini 3.0 Flash)
 * Segue o fluxo lógico: Ler Prompt -> Ler Referências (Instrução ou Visual) -> Extrair Texto (OCR Visual Detalhado) -> Aplicar Configurações -> Preencher Esqueleto.
 */
import { TextLayerData } from "../types";

// ... (imports)

const GOOGLE_FONTS = [
  "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald", 
  "Roboto Condensed", "Raleway", "Merriweather", "Noto Sans", 
  "Playfair Display", "Rubik", "Poppins", "Nunito", "Ubuntu", 
  "Dancing Script", "Pacifico", "Bebas Neue", "Anton", "Lobster",
  "Abril Fatface", "Caveat", "Shadows Into Light", "Indie Flower",
  "Amatic SC", "Righteous", "Permanent Marker", "Satisfy", "Courgette",
  "Great Vibes", "Sacramento", "Press Start 2P", "Creepster", "Bangers",
  "Cinzel", "Orbitron", "Exo 2", "Rajdhani", "Teko", "Kanit"
];

// Helper to create image part
const getImagePart = (base64: string | null) => {
    if (!base64) return null;
    
    // Extract mime type and data
    const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match && match[2]) {
        return { inlineData: { mimeType: match[1], data: match[2] } };
    }
    
    // Fallback cleanup
    const clean = base64.replace(/^data:image\/\w+;base64,/, "");
    if (clean && clean.length > 0) {
        return { inlineData: { mimeType: "image/jpeg", data: clean } };
    }
    
    return null;
};

// Helper for retry logic
const generateContentWithRetry = async (ai: any, params: any, maxRetries = 3) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await ai.models.generateContent(params);
        } catch (error: any) {
            lastError = error;
            console.error(`Attempt ${i + 1} failed with error:`, error);
            const errorStr = typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error);
            console.error("Error details:", errorStr);
            
            if (error?.status === 500 || errorStr.includes('500') || errorStr.includes('Internal error') || errorStr.includes('429') || errorStr.includes('quota')) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
                continue;
            }
            throw new Error(`API Error: ${error.message || errorStr}`); // Throw immediately for non-500 errors
        }
    }
    throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError?.message || lastError}`);
};

export const analyzeAndGeneratePrompt = async (
  mainIdea: string,
  subjectType: 'person' | 'object' | 'person_with_object',
  subjectImages: SubjectImage[],
  subjectDescription: string,
  subjectPosition: 'center' | 'left' | 'right',
  references: ReferenceImage[],
  colorMode: string,
  color1: string,
  color2: string,
  color3: string,
  aspectRatio: string,
  photoSettings: {
      style: string;
      angle: string;
      focus: string;
      lens: string;
      lighting: string;
      framing: string;
      specialEffects: string;
      floatingElements: string;
  },
  subjectSettings: {
      gaze: string[];
      expression: string[];
      skinTexture: string[];
  }
): Promise<{ prompt: string, textLayers: TextLayerData[] }> => {
  const ai = getAIClient();

  const validReferences = references.filter(r => r.base64 !== null);
  const validSubjects = subjectImages.filter(s => s.base64 !== null);

  // 4. Construção do Prompt do Sistema
  let systemPrompt = `
      ATUAÇÃO: Você é um Engenheiro de Prompt de IA Visionária e Especialista em OCR/Tipografia.
      
      OBJETIVO:
      1. Analisar as referências visuais e extrair QUALQUER texto presente com precisão cirúrgica (posição, fonte, cor, efeitos).
      2. Criar um prompt para gerar a imagem SEM O TEXTO (apenas o fundo/sujeito limpo).
      3. Retornar um JSON estruturado com o prompt da imagem e os dados das camadas de texto separadamente.
      4. FIDELIDADE EXTREMA ÀS REFERÊNCIAS: Se houver referências de estilo, o "image_prompt" deve descrever MINUCIOSAMENTE a iluminação, paleta de cores, composição e "vibe" dessas referências. Use termos técnicos de fotografia e arte para garantir que o resultado final seja visualmente idêntico ao estilo das referências.

      FONTS DISPONÍVEIS (Google Fonts):
      ${GOOGLE_FONTS.join(', ')}

      FORMATO DE RESPOSTA (JSON OBRIGATÓRIO):
      {
        "image_prompt": "Prompt detalhado seguindo ESTRITAMENTE o esqueleto abaixo.",
        "text_layers": [
          {
            "text": "Texto exato encontrado",
            "x": 50, // Posição X em porcentagem (0-100)
            "y": 50, // Posição Y em porcentagem (0-100)
            "fontSize": 24, // Tamanho estimado (referência base 1080px)
            "fontFamily": "Roboto", // ESCOLHA A FONTE MAIS PARECIDA DA LISTA ACIMA
            "color": "#ffffff", // Cor Hex
            "fontWeight": "bold", // normal, bold, 100-900
            "fontStyle": "normal", // normal, italic
            "letterSpacing": 0, // em pixels
            "textTransform": "uppercase", // none, uppercase, lowercase
            "align": "center", // left, center, right
            "textShadow": "2px 2px 4px rgba(0,0,0,0.5)" // Se houver sombra, brilho ou contorno, descreva em CSS text-shadow válido. Ex: '0 0 10px #ff00de' (neon), '2px 2px 0 #000' (hard shadow). Se não houver, use null.
          }
        ]
      }

      ESQUELETO OBRIGATÓRIO DO PROMPT (Preencha os colchetes [...] com detalhes):
      
      "Gere uma imagem hiper-realista da PESSOA EXATA fornecida na imagem de modelo. NÃO MUDE ABSOLUTAMENTE NADA NO ROSTO DELA. 
      [EVITE DESCREVER A FISIONOMIA COM MUITAS PALAVRAS PARA NÃO CONFUNDIR A IA]. Apenas instrua fortemente: A IDENTIDADE, PROPORÇÕES, LINHAS FACIAIS, PINTAS, E ESTRUTURA ÓSSEA DEVEM SER UMA CÓPIA PERFEITA E INTACTA DA FOTO FORNECIDA COMO SUJEITO.
      
      [REGRA DE VESTUÁRIO (ESTRITAMENTE OBRIGATÓRIA)]: Se houver uma imagem de referência, o sujeito DEVE usar EXATAMENTE A MESMA ROUPA da pessoa na imagem de referência. Descreva detalhadamente o tecido, cor, corte e TUDO que houver nela (logotipos, ícones, escritos, estampas, números) e instrua a geração a manter essas roupas idênticas na nova imagem. A ideia é manter o corpo/roupa da referência, mas com o "rosto" / "cabeça" do sujeito fornecido (modelo).
      
      [REGRA DE IDENTIDADE E EXPRESSÃO FACIAL (MUITO IMPORTANTE)]: Crie uma RÉPLICA BIOMÉTRICA EXATA do rosto do sujeito. É OBRIGATÓRIO preservar a pessoa exatamente como ela é. ALÉM DISSO, a EXPRESSÃO FACIAL DEVE SER IDÊNTICA À DA FOTO DO SUJEITO (posição da boca, tensão no olhar) a menos que o usuário tenha exigido uma expressão diferente através das configurações. O ângulo e traços originais são intocáveis.

      O cenário é [SE HOUVER REFERÊNCIA: COPIAR EXATAMENTE O CENÁRIO E COMPOSIÇÃO DA REFERÊNCIA, COLOCANDO O SUJEITO NO LUGAR DO ORIGINAL. SE NÃO HOUVER REFERÊNCIA: DESCREVER UM CENÁRIO ÉPICO, MONUMENTAL E RICO DETALHADO BASEADO NA IDEIA DO USUÁRIO]. A fotografia mostra texturas realistas. A iluminação é [DESCREVER EXATAMENTE A LUZ DA REFERÊNCIA OU LUZ CINEMATOGRÁFICA DRAMÁTICA], as sombras são [...]. O estilo da imagem é [COPIAR ESTILO DA REFERÊNCIA OU HIPER-REALISTA]. Imagem 8K, rica em detalhes.

      Orientação: [...]"

      PASSO A PASSO:
      0. ANÁLISE FACIAL EXTREMA (CRÍTICO): Seu objetivo principal é garantir que a imagem gerada seja IDÊNTICA à foto fornecida. A identidade visual, traços do rosto, sobrancelhas, olhos, nariz, boca, marcas e o vestuário devem ser copiados fielmente da imagem do modelo original. NÃO ADICIONE TRAÇOS QUE NÃO EXISTEM NA FOTO. A identidade deve ser uma cópia 100% perfeita.
      1. LEITURA PROFUNDA DA REFERÊNCIA (SE HOUVER REFERÊNCIA VISUAL): Examine a imagem de referência fornecida pixel por pixel. VOCÊ DEVE EXTRAIR TUDO DELA: o cenário inteiro, cada objeto de fundo, a atmosfera exata, de onde vem a luz (direction, falloff, temperatura), se a textura é filme granulado, pintura, foto de estúdio, ou render 3D, e qual a paleta de cores. O prompt final OBRIGATORIAMENTE DEVE INSTRUIR A IA A RECRIAR EXATAMENTE O MESMO MUNDO, LUZ E COMPOSIÇÃO DA REFERÊNCIA.
      1.5. SOFISTICAÇÃO EXTREMA: Integre maravilhosamente todas as Configurações de Câmera e Estilo selecionadas pelo usuário no prompt final. O prompt deve ser MAGNÍFICO, extenso e riquíssimo em detalhes como: iluminação primorosa, lentes cinematográficas (e.g. 35mm, f/1.4, bokeh), atmosfera, composição e todas as minúcias.
      2. IMPORTANTE ESSENCIAL SOBRE TEXTOS: VOCÊ DEVE PRESERVAR E DESCREVER NO PROMPT todos os logotipos, ícones, números e textos que façam parte física do sujeito (ex: escritos na camiseta, tatuagens) ou do cenário natural da referência (ex: placas de rua, letreiros físicos na parede).
      3. IMPORTANTE: NÃO GERE TEXTO FLUTUANTE NA IMAGEM. O prompt deve garantir que a imagem não tenha sobreposições de texto inseridas em pós-edição, mantendo estritamente os textos orgânicos e reais do sujeito e cenário descritos.
      4. POSICIONAMENTO DO SUJEITO: O usuário escolheu posicionar o sujeito principal em: "${subjectPosition.toUpperCase()}". O prompt deve refletir isso explicitamente na Orientação.
      5. CRÍTICO (FIDELIDADE ABSOLUTA DA IDENTIDADE E EXPRESSÃO): O prompt DEVE exigir que a imagem use a mesma face da foto sem alterações estruturais, preservando absolutamente as proporções originais, a estrutura óssea e as linhas faciais. A exigência fundamental é ser uma CLONAGEM PERFEITA da fisionomia. Adicionalmente, preencha o prompt com O MÁXIMO DE DETALHES DE ESTILO, LUZ E CENÁRIO baseados nas configurações da câmera e imagem de referência.
      6. REFERÊNCIAS VISUAIS: Se houver referências, o sujeito DEVE ser inserido NESTE CONTEXTO/CENÁRIO. A referência dita a iluminação, o fundo, a composição e o estilo.
      7. PARÂMETROS DE CÂMERA E ESTILO: Você DEVE incluir explicitamente as seguintes configurações no prompt gerado (se fornecidas), expandindo-as com descrições poéticas e precisas de fotografia:
      - Enquadramento: ${photoSettings.framing || 'Padrão'} (Descreva a distância da câmera em relação ao sujeito: close-up, plano médio, plano geral, etc.)
      - Estilo: ${photoSettings.style || 'Fotorrealista'} (SE O ESTILO FOR "Hiper-Realista", A ILUMINAÇÃO DEVE SER BRANCA E NATURAL, NUNCA USE LUZ ROXA OU NEON A MENOS QUE SOLICITADO)
      - Lente: ${photoSettings.lens || 'Padrão'}
      - Iluminação: ${photoSettings.lighting || 'Padrão'}
      - Ângulo: ${photoSettings.angle || 'Padrão'}
      - Efeitos Especiais: ${photoSettings.specialEffects || 'Nenhum'}
      - Elementos Flutuantes: ${photoSettings.floatingElements || 'Nenhum'}
      - Textura da Pele: ${subjectSettings.skinTexture.length > 0 ? subjectSettings.skinTexture.join(', ') : 'Padrão'}
      - Expressão Facial: ${subjectSettings.expression.length > 0 ? subjectSettings.expression.join(', ') : 'Manter original'}
      - Direção do Olhar: ${subjectSettings.gaze.length > 0 ? subjectSettings.gaze.join(', ') : 'Manter original'}

      O prompt final DEVE ser rico e descritivo, traduzindo essas configurações técnicas em descrições visuais detalhadas (ex: se a lente for 85mm, descreva o fundo desfocado/bokeh; se o ângulo for Low Angle, descreva a câmera olhando de baixo para cima).
      
      INPUT DO USUÁRIO:
      - Ideia: "${mainIdea || 'Nenhuma'}"
      - Posicionamento do Sujeito: ${subjectPosition}
      - Cores: ${colorMode === 'original' ? 'Original / Natural (Se não houver referência, use cores neutras/sofisticadas)' : `${colorMode} (${color1}, ${color2}, ${color3})`}
      
      NOTA: Se o usuário não selecionou um estilo específico nas configurações, assuma "FOTOREALISTA" como padrão.

      ESTILO ESPECIAL "3D CGI AAA":
      Se o estilo selecionado for "3D CGI AAA", o prompt DEVE OBRIGATORIAMENTE conter as seguintes palavras-chave e descrições técnicas:
      - "Renderização CGI de videogame esportivo AAA de última geração"
      - "Modelo de personagem na Unreal Engine 5, gráficos no motor Frostbite, renderização 3D hiper-realista"
      - "DETALHE EXTREMO DE TEXTURA: poros de pele absurdamente detalhados, imperfeições naturais da pele, espalhamento subsuperficial, íris hiper detalhada, pelos faciais realistas"
      - "DETALHES DO TECIDO: texturas de tecido microentrelaçadas, costuras visíveis, material esportivo sintético com reflexos especulares"
      - "ILUMINAÇÃO: iluminação cinematográfica com ray tracing, luz volumétrica criando um contorno (rim light)"
      - "Resolução 8K, Octane Render, detalhes esculpidos no ZBrush, profundidade de campo cinematográfica, fundo desfocado com efeito bokeh"

      ESTILO ESPECIAL "Hiper-realista":
      Se o estilo selecionado for "Hiper-realista", o prompt DEVE OBRIGATORIAMENTE conter as seguintes palavras-chave e descrições técnicas:
      - "Retrato cinematográfico ultra-realista em 8K, textura de pele hiper detalhada com poros visíveis, imperfeições sutis e naturais da pele, espalhamento subsuperficial natural, fios de barba realistas, foco ultra nítido, microtextura da pele, brilho oleoso suave da pele, realces especulares controlados."
      - "ILUMINAÇÃO CINEMATOGRÁFICA DRAMÁTICA: iluminação de alto contraste com luz principal dourada e quente vinda de baixo, luz de recorte volumétrica suave em tom branco vindo de trás, luz de preenchimento sutil para equilíbrio de profundidade, iluminação global, iluminação com ray tracing, difusão realista da luz na pele, gradientes suaves de sombra, ambient occlusion, sombras fisicamente precisas."
      - "DETALHE DE SOMBRAS: sombras profundas, porém ricas em detalhes, transição suave de luz para sombra, proporção de contraste cinematográfica, envolvimento realista da luz ao redor dos contornos faciais, estrutura facial com profundidade realçada."
      - "RENDERIZAÇÃO DA PELE: tons de pele com alto alcance dinâmico, translucidez realista, espalhamento subsuperficial ao redor das orelhas e do pescoço, micro rugas detalhadas, variação natural de textura, profundidade facial hiper-realista."
      - "ATMOSFERA: névoa volumétrica, partículas luminosas, bloom cinematográfico, difração de lente, aberração cromática suave, correção de cores HDR, renderização de textura ultra detalhada, qualidade Unreal Engine 5, Octane Render, ray tracing, nitidez extrema, color grading profissional."
  `;

  // Build the request parts
  const parts: any[] = [{ text: systemPrompt }];

  // Adicionar Referências Visuais
  if (validReferences.length > 0) {
      systemPrompt += `\n\n[DADOS DE REFERÊNCIA (CENÁRIO/ESTILO)]:\n`;
      validReferences.forEach((ref, index) => {
          const instruction = ref.instruction ? `INSTRUÇÃO DO USUÁRIO: "${ref.instruction}"` : `SEM INSTRUÇÃO (Use como base para o cenário/estilo)`;
          systemPrompt += `REFERÊNCIA #${index+1}: ${instruction}.\n`;
         
          const imgPart = getImagePart(ref.base64);
          if (imgPart) parts.push(imgPart);
      });
  } else {
      systemPrompt += `\n[SEM REFERÊNCIAS]: Baseie-se puramente na Ideia Central.`;
  }
  
  // Adicionar Sujeito
  validSubjects.forEach((sub, index) => {
      const imgPart = getImagePart(sub.base64);
      if (imgPart) {
          const desc = sub.description ? `DESCRIÇÃO DO USUÁRIO: "${sub.description}"` : "Sem descrição extra.";
          systemPrompt += `\n[FOTO DO MODELO ${index+1}]: ${desc}. OBJETIVO CRÍTICO: Faça uma Análise Biométrica Extrema deste rosto/corpo e inclua os traços exatos no image_prompt. A EXPRESSÃO FACIAL, O ÂNGULO DA CABEÇA E AS CARACTERÍSTICAS FÍSICAS EXATAS DESTA FOTO DEVEM SER DESCRITAS NO PROMPT PARA SEREM MANTIDAS NO RESULTADO FINAL.\n`;
          parts.push(imgPart);
      }
  });

  // Atualizar o prompt de texto final
  parts[0] = { text: systemPrompt };

  const response = await generateContentWithRetry(ai, {
    model: 'gemini-3-flash-preview',
    contents: { parts: parts },
    config: { 
      responseMimeType: 'application/json'
    }
  });


  const text = response.text;
  if (!text) throw new Error("Falha ao gerar o prompt detalhado.");
  
  try {
      const json = JSON.parse(text);
      return {
          prompt: typeof json.image_prompt === 'string' ? json.image_prompt : text, // Fallback to full text if image_prompt is missing
          textLayers: Array.isArray(json.text_layers) ? json.text_layers : []
      };
  } catch (e) {
      console.error("Failed to parse JSON prompt:", text);
      // Fallback if JSON fails (shouldn't happen with responseMimeType)
      return {
          prompt: text,
          textLayers: []
      };
  }
};


/**
 * ETAPA 2: A CRIAÇÃO DA IMAGEM (Gemini 3.1 Flash Image)
 * Processo: Pega o Prompt detalhado da Etapa 1 + Foto do Modelo.
 * Regra: NÃO recebe as referências visuais (apenas o texto descritivo delas e o texto a ser renderizado).
 */
export const generateImage = async (
    prompt: string,
    subjectImages: SubjectImage[],
    references: ReferenceImage[],
    aspectRatio: string,
    model: string = 'gemini-3.1-flash-image-preview'
): Promise<string> => {
    const ai = getAIClient();
   
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
        throw new Error("Prompt inválido ou vazio para geração de imagem.");
    }

    const validSubjects = subjectImages.filter(s => s.base64 !== null);
    
    // O prompt já é o esqueleto preenchido (incluindo instruções de render text).
    const finalPrompt = prompt; 

    // Construir payload
    const parts: any[] = [];

    // Adicionar APENAS a foto do Modelo (Identidade)
    validSubjects.forEach(sub => {
        const imgPart = getImagePart(sub.base64);
        if (imgPart) parts.push(imgPart);
    });

    parts.push({ text: finalPrompt });

    const response = await generateContentWithRetry(ai, {
        model: model,
        contents: { parts: parts },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio === '4:5' ? '3:4' : aspectRatio as any,
                ...(model === 'gemini-3.1-flash-image-preview' ? { imageSize: "2K" as any } : {})
            }
        }
    });


    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
    }

    // Check for refusal or text response
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart) {
        throw new Error(`O modelo recusou a geração: ${textPart.text}`);
    }

    throw new Error("Nenhuma imagem gerada pelo modelo. Verifique se o prompt não viola as políticas de segurança.");
};

/**
 * ETAPA 3: EDIÇÃO DE IMAGEM (Gemini 3.1 Flash Image)
 * Permite modificar uma imagem existente com base em uma máscara e um prompt.
 */
export const editImage = async (
    originalImage: string,
    maskImage: string | null,
    prompt: string,
    aspectRatio: string = "1:1"
): Promise<string> => {
    const ai = getAIClient();
    
    const parts: any[] = [];

    // Adicionar imagem original
    const originalPart = getImagePart(originalImage);
    if (originalPart) parts.push(originalPart);

    // Adicionar máscara se houver
    const maskPart = getImagePart(maskImage);
    if (maskPart) {
        // Ensure mask is PNG
        maskPart.inlineData.mimeType = "image/png";
        parts.push(maskPart);
    }

    parts.push({ text: prompt });

    const response = await generateContentWithRetry(ai, {
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: parts },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio as any,
                imageSize: "2K" as any
            }
        }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
    }

    throw new Error("Falha ao editar a imagem.");
};

/**
 * GERAÇÃO DE VARIAÇÕES
 * Usa uma imagem base para gerar variações mantendo o estilo e composição.
 */
export const generateVariations = async (
    baseImage: string,
    prompt: string,
    aspectRatio: string
): Promise<string> => {
    const ai = getAIClient();
    
    const parts: any[] = [];

    const basePart = getImagePart(baseImage);
    if (basePart) parts.push(basePart);

    parts.push({ text: `Gere uma variação criativa desta imagem. Mantenha a composição e o estilo, mas varie os detalhes. Prompt original: ${prompt}` });

    const response = await generateContentWithRetry(ai, {
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: parts },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio as any,
                imageSize: "2K" as any
            }
        }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
    }

    throw new Error("Falha ao gerar variação.");
};

