import { useEffect, useState, useCallback, useRef } from "react";
import api from "../../lib/api";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import JsBarcode from "jsbarcode";

interface StudentCard {
  userId: string;
  fullName: string;
  instituteId: string;
  barcodeId: string | null;
  avatarUrl: string | null;
  school: string | null;
  phone: string | null;
  gender: string | null;
  status: string;
  enrolledDate: string;
  classes: { id: string; name: string; subject: string | null }[];
}
interface ClassOption { id: string; name: string; subject: string | null; }

const CARD_W = 660, CARD_H = 420, SCALE = 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => res(img); img.onerror = () => rej(new Error("failed")); img.src = src; });
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
function trunc(t: string, n: number) { return t.length > n ? t.slice(0, n-1)+"…" : t; }
function generateBarcodeDataUrl(text: string): string {
  const c = document.createElement("canvas");
  try { JsBarcode(c, text, { format:"CODE128", width:2, height:52, displayValue:true, fontSize:13, margin:6, background:"#ffffff", lineColor:"#0f172a" }); }
  catch { const ctx=c.getContext("2d")!; c.width=200; c.height=60; ctx.fillStyle="#fff"; ctx.fillRect(0,0,200,60); ctx.fillStyle="#0f172a"; ctx.font="13px monospace"; ctx.textAlign="center"; ctx.fillText(text,100,35); }
  return c.toDataURL("image/png");
}

function drawInitials(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, name: string) {
  const initials = name.split(" ").map((p:string)=>p[0]).slice(0,2).join("").toUpperCase();
  const g = ctx.createLinearGradient(x,y,x+size,y+size); g.addColorStop(0,"#4f46e5"); g.addColorStop(1,"#2563eb");
  ctx.fillStyle = g; roundRect(ctx,x,y,size,size,14); ctx.fill();
  ctx.fillStyle="#e2e8f0"; ctx.font=`bold ${size*0.38}px "Segoe UI",sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(initials,x+size/2,y+size/2+2); ctx.textBaseline="alphabetic";
}

async function renderCard(student: StudentCard, instituteName: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas"); canvas.width=CARD_W*SCALE; canvas.height=CARD_H*SCALE;
  const ctx = canvas.getContext("2d")!; ctx.scale(SCALE,SCALE);
  // bg
  const bg=ctx.createLinearGradient(0,0,CARD_W,CARD_H); bg.addColorStop(0,"#0c1120"); bg.addColorStop(0.55,"#111827"); bg.addColorStop(1,"#0c1120");
  ctx.fillStyle=bg; roundRect(ctx,0,0,CARD_W,CARD_H,22); ctx.fill();
  // left strip
  const sg=ctx.createLinearGradient(0,0,0,CARD_H); sg.addColorStop(0,"#6366f1"); sg.addColorStop(1,"#3b82f6");
  ctx.fillStyle=sg; roundRect(ctx,0,0,7,CARD_H,22); ctx.fill(); ctx.fillRect(4,0,3,CARD_H);
  // header band
  const hb=ctx.createLinearGradient(0,0,CARD_W,0); hb.addColorStop(0,"rgba(99,102,241,0.18)"); hb.addColorStop(0.5,"rgba(59,130,246,0.10)"); hb.addColorStop(1,"rgba(139,92,246,0.18)");
  ctx.fillStyle=hb; ctx.fillRect(7,0,CARD_W-7,72);
  // divider
  const dg=ctx.createLinearGradient(60,0,CARD_W-60,0); dg.addColorStop(0,"rgba(99,102,241,0)"); dg.addColorStop(0.3,"rgba(99,102,241,0.8)"); dg.addColorStop(0.7,"rgba(59,130,246,0.8)"); dg.addColorStop(1,"rgba(59,130,246,0)");
  ctx.fillStyle=dg; ctx.fillRect(30,72,CARD_W-60,1.5);
  // logo circle
  const cx2=42,cy2=36; const gc=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,18); gc.addColorStop(0,"#818cf8"); gc.addColorStop(1,"#4f46e5");
  ctx.beginPath(); ctx.arc(cx2,cy2,18,0,Math.PI*2); ctx.fillStyle=gc; ctx.fill();
  ctx.fillStyle="#ffffff"; ctx.font="bold 16px 'Segoe UI',sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("T",cx2,cy2+1); ctx.textBaseline="alphabetic";
  // institute name
  ctx.fillStyle="#e2e8f0"; ctx.font="bold 17px 'Segoe UI',sans-serif"; ctx.textAlign="left"; ctx.fillText(trunc(instituteName,50),70,31);
  ctx.fillStyle="#94a3b8"; ctx.font="11px 'Segoe UI',sans-serif"; ctx.fillText("STUDENT  ID  CARD",70,50);
  // photo
  const px=28,py=92,ps=126;
  ctx.shadowColor="rgba(0,0,0,0.5)"; ctx.shadowBlur=12; ctx.shadowOffsetY=4; ctx.fillStyle="#1e293b"; roundRect(ctx,px,py,ps,ps,14); ctx.fill(); ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  ctx.save(); const pbg=ctx.createLinearGradient(px,py,px+ps,py+ps); pbg.addColorStop(0,"#6366f1"); pbg.addColorStop(1,"#3b82f6"); ctx.strokeStyle=pbg; ctx.lineWidth=2.5; roundRect(ctx,px-1.5,py-1.5,ps+3,ps+3,15.5); ctx.stroke(); ctx.restore();
  if (student.avatarUrl) { try { const img=await loadImage(student.avatarUrl); ctx.save(); roundRect(ctx,px,py,ps,ps,14); ctx.clip(); ctx.drawImage(img,px,py,ps,ps); ctx.restore(); } catch { drawInitials(ctx,px,py,ps,student.fullName); } } else { drawInitials(ctx,px,py,ps,student.fullName); }
  // details
  const dx=174; let oy=88;
  ctx.fillStyle="#f1f5f9"; ctx.font="bold 20px 'Segoe UI',sans-serif"; ctx.textAlign="left"; ctx.fillText(trunc(student.fullName,28),dx,oy+14); oy+=30;
  // ID chip
  const idTxt=student.instituteId; ctx.font="bold 12px 'Courier New',monospace"; const idW2=ctx.measureText(idTxt).width+20;
  const cg2=ctx.createLinearGradient(dx,oy,dx+idW2,oy); cg2.addColorStop(0,"rgba(99,102,241,0.25)"); cg2.addColorStop(1,"rgba(59,130,246,0.25)"); ctx.fillStyle=cg2; roundRect(ctx,dx,oy,idW2,22,6); ctx.fill();
  ctx.strokeStyle="rgba(99,102,241,0.4)"; ctx.lineWidth=1; roundRect(ctx,dx,oy,idW2,22,6); ctx.stroke();
  ctx.fillStyle="#a5b4fc"; ctx.textAlign="center"; ctx.fillText(idTxt,dx+idW2/2,oy+15); oy+=32;
  // info rows
  const rows:{label:string;value:string;color?:string}[]=[];
  if(student.school) rows.push({label:"School",value:trunc(student.school,28)});
  if(student.gender) rows.push({label:"Gender",value:student.gender==="MALE"?"Male":student.gender==="FEMALE"?"Female":"Other"});
  if(student.phone) rows.push({label:"Phone",value:student.phone});
  if(student.classes.length>0) rows.push({label:"Class",value:trunc(student.classes.map(c=>c.name).join(", "),30),color:"#c4b5fd"});
  ctx.textAlign="left";
  for (const row of rows.slice(0,4)) {
    ctx.fillStyle="#64748b"; ctx.font="11px 'Segoe UI',sans-serif"; ctx.fillText(row.label+":",dx,oy+1);
    ctx.fillStyle=row.color||"#cbd5e1"; ctx.font="12px 'Segoe UI',sans-serif"; const lw=ctx.measureText(row.label+":  ").width; ctx.fillText(row.value,dx+lw,oy+1); oy+=19;
  }
  // status badge
  const sm:Record<string,{bg:string;text:string;border:string}>={ACTIVE:{bg:"rgba(34,197,94,0.15)",text:"#4ade80",border:"rgba(34,197,94,0.4)"},INACTIVE:{bg:"rgba(100,116,139,0.15)",text:"#94a3b8",border:"rgba(100,116,139,0.4)"},PENDING:{bg:"rgba(245,158,11,0.15)",text:"#fbbf24",border:"rgba(245,158,11,0.4)"},OLD:{bg:"rgba(168,85,247,0.15)",text:"#c084fc",border:"rgba(168,85,247,0.4)"}};
  const sc=sm[student.status]||sm.ACTIVE; ctx.font="bold 10px 'Segoe UI',sans-serif"; const sw2=ctx.measureText(student.status).width+18; const sx2=CARD_W-sw2-18,sy2=82;
  ctx.fillStyle=sc.bg; roundRect(ctx,sx2,sy2,sw2,20,5); ctx.fill(); ctx.strokeStyle=sc.border; ctx.lineWidth=0.8; roundRect(ctx,sx2,sy2,sw2,20,5); ctx.stroke();
  ctx.fillStyle=sc.text; ctx.textAlign="center"; ctx.fillText(student.status,sx2+sw2/2,sy2+14);
  // divider above barcode
  ctx.fillStyle="rgba(99,102,241,0.25)"; ctx.fillRect(28,CARD_H-130,CARD_W-56,1);
  // barcode
  if(student.barcodeId){
    const bdUrl=generateBarcodeDataUrl(student.barcodeId);
    try { const bi=await loadImage(bdUrl); const mw=CARD_W-80; const bw2=Math.min(bi.width,mw); const bh2=(bw2/bi.width)*bi.height; const bx2=(CARD_W-bw2)/2; const by2=CARD_H-125;
      ctx.fillStyle="#ffffff"; roundRect(ctx,bx2-14,by2-8,bw2+28,bh2+16,10); ctx.fill(); ctx.strokeStyle="rgba(99,102,241,0.2)"; ctx.lineWidth=1; roundRect(ctx,bx2-14,by2-8,bw2+28,bh2+16,10); ctx.stroke(); ctx.drawImage(bi,bx2,by2,bw2,bh2); } catch{}
  } else {
    ctx.fillStyle="rgba(255,255,255,0.04)"; roundRect(ctx,40,CARD_H-125,CARD_W-80,90,10); ctx.fill();
    ctx.fillStyle="#475569"; ctx.font="12px 'Segoe UI',sans-serif"; ctx.textAlign="center"; ctx.fillText("No barcode assigned",CARD_W/2,CARD_H-72);
  }
  // bottom bar
  const bg2=ctx.createLinearGradient(0,0,CARD_W,0); bg2.addColorStop(0,"#6366f1"); bg2.addColorStop(0.5,"#3b82f6"); bg2.addColorStop(1,"#8b5cf6"); ctx.fillStyle=bg2; ctx.fillRect(28,CARD_H-7,CARD_W-56,3);
  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res,rej) => canvas.toBlob(b=>b?res(b):rej(new Error("failed")),"image/png"));
}

const STATUS_BADGE: Record<string,string> = {
  ACTIVE:"bg-emerald-100 text-emerald-700",INACTIVE:"bg-slate-100 text-slate-500",PENDING:"bg-amber-100 text-amber-700",OLD:"bg-purple-100 text-purple-700"
};

const IcDl = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>;
const IcEye = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3-8C8.477 4 4.268 7.11 2.458 10.5a18.17 18.17 0 000 3C4.268 16.89 8.477 20 12 20s7.732-3.11 9.542-6.5a18.17 18.17 0 000-3C19.732 7.11 15.523 4 12 4z"/></svg>;
const IcSearch = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg>;
const IcCard = () => <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}><rect x="2" y="5" width="20" height="14" rx="2"/><path strokeLinecap="round" d="M2 10h20M7 15h2M13 15h4"/></svg>;
const IcClose = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>;
const IcZip = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>;

export default function AdminIdCards() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [filtered, setFiltered] = useState<StudentCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current:0, total:0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterClass, setFilterClass] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [enrolledFrom, setEnrolledFrom] = useState("");
  const [enrolledTo, setEnrolledTo] = useState("");
  const [instituteName, setInstituteName] = useState("Thilina Dhananjaya Institute");
  const [previewIdx, setPreviewIdx] = useState<number|null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string|null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get("/classes").then(r => {
      const d = Array.isArray(r.data) ? r.data : r.data?.data || [];
      setClasses(d.map((c:any) => ({ id:c.id, name:c.name, subject:c.subject })));
    });
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params:any = {};
      if(filterClass) params.classId=filterClass;
      if(enrolledFrom) params.enrolledFrom=enrolledFrom;
      if(enrolledTo) params.enrolledTo=enrolledTo;
      const { data } = await api.get("/users/students/id-card-data", { params });
      setStudents(data);
    } catch { setStudents([]); } finally { setLoading(false); }
  }, [filterClass, enrolledFrom, enrolledTo]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  useEffect(() => {
    if(!searchQ.trim()) { setFiltered(students); }
    else { const q=searchQ.toLowerCase(); setFiltered(students.filter(s=>s.fullName.toLowerCase().includes(q)||s.instituteId.toLowerCase().includes(q)||(s.barcodeId&&s.barcodeId.toLowerCase().includes(q)))); }
    setPreviewIdx(null); setPreviewDataUrl(null); setSelectedIds(new Set());
  }, [students, searchQ]);

  const openPreview = useCallback(async (idx:number) => {
    if(!filtered[idx]) return;
    setPreviewIdx(idx); setPreviewLoading(true); setPreviewDataUrl(null);
    try { const c=await renderCard(filtered[idx],instituteName); setPreviewDataUrl(c.toDataURL("image/png")); }
    finally { setPreviewLoading(false); }
    setTimeout(() => previewRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"}), 80);
  }, [filtered, instituteName]);

  const exportOne = useCallback(async (s:StudentCard) => {
    if(exporting) return; setExporting(true);
    try { const c=await renderCard(s,instituteName); saveAs(await canvasToBlob(c),`${s.instituteId}_${s.fullName.replace(/[^a-zA-Z0-9]/g,"_")}.png`); }
    finally { setExporting(false); }
  }, [instituteName, exporting]);

  const exportBulk = useCallback(async (list:StudentCard[], label:string) => {
    if(list.length===0||exporting) return;
    if(list.length===1) { await exportOne(list[0]); return; }
    setExporting(true); setExportProgress({current:0,total:list.length});
    const BATCH=50, total=Math.ceil(list.length/BATCH);
    try {
      for(let b=0;b<total;b++) {
        const zip=new JSZip(), slice=list.slice(b*BATCH,(b+1)*BATCH);
        for(let i=0;i<slice.length;i++) {
          const c=await renderCard(slice[i],instituteName);
          zip.file(`${slice[i].instituteId}_${slice[i].fullName.replace(/[^a-zA-Z0-9]/g,"_")}.png`, await canvasToBlob(c));
          setExportProgress({current:b*BATCH+i+1,total:list.length});
        }
        const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
        saveAs(blob, `${label}_${new Date().toISOString().split("T")[0]}${total>1?`_part${b+1}`:""}.zip`);
      }
    } finally { setExporting(false); setExportProgress({current:0,total:0}); }
  }, [instituteName, exporting, exportOne]);

  const toggleSelect = (id:string) => setSelectedIds(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAll = () => setSelectedIds(selectedIds.size===filtered.length ? new Set() : new Set(filtered.map(s=>s.userId)));
  const selList = filtered.filter(s=>selectedIds.has(s.userId));

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 flex-shrink-0">
            <IcCard />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Student ID Cards</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Generate &amp; export student cards as PNG</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {selList.length > 0 && (
            <button onClick={() => exportBulk(selList,"id_cards_selected")} disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-500/20 transition-all">
              <IcZip /> Export Selected ({selList.length})
            </button>
          )}
          <button onClick={() => exportBulk(filtered,"id_cards")} disabled={exporting||filtered.length===0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 transition-all">
            <IcDl /> Export All ({filtered.length})
          </button>
        </div>
      </div>

      {/* Progress */}
      {exporting && exportProgress.total > 0 && (
        <div className="p-4 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Generating cards…</span>
            <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">{exportProgress.current} / {exportProgress.total}</span>
          </div>
          <div className="w-full bg-[hsl(var(--muted))] rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-300"
              style={{width:`${(exportProgress.current/exportProgress.total)*100}%`}} />
          </div>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5">Large sets split into 50-card ZIP files automatically</p>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm">
        <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
          <p className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Filters &amp; Settings</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Class</label>
            <select value={filterClass} onChange={e=>setFilterClass(e.target.value)} className={inputCls}>
              <option value="">All Classes</option>
              {classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.subject?` (${c.subject})`:""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Search</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"><IcSearch /></span>
              <input type="text" value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Name, ID or Barcode…"
                className={inputCls + " pl-9"} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Enrolled From</label>
            <input type="date" value={enrolledFrom} onChange={e=>setEnrolledFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Enrolled To</label>
            <input type="date" value={enrolledTo} onChange={e=>setEnrolledTo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Institute Name (on card)</label>
            <input type="text" value={instituteName} onChange={e=>setInstituteName(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Table + Preview */}
      <div className={`flex flex-col ${previewIdx!==null?"xl:flex-row":""} gap-6 items-start`}>

        {/* Table */}
        <div className={`${previewIdx!==null?"xl:flex-1":"w-full"} rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm overflow-hidden`}>
          <div className="px-5 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
            <p className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              {loading ? "Loading…" : `${filtered.length} Student${filtered.length!==1?"s":""}`}
              {selectedIds.size>0 && <span className="ml-2 text-indigo-500">· {selectedIds.size} selected</span>}
            </p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{filtered.filter(s=>s.barcodeId).length} with barcode</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)]">
                  <th className="px-4 py-3 w-10"><input type="checkbox" checked={selectedIds.size===filtered.length&&filtered.length>0} onChange={toggleAll} className="rounded border-[hsl(var(--border))]" /></th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Student</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider hidden sm:table-cell">Barcode</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider hidden lg:table-cell">Classes</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_,i)=>(
                    <tr key={i} className="border-b border-[hsl(var(--border)/0.5)]">
                      <td colSpan={8} className="px-4 py-3"><div className="h-9 rounded-lg bg-[hsl(var(--muted))] animate-pulse" /></td>
                    </tr>
                  ))
                ) : filtered.length===0 ? (
                  <tr><td colSpan={8} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center">
                        <svg className="w-6 h-6 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><rect x="2" y="5" width="20" height="14" rx="2"/><path strokeLinecap="round" d="M2 10h20M7 15h2M13 15h4"/></svg>
                      </div>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">No students found. Adjust filters.</p>
                    </div>
                  </td></tr>
                ) : filtered.map((s,i)=>(
                  <tr key={s.userId}
                    className={`border-b border-[hsl(var(--border)/0.4)] transition-colors cursor-pointer
                      ${selectedIds.has(s.userId)?"bg-indigo-500/5":"hover:bg-[hsl(var(--muted)/0.3)]"}
                      ${previewIdx===i?"ring-1 ring-inset ring-indigo-500/40 bg-indigo-500/5":""}`}
                    onClick={()=>openPreview(i)}>
                    <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(s.userId)} onChange={()=>toggleSelect(s.userId)} className="rounded border-[hsl(var(--border))]" />
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{i+1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 overflow-hidden ring-2 ring-[hsl(var(--card))]">
                          {s.avatarUrl ? <img src={s.avatarUrl} alt="" className="w-8 h-8 object-cover" /> : s.fullName.split(" ").map((p:string)=>p[0]).slice(0,2).join("").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[hsl(var(--foreground))] text-sm truncate">{s.fullName}</p>
                          {s.school && <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{s.school}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-indigo-500">{s.instituteId}</span></td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {s.barcodeId ? <span className="font-mono text-xs text-[hsl(var(--foreground))]">{s.barcodeId}</span> : <span className="text-[11px] italic text-[hsl(var(--muted-foreground))]">None</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${STATUS_BADGE[s.status]||STATUS_BADGE.ACTIVE}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))] hidden lg:table-cell max-w-[140px] truncate">
                      {s.classes.map(c=>c.name).join(", ")||"—"}
                    </td>
                    <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={()=>openPreview(i)} title="Preview"
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${previewIdx===i?"bg-indigo-500 text-white":"bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-indigo-100 hover:text-indigo-600"}`}>
                          <IcEye />
                        </button>
                        <button onClick={()=>exportOne(s)} disabled={exporting} title="Download PNG"
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 text-blue-500 hover:bg-blue-100 disabled:opacity-40 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview panel */}
        {previewIdx!==null && filtered[previewIdx] && (
          <div ref={previewRef} className="xl:w-[400px] xl:flex-shrink-0 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm overflow-hidden xl:sticky xl:top-4">
            <div className="px-5 py-3.5 border-b border-[hsl(var(--border))] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Card Preview</p>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate mt-0.5">{filtered[previewIdx].fullName}</p>
              </div>
              <button onClick={()=>{setPreviewIdx(null);setPreviewDataUrl(null);}}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition">
                <IcClose />
              </button>
            </div>
            <div className="p-4 bg-[hsl(var(--muted)/0.3)]">
              <div className="rounded-xl overflow-hidden shadow-xl border border-[hsl(var(--border))]" style={{aspectRatio:`${CARD_W}/${CARD_H}`}}>
                {previewLoading ? (
                  <div className="w-full h-full bg-[hsl(var(--muted))] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Rendering…</p>
                    </div>
                  </div>
                ) : previewDataUrl ? (
                  <img src={previewDataUrl} alt="ID Card Preview" className="w-full h-full object-contain" />
                ) : null}
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <button onClick={()=>openPreview(Math.max(0,previewIdx-1))} disabled={previewIdx===0}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg> Prev
                </button>
                <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums whitespace-nowrap">{previewIdx+1} / {filtered.length}</span>
                <button onClick={()=>openPreview(Math.min(filtered.length-1,previewIdx+1))} disabled={previewIdx===filtered.length-1}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30 transition">
                  Next <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
              <button onClick={()=>exportOne(filtered[previewIdx])} disabled={exporting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 transition-all">
                <IcDl /> Download PNG
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
