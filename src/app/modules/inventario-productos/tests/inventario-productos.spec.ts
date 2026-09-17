import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { apiInterceptor } from '../../../core/interceptors/api.interceptor';
import { InventarioProductosService } from '../shared/inventario-productos.service';
import { Product, InventoryReferences, ProductSummary } from '../shared/models';
import { ReferenciasPage } from '../cu18-gestionar-catalogo/pages/referencias';
import { ProductosPage } from '../cu18-gestionar-catalogo/pages/productos';
import { InventarioPage } from '../cu20-gestionar-inventario/pages/inventario';
import { catalogAdminGuard } from '../shared/admin-only.guard';
import { AuthService } from '../../seguridad-accesos/services/auth.service';
import { CU18_ROUTES } from '../cu18-gestionar-catalogo/routes/cu18.routes';
import { CU19_ROUTES } from '../cu19-gestionar-proveedores/routes/cu19.routes';
import { CU20_ROUTES } from '../cu20-gestionar-inventario/routes/cu20.routes';

const refs=Object.fromEntries(['categorias','marcas','colecciones','proveedores','tallas','colores','temporadas','promociones'].map(k=>[k,[{id:1,nombre:k}]]));
const product:Product={idProd:'Prod-test',descripcion:'Camisa',estado:'activo',idCat:1,idMarca:1,idCol:1,idProv:1,idPromo:null,
  variantes:[{idVariante:'Var-1',sku:'CAM-1',precio:25,estado:'activo',img:null,idTalla:1,idColores:[1]}]};
const summary:ProductSummary={idProd:'Prod-test',descripcion:'Camisa',estado:'activo',categoria:'Camisas',marca:'Andes',coleccion:'Verano',proveedor:'Prov',totalVariantes:1};
const inventoryRefs:InventoryReferences={sucursales:[{id:1,nombre:'Central'}],variantes:[{id:'Var-1',nombre:'Camisa M · CAM-1'}],categorias:[],tallas:[],colores:[],sucursalAsignada:null};
const empty={items:[],total:0,offset:0,limit:20};

describe('CU18 CU19 CU20 formularios',()=>{
  const uploadImage = vi.fn();
  const service={listGroup:vi.fn(),saveGroup:vi.fn(),deleteGroup:vi.fn(),references:vi.fn(),products:vi.fn(),product:vi.fn(),saveProduct:vi.fn(),deleteProduct:vi.fn(),inventory:vi.fn(),inventoryReferences:vi.fn(),registerMovement:vi.fn(),movements:vi.fn()};
  function setup(kind='tallas'){
    for(const mock of Object.values(service))mock.mockReset();
    uploadImage.mockReset(); Object.assign(service, {uploadImage});
    service.listGroup.mockReturnValue(of(empty));service.saveGroup.mockReturnValue(of({id:1,descripcion:'M'}));service.deleteGroup.mockReturnValue(of(undefined));
    service.references.mockReturnValue(of(refs));service.products.mockReturnValue(of({...empty,items:[summary],total:1}));service.product.mockReturnValue(of(product));service.saveProduct.mockReturnValue(of(product));
    service.inventory.mockReturnValue(of(empty));service.inventoryReferences.mockReturnValue(of(inventoryRefs));service.registerMovement.mockReturnValue(of({nroInv:1,stock:10,cantDisp:10,mensaje:'Movimiento registrado correctamente'}));service.movements.mockReturnValue(of(empty));
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{data:{kind}}}},{provide:InventarioProductosService,useValue:service}]});
  }
  it('sube la imagen y bloquea guardar durante la subida',()=>{
    setup(); const pending = new Subject<{url:string;publicId:string}>(); uploadImage.mockReturnValue(pending);
    const fixture = TestBed.createComponent(ProductosPage); fixture.detectChanges(); const page = fixture.componentInstance; page.edit(summary);
    const file = new File(['image'], 'image.png', {type:'image/png'});
    page.uploadImage(0, {target:{files:[file],value:'image.png'}} as unknown as Event);
    page.save(); expect(service.saveProduct).not.toHaveBeenCalled(); expect(page.uploading()).toBe(0);
    page.removeVariant(0); expect(page.form.controls.variantes.length).toBe(1);
    const url = 'https://res.cloudinary.com/test/image/upload/image.png';
    pending.next({url,publicId:'test'}); pending.complete(); fixture.detectChanges();
    expect(page.uploading()).toBeNull(); expect(page.form.controls.variantes.at(0).controls.img.value).toBe(url);
    expect(fixture.nativeElement.querySelector('.image-preview').src).toBe(url);
    page.save(); expect(service.saveProduct.mock.calls[0][0].variantes[0].img).toBe(url);
  });
  it('rechaza archivos no permitidos y conserva la imagen ante error del proveedor',()=>{
    setup(); const fixture = TestBed.createComponent(ProductosPage); fixture.detectChanges(); const page = fixture.componentInstance; page.edit(summary);
    page.uploadImage(0, {target:{files:[new File(['svg'],'x.svg',{type:'image/svg+xml'})],value:''}} as unknown as Event);
    expect(uploadImage).not.toHaveBeenCalled();
    page.form.controls.variantes.at(0).controls.img.setValue('https://example.com/old.png');
    uploadImage.mockReturnValue(throwError(()=>new HttpErrorResponse({status:502,error:{error:{message:'No se pudo subir la imagen'}}})));
    page.uploadImage(0, {target:{files:[new File(['png'],'x.png',{type:'image/png'})],value:''}} as unknown as Event);
    expect(page.form.controls.variantes.at(0).controls.img.value).toBe('https://example.com/old.png');
    expect(page.uploading()).toBeNull(); expect(page.imageMessage()).toBe(''); expect(page.error()).toContain('No se pudo subir');
  });
  it('resalta campos obligatorios sin enviar una talla vacía',()=>{
    setup();const fixture=TestBed.createComponent(ReferenciasPage);fixture.detectChanges();const page=fixture.componentInstance;page.edit();page.save();fixture.detectChanges();
    expect(service.saveGroup).not.toHaveBeenCalled();expect(fixture.nativeElement.querySelector('.field-error')).toBeTruthy();
    page.form.controls.descripcion.setValue('M');page.save();expect(service.saveGroup).toHaveBeenCalledWith('tallas',{descripcion:'M'},undefined);
    expect(page.success()).toContain('Guardado correctamente');
  });
  it('guarda temporadas como enlaces de colección',()=>{
    setup('colecciones');const fixture=TestBed.createComponent(ReferenciasPage);fixture.detectChanges();const page=fixture.componentInstance;page.edit();
    page.form.patchValue({descripcion:'Verano',idTemps:['1']});page.save();expect(service.saveGroup).toHaveBeenCalledWith('colecciones',{descripcion:'Verano',idTemps:[1]},undefined);
  });
  it('valida correo del proveedor y no envía campos ajenos',()=>{
    setup('proveedores');const fixture=TestBed.createComponent(ReferenciasPage);fixture.detectChanges();const page=fixture.componentInstance;page.edit();
    page.form.patchValue({nombre:'Prov',correo:'invalido',telefono:'123',direccion:'Calle'});page.save();expect(service.saveGroup).not.toHaveBeenCalled();
    page.form.controls.correo.setValue('prov@example.com');page.save();expect(service.saveGroup).toHaveBeenCalledWith('proveedores',{nombre:'Prov',correo:'prov@example.com',direccion:'Calle',telefono:'123'},undefined);
  });
  it('conserva el registro si el backend impide eliminarlo',()=>{
    setup('proveedores');const fixture=TestBed.createComponent(ReferenciasPage);fixture.detectChanges();const page=fixture.componentInstance;
    service.deleteGroup.mockReturnValue(throwError(()=>new HttpErrorResponse({status:409,error:{error:{message:'Tiene productos asociados'}}})));
    page.confirm.set({id:1,nombre:'Prov'});page.remove();expect(page.confirm()?.id).toBe(1);expect(page.success()).toBe('');expect(page.error()).toContain('productos asociados');
  });
  it('edita productos con sus variantes, sin enviar código de producto en el cuerpo',()=>{
    setup();const fixture=TestBed.createComponent(ProductosPage);fixture.detectChanges();const page=fixture.componentInstance;page.edit(summary);fixture.detectChanges();
    expect(page.form.controls.variantes.length).toBe(1);expect(fixture.nativeElement.querySelector('#product-id').readOnly).toBe(true);
    page.form.controls.descripcion.setValue('Camisa editada');page.save();
    expect(service.saveProduct).toHaveBeenCalledWith(expect.objectContaining({descripcion:'Camisa editada',variantes:[expect.objectContaining({idVariante:'Var-1',sku:'CAM-1',idColores:[1]})]}),'Prod-test');
    expect(service.saveProduct.mock.calls[0][0].idProd).toBeUndefined();expect(page.success()).toContain('guardada correctamente');
  });
  it('filtra colecciones por temporada sin guardarla directamente en producto',()=>{
    setup();service.references.mockReturnValue(of({...refs,colecciones:[{id:1,nombre:'Verano',idTemps:[1]},{id:2,nombre:'Invierno',idTemps:[2]}]}));
    const fixture=TestBed.createComponent(ProductosPage);fixture.detectChanges();const page=fixture.componentInstance;page.edit(summary);
    page.form.controls.idTemp.setValue(1);page.seasonChanged();expect(page.choices('colecciones').map(c=>c.id)).toEqual([1]);
    page.save();expect(service.saveProduct.mock.calls[0][0].idTemp).toBeUndefined();
    page.form.controls.idTemp.setValue(2);page.seasonChanged();expect(page.form.controls.idCol.value).toBeNull();
  });
  it('impide SKU repetido dentro de la misma prenda',()=>{
    setup();const fixture=TestBed.createComponent(ProductosPage);fixture.detectChanges();const page=fixture.componentInstance;page.edit(summary);
    page.form.controls.variantes.push(page.variantForm({...product.variantes[0],idVariante:null}));page.save();
    expect(service.saveProduct).not.toHaveBeenCalled();expect(page.error()).toContain('SKU diferente');
  });
  it('una variante incompleta no se envía y quitar una nunca elimina todas',()=>{
    setup();const fixture=TestBed.createComponent(ProductosPage);fixture.detectChanges();const page=fixture.componentInstance;page.newProduct();page.save();
    expect(service.saveProduct).not.toHaveBeenCalled();page.removeVariant(0);expect(page.form.controls.variantes.length).toBe(1);
  });
  it('fija la sucursal del encargado y registra ajustes con dirección explícita',()=>{
    setup();service.inventoryReferences.mockReturnValue(of({...inventoryRefs,sucursalAsignada:1}));
    const fixture=TestBed.createComponent(InventarioPage);fixture.detectChanges();const page=fixture.componentInstance;
    expect(page.form.controls.nroSuc.disabled).toBe(true);expect(page.filters.controls.nroSuc.disabled).toBe(true);page.newMovement();
    page.form.patchValue({idVariante:'Var-1',tipoMov:'ajuste',cantidad:2,motivo:'Conteo físico',ajusteDireccion:'disminuir'});page.save();
    expect(service.registerMovement).toHaveBeenCalledWith({nroSuc:1,idVariante:'Var-1',tipoMov:'ajuste',cantidad:2,motivo:'Conteo físico',ajusteDireccion:'disminuir'});
  });
  it('inventario requiere cantidad positiva y motivo, sin éxito falso ante rechazo',()=>{
    setup();const fixture=TestBed.createComponent(InventarioPage);fixture.detectChanges();const page=fixture.componentInstance;page.newMovement();page.form.patchValue({nroSuc:1,idVariante:'Var-1',cantidad:0,motivo:''});page.save();
    expect(service.registerMovement).not.toHaveBeenCalled();service.registerMovement.mockReturnValue(throwError(()=>new HttpErrorResponse({status:409,error:{error:{message:'Stock insuficiente'}}})));
    page.form.patchValue({cantidad:20,motivo:'Merma',tipoMov:'salida'});page.save();expect(page.success()).toBe('');expect(page.editor()).toBe(true);expect(page.error()).toContain('Stock insuficiente');
  });
  it('las rutas incluyen productos, todos los paneles y permisos',()=>{
    expect(CU18_ROUTES.map(r=>r.path)).toEqual(['','productos','tallas','colores','colecciones','temporadas','categorias','marcas']);
    expect(CU18_ROUTES.find(r=>r.path==='productos')?.canActivate?.length).toBe(2);expect(CU19_ROUTES[0].data?.['kind']).toBe('proveedores');expect(CU20_ROUTES[0].canActivate?.length).toBe(1);
  });
  it('no permite al empleado acceder al formulario de administrador',()=>{
    setup();const session=signal({usuario:{tipo:'E'}});TestBed.overrideProvider(AuthService,{useValue:{session}});
    expect(TestBed.runInInjectionContext(()=>catalogAdminGuard({} as never,{} as never))).not.toBe(true);
    session.set({usuario:{tipo:'A'}});expect(TestBed.runInInjectionContext(()=>catalogAdminGuard({} as never,{} as never))).toBe(true);
  });
});

describe('CU18 CU19 CU20 transporte HTTP',()=>{
  let service:InventarioProductosService;let http:HttpTestingController;
  beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(withInterceptors([apiInterceptor])),provideHttpClientTesting()]});service=TestBed.inject(InventarioProductosService);http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());
  it('proveedores usa la ruta de CU19, cookie y defensa CSRF',()=>{
    service.saveGroup('proveedores',{nombre:'Prov'}).subscribe();const request=http.expectOne('/api/admin/proveedores');
    expect(request.request.method).toBe('POST');expect(request.request.withCredentials).toBe(true);expect(request.request.headers.get('X-CSRF-Protection')).toBe('1');request.flush({id:1,nombre:'Prov'});
  });
  it('inventario envía filtros y registra un único movimiento',()=>{
    service.inventory({offset:0,limit:20,nroSuc:1,idColor:2}).subscribe();http.expectOne('/api/admin/inventario?offset=0&limit=20&nroSuc=1&idColor=2').flush(empty);
    service.registerMovement({nroSuc:1,idVariante:'Var-1',tipoMov:'entrada',cantidad:2,motivo:'Recepción'}).subscribe();const request=http.expectOne('/api/admin/inventario/movimientos');expect(request.request.method).toBe('POST');request.flush({nroInv:1,stock:2,cantDisp:2,mensaje:'Registrado'});
  });
  it('codifica el identificador y evita transfer cache en producto',()=>{
    service.product('Prod/a').subscribe();const request=http.expectOne('/api/admin/catalogo/productos/Prod%2Fa');expect(request.request.transferCache).toBe(false);request.flush(product);
  });
});

describe('Inventario y productos SSR',()=>{
  it('no consulta datos privados en el servidor',()=>{
    TestBed.configureTestingModule({providers:[{provide:PLATFORM_ID,useValue:'server'},provideHttpClient(),provideHttpClientTesting()]});
    const service=TestBed.inject(InventarioProductosService);service.products({}).subscribe();service.inventory({}).subscribe();service.references().subscribe();
    TestBed.inject(HttpTestingController).expectNone(()=>true);
  });
});
