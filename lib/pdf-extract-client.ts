'use client';

import type { PdfExtractedDocument, PdfExtractedPage } from '@/types/pdf-import';

type TextItemLike={str?:string;transform?:number[];width?:number};
type TextChunkLike={items?:TextItemLike[]};

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

/**
 * Safari/iOS compatibility:
 * pdf.js 5.x getTextContent() internally consumes streamTextContent() with
 * for-await-of. Some Safari versions expose ReadableStream.getReader() but
 * not the async iterator interface expected by pdf.js, causing:
 * "TypeError: undefined is not a function (near '...t of e...')".
 *
 * Read the same stream through the reader API first. Keep getTextContent()
 * as a fallback for environments where streamTextContent/getReader is absent.
 */
async function getTextItemsCompat(page:any):Promise<TextItemLike[]>{
  try{
    if(typeof page?.streamTextContent==='function'){
      const stream=page.streamTextContent();
      if(stream&&typeof stream.getReader==='function'){
        const reader=stream.getReader();
        const items:TextItemLike[]=[];
        try{
          while(true){
            const chunk=await reader.read() as {value?:TextChunkLike;done:boolean};
            if(chunk.done) break;
            if(Array.isArray(chunk.value?.items)) items.push(...chunk.value.items);
          }
        }finally{
          try{reader.releaseLock?.();}catch{/* no-op */}
        }
        return items;
      }
    }
  }catch{
    // Fall through to the standard pdf.js method.
  }

  const content=await page.getTextContent();
  return Array.isArray(content?.items)?content.items as TextItemLike[]:[];
}

export async function extractPdfFile(file:File,onProgress?:(page:number,total:number)=>void):Promise<PdfExtractedDocument>{
  const buffer=await file.arrayBuffer();
  const hash=await fingerprint(buffer);
  // webpack.mjs configures the worker bundle for webpack-compatible builds, including Next.js production builds.
  const pdfjs=await import('pdfjs-dist/webpack.mjs');
  const pdf=await pdfjs.getDocument({data:new Uint8Array(buffer)}).promise;
  const pages:PdfExtractedPage[]=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const items=await getTextItemsCompat(page);
    const lines=buildLines(items);
    pages.push({page:p,lines,text:lines.join('\n')});
    onProgress?.(p,pdf.numPages);
  }
  return {name:file.name,size:file.size,fingerprint:hash,pages};
}