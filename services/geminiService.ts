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
  },
  model: string = 'gemini-3.1-pro-preview'
): Promise<{ prompt: string, textLayers: TextLayerData[] }> => {
  const ai = getAIClient();

  const validReferences = references.filter(r => r.base64 !== null);
  const validSubjects = subjectImages.filter(s => s.base64 !== null);

  // 4. Construção do Prompt do Sistema
  let systemPrompt = `
      ATUAÇÃO: Você é um Engenheiro de Prompt de IA Visionária e Especialista em OCR/Tipografia.
      
      OBJETIVO:
      1. Extrair os detalhes da imagem de referência de forma impecável, gerando um JSON perfeitamente detalhado e minucioso, descrevendo o cenário, o sujeito, o estilo e TUDO que for possível para que o resultado fique IGUALZINHO à referência.
      2. PRIORIDADE DE CONFIGURAÇÃO: Se o usuário selecionou predefinições manuais de Câmera, Estilo ou Iluminação, elas DEVEM ter prioridade máxima e serem o guia principal da estética da imagem, sobrepondo-se ao estilo da referência se necessário.
      3. IMPORTANTE SOBRE TEXTOS: As imagens geradas NÃO devem ter "textos sobrepostos" (overlay texts) em pós-produção. Os ÚNICOS textos permitidos são aqueles que compõem os objetos físicos na cena (logotipos, escritos em camisas, faixadas, outdoors, etc.). 
      4. Sendo assim, o array "text_layers" DEVE retornar SEMPRE VAZIO ([]). TODO e QUALQUER TEXTO deve ser minuciosamente descrito *dentro* do "image_prompt_json" para ser gerado organicamente pela IA.
      5. Retornar um JSON estruturado com o "image_prompt_json" extremamente fiel descrevendo a iluminação, paleta de cores, e composição da referência, INTEGRANDO PRIORITARIAMENTE as escolhas de câmera do usuário.

      FONTS DISPONÍVEIS (Google Fonts):
      ${GOOGLE_FONTS.join(', ')}

      FORMATO DE RESPOSTA (JSON OBRIGATÓRIO):
      {
        "image_prompt_json": {
          "composicao_visual": {
            "estilo": "...",
            "paleta_de_cores": ["..."],
            "iluminação": { "tipo": "...", "direcao": "...", "efeitos": "..." }
          },
          "elemento_central": {
            "sujeito": "...",
            "caracteristicas_faciais": { "expressao": "...", "detalhes": "...", "acessorios": ["..."] },
            "integracao_cenica": "..."
          },
          "elementos_de_escala_e_detalhes": {
            "personagens_secundarios": { "descricao": "...", "vestuario": "...", "atividades": ["..."] },
            "veiculos_e_objetos": ["..."]
          },
          "ambiente_background": {
            "primeiro_plano": "...",
            "meio_plano": "...",
            "plano_fundo": "..."
          },
          "texturas_detalhadas": { "gelo_ou_materiais_principais": "...", "atmosfera": "..." },
          "descricao_do_sujeito": "Descreva a fisionomia do sujeito da imagem de forma perfeitamente detalhada, citando formato ósseo, marcas, cabelo, sobrancelha. (APENAS DESCRIÇÃO VISUAL)."
        },
        "text_layers": [] // SEMPRE RETORNE VAZIO.
      }

      ESQUELETO DO OBJETO JSON 'image_prompt_json':
      - Mapeie TODA a composição visual, elementos centrais, personagens secundários, ambiente e texturas (exatamente como no formato json fornecido por instrução e preenchendo todos os atributos aplicáveis).
      - Na chave descricao_do_sujeito: Descreva a fisionomia com extrema precisão visual e realismo fotográfico absoluto. Adicione riqueza de detalhes: nitidez de fotografia real, microestruturas naturais da pele, pequenos pelos faciais sutis, poros visíveis, imperfeições humanas orgânicas, sardas ou marcas de expressão naturais. Mencione a textura da íris e o brilho úmido dos olhos. (Não use textos conversacionais ou ordens diretas para a IA, apenas descreva visualmente).
      - TEXTURAS E MICRODETALHES: Especifique "fotografia hiper-realista", "qualidade de lente prime cinematográfica", "resolução 2K/4K", "textura de pele humana real com poros visíveis", "fios de cabelo individuais", "textura de tecido realista" e "micro-detalhes de superfície".
      - A ideia é manter a essência da referência (roupa, cenário, luz) substituindo APENAS o sujeito pelo sujeito do usuário.
      - NÃO adicione textos no design a não ser que sejam textos orgânicos gravados em camisas, crachás ou estruturas do fundo.
      - IMPORTANTE: O prompt final deve soar como uma descrição técnica de uma fotografia de altíssimo nível.


      PASSO A PASSO:
      0. ANÁLISE FACIAL EXTREMA (CRÍTICO): Seu objetivo principal é garantir que a imagem gerada seja IDÊNTICA à pessoa fornecida. Você receberá uma ou múltiplas fotos do mesmo sujeito (modelo). Use TODAS as fotos para entender completamente a estrutura óssea, nariz, boca, marcas e identidade visual dessa pessoa em 360 graus. O vestuário deve ser copiado se solicitado, mas a ênfase é na clonagem anatômica do rosto.
      0.5. POSE E ÂNGULO: Não fique preso à pose das fotos do modelo. Use o conhecimento adquirido sobre o rosto do sujeito para descrever como esse mesmo rosto deve parecer na pose, ângulo e direção de olhar exigidos pelas Configurações do Usuário ou pela Imagem de Referência de Cenário.
      1. LEITURA PROFUNDA DA REFERÊNCIA (SE HOUVER REFERÊNCIA VISUAL): Examine a imagem de referência fornecida pixel por pixel. Você DEVE extrair a leitura perfeitamente formatando O PRÓPRIO 'image_prompt_json' detalhado minuciosamente com todos os detalhes possíveis. Mapeie TODA a composição visual, elementos centrais, personagens secundários, ambiente e texturas (exatamente como no formato json fornecido). A própria estrutura do 'image_prompt_json' é o que ditará a geração final, trazendo um resultado impecável, igualzinho à referência fornecida (mas claro, com o rosto idêntico ao sujeito/modelo fornecido).
      1.5. SOFISTICAÇÃO EXTREMA E PRIORIDADE TÉCNICA: Integre maravilhosamente todas as Configurações de Câmera e Estilo selecionadas pelo usuário no prompt final. ESTAS CONFIGURAÇÕES SÃO PRIORITÁRIAS. O prompt deve ser MAGNÍFICO, extenso e riquíssimo em detalhes como: iluminação primorosa, lentes cinematográficas (e.g. 35mm, f/1.4, bokeh), atmosfera, composição e todas as minúcias. Se as configurações do usuário pedirem um estilo diferente da imagem de referência, siga AS CONFIGURAÇÕES DO USUÁRIO.
      2. IMPORTANTE ESSENCIAL SOBRE TEXTOS: VOCÊ DEVE PRESERVAR E DESCREVER DENTRO DO PROMPT DE IMAGEM todos os logotipos, ícones, números e textos que façam parte física do sujeito (ex: escritos na camiseta, tatuagens) ou do cenário natural da referência (ex: placas de rua, letreiros físicos na parede).
      3. IMPORTANTE: RETORNE O ARRAY "text_layers" VAZIO. As imagens geradas não devem ter textos sobrepostos na frente (overlay), somente aqueles que se enquadrem nos objetos, roupas e fachadas que são gerados nativamente junto com a imagem da IA.
      4. POSICIONAMENTO DO SUJEITO: O usuário escolheu posicionar o sujeito principal em: "${subjectPosition.toUpperCase()}". O prompt deve refletir isso explicitamente na Orientação.
      5. CRÍTICO (FIDELIDADE ABSOLUTA DA IDENTIDADE E EXPRESSÃO): O prompt DEVE exigir que a imagem use a mesma face das fotos do modelo sem alterações estruturais, preservando absolutamente as proporções originais, a estrutura óssea e as linhas faciais a partir de qualquer ângulo. A exigência fundamental é ser uma CLONAGEM PERFEITA da fisionomia. Instrua a IA a adaptar a expressão e a pose perfeitamente para o cenário/referência ou para as configurações de olhar passadas pelo usuário, mas sem perder a semelhança da pessoa. Adicionalmente, preencha o prompt com O MÁXIMO DE DETALHES DE ESTILO, LUZ E CENÁRIO baseados nas configurações da câmera e imagem de referência.
      6. REFERÊNCIAS VISUAIS: Se houver referências, o sujeito DEVE ser inserido NESTE CONTEXTO/CENÁRIO. A referência dita a iluminação, o fundo, a composição e o estilo.
      7. PARÂMETROS DE CÂMERA E ESTILO (PRIORIDADE MÁXIMA): Você DEVE incluir explicitamente as seguintes configurações no prompt gerado (se fornecidas), expandindo-as com descrições poéticas e precisas de fotografia. Estas seleções do usuário DEVEM ditar a atmosfera técnica da imagem gerada:
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

      IMPORTANTE: As configurações de câmera e lente NÃO devem ser apenas listadas. Você DEVE traduzi-las em um parágrafo enorme, rico, descritivo e visual para o "O cenário é [...]". Por exemplo, não escreva "lente 85mm e luz dramática". Escreva "Fundo ricamente imersivo desfocado pelo forte efeito bokeh de uma lente 85mm, onde a iluminação dramática global banha um lado do rosto do sujeito em tons quentes e contrastantes, criando sombras profundas detalhadas geometricamente no lado oposto, masterizando a profundidade de campo com ray tracing...". Exagere e abuse do vocabulário fotográfico profissional para compensar a concisão da descrição fisiológica do rosto.
      
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
          systemPrompt += `\n[FOTO DO MODELO ${index+1} (${validSubjects.length} fotos fornecidas no total)]: ${desc}. OBJETIVO CRÍTICO: Esta é uma das fotos para o "estudo do personagem". MEMORIZE a biometria, os detalhes do rosto, do cabelo e da pele a partir deste ângulo. NÃO force a imagem gerada a ter a mesma pose ou fundo desta foto. Apenas use a identidade visual para formar uma compreensão completa do sujeito.\n`;
          parts.push(imgPart);
      }
  });

  // Atualizar o prompt de texto final
  parts[0] = { text: systemPrompt };

  const response = await generateContentWithRetry(ai, {
    model: model,
    contents: { parts: parts },
    config: { 
      responseMimeType: 'application/json'
    }
  });


  const text = response.text;
  if (!text) throw new Error("Falha ao gerar o prompt detalhado.");
  
  try {
      let cleanedText = text.trim();
      if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```(json)?\n/, '').replace(/\n```$/, '');
      }
      const json = JSON.parse(cleanedText);
      let finalPrompt = text;
      
      if (json.image_prompt_json) {
          // Construct a fluid natural language prompt from the structured JSON
          const p = json.image_prompt_json;
          const promptParts = [];
          
          if (p.composicao_visual) {
            promptParts.push(`ESTILO E COMPOSIÇÃO: ${p.composicao_visual.estilo || ''}. Paleta: ${Array.isArray(p.composicao_visual.paleta_de_cores) ? p.composicao_visual.paleta_de_cores.join(', ') : ''}.`);
            if (p.composicao_visual.iluminação) {
              const l = p.composicao_visual.iluminação;
              promptParts.push(`ILUMINAÇÃO: ${l.tipo || ''}, vinda de ${l.direcao || ''}, com efeitos de ${l.efeitos || ''}.`);
            }
          }

          if (p.elemento_central) {
            promptParts.push(`SUJEITO PRINCIPAL: ${p.elemento_central.sujeito || ''}.`);
            if (p.elemento_central.caracteristicas_faciais) {
              const f = p.elemento_central.caracteristicas_faciais;
              promptParts.push(`EXPRESSÃO E FACE: ${f.expressao || ''}. Detalhes técnicos da face: ${f.detalhes || ''}.`);
            }
            if (p.descricao_do_sujeito) {
              promptParts.push(`BIOMETRIA DETALHADA: ${p.descricao_do_sujeito}`);
            }
            promptParts.push(`INTEGRAÇÃO: ${p.elemento_central.integracao_cenica || ''}.`);
          }

          if (p.ambiente_background) {
            promptParts.push(`CENÁRIO: No primeiro plano ${p.ambiente_background.primeiro_plano || ''}. No meio plano ${p.ambiente_background.meio_plano || ''}. Ao fundo ${p.ambiente_background.plano_fundo || ''}.`);
          }

          if (p.elementos_de_escala_e_detalhes) {
            if (p.elementos_de_escala_e_detalhes.personagens_secundarios) {
              const s = p.elementos_de_escala_e_detalhes.personagens_secundarios;
              promptParts.push(`PERSONAGENS ADICIONAIS: ${s.descricao || ''} vestindo ${s.vestuario || ''}, realizando ${Array.isArray(s.atividades) ? s.atividades.join(' e ') : ''}.`);
            }
            if (Array.isArray(p.elementos_de_escala_e_detalhes.veiculos_e_objetos)) {
              promptParts.push(`OBJETOS NA CENA: ${p.elementos_de_escala_e_detalhes.veiculos_e_objetos.join(', ')}.`);
            }
          }

          if (p.texturas_detalhadas) {
            promptParts.push(`DETALHES TÉCNICOS DE RENDERIZAÇÃO: Texturas de ${p.texturas_detalhadas.gelo_ou_materiais_principais || ''}. Atmosfera com ${p.texturas_detalhadas.atmosfera || ''}.`);
          }

          finalPrompt = promptParts.join(' ');
      } else if (typeof json.image_prompt === 'string') {
          finalPrompt = json.image_prompt;
      }
      
      return {
          prompt: finalPrompt,
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
    if (textPart && !response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)) {
        // Only throw if NO image was generated at all
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

