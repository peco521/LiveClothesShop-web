import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { EstadoPagoPage } from '../pages/estado-pago/estado-pago';
import { PagosService } from '../services/pagos.service';
import { ComprasService } from '../../cu13-compra-digital/services/compras.service';

describe('Estado pago: reintento de sandbox explícito',()=>{
  const payment={idPago:7,nroVenta:9,estado:'pendiente',metodo:'tarjeta',monto:'20.00',estadoVenta:'registrada'};
  const service={configuracion:vi.fn(),detalle:vi.fn(),procesar:vi.fn(),reconciliar:vi.fn()};
  beforeEach(()=>{
    service.configuracion.mockReset().mockReturnValue(of({proveedor:'mock',simulacion:true,disponible:true}));
    service.detalle.mockReset().mockReturnValue(of(payment));
    service.procesar.mockReset().mockReturnValue(of({...payment,estado:'aprobado'}));
    TestBed.configureTestingModule({providers:[provideRouter([]),
      {provide:ActivatedRoute,useValue:{paramMap:of(convertToParamMap({id:'7'}))}},
      {provide:PagosService,useValue:service},{provide:ComprasService,useValue:{}}]});
  });
  it('reprocesa mismo identificador, no crea venta ni pago nuevos',()=>{
    const fixture=TestBed.createComponent(EstadoPagoPage);fixture.detectChanges();
    const page=fixture.componentInstance;page.reprocesarSimulacion();
    expect(service.procesar).toHaveBeenCalledExactlyOnceWith(7,'aprobado');
    expect(page.pago()?.estado).toBe('aprobado');
    page.reprocesarSimulacion();expect(service.procesar).toHaveBeenCalledTimes(1);
  });
  it('Stripe no muestra ni permite resolver un resultado desde el cliente',()=>{
    service.configuracion.mockReturnValue(of({proveedor:'stripe',simulacion:false,disponible:true}));
    const fixture=TestBed.createComponent(EstadoPagoPage);fixture.detectChanges();
    fixture.componentInstance.reprocesarSimulacion();
    expect(service.procesar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Reintentar pago simulado');
  });
  it('evita doble envío mientras el resultado está en curso',()=>{
    const pending=new Subject<never>();service.procesar.mockReturnValue(pending);
    const fixture=TestBed.createComponent(EstadoPagoPage);fixture.detectChanges();
    fixture.componentInstance.reprocesarSimulacion();fixture.componentInstance.reprocesarSimulacion();
    expect(service.procesar).toHaveBeenCalledTimes(1);pending.complete();
  });
});
