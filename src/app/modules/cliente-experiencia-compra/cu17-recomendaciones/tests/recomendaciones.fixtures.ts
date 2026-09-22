import { RecomendacionesRespuesta } from '../models/recomendacion.models';

export const personalizada: RecomendacionesRespuesta = {
  tipo: 'personalizada',
  mensaje: 'Seleccionamos estas poleras según tus compras, reservas y productos de interés.',
  total: 2,
  items: [
    { idProd: 'prod-001', descripcion: 'Polera Nike Pro',
      categoria: { idCat: 1, descripcion: 'Deportiva' }, marca: { idMarca: 1, nombre: 'Nike' },
      coleccion: { idCol: 1, descripcion: 'Verano' },
      promocion: { idPromo: 1, nombre: 'Promo', tipoDescuento: 'porcentaje', valorDescuento: 10 },
      precioMin: 45, precioMax: 45, imagen: 'http://img/1.jpg', disponible: true, totalVariantes: 1,
      score: 11,
      razones: ['Similar a los modelos de polera que prefieres', 'Marca frecuente en tus interacciones'] },
    { idProd: 'prod-002', descripcion: 'Polera Adidas Run',
      categoria: { idCat: 1, descripcion: 'Deportiva' }, marca: { idMarca: 2, nombre: 'Adidas' },
      coleccion: { idCol: 1, descripcion: 'Verano' }, promocion: null,
      precioMin: 50, precioMax: 80, imagen: null, disponible: true, totalVariantes: 2,
      score: 6, razones: ['Precio dentro de tu rango habitual'] },
  ],
};

export const general: RecomendacionesRespuesta = {
  tipo: 'general',
  mensaje: 'Todavía estamos conociendo tus gustos. Estas son algunas poleras populares que podrían interesarte.',
  total: 1,
  items: [
    { idProd: 'prod-003', descripcion: 'Polera Nike Formal',
      categoria: { idCat: 2, descripcion: 'Semi-Formal' }, marca: { idMarca: 1, nombre: 'Nike' },
      coleccion: { idCol: 2, descripcion: 'Invierno' }, promocion: null,
      precioMin: 120, precioMax: 120, imagen: null, disponible: true, totalVariantes: 1,
      score: 2, razones: ['Popular entre los clientes'] },
  ],
};

export const vacia: RecomendacionesRespuesta = {
  tipo: 'general',
  mensaje: 'Todavía estamos conociendo tus gustos. Estas son algunas poleras populares que podrían interesarte.',
  total: 0,
  items: [],
};
