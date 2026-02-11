import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Rect, Transformer } from 'react-konva';
import useImage from 'use-image';
import { jsPDF } from 'jspdf';
import { LayoutTemplate, Settings, Download, Image as ImageIcon, Type, Trash2, Upload } from 'lucide-react';

type FieldType = 'texto' | 'foto';

interface Field {
  id: string;
  type: FieldType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  value?: string;
}

const Workspace = ({ 
  baseImage, 
  fields, 
  setFields, 
  mode, 
  values, 
  photoData 
}: { 
  baseImage: string | null, 
  fields: Field[], 
  setFields: any, 
  mode: 'admin' | 'operacao',
  values: Record<string, string>,
  photoData: string | null
}) => {
  const [img] = useImage(baseImage || '');
  const [selectedId, selectShape] = useState<string | null>(null);
  const trRef = useRef<any>(null);
  const shapeRefs = useRef<{ [key: string]: any }>({});
  const [photoImg] = useImage(photoData || '');

  useEffect(() => {
    if (selectedId && mode === 'admin') {
      trRef.current?.nodes([shapeRefs.current[selectedId]]);
      trRef.current?.getLayer().batchDraw();
    }
  }, [selectedId, mode]);

  if (!img) return <div className="flex items-center justify-center h-64 bg-slate-200 rounded-lg border-2 border-dashed border-slate-300 text-slate-500">Faça o upload da base (PNG/JPG)</div>;

  return (
    <Stage width={img.width} height={img.height} onMouseDown={(e) => {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) selectShape(null);
    }} className="border shadow-lg bg-white rounded-lg overflow-hidden">
      <Layer>
        <KonvaImage image={img} />
        {fields.map((field) => {
          const isSelected = field.id === selectedId;
          
          if (field.type === 'foto') {
            return (
              <React.Fragment key={field.id}>
                {mode === 'operacao' && photoImg ? (
                  <KonvaImage image={photoImg} x={field.x} y={field.y} width={field.w} height={field.h} />
                ) : (
                  <Rect
                    ref={(node) => { shapeRefs.current[field.id] = node; }}
                    x={field.x} y={field.y} width={field.w} height={field.h}
                    fill={mode === 'admin' ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.1)"}
                    stroke="red" strokeWidth={isSelected ? 2 : 1}
                    draggable={mode === 'admin'}
                    onClick={() => mode === 'admin' && selectShape(field.id)}
                    onDragEnd={(e) => {
                      const newFields = fields.map(f => f.id === field.id ? { ...f, x: e.target.x(), y: e.target.y() } : f);
                      setFields(newFields);
                    }}
                    onTransformEnd={() => {
                      const node = shapeRefs.current[field.id];
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1); node.scaleY(1);
                      const newFields = fields.map(f => f.id === field.id ? { ...f, x: node.x(), y: node.y(), w: Math.max(5, node.width() * scaleX), h: Math.max(5, node.height() * scaleY) } : f);
                      setFields(newFields);
                    }}
                  />
                )}
                {mode === 'admin' && <Text x={field.x} y={field.y - 15} text={field.name} fill="red" fontSize={12} />}
              </React.Fragment>
            );
          }

          // Campo de Texto
          return (
            <React.Fragment key={field.id}>
              <Text
                ref={(node) => { shapeRefs.current[field.id] = node; }}
                x={field.x} y={field.y}
                text={mode === 'operacao' ? (values[field.name] || '') : field.name}
                fontSize={field.fontSize || 20}
                fill="black"
                fontFamily="Arial"
                draggable={mode === 'admin'}
                onClick={() => mode === 'admin' && selectShape(field.id)}
                onDragEnd={(e) => {
                  const newFields = fields.map(f => f.id === field.id ? { ...f, x: e.target.x(), y: e.target.y() } : f);
                  setFields(newFields);
                }}
              />
              {mode === 'admin' && isSelected && (
                <Rect x={field.x - 2} y={field.y - 2} width={100} height={field.fontSize! + 4} stroke="#3b82f6" strokeWidth={1} dash={[4, 4]} listening={false} />
              )}
            </React.Fragment>
          );
        })}
        {mode === 'admin' && selectedId && <Transformer ref={trRef} boundBoxFunc={(oldBox, newBox) => newBox.width < 10 || newBox.height < 10 ? oldBox : newBox} />}
      </Layer>
    </Stage>
  );
};

export default function App() {
  const [view, setView] = useState<'admin' | 'operacao'>('admin');
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [photoData, setPhotoData] = useState<string | null>(null);
  
  const stageContainerRef = useRef<HTMLDivElement>(null);

  const handleBaseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBaseImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhotoData(URL.createObjectURL(e.target.files[0]));
    }
  };

  const addField = (type: FieldType) => {
    let name = '';
    if (type === 'texto') {
      const promptName = prompt('Nome do campo (texto):');
      if (!promptName) return;
      name = promptName.toUpperCase();
    } else {
      name = 'FOTO';
    }
    setFields([...fields, {
      id: Math.random().toString(36).substr(2, 9),
      type, name, x: 50, y: 50, w: type === 'foto' ? 100 : 0, h: type === 'foto' ? 130 : 0, fontSize: 20
    }]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const generatePDF = async () => {
    if (!stageContainerRef.current) return;
    const stage = stageContainerRef.current.querySelector('canvas');
    if (!stage) return;
    
    const pdf = new jsPDF('landscape', 'px', [stage.width, stage.height]);
    pdf.addImage(stage.toDataURL('image/png', 1.0), 'PNG', 0, 0, stage.width, stage.height);
    pdf.save('carteirinha-oab.pdf');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="bg-blue-900 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xl font-bold">
            <LayoutTemplate /> <span>Sistema OAB Pro</span>
          </div>
          <div className="text-sm bg-blue-800 px-3 py-1 rounded-full">
            v1.1.0 • {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('admin')} className={`px-4 py-2 rounded font-medium flex gap-2 items-center transition-colors ${view === 'admin' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}><Settings size={18}/> Admin (Mapear)</button>
          <button onClick={() => setView('operacao')} className={`px-4 py-2 rounded font-medium flex gap-2 items-center transition-colors ${view === 'operacao' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}><LayoutTemplate size={18}/> Operação (Gerar)</button>
        </div>
      </header>

      <main className="flex-1 flex p-6 gap-6">
        {/* Sidebar */}
        <aside className="w-80 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6 h-fit">
          {view === 'admin' ? (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">1. Base PNG</h2>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                  <Upload className="mb-2" />
                  <span className="text-sm font-medium">Upload Frente/Verso</span>
                  <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleBaseUpload} />
                </label>
              </div>
              
              <div>
                <h2 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">2. Adicionar Campos</h2>
                <div className="flex gap-2">
                  <button onClick={() => addField('texto')} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded flex items-center justify-center gap-2 font-medium border border-slate-300"><Type size={16}/> Texto</button>
                  <button onClick={() => addField('foto')} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded flex items-center justify-center gap-2 font-medium border border-slate-300"><ImageIcon size={16}/> Foto</button>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Campos Criados</h2>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-2">
                  {fields.length === 0 && <p className="text-sm text-slate-400 italic">Nenhum campo adicionado.</p>}
                  {fields.map(f => (
                    <div key={f.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded">
                      <div className="flex items-center gap-2">
                        {f.type === 'texto' ? <Type size={14} className="text-blue-500"/> : <ImageIcon size={14} className="text-red-500"/>}
                        <span className="text-sm font-medium text-slate-700">{f.name}</span>
                      </div>
                      <button onClick={() => removeField(f.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Preencher Dados</h2>
                <div className="flex flex-col gap-4">
                  {fields.filter(f => f.type === 'texto').map(f => (
                    <div key={f.id}>
                      <label className="block text-sm font-semibold text-slate-600 mb-1">{f.name}</label>
                      <input 
                        type="text" 
                        className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder={`Digite ${f.name}`}
                        value={values[f.name] || ''}
                        onChange={(e) => setValues({...values, [f.name]: e.target.value})}
                      />
                    </div>
                  ))}
                  
                  {fields.some(f => f.type === 'foto') && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1">Foto 3x4</label>
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-300 rounded" />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto">
                <button onClick={generatePDF} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm">
                  <Download size={20} /> Baixar PDF Final
                </button>
              </div>
            </>
          )}
        </aside>

        {/* Workspace Area */}
        <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 overflow-auto flex items-center justify-center p-8 relative shadow-inner">
          {view === 'admin' && <div className="absolute top-4 left-4 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium border border-yellow-200 shadow-sm z-10">Modo Edição: Clique e arraste os campos</div>}
          <div className="relative overflow-auto max-w-full max-h-full">
            <div ref={stageContainerRef} className="shadow-2xl transform-gpu" style={{transform: 'scale(1)', transformOrigin: 'top left'}}>
              <Workspace baseImage={baseImage} fields={fields} setFields={setFields} mode={view} values={values} photoData={photoData} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
