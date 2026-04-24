import React, { useRef } from 'react';

interface DropzoneProps {
  id: string;
  label: string;
  subLabel?: string;
  required?: boolean;
  image: string | null;
  heightClass: string;
  onImageChange: (base64: string | null) => void;
  icon?: string;
}

const Dropzone: React.FC<DropzoneProps> = ({ 
  id, label, subLabel, required, image, heightClass, onImageChange, icon = "fa-image" 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImageChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onImageChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) processFile(blob);
        e.preventDefault(); 
        return; 
      }
    }
  };

  return (
    <div className="group">
      <div className="flex justify-between items-center mb-2 px-1">
        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">{label}</label>
        {required && (
          <span className="text-[8px] font-bold text-neon-500 border border-neon-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Obrigatório</span>
        )}
      </div>
      <div 
        ref={containerRef}
        tabIndex={0}
        onPaste={handlePaste}
        className={`
            relative w-full ${heightClass} 
            border transition-all duration-300 ease-out cursor-pointer flex flex-col justify-center items-center overflow-hidden 
            rounded-none
            ${image 
                ? 'border-neon-500/40 bg-black' 
                : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-neon-500/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]'
            }
        `}
        onClick={() => fileInputRef.current?.click()}
        title="Clique para upload ou Cole (Ctrl+V)"
      >
        <input 
          type="file" 
          ref={fileInputRef}
          accept="image/*" 
          onChange={handleFileChange}
          className="hidden" 
        />
        
        {image ? (
          <>
            <img src={image} className="absolute inset-0 w-full h-full object-contain z-0 p-2" alt="Preview" />
            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                <button 
                  onClick={handleRemove}
                  className="text-white border border-white/20 rounded-full w-10 h-10 flex items-center justify-center hover:bg-red-500 hover:border-red-500 transition-all"
                >
                  <i className="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
          </>
        ) : (
          <div className="text-center transition-all duration-300 group-hover:scale-95 group-hover:opacity-100 opacity-60">
            <i className={`fas ${icon} text-2xl mb-3 text-electric-500 group-hover:text-neon-500 transition-colors`}></i>
            <p className="text-[10px] uppercase font-bold text-gray-500 group-hover:text-white transition-colors tracking-wide">{subLabel || 'Upload Image'}</p>
          </div>
        )}
        
        {/* Corner Accents for futuristic look */}
        {!image && (
            <>
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/10 group-hover:border-neon-500/50 transition-colors"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/10 group-hover:border-neon-500/50 transition-colors"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/10 group-hover:border-neon-500/50 transition-colors"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/10 group-hover:border-neon-500/50 transition-colors"></div>
            </>
        )}
      </div>
    </div>
  );
};

export default Dropzone;