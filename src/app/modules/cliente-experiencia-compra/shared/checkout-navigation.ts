import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
@Injectable({providedIn:'root'})
export class CheckoutNavigation {
  private readonly document=inject(DOCUMENT);
  private readonly router=inject(Router);
  open(pago:{idPago:number;checkoutUrl?:string|null}):void{
    if(!pago.checkoutUrl){void this.router.navigate(['/tienda/pago',pago.idPago]);return;}
    const url=new URL(pago.checkoutUrl);
    if(url.origin!=='https://checkout.stripe.com'||url.username||url.password)throw new Error('invalid_checkout');
    const browser=this.document.defaultView;
    if(!browser)throw new Error('browser_required');
    browser.location.assign(url.href);
  }
}
