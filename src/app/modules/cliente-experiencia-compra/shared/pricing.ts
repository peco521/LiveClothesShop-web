// Display estimates only. Checkout totals always come from the backend.
type Promotion = {tipoDescuento:string;valorDescuento:number|string} | null;
function decimal(value:number|string):[bigint,bigint]|null{
  const text=String(value),parts=text.match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if(!parts)return null;
  const fraction=parts[2]??'';return [BigInt(parts[1]+fraction),10n**BigInt(fraction.length)];
}
function rounded(n:bigint,d:bigint):bigint{return n/d+(n%d*2n>=d?1n:0n);}
export function priceQuote(value:number|string,promotion:Promotion){
  const parsed=decimal(value);const base=parsed?rounded(parsed[0]*100n,parsed[1]):0n;
  const amount=promotion?decimal(promotion.valorDescuento):null;
  let off=0n;
  if(amount&&promotion){
    if(promotion.tipoDescuento==='porcentaje')off=rounded(base*amount[0],amount[1]*100n);
    else if(promotion.tipoDescuento==='montoFijo')off=rounded(amount[0]*100n,amount[1]);
  }
  if(off>base)off=base;
  return {base:Number(base)/100,total:Number(base-off)/100,discount:Number(off)/100,
    percent:base>0n?Math.round(Number(off)*1000/Number(base))/10:0};
}
export function money(value:number|string):string{
  return new Intl.NumberFormat('es-BO',{style:'currency',currency:'USD',currencyDisplay:'code'}).format(Number(value));
}
export function cartQuote(items:readonly {precio:number|string;promocion:Promotion;cantidad:number}[]){
  let base=0,discount=0;
  for(const item of items){const quote=priceQuote(item.precio,item.promocion);base+=Math.round(quote.base*100)*item.cantidad;discount+=Math.round(quote.discount*100)*item.cantidad;}
  return {base:base/100,discount:discount/100,total:(base-discount)/100};
}
