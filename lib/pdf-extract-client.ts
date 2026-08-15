'use client';

import type { PdfExtractedDocument, PdfExtractedPage } from '@/types/pdf-import';

type TextItemLike={str?:string;transform?:number[];width?:number};

function buildLines(items:TextItemLike[]) {
  const rows:{y:number;items:{x:number;text:string}[]}[]=[];
  for(const item of items){
    const text=String(item.str||'').trim(); if(!text) continue;
    const x=Number(item.transform?.[4]||0), y=Number(item.transform?.[5]||0);
    let row=rows.find((r)=>Math.abs(r.y-y)<=2.2);
    if(!row){row={y,items:[]};rows.push(row);}
    row.items.push({x,text});
  }
  return rows.sort((a,b)=>b.y-a.y).map((row)=>row.items.sort((a,b)=>a.x-b.x).map((x)=>x.text).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
}

async function fingerprint(buffer:ArrayBuffer){
  const digest=await crypto.subtle.digest('SHA-256',buffer);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2,'0')).join('');
}

export async function extractPdfFile(file:File,onProgress?:(page:number,total:number)=>void):Promise<PdfExtractedDocument>{
  const buffer=await file.arrayBuffer();
  const hash=await fingerprint(buffer);
  // webpack.mjs configures the worker bundle for webpack-compatible builds, including Next.js production builds.
  const pdfjs=await import('pdfjs-dist/webpack.mjs');
  const pdf=await pdfjs.getDocument({data:new Uint8Array(buffer)}).promise;
  const pages:PdfExtractedPage[]=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p); const content=await page.getTextContent();
    const lines=buildLines(content.items as TextItemLike[]);
    pages.push({page:p,lines,text:lines.join('\n')});
    onProgress?.(p,pdf.numPages);
  }
  return {name:file.name,size:file.size,fingerprint:hash,pages};
}
