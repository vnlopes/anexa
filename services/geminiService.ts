import { GoogleGenAI, Type } from "@google/genai";
import { ReferenceImage, SubjectImage } from "../types";


// Ensure API Key is available
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment");
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
  keepText: boolean,
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
      
      "Gere uma imagem dessa(a) pessoa/objeto(pessoa/objeto da foto fornecida).

      Preserve fielmente os traços faciais originais da pessoa/produto da foto, incluindo logotipos em roupas, marcas em produtos e detalhes de design do sujeito.

      O cenário é [...]. A fotografia mostra os detalhes do seu rosto, póros, marcas faciais, pelos, expressões faciais, microtexturas naturais, imperfeições realistas, estruturas, etc. A iluminação é [...], hiper realista, as sombras são [...]. Imagem 8K, rica em detalhes, fotografia cinematográfica.

      Orientação: [...]"

      PASSO A PASSO:
      1. ANÁLISE VISUAL PROFUNDA: Antes de escrever o prompt, analise as referências. Qual é a iluminação? (Suave, dura, neon, natural). Quais são as cores dominantes? Qual é o estilo artístico? (3D, foto, pintura, colagem).
      2. Se "keepText" for FALSE, o "image_prompt" DEVE conter "no graphic design text, no typography, clean background, textless" ao final da Orientação. Retorne "text_layers": []. IMPORTANTE: Isso se refere a textos de design/composição, NÃO a logotipos em roupas ou produtos que fazem parte do sujeito.
      3. Se "keepText" for TRUE, o "image_prompt" DEVE INCLUIR O TEXTO DE DESIGN/COMPOSIÇÃO. Descreva onde o texto deve aparecer, qual a fonte, cor e o conteúdo exato. Tente replicar o estilo da referência.
      4. O "image_prompt" deve seguir o ESQUELETO acima. Preencha os [...] com descrições ricas baseadas nas referências e na ideia do usuário.
      5. IMPORTANTE: Se "keepText" for FALSE, NÃO GERE TEXTO NA IMAGEM. O prompt deve garantir que a imagem seja limpa.
      6. POSICIONAMENTO DO SUJEITO: O usuário escolheu posicionar o sujeito principal em: "${subjectPosition.toUpperCase()}". O prompt deve refletir isso explicitamente na Orientação.
      7. CRÍTICO: Se houver uma foto de sujeito (pessoa), o prompt DEVE instruir explicitamente a preservação da identidade, EXPRESSÃO FACIAL e POSIÇÃO DA CABEÇA da foto original, a menos que o usuário tenha pedido para mudar.
      8. REFERÊNCIAS VISUAIS: Se houver referências, o sujeito DEVE ser inserido NESTE CONTEXTO/CENÁRIO. A referência dita a iluminação, o fundo, a composição e o estilo. O sujeito (da foto do modelo) é o "ator" que entra neste "palco" (da referência).
      9. SUJEITOS MÚLTIPLOS: Se houver múltiplos sujeitos, cada um tem sua própria descrição abaixo. Respeite as características individuais de cada um.
      10. ENQUADRAMENTO: O usuário selecionou o enquadramento: "${photoSettings.framing}". O prompt DEVE refletir isso explicitamente na descrição da composição e distância da câmera.
      11. PARÂMETROS DE CÂMERA E ESTILO: Você DEVE incluir explicitamente as seguintes configurações no prompt gerado (se fornecidas):
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
      - Manter Texto (keepText): ${keepText}
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
          systemPrompt += `\n[FOTO DO MODELO ${index+1}]: ${desc}. Use para entender a identidade do sujeito. IMPORTANTE: A EXPRESSÃO FACIAL, O ÂNGULO DA CABEÇA E AS CARACTERÍSTICAS FÍSICAS DESTA FOTO DEVEM SER MANTIDAS NO RESULTADO FINAL, a menos que a descrição do usuário peça explicitamente para mudar.\n`;
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
 * ETAPA 2: A CRIAÇÃO DA IMAGEM (Gemini 3.0 Pro Image)
 * Processo: Pega o Prompt detalhado da Etapa 1 + Foto do Modelo.
 * Regra: NÃO recebe as referências visuais (apenas o texto descritivo delas e o texto a ser renderizado).
 */
export const generateImage = async (
    prompt: string,
    subjectImages: SubjectImage[],
    references: ReferenceImage[],
    aspectRatio: string,
    model: string = 'gemini-3-pro-image-preview'
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
                ...(model === 'gemini-3-pro-image-preview' ? { imageSize: "2K" as any } : {})
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
 * ETAPA 3: EDIÇÃO DE IMAGEM (Gemini 3.0 Pro Image)
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
        model: 'gemini-3-pro-image-preview',
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
        model: 'gemini-3-pro-image-preview',
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

